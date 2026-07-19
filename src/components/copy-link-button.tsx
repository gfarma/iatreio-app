"use client";

import { useState } from "react";

/**
 * Copies the patient self-service link so the front desk can paste it into
 * Viber/SMS until an automated sender is wired up.
 */
export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Αντιγραφή link επιβεβαίωσης για αποστολή στον ασθενή (Viber/SMS)"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${path}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Αντιγράψτε το link:", `${window.location.origin}${path}`);
        }
      }}
      className="rounded-md bg-sage px-2 py-0.5 text-xs font-semibold text-pine-deep hover:bg-pine hover:text-surface"
    >
      {copied ? "✓ Αντιγράφηκε" : "🔗 Link ασθενή"}
    </button>
  );
}
