export type HistoryItem = { status: string };

export type NoShowRisk = {
  score: number; // 0..1
  label: "χαμηλός" | "μέτριος" | "υψηλός";
  sample: number; // how many past appointments the estimate is based on
};

/**
 * Simple in-house no-show risk estimate (no LLM, no external calls, zero GDPR
 * exposure): share of the patient's own past appointments that ended as
 * no-shows, with Laplace smoothing so 1-2 data points don't scream "high risk".
 */
export function noShowRisk(history: HistoryItem[]): NoShowRisk {
  const finished = history.filter((h) =>
    ["completed", "no_show", "cancelled"].includes(h.status),
  );
  const noShows = finished.filter((h) => h.status === "no_show").length;
  const n = finished.length;
  const score = (noShows + 1) / (n + 10); // prior ≈ 10% baseline no-show rate
  const label = score >= 0.35 ? "υψηλός" : score >= 0.18 ? "μέτριος" : "χαμηλός";
  return { score, label, sample: n };
}
