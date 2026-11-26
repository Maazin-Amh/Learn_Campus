import { NextRequest, NextResponse } from "next/server";
import {
  databaseUrl,
  firebaseResponseError,
  normalizeUsername,
  saveUsername,
  verifyFirebaseToken,
} from "@/lib/firebase-rest";

function getToken(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

export async function GET(request: NextRequest) {
  try {
    if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL belum diatur.");
    const token = getToken(request);
    await verifyFirebaseToken(token);
    const username = normalizeUsername(
      request.nextUrl.searchParams.get("username") || "",
    );
    const response = await fetch(
      `${databaseUrl}/usernameLookup/${username}.json?auth=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(
        await firebaseResponseError(
          response,
          "Pencarian username gagal. Periksa aturan Firebase.",
        ),
      );
    const uid = (await response.json()) as string | null;
    if (!uid)
      return NextResponse.json(
        { error: "Username itu belum terdaftar di CampusLink." },
        { status: 404 },
      );
    const profileResponse = await fetch(
      `${databaseUrl}/users/${uid}.json?auth=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!profileResponse.ok)
      throw new Error(
        await firebaseResponseError(
          profileResponse,
          "Profil pengguna tidak dapat dibaca.",
        ),
      );
    const profile = (await profileResponse.json()) as {
      uid?: string;
      displayName?: string;
      username?: string;
    } | null;
    if (!profile?.uid)
      return NextResponse.json(
        { error: "Profil pengguna belum tersedia." },
        { status: 404 },
      );
    return NextResponse.json({
      uid: profile.uid,
      displayName: profile.displayName || "Pengguna",
      username: profile.username || username,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pencarian gagal." },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request);
    const user = await verifyFirebaseToken(token);
    const { username } = await request.json();
    if (typeof username !== "string" || username.length > 40)
      return NextResponse.json(
        { error: "Username tidak valid." },
        { status: 400 },
      );
    const savedUsername = await saveUsername(
      user.localId,
      username,
      token,
      user.displayName,
    );
    return NextResponse.json({ ok: true, username: savedUsername });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Username gagal disimpan.",
      },
      { status: 400 },
    );
  }
}
