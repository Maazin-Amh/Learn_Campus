"use client";

import { FormEvent, RefObject } from "react";
import { motion } from "framer-motion";
import type { Message, Session, User } from "./types";

type Props = {
  session: Session;
  users: User[];
  selected: User | null;
  messages: Message[];
  text: string;
  error: string;
  busy: boolean;
  endRef: RefObject<HTMLDivElement | null>;
  onOpenFriendModal: () => void;
  onSelect: (user: User) => void;
  onTextChange: (value: string) => void;
  onSend: (event: FormEvent) => void;
};
const initial = (name: string) => name.trim().slice(0, 1).toUpperCase() || "?";

export function ChatView({
  session,
  users,
  selected,
  messages,
  text,
  error,
  busy,
  endRef,
  onOpenFriendModal,
  onSelect,
  onTextChange,
  onSend,
}: Props) {
  return (
    <motion.div
      key="chats"
      className="mx-auto flex max-w-7xl flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="mt-6 flex items-end justify-between gap-3 sm:mt-8">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-biruabu">
            Kolaborasi kampus
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Chat</h1>
        </div>
        <button
          onClick={onOpenFriendModal}
          className="rounded-xl bg-abubiru px-3 py-2.5 text-xs font-semibold text-white hover:bg-hitamdov"
        >
          ＋ Tambah chat
        </button>
      </div>
      <div className="mt-5 grid min-h-[62vh] overflow-hidden rounded-2xl border border-mistline bg-white shadow-sm md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-mistline md:border-b-0 md:border-r">
          <div className="border-b border-mistline px-4 py-3">
            <p className="text-xs font-semibold">Percakapan</p>
            <p className="mt-1 text-[10px] text-biruabu">
              {users.length} teman
            </p>
          </div>
          <div className="flex max-h-36 gap-2 overflow-x-auto p-2 md:max-h-[calc(62vh-56px)] md:flex-col md:overflow-y-auto">
            {users.map((user) => (
              <button
                key={user.uid}
                onClick={() => onSelect(user)}
                className={`flex min-w-44 items-center gap-3 rounded-xl p-2.5 text-left md:min-w-0 ${selected?.uid === user.uid ? "bg-cyanterang/50" : "hover:bg-mist"}`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-cyanterang/60 text-xs font-semibold text-abubiru">
                  {initial(user.displayName)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {user.displayName}
                </span>
              </button>
            ))}
            {users.length === 0 && (
              <p className="px-3 py-4 text-xs text-biruabu">
                Belum ada teman chat. Tambahkan lewat username.
              </p>
            )}
          </div>
        </aside>
        <main className="flex min-h-[55vh] min-w-0 flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b border-mistline px-4 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-cyanterang/60 text-sm font-semibold text-abubiru">
                  {initial(selected.displayName)}
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    {selected.displayName}
                  </p>
                  <p className="text-[10px] text-biruabu">
                    Pengguna CampusLink
                  </p>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-mist/40 p-4 sm:p-6">
                {messages.length ? (
                  messages.map((message, index) => (
                    <motion.div
                      key={`${message.createdAt}-${index}`}
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm sm:max-w-[70%] ${message.senderId === session.uid ? "ml-auto bg-abubiru text-white" : "mr-auto border border-mistline bg-white"}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.text}
                      </p>
                      <time className="mt-1 block text-right text-[9px] opacity-60">
                        {new Date(message.createdAt).toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </time>
                    </motion.div>
                  ))
                ) : (
                  <div className="m-auto text-center">
                    <p className="text-sm font-medium">Mulai percakapan</p>
                    <p className="mt-1 text-xs text-biruabu">
                      Kirim pesan pertama ke {selected.displayName}.
                    </p>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              {error && (
                <p className="px-4 pt-2 text-xs text-red-600">{error}</p>
              )}
              <form
                onSubmit={onSend}
                className="flex gap-2 border-t border-mistline p-3 sm:p-4"
              >
                <input
                  value={text}
                  onChange={(event) => onTextChange(event.target.value)}
                  placeholder="Tulis pesan…"
                  maxLength={2000}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-mistline bg-mist/50 px-4 text-xs outline-none"
                />
                <button
                  disabled={busy || !text.trim()}
                  aria-label="Kirim pesan"
                  className="grid h-11 w-11 place-items-center rounded-xl bg-abubiru text-lg text-white disabled:opacity-40"
                >
                  ↑
                </button>
              </form>
            </>
          ) : (
            <div className="m-auto px-5 py-12 text-center">
              <h2 className="text-base font-semibold">Pilih percakapan</h2>
              <p className="mt-1 text-xs text-biruabu">
                Pilih teman atau cari username untuk mulai chat.
              </p>
            </div>
          )}
        </main>
      </div>
    </motion.div>
  );
}
