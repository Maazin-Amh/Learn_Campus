"use client";

import { motion } from "framer-motion";
import type { Course, DashboardView, User } from "./types";

type Props = {
  displayName: string;
  courses: Course[];
  users: User[];
  onViewChange: (view: DashboardView) => void;
  onOpenCourseModal: () => void;
  onOpenFriendModal: () => void;
  onDeleteCourse: (id: string) => void;
};

export function OverviewView({
  displayName,
  courses,
  users,
  onViewChange,
  onOpenCourseModal,
  onOpenFriendModal,
  onDeleteCourse,
}: Props) {
  const stats = [
    ["Mata kuliah", courses.length, "▤"],
    ["Teman chat", users.length, "◌"],
    ["Link Zoom", courses.filter((course) => course.zoomUrl).length, "↗"],
    ["Status akun", "Aktif", "✓"],
  ];

  return (
    <motion.div
      key="overview"
      className="mx-auto max-w-7xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22 }}
    >
      <div className="mt-7 flex flex-col justify-between gap-4 sm:mt-10 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-biruabu sm:text-base">
            Selamat datang kembali,
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {displayName} <span className="text-coral">✦</span>
          </h1>
        </div>
        <button
          onClick={onOpenCourseModal}
          className="inline-flex min-h-10 items-center justify-center self-start rounded-xl bg-abubiru px-4 text-xs font-semibold text-white shadow-lg shadow-abubiru/15 transition hover:bg-hitamdov sm:self-auto sm:text-sm"
        >
          ＋ Tambah mata kuliah
        </button>
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl bg-hitamdov p-5 text-white shadow-xl shadow-hitamdov/10 sm:mt-8 sm:p-8">
        <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-cyanterang">
          Ruang belajarmu
        </span>
        <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              Semua kegiatan kampus dalam satu tempat.
            </h2>
            <p className="mt-2 text-xs leading-5 text-white/60 sm:text-sm">
              Atur mata kuliah, mulai percakapan, dan gabung rapat dengan mudah.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onViewChange("chats")}
              className="rounded-xl bg-cyanterang px-4 py-2.5 text-xs font-semibold text-hitamdov"
            >
              Buka chat
            </button>
            <button
              onClick={() => onViewChange("courses")}
              className="rounded-xl border border-white/20 px-4 py-2.5 text-xs font-semibold"
            >
              Lihat kelas
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-4">
        {stats.map(([label, value, icon]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-mistline bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-biruabu sm:text-xs">
                {label}
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyanterang/45 text-sm text-abubiru">
                {icon}
              </span>
            </div>
            <p className="mt-3 text-xl font-semibold sm:text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">
                Aktivitas belajar
              </p>
              <h2 className="mt-1 text-lg font-semibold sm:text-xl">
                Mata kuliah kamu
              </h2>
            </div>
            <button
              onClick={() => onViewChange("courses")}
              className="text-xs font-semibold text-abubiru"
            >
              Lihat semua →
            </button>
          </div>
          {courses.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.slice(0, 4).map((course) => (
                <article
                  key={course.id}
                  className="rounded-2xl border border-mistline bg-white p-4 shadow-sm"
                >
                  <div className="flex justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyanterang/55 text-abubiru">
                      ▤
                    </span>
                    <button
                      onClick={() => onDeleteCourse(course.id)}
                      className="text-biruabu"
                      aria-label={`Hapus ${course.name}`}
                    >
                      ×
                    </button>
                  </div>
                  <h3 className="mt-4 truncate text-sm font-semibold">
                    {course.name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-biruabu">
                    {[course.code, course.lecturer]
                      .filter(Boolean)
                      .join(" · ") || "Mata kuliah"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyCourses onOpenCourseModal={onOpenCourseModal} />
          )}
        </section>
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">
                Tetap terhubung
              </p>
              <h2 className="mt-1 text-lg font-semibold sm:text-xl">
                Chat terbaru
              </h2>
            </div>
            <button
              onClick={onOpenFriendModal}
              className="text-xs font-semibold text-abubiru"
            >
              ＋ Tambah
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-mistline bg-white">
            {users.length ? (
              users.slice(0, 5).map((user) => (
                <button
                  key={user.uid}
                  onClick={() => onViewChange("chats")}
                  className="flex w-full items-center gap-3 border-b border-mistline px-4 py-3 text-left last:border-0 hover:bg-mist"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-cyanterang/60 text-sm font-semibold text-abubiru">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold">
                    {user.displayName}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium">Mulai percakapan</p>
                <p className="mt-1 text-xs text-biruabu">
                  Tambahkan teman menggunakan username mereka.
                </p>
                <button
                  onClick={onOpenFriendModal}
                  className="mt-4 rounded-xl border border-mistline px-4 py-2 text-xs font-semibold text-abubiru"
                >
                  Cari teman
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function EmptyCourses({
  onOpenCourseModal,
}: {
  onOpenCourseModal: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-biruabu/30 bg-white px-5 py-8 text-center">
      <p className="text-sm font-medium">Belum ada mata kuliah</p>
      <button
        onClick={onOpenCourseModal}
        className="mt-4 rounded-xl bg-abubiru px-4 py-2 text-xs font-semibold text-white"
      >
        Tambah mata kuliah
      </button>
    </div>
  );
}
