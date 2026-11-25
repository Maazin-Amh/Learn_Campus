export type FirebaseUser = { localId: string; email: string; displayName?: string };

const authUrl = (method: string) =>
  `https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${process.env.FIREBASE_API_KEY}`;

export async function firebaseAuth(method: "signUp" | "signInWithPassword", email: string, password: string, displayName?: string) {
  const response = await fetch(authUrl(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true, ...(displayName ? { displayName } : {}) }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Autentikasi gagal.");
  return body as { localId: string; email: string; idToken: string; refreshToken: string; displayName?: string };
}

export async function firebaseRefresh(refreshToken: string) {
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Sesi berakhir. Silakan masuk kembali.");
  return body as { id_token: string; refresh_token: string };
}

export async function verifyFirebaseToken(token: string): Promise<FirebaseUser> {
  if (!token) throw new Error("Token sesi tidak ditemukan. Silakan masuk kembali.");
  const response = await fetch(authUrl("lookup"), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: token }),
  });
  const body = await response.json();
  const user = body.users?.[0];
  if (!response.ok || !user) {
    const code = body.error?.message;
    if (typeof code === "string") throw new Error(`Firebase Auth menolak sesi (${code}). Silakan masuk kembali.`);
    throw new Error("Firebase Auth tidak dapat memverifikasi sesi. Silakan masuk kembali.");
  }
  return { localId: user.localId, email: user.email, displayName: user.displayName };
}

export async function firebaseUpdateDisplayName(token: string, displayName: string) {
  const response = await fetch(authUrl("update"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: token, displayName, returnSecureToken: false }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Nama profil gagal diperbarui.");
}

export const databaseUrl = process.env.FIREBASE_DATABASE_URL?.replace(/\/$/, "");

export function normalizeUsername(value: string) {
  const username = value.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new Error("Username harus 3–20 karakter: huruf kecil, angka, atau garis bawah.");
  }
  return username;
}

export async function saveUsername(uid: string, rawUsername: string, token: string, displayName?: string) {
  if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL belum diatur.");
  const username = normalizeUsername(rawUsername);
  const auth = `?auth=${encodeURIComponent(token)}`;
  const ownerUrl = `${databaseUrl}/usernameOwners/${uid}.json${auth}`;
  const oldResponse = await fetch(ownerUrl, { cache: "no-store" });
  if (!oldResponse.ok) throw new Error(await firebaseResponseError(oldResponse, "Gagal membaca username akun."));
  const oldUsername = await oldResponse.json() as string | null;
  if (oldUsername === username) return username;

  const indexUrl = `${databaseUrl}/usernameLookup/${username}.json${auth}`;
  const claim = await fetch(indexUrl, {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(uid),
  });
  if (!claim.ok) {
    const reason = await firebaseResponseError(claim, "Username tidak dapat digunakan.");
    if (/permission denied/i.test(reason)) throw new Error("Username itu sudah dipakai atau aturan username belum dipublikasikan.");
    throw new Error(reason);
  }

  const ownerWrite = await fetch(ownerUrl, {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(username),
  });
  if (!ownerWrite.ok) {
    await fetch(indexUrl, { method: "DELETE" });
    throw new Error(await firebaseResponseError(ownerWrite, "Gagal menyimpan username."));
  }

  const profileUrl = `${databaseUrl}/users/${uid}.json${auth}`;
  const profileResponse = await fetch(profileUrl, { cache: "no-store" });
  if (!profileResponse.ok) throw new Error(await firebaseResponseError(profileResponse, "Profil pengguna tidak dapat dibaca."));
  const profile = await profileResponse.json() as { uid?: string; displayName?: string } | null;
  const profileWrite = await fetch(profileUrl, {
    method: profile ? "PATCH" : "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid, displayName: profile?.displayName || displayName || username, username }),
  });
  if (!profileWrite.ok) throw new Error(await firebaseResponseError(profileWrite, "Username tersimpan, tetapi profil gagal diperbarui."));

  if (oldUsername) {
    await fetch(`${databaseUrl}/usernameLookup/${oldUsername}.json${auth}`, { method: "DELETE" });
  }
  return username;
}

export async function firebaseResponseError(response: Response, fallback: string) {
  const payload = await response.text();
  try {
    const parsed = JSON.parse(payload);
    const message = parsed.error?.message || parsed.error || parsed.message;
    return typeof message === "string" ? message : fallback;
  } catch {
    return payload.slice(0, 240) || fallback;
  }
}
