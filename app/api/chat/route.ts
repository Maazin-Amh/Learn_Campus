import { NextRequest, NextResponse } from "next/server";
import { databaseUrl, firebaseResponseError, verifyFirebaseToken } from "@/lib/firebase-rest";

function pairKey(a: string, b: string) { return [a, b].sort().join("_"); }
function tokenFrom(request: NextRequest) { return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; }

export async function GET(request: NextRequest) {
  try {
    if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL belum diatur.");
    const token = tokenFrom(request); const me = await verifyFirebaseToken(token);
    if (request.nextUrl.searchParams.get("users") === "1") {
      const response = await fetch(`${databaseUrl}/userChats/${me.localId}.json?auth=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!response.ok) return NextResponse.json({ error: await firebaseResponseError(response, "Gagal memuat pengguna.") }, { status: response.status });
      const records = await response.json() as Record<string, boolean> | null;
      const peers = Object.keys(records || {}).filter((uid) => uid !== me.localId);
      const profiles = await Promise.all(peers.map(async (uid) => {
        const profileResponse = await fetch(`${databaseUrl}/users/${uid}.json?auth=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!profileResponse.ok) return null;
        return await profileResponse.json() as { uid: string; displayName?: string } | null;
      }));
      const users = profiles.filter((user): user is { uid: string; displayName?: string } => !!user?.uid)
        .map(({ uid, displayName }) => ({ uid, displayName: displayName || "Pengguna" }));
      return NextResponse.json(users);
    }
    const peer = request.nextUrl.searchParams.get("peer");
    if (!peer || peer === me.localId) return NextResponse.json({ error: "Pilih pengguna untuk membuka chat." }, { status: 400 });
    const url = `${databaseUrl}/chats/${pairKey(me.localId, peer)}/messages.json?auth=${encodeURIComponent(token)}`;
    const upstream = await fetch(url, { headers: { accept: "text/event-stream" }, cache: "no-store" });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: await firebaseResponseError(upstream, "Tidak dapat membuka chat.") }, { status: upstream.status || 502 });
    return new Response(upstream.body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sesi tidak valid." }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL belum diatur.");
    const token = tokenFrom(request); const me = await verifyFirebaseToken(token);
    const { peer, text } = await request.json();
    if (typeof peer !== "string" || peer === me.localId || typeof text !== "string" || !text.trim() || text.length > 2000) {
      return NextResponse.json({ error: "Pesan atau penerima tidak valid." }, { status: 400 });
    }
    const base = `${databaseUrl}/chats/${pairKey(me.localId, peer)}`;
    const memberWrite = await fetch(`${base}/members.json?auth=${encodeURIComponent(token)}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ [me.localId]: true, [peer]: true }),
    });
    if (!memberWrite.ok) throw new Error(await firebaseResponseError(memberWrite, "Tidak dapat membuat ruang chat. Periksa aturan Firebase."));
    const response = await fetch(`${base}/messages.json?auth=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ senderId: me.localId, text: text.trim(), createdAt: Date.now() }),
    });
    if (!response.ok) throw new Error(await firebaseResponseError(response, "Pesan gagal dikirim."));
    const contactResponse = await fetch(`${databaseUrl}/userChats/${me.localId}/${peer}.json?auth=${encodeURIComponent(token)}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: "true",
    });
    if (!contactResponse.ok) throw new Error(await firebaseResponseError(contactResponse, "Pesan terkirim, tetapi percakapan belum masuk ke daftar."));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Terjadi kesalahan." }, { status: 400 });
  }
}
