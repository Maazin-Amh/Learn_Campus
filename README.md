# CampusLink

Next.js App Router dengan Firebase Authentication dan Firebase Realtime Database. Fitur mencakup login/daftar, chat real-time berdasarkan username unik, serta pencatatan mata kuliah per akun.

Setelah masuk, pengguna diarahkan ke `/dashboard` untuk mata kuliah, chat, dan link rapat Zoom. Pengaturan nama tampilan dan username ada di `/profile`. Link Zoom disimpan per mata kuliah; rapat dibuat dari Zoom lalu link undangannya ditempelkan di CampusLink.

## Menyiapkan Firebase

1. Aktifkan **Authentication → Email/Password**.
2. Buat **Realtime Database** dan salin URL database.
3. Isi `.env.local` berdasarkan `.env.example`.
4. Publikasikan seluruh isi `database.rules.json` di **Realtime Database → Rules**.
5. Jalankan `npm run dev` (port 3467).

Signup meminta username unik 3–20 karakter (huruf, angka, garis bawah). Username lama bisa diatur melalui tombol `+` pada bagian chat. Pencarian tidak memakai nomor telepon.

Mata kuliah disimpan pada `/courses/{uid}` dan hanya dapat dibaca atau diubah oleh pemilik akun.

## Route API

- `POST /api/auth` — daftar atau masuk Firebase.
- `GET /api/chat?users=1` — daftar chat pengguna.
- `GET /api/chat?peer=<uid>` — stream pesan real-time.
- `POST /api/chat` — kirim pesan `{ peer, text }`.
- `GET /api/contacts?username=<username>` — cari pengguna berdasarkan username.
- `POST /api/contacts` — buat atau ubah username akun `{ username }`.
- `GET /api/courses` — daftar mata kuliah pengguna.
- `POST /api/courses` — tambah mata kuliah `{ name, code?, lecturer?, schedule? }`.
- `DELETE /api/courses?id=<id>` — hapus mata kuliah.
- `GET /api/profile` — baca profil akun.
- `POST /api/profile` — ubah nama tampilan dan username `{ displayName, username }`.
