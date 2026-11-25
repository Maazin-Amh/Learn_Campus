"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Session = { uid: string; email: string; displayName: string; token: string; refreshToken?: string };
type Profile = { displayName: string; username: string; email: string };

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>({ displayName: "", username: "", email: "" });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("clh-session");
      if (raw) {
        const restored = JSON.parse(raw) as Session;
        if (restored.token && restored.refreshToken) setSession(restored);
        else sessionStorage.removeItem("clh-session");
      }
    } catch {
      sessionStorage.removeItem("clh-session");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    authorizedFetch(
      session,
      "/api/profile",
      { headers: { authorization: `Bearer ${session.token}` } },
      updateSession,
      logout,
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Profil gagal dimuat.");
        setProfile(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Profil gagal dimuat."));
    // Load once per account; token refresh does not need a second profile request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.uid]);

  function updateSession(updated: Session) {
    sessionStorage.setItem("clh-session", JSON.stringify(updated));
    setSession(updated);
  }

  function logout() {
    sessionStorage.removeItem("clh-session");
    setSession(null);
    router.replace("/");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await authorizedFetch(
        session,
        "/api/profile",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ displayName: profile.displayName, username: profile.username }),
        },
        updateSession,
        logout,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Profil gagal disimpan.");
      setProfile(data);
      updateSession({ ...session, displayName: data.displayName });
      setNotice("Profil kamu sudah diperbarui.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profil gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !session) {
    if (ready && !session) router.replace("/");
    return (
      <main className="grid min-h-screen place-items-center bg-mist" aria-label="Memuat profil">
        <motion.div className="h-10 w-10 rounded-2xl bg-abubiru" animate={{ rotate: 90, scale: [1, 1.08, 1] }} transition={{ duration: 1, repeat: Infinity }} />
      </main>
    );
  }

  const initial = profile.displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <motion.main
      className="min-h-screen bg-mist px-4 pb-10 text-hitamdov sm:px-6 lg:px-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-5 sm:py-7">
        <Link href="/dashboard" className="group inline-flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-biruabu">
          <motion.span className="grid h-10 w-10 place-items-center rounded-xl bg-hitamdov text-lg font-semibold text-white shadow-lg shadow-hitamdov/15" whileHover={{ rotate: -7, scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 16 }}>C</motion.span>
          <span className="text-lg font-semibold tracking-tight">campus<span className="font-normal text-biruabu">link</span></span>
        </Link>
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-mistline bg-white px-3.5 py-2 text-xs font-medium text-abubiru shadow-sm transition hover:border-biruabu/50 hover:bg-cyanterang/30 sm:px-4 sm:text-sm">
          <span aria-hidden="true">←</span><span className="hidden sm:inline">Kembali ke</span> Dashboard
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-5 pb-4 pt-3 sm:gap-7 lg:grid-cols-[0.82fr_1.18fr] lg:gap-8 lg:pt-8">
        <motion.section
          className="relative isolate flex min-h-64 flex-col justify-between overflow-hidden rounded-3xl bg-hitamdov p-6 text-white shadow-xl shadow-hitamdov/10 sm:min-h-72 sm:p-9 lg:min-h-[610px] lg:p-10"
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="pointer-events-none absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full border border-white/10" />
          <motion.div className="pointer-events-none absolute -right-10 -top-16 -z-10 h-60 w-60 rounded-full border border-cyanterang/20" animate={{ rotate: 360 }} transition={{ duration: 48, repeat: Infinity, ease: "linear" }} />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-cyanterang sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-cyanterang" /> Ruang akun kamu
            </div>
            <h1 className="mt-7 max-w-sm text-3xl font-medium leading-tight tracking-[-0.04em] sm:mt-9 sm:text-4xl lg:text-[2.7rem]">
              Profil yang terasa seperti kamu.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
              Atur nama dan username yang teman kampus lihat saat kalian terhubung.
            </p>
          </div>
          <div className="mt-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur sm:mt-14 sm:p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyanterang to-biruabu text-lg font-semibold text-hitamdov">{initial}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile.displayName || "Nama tampilan"}</p>
              <p className="truncate text-xs text-white/50">@{profile.username || "username"}</p>
            </div>
            <span className="ml-auto rounded-full bg-cyanterang/10 px-2.5 py-1 text-[10px] font-medium text-cyanterang">AKUN</span>
          </div>
        </motion.section>

        <motion.section
          className="rounded-3xl border border-mistline bg-white p-5 shadow-sm shadow-hitamdov/5 sm:p-8 lg:p-10"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45, ease: "easeOut" }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-mistline pb-6 sm:pb-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-biruabu sm:text-xs">Pengaturan akun</p>
              <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] sm:text-3xl">Edit profil</h2>
              <p className="mt-2 max-w-md text-xs leading-5 text-biruabu sm:text-sm sm:leading-6">Ubah detail publik akunmu. Email hanya bisa dilihat oleh kamu.</p>
            </div>
            <motion.div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyanterang/60 text-xl text-abubiru sm:grid" whileHover={{ rotate: 8, scale: 1.05 }}>✳</motion.div>
          </div>

          <form onSubmit={saveProfile} className="grid gap-5 pt-6 sm:gap-6 sm:pt-8">
            <label className="grid gap-2 text-xs font-medium text-hitamdov sm:text-sm">
              Nama tampilan
              <input
                value={profile.displayName}
                onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
                required minLength={2} maxLength={60} autoComplete="name"
                placeholder="Nama yang ingin ditampilkan"
                className="h-12 w-full rounded-xl border border-mistline bg-mist/50 px-4 text-sm font-normal text-hitamdov outline-none transition placeholder:text-biruabu/70 hover:border-biruabu/50 focus:border-abubiru focus:bg-white focus:ring-4 focus:ring-cyanterang/50 sm:h-[3.25rem]"
              />
            </label>

            <label className="grid gap-2 text-xs font-medium text-hitamdov sm:text-sm">
              Username unik
              <span className="flex h-12 items-center rounded-xl border border-mistline bg-mist/50 pl-4 transition focus-within:border-abubiru focus-within:bg-white focus-within:ring-4 focus-within:ring-cyanterang/50 sm:h-[3.25rem]">
                <span className="text-sm text-biruabu">@</span>
                <input
                  value={profile.username}
                  onChange={(event) => setProfile({ ...profile, username: event.target.value })}
                  required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]{3,20}" autoComplete="username"
                  placeholder="username_kamu"
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm font-normal text-hitamdov outline-none placeholder:text-biruabu/70"
                />
              </span>
              <span className="text-[11px] font-normal leading-5 text-biruabu sm:text-xs">3–20 karakter, huruf, angka, atau garis bawah. Username harus berbeda dari pengguna lain.</span>
            </label>

            <label className="grid gap-2 text-xs font-medium text-hitamdov sm:text-sm">
              Email akun
              <input value={profile.email || session.email} readOnly disabled className="h-12 w-full cursor-not-allowed rounded-xl border border-mistline bg-slate-50 px-4 text-sm font-normal text-biruabu sm:h-[3.25rem]" />
            </label>

            <div className="mt-1 rounded-xl border border-cyanterang bg-cyanterang/30 px-4 py-3 text-xs leading-5 text-abubiru sm:text-sm">
              CampusLink menggunakan username untuk pencarian chat. Nomor telepon tidak ditampilkan atau digunakan.
            </div>

            {error && <motion.p role="alert" className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-xs leading-5 text-hitamdov sm:text-sm" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.p>}
            {notice && <motion.p role="status" className="rounded-xl border border-cyanterang bg-cyanterang/40 px-4 py-3 text-xs text-abubiru sm:text-sm" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>{notice}</motion.p>}

            <div className="flex flex-col-reverse gap-3 border-t border-mistline pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
              <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-biruabu transition hover:bg-mist hover:text-hitamdov">Batal</Link>
              <motion.button type="submit" disabled={busy} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-abubiru px-6 text-sm font-medium text-white shadow-lg shadow-abubiru/15 transition hover:bg-hitamdov disabled:cursor-wait disabled:opacity-60 sm:min-w-48">
                {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {busy ? "Menyimpan…" : "Simpan perubahan"}
              </motion.button>
            </div>
          </form>
        </motion.section>
      </div>
    </motion.main>
  );
}

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
  const refreshed = await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "refresh", refreshToken: session.refreshToken }),
  });
  if (!refreshed.ok) {
    onExpired();
    return first;
  }
  const tokens = await refreshed.json();
  const updated = { ...session, token: tokens.token, refreshToken: tokens.refreshToken };
  onRefresh(updated);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${updated.token}`);
  return fetch(input, { ...init, headers });
}
