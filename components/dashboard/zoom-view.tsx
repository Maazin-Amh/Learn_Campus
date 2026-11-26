"use client";

import { motion } from "framer-motion";
import type { Course, DashboardView } from "./types";

export function ZoomView({
  courses,
  onViewChange,
}: {
  courses: Course[];
  onViewChange: (view: DashboardView) => void;
}) {
  const meetings = courses.filter((course) => course.zoomUrl);
  return (
    <motion.div
      key="zoom"
      className="mx-auto max-w-7xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="mt-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">
          Ruang pertemuan
        </p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Rapat Zoom</h1>
        <p className="mt-2 text-xs text-biruabu sm:text-sm">
          Link rapat yang sudah kamu simpan di tiap mata kuliah.
        </p>
      </div>
      {meetings.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {meetings.map((course) => (
            <article
              key={course.id}
              className="rounded-2xl border border-mistline bg-white p-5 shadow-sm"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanterang/55 text-lg text-abubiru">
                ↗
              </span>
              <h2 className="mt-4 text-sm font-semibold">{course.name}</h2>
              <p className="mt-1 text-xs text-biruabu">
                {course.schedule || "Jadwal belum diatur"}
              </p>
              <a
                href={course.zoomUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-abubiru text-xs font-semibold text-white"
              >
                Gabung Zoom ↗
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-biruabu/30 bg-white p-10 text-center">
          <p className="font-medium">Belum ada link rapat</p>
          <p className="mt-2 text-sm text-biruabu">
            Simpan link Zoom ketika menambahkan mata kuliah.
          </p>
          <button
            onClick={() => onViewChange("courses")}
            className="mt-4 rounded-xl border border-mistline px-4 py-2 text-xs font-semibold text-abubiru"
          >
            Buka mata kuliah
          </button>
        </div>
      )}
    </motion.div>
  );
}
