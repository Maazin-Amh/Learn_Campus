import { NextRequest, NextResponse } from "next/server";
import {
  databaseUrl,
  firebaseAuth,
  firebaseRefresh,
  firebaseResponseError,
  saveUsername,
} from "@/lib/firebase-rest";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.FIREBASE_API_KEY)
      throw new Error("FIREBASE_API_KEY belum diatur.");
    const { action, email, password, displayName, refreshToken, username } =
      await request.json();
    if (action === "refresh") {
      if (typeof refreshToken !== "string" || !refreshToken)
        throw new Error("Token sesi tidak tersedia. Silakan masuk kembali.");
      const refreshed = await firebaseRefresh(refreshToken);
      return NextResponse.json({
        token: refreshed.id_token,
        refreshToken: refreshed.refresh_token,
      });
    }
    if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL belum diatur.");
    if (
      !email ||
      !password ||
      (action === "signup" && (!displayName || typeof username !== "string"))
    )
      return NextResponse.json(
        { error: "Nama, username, email, dan kata sandi wajib diisi." },
        { status: 400 },
      );
    const user = await firebaseAuth(
      action === "signup" ? "signUp" : "signInWithPassword",
      email,
      password,
      displayName,
    );
    let warning: string | undefined;
    if (action === "signup") {
      const profileResponse = await fetch(
        `${databaseUrl}/users/${user.localId}.json?auth=${user.idToken}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uid: user.localId,
            displayName: user.displayName || displayName,
          }),
        },
      );
      if (!profileResponse.ok)
        throw new Error(
          `Akun dibuat, tetapi profil gagal disimpan: ${await firebaseResponseError(profileResponse, "Periksa aturan database Firebase.")}`,
        );
      try {
        await saveUsername(
          user.localId,
          username,
          user.idToken,
          user.displayName || displayName,
        );
      } catch (error) {
        warning =
          error instanceof Error
            ? error.message
            : "Username belum tersimpan. Atur lewat menu + setelah masuk.";
      }
    }
    return NextResponse.json({
      token: user.idToken,
      refreshToken: user.refreshToken,
      warning,
      user: {
        uid: user.localId,
        email: user.email,
        displayName: user.displayName || displayName || user.email,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan." },
      { status: 400 },
    );
  }
}
