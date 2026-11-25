"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

type User = { uid: string; displayName: string };
type Message = { senderId: string; text: string; createdAt: number };
type Course = { id: string; name: string; code: string; lecturer: string; schedule: string; zoomUrl?: string; createdAt: number };
type DashboardView = "overview" | "courses" | "chats" | "zoom";
type Session = {
  uid: string;
  email: string;
  displayName: string;
  token: string;
  refreshToken?: string;
};

async function authorizedFetch(
  session: Session,
  input: RequestInfo | URL,
  init: RequestInit,
  onRefresh: (session: Session) => void,
  onExpired: () => void,
) {
  const first = await fetch(input, init);
  if (first.status !== 401) return first;
  if (!session.refreshToken) {
    onExpired();
    return first;
  }
  const refreshResponse = await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "refresh", refreshToken: session.refreshToken }),
  });
  if (!refreshResponse.ok) {
    onExpired();
    return first;
  }
  const tokens = await refreshResponse.json();
  const updated = { ...session, token: tokens.token, refreshToken: tokens.refreshToken };
  onRefresh(updated);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${updated.token}`);
  return fetch(input, { ...init, headers });
}

export default function DashboardClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messageMap = useRef<Record<string, Message>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [courseError, setCourseError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const initials = (name: string) =>
    name.trim().slice(0, 1).toUpperCase() || "?";

  useEffect(() => {
    const stored = sessionStorage.getItem("clh-session");
    if (stored) {
      try {
        const restored = JSON.parse(stored) as Session;
        if (!restored.refreshToken) {
          sessionStorage.removeItem("clh-session");
          setError("Sesi lama berakhir. Silakan masuk kembali.");
        } else {
          setSession(restored);
        }
      } catch {
        sessionStorage.removeItem("clh-session");
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    authorizedFetch(
      session,
      "/api/chat?users=1",
      { headers: { authorization: `Bearer ${session.token}` } },
      (updated) => {
        sessionStorage.setItem("clh-session", JSON.stringify(updated));
        setSession(updated);
      },
      logout,
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      })
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    authorizedFetch(
      session,
      "/api/courses",
      { headers: { authorization: `Bearer ${session.token}` } },
      updateSession,
      logout,
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Mata kuliah gagal dimuat.");
        return data as Course[];
      })
      .then(setCourses)
      .catch((e) => setCourseError(e.message));
  }, [session]);

  useEffect(() => {
    if (!session || !selected) {
      messageMap.current = {};
      setMessages([]);
      return;
    }
    messageMap.current = {};
    setMessages([]);
    const controller = new AbortController();
    const apply = (eventName: string, payload: string) => {
      try {
        if (eventName !== "put" && eventName !== "patch") return;
        const value = JSON.parse(payload) as {
          path: string;
          data: Record<string, Message> | Message | null;
        };
        if (value.path !== "/" && !value.path.startsWith("/")) return;
        if (value.path === "/")
          messageMap.current =
            (value.data as Record<string, Message> | null) || {};
        else {
          const key = value.path.split("/").filter(Boolean)[0];
          if (key && value.data && typeof value.data === "object")
            messageMap.current[key] = value.data as Message;
          else if (key && value.data === null) delete messageMap.current[key];
        }
        setMessages(
          Object.values(messageMap.current)
            .filter((m) => !!m && typeof m.text === "string")
            .sort((a, b) => a.createdAt - b.createdAt),
        );
      } catch {
        /* ignore keep-alive or malformed event */
      }
    };
    (async () => {
      try {
        const response = await authorizedFetch(
          session,
          `/api/chat?peer=${encodeURIComponent(selected.uid)}`,
          {
            headers: { authorization: `Bearer ${session.token}` },
            signal: controller.signal,
          },
          (updated) => {
            sessionStorage.setItem("clh-session", JSON.stringify(updated));
            setSession(updated);
          },
          logout,
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Koneksi chat gagal.");
        }
        if (!response.body) throw new Error("Koneksi chat gagal.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";
          for (const block of blocks) {
            const eventName = block.match(/^event:\s*(.+)$/m)?.[1] || "message";
            const payload = block.match(/^data:\s*(.+)$/m)?.[1];
            if (payload) apply(eventName, payload);
          }
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Koneksi chat terputus.");
      }
    })();
    return () => controller.abort();
  }, [session, selected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!session || !selected || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedFetch(
        session,
        "/api/chat",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ peer: selected.uid, text }),
        },
        (updated) => {
          sessionStorage.setItem("clh-session", JSON.stringify(updated));
          setSession(updated);
        },
        logout,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pesan gagal dikirim.");
    } finally {
      setBusy(false);
    }
  }

  function updateSession(updated: Session) {
    sessionStorage.setItem("clh-session", JSON.stringify(updated));
    setSession(updated);
  }

  async function findContact() {
    if (!session || !usernameInput.trim()) return;
    setBusy(true);
    setUsernameMessage("");
    try {
      const response = await authorizedFetch(
        session,
        `/api/contacts?username=${encodeURIComponent(usernameInput)}`,
        { headers: { authorization: `Bearer ${session.token}` } },
        updateSession,
        logout,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pengguna tidak ditemukan.");
      if (data.uid === session.uid) throw new Error("Username itu milik akun kamu.");
      const contact = data as User;
      setUsers((current) => [contact, ...current.filter((item) => item.uid !== contact.uid)]);
      setSelected(contact);
      setActiveView("chats");
      setUsernameModalOpen(false);
      setUsernameInput("");
      setError("");
    } catch (e) {
      setUsernameMessage(e instanceof Error ? e.message : "Pencarian gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMyUsername() {
    if (!session || !usernameInput.trim()) return;
    setBusy(true);
    setUsernameMessage("");
    try {
      const response = await authorizedFetch(
        session,
        "/api/contacts",
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ username: usernameInput }),
        },
        updateSession,
        logout,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Username gagal disimpan.");
      setUsernameMessage(`Username akunmu sekarang @${data.username}. Teman bisa menambahkanmu lewat username ini.`);
    } catch (e) {
      setUsernameMessage(e instanceof Error ? e.message : "Username gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function addCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setCourseError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(
        session,
        "/api/courses",
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` },
          body: JSON.stringify({
            name: form.get("courseName"),
            code: form.get("courseCode"),
            lecturer: form.get("lecturer"),
            schedule: form.get("schedule"),
            zoomUrl: form.get("zoomUrl"),
          }),
        },
        updateSession,
        logout,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mata kuliah gagal disimpan.");
      setCourses((current) => [...current, data as Course].sort((a, b) => a.name.localeCompare(b.name, "id")));
      setCourseModalOpen(false);
    } catch (e) {
      setCourseError(e instanceof Error ? e.message : "Mata kuliah gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourse(id: string) {
    if (!session) return;
    setCourseError("");
    try {
      const response = await authorizedFetch(
        session,
        `/api/courses?id=${encodeURIComponent(id)}`,
        { method: "DELETE", headers: { authorization: `Bearer ${session.token}` } },
        updateSession,
        logout,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mata kuliah gagal dihapus.");
      setCourses((current) => current.filter((course) => course.id !== id));
    } catch (e) {
      setCourseError(e instanceof Error ? e.message : "Mata kuliah gagal dihapus.");
    }
  }

  function logout() {
    sessionStorage.removeItem("clh-session");
    setSession(null);
    setSelected(null);
    setUsers([]);
  }

  if (!session) {
    if (ready) router.replace("/");
    return <main className="loading-screen" aria-label="Memuat dashboard" />;
  }

  return (
    <motion.main className="min-h-screen bg-mist text-hitamdov lg:flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <motion.aside className="z-20 flex w-full flex-col border-b border-mistline bg-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:border-r" initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.35 }}>
        <Link href="/dashboard" className="flex items-center gap-3 px-5 py-4 lg:px-6 lg:py-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-hitamdov font-semibold text-white shadow-lg shadow-hitamdov/15">C</span>
          <span className="text-lg font-semibold tracking-tight">campus<span className="font-normal text-biruabu">link</span></span>
          <span className="ml-auto rounded-full bg-cyanterang/60 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-abubiru lg:hidden">STUDENT HUB</span>
        </Link>

        <div className="mx-4 hidden items-center gap-3 rounded-2xl bg-mist p-3 lg:flex">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-abubiru to-biruabu text-sm font-semibold text-white">{initials(session.displayName)}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{session.displayName}</p><p className="truncate text-[10px] text-biruabu">{session.email}</p></div>
          <button onClick={logout} title="Keluar" className="rounded-lg p-2 text-biruabu transition hover:bg-white hover:text-hitamdov">↗</button>
        </div>

        <div className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-4 lg:pb-0 lg:pt-7">
          <p className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-biruabu lg:block">Menu utama</p>
          {([
            ["overview", "▦", "Ringkasan"],
            ["courses", "▤", "Mata kuliah"],
            ["chats", "◌", "Chat"],
            ["zoom", "↗", "Rapat Zoom"],
          ] as const).map(([view, icon, label]) => (
            <button key={view} onClick={() => setActiveView(view)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition sm:text-sm ${activeView === view ? "bg-cyanterang/55 text-abubiru" : "text-biruabu hover:bg-mist hover:text-hitamdov"}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-lg text-base ${activeView === view ? "bg-white text-abubiru shadow-sm" : "bg-transparent text-biruabu"}`}>{icon}</span>{label}
              {view === "chats" && users.length > 0 && <span className="ml-auto hidden rounded-full bg-abubiru px-2 py-0.5 text-[10px] text-white lg:inline-flex">{users.length}</span>}
            </button>
          ))}
        </div>

        <div className="hidden px-4 pt-8 lg:block">
          <div className="mb-2 flex items-center justify-between px-3"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-biruabu">Mata kuliah</p><button onClick={() => { setCourseError(""); setCourseModalOpen(true); }} className="rounded-lg px-2 py-1 text-lg leading-none text-biruabu transition hover:bg-cyanterang/50 hover:text-abubiru" aria-label="Tambah mata kuliah">＋</button></div>
          <div className="space-y-1">
            {courses.slice(0, 5).map((course) => <button key={course.id} onClick={() => setActiveView("courses")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-mist"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyanterang/50 text-sm text-abubiru">▤</span><span className="min-w-0"><span className="block truncate text-xs font-medium text-hitamdov">{course.name}</span><span className="block truncate text-[10px] text-biruabu">{course.code || course.schedule || "Mata kuliah"}</span></span></button>)}
            {courses.length === 0 && <p className="px-3 py-2 text-xs leading-5 text-biruabu">Mata kuliahmu akan muncul di sini.</p>}
          </div>
        </div>

        <div className="mt-auto hidden space-y-1 border-t border-mistline p-4 lg:block">
          <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-biruabu transition hover:bg-mist hover:text-hitamdov"><span className="grid h-7 w-7 place-items-center rounded-lg bg-mist">◉</span>Profil</Link>
          <div className="flex items-center gap-2 px-3 pt-2 text-[10px] text-biruabu"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Terhubung dengan aman</div>
        </div>
        <div className="flex items-center justify-between border-t border-mistline px-5 py-2.5 lg:hidden">
          <span className="max-w-[55%] truncate text-xs font-medium">{session.displayName}</span><Link href="/profile" className="text-xs font-semibold text-abubiru">Edit profil →</Link><button onClick={logout} className="text-xs text-biruabu">Keluar</button>
        </div>
      </motion.aside>

      <section className="min-w-0 flex-1 px-4 pb-10 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pt-8 xl:px-12">
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-biruabu sm:text-xs">Campus Learning Hub</p><p className="mt-1 text-xs text-biruabu sm:text-sm">Ruang belajar dan kolaborasi kamu</p></div>
          <Link href="/profile" className="hidden items-center gap-2 rounded-full border border-mistline bg-white py-1.5 pl-1.5 pr-4 text-xs font-medium text-hitamdov shadow-sm transition hover:border-biruabu/40 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-full bg-cyanterang/70 font-semibold text-abubiru">{initials(session.displayName)}</span>{session.displayName}</Link>
        </header>

        <AnimatePresence mode="wait">
          {activeView === "overview" && <motion.div key="overview" className="mx-auto max-w-7xl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
            <div className="mt-7 flex flex-col justify-between gap-4 sm:mt-10 sm:flex-row sm:items-end"><div><p className="text-sm text-biruabu sm:text-base">Selamat datang kembali,</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{session.displayName} <span className="text-coral">✦</span></h1></div><button onClick={() => { setCourseError(""); setCourseModalOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-abubiru px-4 text-xs font-semibold text-white shadow-lg shadow-abubiru/15 transition hover:-translate-y-0.5 hover:bg-hitamdov sm:self-auto sm:text-sm">＋ Tambah mata kuliah</button></div>

            <motion.div className="mt-6 overflow-hidden rounded-3xl bg-hitamdov p-5 text-white shadow-xl shadow-hitamdov/10 sm:mt-8 sm:p-8 lg:p-9" initial={{ scale: 0.985 }} animate={{ scale: 1 }} transition={{ duration: 0.35 }}>
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div className="max-w-xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-cyanterang"><span className="h-1.5 w-1.5 rounded-full bg-cyanterang" />Ruang belajarmu</span><h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">Semua kegiatan kampus dalam satu tempat.</h2><p className="mt-2 text-xs leading-5 text-white/60 sm:text-sm sm:leading-6">Atur mata kuliah, mulai percakapan, dan gabung rapat dengan mudah.</p></div><div className="flex shrink-0 gap-2"><button onClick={() => setActiveView("chats")} className="rounded-xl bg-cyanterang px-4 py-2.5 text-xs font-semibold text-hitamdov transition hover:bg-white sm:text-sm">Buka chat</button><button onClick={() => setActiveView("courses")} className="rounded-xl border border-white/20 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 sm:text-sm">Lihat kelas</button></div></div>
            </motion.div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-4">
              {[["Mata kuliah", courses.length, "▤"], ["Teman chat", users.length, "◌"], ["Link Zoom", courses.filter((course) => course.zoomUrl).length, "↗"], ["Status akun", "Aktif", "✓"]].map(([label, value, icon], i) => <motion.div key={String(label)} className="rounded-2xl border border-mistline bg-white p-4 shadow-sm sm:p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}><div className="flex items-center justify-between"><span className="text-[10px] text-biruabu sm:text-xs">{label}</span><span className="grid h-8 w-8 place-items-center rounded-xl bg-cyanterang/45 text-sm text-abubiru">{icon}</span></div><p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p></motion.div>)}
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
              <section><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">Aktivitas belajar</p><h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">Mata kuliah kamu</h2></div><button onClick={() => setActiveView("courses")} className="text-xs font-semibold text-abubiru hover:text-hitamdov">Lihat semua →</button></div>
                {courses.length ? <div className="grid gap-3 sm:grid-cols-2">{courses.slice(0, 4).map((course, index) => <motion.article key={course.id} layout className="rounded-2xl border border-mistline bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyanterang/55 text-abubiru">▤</span><button onClick={() => deleteCourse(course.id)} title={`Hapus ${course.name}`} className="rounded-lg px-2 py-1 text-biruabu hover:bg-mist hover:text-hitamdov">···</button></div><h3 className="mt-4 truncate text-sm font-semibold">{course.name}</h3><p className="mt-1 truncate text-xs text-biruabu">{[course.code, course.lecturer].filter(Boolean).join(" · ") || "Mata kuliah"}</p><div className="mt-4 flex items-center justify-between gap-2 border-t border-mistline pt-3"><span className="truncate text-[10px] text-biruabu">{course.schedule || "Jadwal belum diatur"}</span>{course.zoomUrl && <a href={course.zoomUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-cyanterang/50 px-2.5 py-1.5 text-[10px] font-semibold text-abubiru hover:bg-cyanterang">Gabung Zoom ↗</a>}</div></motion.article>)}</div> : <div className="rounded-2xl border border-dashed border-biruabu/30 bg-white px-5 py-8 text-center"><p className="text-sm font-medium">Belum ada mata kuliah</p><p className="mt-1 text-xs text-biruabu">Tambahkan kelas pertamamu untuk mulai mengatur jadwal.</p><button onClick={() => setCourseModalOpen(true)} className="mt-4 rounded-xl bg-abubiru px-4 py-2 text-xs font-semibold text-white">Tambah mata kuliah</button></div>}
              </section>
              <section><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">Tetap terhubung</p><h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">Chat terbaru</h2></div><button onClick={() => { setUsernameInput(""); setUsernameMessage(""); setUsernameModalOpen(true); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-abubiru hover:bg-cyanterang/40">＋ Tambah</button></div>
                <div className="overflow-hidden rounded-2xl border border-mistline bg-white shadow-sm">{users.slice(0, 5).map((user) => <button key={user.uid} onClick={() => { setSelected(user); setActiveView("chats"); setError(""); }} className="flex w-full items-center gap-3 border-b border-mistline px-4 py-3 text-left transition last:border-0 hover:bg-mist"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyanterang/60 text-sm font-semibold text-abubiru">{initials(user.displayName)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{user.displayName}</span><span className="mt-1 block text-[10px] text-biruabu">Pengguna CampusLink</span></span><span className="text-biruabu">›</span></button>)}{users.length === 0 && <div className="px-5 py-8 text-center"><p className="text-sm font-medium">Mulai percakapan</p><p className="mt-1 text-xs leading-5 text-biruabu">Tambahkan teman menggunakan username mereka.</p><button onClick={() => { setUsernameInput(""); setUsernameMessage(""); setUsernameModalOpen(true); }} className="mt-4 rounded-xl border border-mistline px-4 py-2 text-xs font-semibold text-abubiru hover:bg-mist">Cari teman</button></div>}</div>
              </section>
            </div>
          </motion.div>}

          {activeView === "courses" && <motion.div key="courses" className="mx-auto max-w-7xl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">Pengelolaan belajar</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Mata kuliah</h1><p className="mt-2 text-xs text-biruabu sm:text-sm">Kelas dan link rapat Zoom kamu.</p></div><button onClick={() => { setCourseError(""); setCourseModalOpen(true); }} className="rounded-xl bg-abubiru px-4 py-2.5 text-xs font-semibold text-white hover:bg-hitamdov sm:text-sm">＋ Tambah mata kuliah</button></div>{courseError && <p className="mt-4 text-xs text-red-600">{courseError}</p>}{courses.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <motion.article layout key={course.id} className="rounded-2xl border border-mistline bg-white p-5 shadow-sm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanterang/55 text-lg text-abubiru">▤</span><button onClick={() => deleteCourse(course.id)} className="rounded-lg px-2 py-1 text-biruabu hover:bg-mist" aria-label={`Hapus ${course.name}`}>×</button></div><h2 className="mt-5 text-base font-semibold">{course.name}</h2><p className="mt-1 text-xs text-biruabu">{course.code || "Kode belum diatur"}</p><div className="mt-4 space-y-2 border-t border-mistline pt-4 text-xs text-biruabu"><p>◷ {course.schedule || "Jadwal belum diatur"}</p><p>◉ {course.lecturer || "Dosen belum diatur"}</p></div>{course.zoomUrl ? <a href={course.zoomUrl} target="_blank" rel="noreferrer" className="mt-5 flex min-h-10 items-center justify-center rounded-xl bg-cyanterang/50 text-xs font-semibold text-abubiru transition hover:bg-cyanterang">Gabung rapat Zoom ↗</a> : <button onClick={() => { setCourseError("Tambahkan link Zoom dengan mengedit data mata kuliah."); }} className="mt-5 w-full rounded-xl border border-mistline py-2.5 text-xs text-biruabu">Belum ada link Zoom</button>}</motion.article>)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-biruabu/30 bg-white p-10 text-center"><p className="font-medium">Belum ada mata kuliah</p><p className="mt-2 text-sm text-biruabu">Tambah mata kuliah untuk menyimpan kelas dan link Zoom.</p></div>}</motion.div>}

          {activeView === "zoom" && <motion.div key="zoom" className="mx-auto max-w-7xl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><div className="mt-8"><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">Ruang pertemuan</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Rapat Zoom</h1><p className="mt-2 text-xs text-biruabu sm:text-sm">Link rapat yang sudah kamu simpan di tiap mata kuliah.</p></div>{courses.some((course) => course.zoomUrl) ? <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses.filter((course) => course.zoomUrl).map((course) => <motion.article key={course.id} layout className="rounded-2xl border border-mistline bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanterang/55 text-lg text-abubiru">↗</span><h2 className="mt-4 text-sm font-semibold">{course.name}</h2><p className="mt-1 text-xs text-biruabu">{course.schedule || "Jadwal belum diatur"}</p><a href={course.zoomUrl} target="_blank" rel="noreferrer" className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-abubiru text-xs font-semibold text-white transition hover:bg-hitamdov">Gabung Zoom ↗</a></motion.article>)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-biruabu/30 bg-white p-10 text-center"><p className="font-medium">Belum ada link rapat</p><p className="mt-2 text-sm text-biruabu">Simpan link Zoom ketika menambahkan mata kuliah.</p><button onClick={() => setActiveView("courses")} className="mt-4 rounded-xl border border-mistline px-4 py-2 text-xs font-semibold text-abubiru">Buka mata kuliah</button></div>}</motion.div>}

          {activeView === "chats" && <motion.div key="chats" className="mx-auto flex max-w-7xl flex-col" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><div className="mt-6 flex items-end justify-between gap-3 sm:mt-8"><div><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">Kolaborasi kampus</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Chat</h1></div><button onClick={() => { setUsernameInput(""); setUsernameMessage(""); setUsernameModalOpen(true); }} className="rounded-xl bg-abubiru px-3 py-2.5 text-xs font-semibold text-white hover:bg-hitamdov sm:px-4 sm:text-sm">＋ Tambah chat</button></div>
            <div className="mt-5 grid min-h-[62vh] overflow-hidden rounded-2xl border border-mistline bg-white shadow-sm md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="border-b border-mistline md:border-b-0 md:border-r"><div className="border-b border-mistline px-4 py-3"><p className="text-xs font-semibold">Percakapan</p><p className="mt-1 text-[10px] text-biruabu">{users.length} teman</p></div><div className="flex max-h-36 gap-2 overflow-x-auto p-2 md:max-h-[calc(62vh-56px)] md:flex-col md:overflow-y-auto">{users.map((user) => <button key={user.uid} onClick={() => { setSelected(user); setError(""); }} className={`flex min-w-44 items-center gap-3 rounded-xl p-2.5 text-left transition md:min-w-0 ${selected?.uid === user.uid ? "bg-cyanterang/50" : "hover:bg-mist"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyanterang/60 text-xs font-semibold text-abubiru">{initials(user.displayName)}</span><span className="min-w-0 flex-1 truncate text-xs font-medium">{user.displayName}</span><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></button>)}{users.length === 0 && <p className="px-3 py-4 text-xs leading-5 text-biruabu">Belum ada teman chat. Tambahkan lewat username.</p>}</div></div>
              <div className="flex min-h-[55vh] min-w-0 flex-col">{selected ? <><div className="flex items-center gap-3 border-b border-mistline px-4 py-3 sm:px-5"><span className="grid h-10 w-10 place-items-center rounded-full bg-cyanterang/60 text-sm font-semibold text-abubiru">{initials(selected.displayName)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{selected.displayName}</p><p className="mt-0.5 text-[10px] text-biruabu">Pengguna CampusLink</p></div></div><div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-mist/40 p-4 sm:p-6">{messages.length === 0 ? <div className="m-auto text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyanterang/60 text-xl text-abubiru">◌</span><p className="mt-3 text-sm font-medium">Mulai percakapan</p><p className="mt-1 text-xs text-biruabu">Kirim pesan pertama ke {selected.displayName}.</p></div> : messages.map((message, index) => <motion.div key={`${message.createdAt}-${index}`} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm sm:max-w-[70%] sm:text-sm ${message.senderId === session.uid ? "ml-auto rounded-br-md bg-abubiru text-white" : "mr-auto rounded-bl-md border border-mistline bg-white text-hitamdov"}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><p className="whitespace-pre-wrap break-words">{message.text}</p><time className={`mt-1 block text-right text-[9px] ${message.senderId === session.uid ? "text-white/60" : "text-biruabu"}`}>{new Date(message.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</time></motion.div>)}<div ref={endRef} /></div>{error && <p className="px-4 pt-2 text-xs text-red-600">{error}</p>}<form onSubmit={sendMessage} className="flex gap-2 border-t border-mistline p-3 sm:p-4"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Tulis pesan…" maxLength={2000} className="h-11 min-w-0 flex-1 rounded-xl border border-mistline bg-mist/50 px-4 text-xs outline-none transition focus:border-biruabu focus:bg-white focus:ring-4 focus:ring-cyanterang/40 sm:text-sm" /><button disabled={busy || !text.trim()} aria-label="Kirim pesan" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-abubiru text-lg text-white transition hover:bg-hitamdov disabled:opacity-40">↑</button></form></> : <div className="m-auto px-5 py-12 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyanterang/55 text-2xl text-abubiru">◌</span><h2 className="mt-4 text-base font-semibold">Pilih percakapan</h2><p className="mt-1 text-xs text-biruabu">Pilih teman atau cari username untuk mulai chat.</p></div>}</div>
            </div>
          </motion.div>}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {usernameModalOpen && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-hitamdov/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setUsernameModalOpen(false); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="relative w-full max-w-md rounded-3xl border border-mistline bg-white p-6 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="username-modal-title" initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}><button className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-lg text-biruabu hover:bg-mist" onClick={() => setUsernameModalOpen(false)} aria-label="Tutup">×</button><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanterang/60 text-xl text-abubiru">＋</span><h2 id="username-modal-title" className="mt-5 text-xl font-semibold">Tambah chat</h2><p className="mt-1 text-xs leading-5 text-biruabu">Cari teman menggunakan username CampusLink mereka.</p><label className="mt-5 grid gap-2 text-xs font-medium" htmlFor="username-search">Username<input id="username-search" className="h-11 rounded-xl border border-mistline px-3 text-sm outline-none focus:border-biruabu focus:ring-4 focus:ring-cyanterang/40" value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} placeholder="@username" maxLength={21} /></label>{usernameMessage && <p className="mt-3 text-xs leading-5 text-abubiru">{usernameMessage}</p>}<button className="mt-4 h-11 w-full rounded-xl bg-abubiru text-xs font-semibold text-white hover:bg-hitamdov disabled:opacity-50" onClick={findContact} disabled={busy || !usernameInput.trim()}>{busy ? "Memproses…" : "Cari pengguna"}</button><button className="mt-2 h-10 w-full rounded-xl text-xs font-medium text-abubiru hover:bg-mist" onClick={saveMyUsername} disabled={busy || !usernameInput.trim()}>Atur username akun saya</button><p className="mt-3 text-[10px] leading-5 text-biruabu">Username harus unik. Gunakan 3–20 karakter huruf, angka, atau garis bawah.</p></motion.section></motion.div>}
        {courseModalOpen && <motion.div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-hitamdov/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setCourseModalOpen(false); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="relative my-auto w-full max-w-lg rounded-3xl border border-mistline bg-white p-6 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="course-modal-title" initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}><button className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-lg text-biruabu hover:bg-mist" onClick={() => setCourseModalOpen(false)} aria-label="Tutup">×</button><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanterang/60 text-lg text-abubiru">▤</span><h2 id="course-modal-title" className="mt-5 text-xl font-semibold">Tambah mata kuliah</h2><p className="mt-1 text-xs text-biruabu">Simpan informasi kelas dan link rapat di sini.</p><form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={addCourse}>{[["courseName", "Nama mata kuliah", "Contoh: Pemrograman Web", true, 80], ["courseCode", "Kode mata kuliah", "Contoh: IF204", false, 24], ["lecturer", "Dosen pengampu", "Opsional", false, 80], ["schedule", "Jadwal", "Contoh: Senin, 09.00", false, 80], ["zoomUrl", "Link rapat Zoom", "https://zoom.us/j/...", false, 300]].map(([name, label, placeholder, required, max]) => <label key={String(name)} className={`grid gap-1.5 text-[11px] font-medium text-hitamdov ${name === "zoomUrl" ? "sm:col-span-2" : ""}`}>{label}<input name={String(name)} type={name === "zoomUrl" ? "url" : "text"} placeholder={String(placeholder)} required={Boolean(required)} maxLength={Number(max)} className="h-10 w-full rounded-xl border border-mistline bg-mist/40 px-3 text-xs font-normal outline-none focus:border-biruabu focus:bg-white focus:ring-4 focus:ring-cyanterang/40" /></label>)}<p className="text-[10px] leading-5 text-biruabu sm:col-span-2">Link Zoom opsional. Buat rapat di Zoom lalu tempel link undangannya.</p>{courseError && <p className="text-xs text-red-600 sm:col-span-2">{courseError}</p>}<button className="mt-1 h-11 rounded-xl bg-abubiru text-xs font-semibold text-white hover:bg-hitamdov disabled:opacity-50 sm:col-span-2" disabled={busy}>{busy ? "Menyimpan…" : "Simpan mata kuliah"}</button></form></motion.section></motion.div>}
      </AnimatePresence>
    </motion.main>
  );
}
