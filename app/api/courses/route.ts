import { NextRequest, NextResponse } from "next/server";
import {
  databaseUrl,
  firebaseResponseError,
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
      `${databaseUrl}/courses/${user.localId}.json?auth=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(
        await firebaseResponseError(response, "Gagal memuat mata kuliah."),
      );
    const value = (await response.json()) as Record<
      string,
      Omit<Course, "id">
    > | null;
    const courses = Object.entries(value || {})
      .map(([id, course]) => ({ id, ...course }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal memuat mata kuliah.",
      },
      { status: 400 },
    );
  }
}

type Course = {
  id: string;
  name: string;
  code: string;
  lecturer: string;
  schedule: string;
  zoomUrl: string;
  createdAt: number;
};

export async function POST(request: NextRequest) {
  try {
    if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL belum diatur.");
    const token = getToken(request);
    const user = await verifyFirebaseToken(token);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const lecturer =
      typeof body.lecturer === "string" ? body.lecturer.trim() : "";
    const schedule =
      typeof body.schedule === "string" ? body.schedule.trim() : "";
    const zoomUrl = typeof body.zoomUrl === "string" ? body.zoomUrl.trim() : "";
    if (
      !name ||
      name.length > 80 ||
      code.length > 24 ||
      lecturer.length > 80 ||
      schedule.length > 80 ||
      zoomUrl.length > 300
    ) {
      return NextResponse.json(
        { error: "Nama wajib diisi. Periksa batas panjang data." },
        { status: 400 },
      );
    }
    if (zoomUrl) {
      try {
        const parsed = new URL(zoomUrl);
        if (
          parsed.protocol !== "https:" ||
          !(
            parsed.hostname === "zoom.us" ||
            parsed.hostname.endsWith(".zoom.us")
          )
        )
          throw new Error();
      } catch {
        return NextResponse.json(
          { error: "Masukkan link rapat Zoom yang valid (https://…zoom.us)." },
          { status: 400 },
        );
      }
    }
    const createdAt = Date.now();
    const response = await fetch(
      `${databaseUrl}/courses/${user.localId}.json?auth=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          lecturer,
          schedule,
          zoomUrl,
          createdAt,
        }),
      },
    );
    if (!response.ok)
      throw new Error(
        await firebaseResponseError(response, "Mata kuliah gagal disimpan."),
      );
    const { name: id } = await response.json();
    return NextResponse.json(
      { id, name, code, lecturer, schedule, zoomUrl, createdAt },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mata kuliah gagal disimpan.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL belum diatur.");
    const token = getToken(request);
    const user = await verifyFirebaseToken(token);
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id))
      return NextResponse.json(
        { error: "ID mata kuliah tidak valid." },
        { status: 400 },
      );
    const response = await fetch(
      `${databaseUrl}/courses/${user.localId}/${id}.json?auth=${encodeURIComponent(token)}`,
      { method: "DELETE" },
    );
    if (!response.ok)
      throw new Error(
        await firebaseResponseError(response, "Mata kuliah gagal dihapus."),
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Mata kuliah gagal dihapus.",
      },
      { status: 400 },
    );
  }
}
