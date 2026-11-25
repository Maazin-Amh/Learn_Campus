"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("clh-session");
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.token && session.refreshToken) router.replace("/dashboard");
        else sessionStorage.removeItem("clh-session");
      } catch {
        sessionStorage.removeItem("clh-session");
      }
    }
    setReady(true);
  }, [router]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: mode === "signup" ? "signup" : "login",
          displayName: form.get("name"),
          username: form.get("username"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Autentikasi gagal.");
      sessionStorage.setItem(
        "clh-session",
        JSON.stringify({
          ...data.user,
          token: data.token,
          refreshToken: data.refreshToken,
        }),
      );
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autentikasi gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready)
    return <main className="loading-screen" aria-label="Memuat CampusLink" />;

  return (
    <motion.main className="auth-screen bg-gradient-to-br from-white via-white to-cyanterang/50 text-hitamdov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <motion.section className="auth-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
        <div className="brand">
          <motion.span className="brand-icon bg-abubiru shadow-lg shadow-abubiru/20" whileHover={{ rotate: -8, scale: 1.06 }}>C</motion.span>
          <span>
            campus<span className="brand-light">link</span>
          </span>
        </div>
        <p className="eyebrow">CAMPUS LEARNING HUB</p>
        <h1>{mode === "login" ? "Senang bertemu lagi" : "Buat akun kamu"}</h1>
        <p className="muted">
          {mode === "login"
            ? "Masuk untuk membuka dashboard kampusmu."
            : "Daftar dan mulai terhubung dengan teman kampus."}
        </p>
        <form onSubmit={authenticate} className="auth-form">
          {mode === "signup" && (
            <>
              <label>
                Nama lengkap
                <input
                  name="name"
                  placeholder="Nama kamu"
                  required
                  minLength={2}
                />
              </label>
              <label>
                Username unik
                <input
                  name="username"
                  placeholder="contoh: rani_01"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]{3,20}"
                />
              </label>
            </>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              placeholder="nama@email.com"
              required
            />
          </label>
          <label>
            Kata sandi
            <input
              name="password"
              type="password"
              placeholder="Minimal 6 karakter"
              required
              minLength={6}
            />
          </label>
          <motion.button className="primary bg-abubiru hover:bg-hitamdov" disabled={busy} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            {busy ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
          </motion.button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="switch">
          {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Daftar" : "Masuk"}
          </button>
        </p>
        <p className="fine-print">
          Username harus unik dan tidak menggunakan nomor telepon.
        </p>
      </motion.section>
      <motion.div className="auth-decoration bg-gradient-to-br from-hitamdov to-abubiru" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
        <motion.div className="decor-orbit orbit-one" animate={{ rotate: 360 }} transition={{ duration: 36, repeat: Infinity, ease: "linear" }} />
        <motion.div className="decor-orbit orbit-two" animate={{ rotate: -360 }} transition={{ duration: 48, repeat: Infinity, ease: "linear" }} />
        <motion.div className="decor-card" whileHover={{ y: -6, rotate: -1 }} transition={{ type: "spring", stiffness: 200, damping: 18 }}>
          <span>✦</span>
          <p>
            Belajar lebih mudah
            <br />
            saat terhubung.
          </p>
          <small>Ruang untuk komunitas kampusmu</small>
        </motion.div>
      </motion.div>
    </motion.main>
  );
}
