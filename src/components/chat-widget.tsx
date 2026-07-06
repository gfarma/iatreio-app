"use client";

import { useState } from "react";

type Msg = { from: "user" | "bot"; text: string };

export function ChatWidget({ clinicSlug }: { clinicSlug: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { from: "bot", text: "Γεια σας! Ρωτήστε με για ωράριο, τοποθεσία ή κρατήσεις. 😊" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { from: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/reception-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: clinicSlug, message: text }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages((m) => [
        ...m,
        { from: "bot", text: data.reply ?? "Κάτι πήγε στραβά — δοκιμάστε ξανά." },
      ]);
    } catch {
      setMessages((m) => [...m, { from: "bot", text: "Κάτι πήγε στραβά — δοκιμάστε ξανά." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="mb-3 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between bg-pine px-4 py-3 text-surface">
            <span className="text-sm font-bold">Βοηθός υποδοχής</span>
            <button onClick={() => setOpen(false)} className="text-surface/80 hover:text-surface">
              ✕
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.from === "user"
                    ? "ml-auto bg-pine text-surface"
                    : "bg-cream text-ink"
                }`}
              >
                {m.text}
              </div>
            ))}
            {busy ? <div className="rounded-xl bg-cream px-3 py-2 text-sm text-mist">…</div> : null}
          </div>
          <div className="flex gap-2 border-t border-line p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Το μήνυμά σας…"
              className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm focus:border-pine focus:outline-none"
            />
            <button
              onClick={send}
              disabled={busy}
              className="rounded-lg bg-pine px-3 py-1.5 text-sm font-bold text-surface disabled:opacity-50"
            >
              →
            </button>
          </div>
          <p className="border-t border-line px-3 py-1.5 text-[10px] text-mist">
            Απαντά μόνο σε γενικά ερωτήματα — όχι ιατρικές συμβουλές.
          </p>
        </div>
      ) : null}
      <button
        onClick={() => setOpen((o) => !o)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-pine text-2xl text-surface shadow-card transition-transform hover:scale-105"
        aria-label="Άνοιγμα βοηθού"
      >
        💬
      </button>
    </div>
  );
}
