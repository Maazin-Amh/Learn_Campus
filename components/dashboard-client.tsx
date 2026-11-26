"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { ChatView } from "./dashboard/chat-view";
import { CoursesView } from "./dashboard/courses-view";
import { OverviewView } from "./dashboard/overview-view";
import { ZoomView } from "./dashboard/zoom-view";
import type { Course, DashboardView, Message, Session, User } from "./dashboard/types";

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
    body: JSON.stringify({
      action: "refresh",
      refreshToken: session.refreshToken,
    }),
  });
  if (!refreshResponse.ok) {
    onExpired();
    return first;
  }
  const tokens = await refreshResponse.json();
  const updated = {
    ...session,
    token: tokens.token,
    refreshToken: tokens.refreshToken,
  };
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
  const [myUsername, setMyUsername] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
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
        if (!response.ok)
          throw new Error(data.error || "Mata kuliah gagal dimuat.");
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

  async function openUsernameModal() {
    setUsernameInput("");
    setUsernameMessage("");
    setUsernameModalOpen(true);
    if (!session) return;
    setQrLoading(true);
    try {
      const response = await authorizedFetch(session, "/api/profile", { headers: { authorization: `Bearer ${session.token}` } }, updateSession, logout);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Profil gagal dimuat.");
      setMyUsername(data.username);
      setQrCodeUrl(data.username ? await QRCode.toDataURL(`@${data.username}`, { width: 220, margin: 1, color: { dark: "#15253f", light: "#ffffff" } }) : "");
    } catch (e) {
      setUsernameMessage(e instanceof Error ? e.message : "Kode QR gagal dimuat.");
    } finally { setQrLoading(false); }
  }

  function updateSession(updated: Session) {
    sessionStorage.setItem("clh-session", JSON.stringify(updated));
    setSession(updated);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!session || !selected || !text.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await authorizedFetch(session, "/api/chat", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` }, body: JSON.stringify({ peer: selected.uid, text }) }, updateSession, logout);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setText("");
    } catch (e) { setError(e instanceof Error ? e.message : "Pesan gagal dikirim."); } finally { setBusy(false); }
  }

  async function findContact() {
    if (!session || !usernameInput.trim()) return;
    setBusy(true); setUsernameMessage("");
    try {
      const response = await authorizedFetch(session, `/api/contacts?username=${encodeURIComponent(usernameInput)}`, { headers: { authorization: `Bearer ${session.token}` } }, updateSession, logout);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pengguna tidak ditemukan.");
      if (data.uid === session.uid) throw new Error("Username itu milik akun kamu.");
      const contact = data as User;
      setUsers((current) => [contact, ...current.filter((item) => item.uid !== contact.uid)]);
      setSelected(contact); setActiveView("chats"); setUsernameModalOpen(false); setUsernameInput(""); setError("");
    } catch (e) { setUsernameMessage(e instanceof Error ? e.message : "Pencarian gagal."); } finally { setBusy(false); }
  }

  async function saveMyUsername() {
    if (!session || !usernameInput.trim()) return;
    setBusy(true); setUsernameMessage("");
    try {
      const response = await authorizedFetch(session, "/api/contacts", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` }, body: JSON.stringify({ username: usernameInput }) }, updateSession, logout);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Username gagal disimpan.");
      setUsernameMessage(`Username akunmu sekarang @${data.username}. Teman bisa menambahkanmu lewat username ini.`);
      setMyUsername(data.username);
      setQrCodeUrl(await QRCode.toDataURL(`@${data.username}`, { width: 220, margin: 1, color: { dark: "#15253f", light: "#ffffff" } }));
    } catch (e) { setUsernameMessage(e instanceof Error ? e.message : "Username gagal disimpan."); } finally { setBusy(false); }
  }

  async function addCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return;
    setBusy(true); setCourseError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(session, "/api/courses", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` }, body: JSON.stringify({ name: form.get("courseName"), code: form.get("courseCode"), lecturer: form.get("lecturer"), schedule: form.get("schedule"), zoomUrl: form.get("zoomUrl") }) }, updateSession, logout);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Mata kuliah gagal disimpan.");
      setCourses((current) => [...current, data as Course].sort((a, b) => a.name.localeCompare(b.name, "id"))); setCourseModalOpen(false);
    } catch (e) { setCourseError(e instanceof Error ? e.message : "Mata kuliah gagal disimpan."); } finally { setBusy(false); }
  }

  async function deleteCourse(id: string) {
    if (!session) return;
    setCourseError("");
    try {
      const response = await authorizedFetch(session, `/api/courses?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { authorization: `Bearer ${session.token}` } }, updateSession, logout);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Mata kuliah gagal dihapus.");
      setCourses((current) => current.filter((course) => course.id !== id));
    } catch (e) { setCourseError(e instanceof Error ? e.message : "Mata kuliah gagal dihapus."); }
  }

  function logout() { sessionStorage.removeItem("clh-session"); setSession(null); setSelected(null); setUsers([]); }

  if (!session) {
    if (ready) router.replace("/");
    return <main className="loading-screen" aria-label="Memuat dashboard" />;
  }

  return (
    <motion.main className="min-h-screen bg-mist text-hitamdov lg:flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <motion.aside className="z-20 flex w-full flex-col border-b border-mistline bg-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:border-r" initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
        <Link href="/dashboard" className="flex items-center gap-3 px-5 py-4 lg:px-6 lg:py-6"><span className="grid h-10 w-10 place-items-center rounded-xl bg-hitamdov font-semibold text-white">C</span><span className="text-lg font-semibold tracking-tight">campus<span className="font-normal text-biruabu">link</span></span></Link>
        <div className="mx-4 hidden items-center gap-3 rounded-2xl bg-mist p-3 lg:flex"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-abubiru to-biruabu text-sm font-semibold text-white">{initials(session.displayName)}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{session.displayName}</p><p className="truncate text-[10px] text-biruabu">{session.email}</p></div><button onClick={logout} className="text-biruabu" aria-label="Keluar">Keluar</button></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-4 lg:pt-7"><p className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-biruabu lg:block">Menu utama</p>{([ ["overview", "R", "Ringkasan"], ["courses", "K", "Mata kuliah"], ["chats", "C", "Chat"], ["zoom", "Z", "Rapat Zoom"] ] as const).map(([view, icon, label]) => <button key={view} onClick={() => setActiveView(view)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium ${activeView === view ? "bg-cyanterang/55 text-abubiru" : "text-biruabu hover:bg-mist"}`}><span className="grid h-7 w-7 place-items-center rounded-lg text-base">{icon}</span>{label}{view === "chats" && users.length > 0 && <span className="ml-auto rounded-full bg-abubiru px-2 py-0.5 text-[10px] text-white">{users.length}</span>}</button>)}</nav>
        <div className="mt-auto hidden border-t border-mistline p-4 lg:block"><Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-biruabu hover:bg-mist">Profil</Link></div>
        <div className="flex items-center justify-between border-t border-mistline px-5 py-2.5 lg:hidden"><span className="truncate text-xs font-medium">{session.displayName}</span><Link href="/profile" className="text-xs font-semibold text-abubiru">Edit profil</Link><button onClick={logout} className="text-xs text-biruabu">Keluar</button></div>
      </motion.aside>
      <section className="min-w-0 flex-1 px-4 pb-10 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pt-8 xl:px-12">
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-biruabu sm:text-xs">Campus Learning Hub</p><p className="mt-1 text-xs text-biruabu sm:text-sm">Ruang belajar dan kolaborasi kamu</p></div><Link href="/profile" className="hidden items-center gap-2 rounded-full border border-mistline bg-white py-1.5 pl-1.5 pr-4 text-xs font-medium sm:flex"><span className="grid h-8 w-8 place-items-center rounded-full bg-cyanterang/70 font-semibold text-abubiru">{initials(session.displayName)}</span>{session.displayName}</Link></header>
        <AnimatePresence mode="wait">
          {activeView === "overview" && <OverviewView displayName={session.displayName} courses={courses} users={users} onViewChange={setActiveView} onOpenCourseModal={() => { setCourseError(""); setCourseModalOpen(true); }} onOpenFriendModal={openUsernameModal} onDeleteCourse={deleteCourse} />}
          {activeView === "courses" && <CoursesView courses={courses} error={courseError} onOpenModal={() => { setCourseError(""); setCourseModalOpen(true); }} onDelete={deleteCourse} onError={setCourseError} />}
          {activeView === "zoom" && <ZoomView courses={courses} onViewChange={setActiveView} />}
          {activeView === "chats" && <ChatView session={session} users={users} selected={selected} messages={messages} text={text} error={error} busy={busy} endRef={endRef} onOpenFriendModal={openUsernameModal} onSelect={(user) => { setSelected(user); setError(""); }} onTextChange={setText} onSend={sendMessage} />}
        </AnimatePresence>
      </section>
      <AnimatePresence>
        {usernameModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-hitamdov/45 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setUsernameModalOpen(false);
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className="relative w-full max-w-md rounded-3xl border border-mistline bg-white p-6 shadow-2xl sm:p-8"
              role="dialog"
              aria-modal="true"
              aria-labelledby="username-modal-title"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
            >
              <button
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-lg text-biruabu hover:bg-mist"
                onClick={() => setUsernameModalOpen(false)}
                aria-label="Tutup"
              >
                ×
              </button>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanterang/60 text-xl text-abubiru">
                ＋
              </span>
              <h2
                id="username-modal-title"
                className="mt-5 text-xl font-semibold"
              >
                Tambah chat
              </h2>
              <p className="mt-1 text-xs leading-5 text-biruabu">
                Cari teman menggunakan username CampusLink mereka.
              </p>
              <div className="mt-5 rounded-2xl border border-cyanterang/70 bg-cyanterang/20 p-4 text-center">
                <p className="text-xs font-semibold text-hitamdov">
                  Kode QR akunmu
                </p>
                <p className="mt-1 text-[11px] leading-4 text-biruabu">
                  Minta teman memindai kode ini, lalu masukkan username yang muncul.
                </p>
                {qrLoading ? (
                  <div className="mx-auto mt-3 h-[140px] w-[140px] animate-pulse rounded-xl bg-white" />
                ) : qrCodeUrl ? (
                  <>
                    <Image
                      src={qrCodeUrl}
                      alt={`Kode QR untuk username @${myUsername}`}
                      width={140}
                      height={140}
                      unoptimized
                      className="mx-auto mt-3 rounded-xl border border-white bg-white p-1 shadow-sm"
                    />
                    <p className="mt-2 text-xs font-semibold text-abubiru">
                      @{myUsername}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-4 text-biruabu">
                    Atur username akunmu terlebih dahulu agar kode QR dapat dibuat.
                  </p>
                )}
              </div>
              <label
                className="mt-5 grid gap-2 text-xs font-medium"
                htmlFor="username-search"
              >
                Username
                <input
                  id="username-search"
                  className="h-11 rounded-xl border border-mistline px-3 text-sm outline-none focus:border-biruabu focus:ring-4 focus:ring-cyanterang/40"
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                  placeholder="@username"
                  maxLength={21}
                />
              </label>
              {usernameMessage && (
                <p className="mt-3 text-xs leading-5 text-abubiru">
                  {usernameMessage}
                </p>
              )}
              <button
                className="mt-4 h-11 w-full rounded-xl bg-abubiru text-xs font-semibold text-white hover:bg-hitamdov disabled:opacity-50"
                onClick={findContact}
                disabled={busy || !usernameInput.trim()}
              >
                {busy ? "Memproses…" : "Cari pengguna"}
              </button>
              <button
                className="mt-2 h-10 w-full rounded-xl text-xs font-medium text-abubiru hover:bg-mist"
                onClick={saveMyUsername}
                disabled={busy || !usernameInput.trim()}
              >
                Atur username akun saya
              </button>
              <p className="mt-3 text-[10px] leading-5 text-biruabu">
                Username harus unik. Gunakan 3–20 karakter huruf, angka, atau
                garis bawah.
              </p>
            </motion.section>
          </motion.div>
        )}
        {courseModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-hitamdov/45 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setCourseModalOpen(false);
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className="relative my-auto w-full max-w-lg rounded-3xl border border-mistline bg-white p-6 shadow-2xl sm:p-8"
              role="dialog"
              aria-modal="true"
              aria-labelledby="course-modal-title"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
            >
              <button
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-lg text-biruabu hover:bg-mist"
                onClick={() => setCourseModalOpen(false)}
                aria-label="Tutup"
              >
                ×
              </button>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanterang/60 text-lg text-abubiru">
                ▤
              </span>
              <h2
                id="course-modal-title"
                className="mt-5 text-xl font-semibold"
              >
                Tambah mata kuliah
              </h2>
              <p className="mt-1 text-xs text-biruabu">
                Simpan informasi kelas dan link rapat di sini.
              </p>
              <form
                className="mt-5 grid gap-3 sm:grid-cols-2"
                onSubmit={addCourse}
              >
                {[
                  [
                    "courseName",
                    "Nama mata kuliah",
                    "Contoh: Pemrograman Web",
                    true,
                    80,
                  ],
                  [
                    "courseCode",
                    "Kode mata kuliah",
                    "Contoh: IF204",
                    false,
                    24,
                  ],
                  ["lecturer", "Dosen pengampu", "Opsional", false, 80],
                  ["schedule", "Jadwal", "Contoh: Senin, 09.00", false, 80],
                  [
                    "zoomUrl",
                    "Link rapat Zoom",
                    "https://zoom.us/j/...",
                    false,
                    300,
                  ],
                ].map(([name, label, placeholder, required, max]) => (
                  <label
                    key={String(name)}
                    className={`grid gap-1.5 text-[11px] font-medium text-hitamdov ${name === "zoomUrl" ? "sm:col-span-2" : ""}`}
                  >
                    {label}
                    <input
                      name={String(name)}
                      type={name === "zoomUrl" ? "url" : "text"}
                      placeholder={String(placeholder)}
                      required={Boolean(required)}
                      maxLength={Number(max)}
                      className="h-10 w-full rounded-xl border border-mistline bg-mist/40 px-3 text-xs font-normal outline-none focus:border-biruabu focus:bg-white focus:ring-4 focus:ring-cyanterang/40"
                    />
                  </label>
                ))}
                <p className="text-[10px] leading-5 text-biruabu sm:col-span-2">
                  Link Zoom opsional. Buat rapat di Zoom lalu tempel link
                  undangannya.
                </p>
                {courseError && (
                  <p className="text-xs text-red-600 sm:col-span-2">
                    {courseError}
                  </p>
                )}
                <button
                  className="mt-1 h-11 rounded-xl bg-abubiru text-xs font-semibold text-white hover:bg-hitamdov disabled:opacity-50 sm:col-span-2"
                  disabled={busy}
                >
                  {busy ? "Menyimpan…" : "Simpan mata kuliah"}
                </button>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
