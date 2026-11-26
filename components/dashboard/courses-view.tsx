"use client";

import { motion } from "framer-motion";
import type { Course } from "./types";

type Props = {
  courses: Course[];
  error: string;
  onOpenModal: () => void;
  onDelete: (id: string) => void;
  onError: (message: string) => void;
};

export function CoursesView({
  courses,
  error,
  onOpenModal,
  onDelete,
  onError,
}: Props) {
  return (
    <motion.div
      key="courses"
      className="mx-auto max-w-7xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">
            Pengelolaan belajar
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            Mata kuliah
          </h1>
          <p className="mt-2 text-xs text-biruabu sm:text-sm">
            Kelas dan link rapat Zoom kamu.
          </p>
        </div>
        <button
          onClick={onOpenModal}
          className="rounded-xl bg-abubiru px-4 py-2.5 text-xs font-semibold text-white hover:bg-hitamdov"
        >
          ＋ Tambah mata kuliah
        </button>
      </div>
      {error && <p className="mt-4 text-xs text-red-600">{error}</p>}
      {courses.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <article
              key={course.id}
              className="rounded-2xl border border-mistline bg-white p-5 shadow-sm"
            >
              <div className="flex justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanterang/55 text-lg text-abubiru">
                  ▤
                </span>
                <button
                  onClick={() => onDelete(course.id)}
                  aria-label={`Hapus ${course.name}`}
                  className="text-biruabu"
                >
                  ×
                </button>
              </div>
              <h2 className="mt-5 text-base font-semibold">{course.name}</h2>
              <p className="mt-1 text-xs text-biruabu">
                {course.code || "Kode belum diatur"}
              </p>
              <div className="mt-4 space-y-2 border-t border-mistline pt-4 text-xs text-biruabu">
                <p>◷ {course.schedule || "Jadwal belum diatur"}</p>
                <p>◉ {course.lecturer || "Dosen belum diatur"}</p>
              </div>
              {course.zoomUrl ? (
                <a
                  href={course.zoomUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 flex min-h-10 items-center justify-center rounded-xl bg-cyanterang/50 text-xs font-semibold text-abubiru"
                >
                  Gabung rapat Zoom ↗
                </a>
              ) : (
                <button
                  onClick={() =>
                    onError(
                      "Tambahkan link Zoom dengan mengedit data mata kuliah.",
                    )
                  }
                  className="mt-5 w-full rounded-xl border border-mistline py-2.5 text-xs text-biruabu"
                >
                  Belum ada link Zoom
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-biruabu/30 bg-white p-10 text-center">
          <p className="font-medium">Belum ada mata kuliah</p>
          <p className="mt-2 text-sm text-biruabu">
            Tambah mata kuliah untuk menyimpan kelas dan link Zoom.
          </p>
        </div>
      )}
    </motion.div>
  );
}
