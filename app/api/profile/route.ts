import { NextRequest, NextResponse } from "next/server";
import {
  databaseUrl,
  firebaseResponseError,
  firebaseUpdateDisplayName,
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
    const user = await verifyFirebaseToken(token);
    const response = await fetch(
      `${databaseUrl}/users/${user.localId}.json?auth=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(
        await firebaseResponseError(response, "Profil gagal dimuat."),
      );
    const profile = (await response.json()) as {
      displayName?: string;
      username?: string;
    } | null;
    return NextResponse.json({
      displayName: profile?.displayName || user.displayName || "Pengguna",
      username: profile?.username || "",
      email: user.email,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Profil gagal dimuat.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL belum diatur.");
    const token = getToken(request);
    const user = await verifyFirebaseToken(token);
    const body = await request.json();
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : "";
    const rawUsername = typeof body.username === "string" ? body.username : "";
    if (displayName.length < 2 || displayName.length > 60) {
      return NextResponse.json(
        { error: "Nama harus terdiri dari 2–60 karakter." },
        { status: 400 },
      );
    }
    const username = normalizeUsername(rawUsername);
    await saveUsername(user.localId, username, token, displayName);
    await firebaseUpdateDisplayName(token, displayName);
    const profileResponse = await fetch(
      `${databaseUrl}/users/${user.localId}.json?auth=${encodeURIComponent(token)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName }),
      },
    );
    if (!profileResponse.ok)
      throw new Error(
        await firebaseResponseError(
          profileResponse,
          "Profil gagal diperbarui.",
        ),
      );
    return NextResponse.json({
      ok: true,
      displayName,
      username,
      email: user.email,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Profil gagal disimpan.",
      },
      { status: 400 },
    );
  }
}
