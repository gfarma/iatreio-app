/**
 * Greek text helpers. Clinic staff type in a hurry: no accents, sometimes
 * ALL CAPS, sometimes final sigma vs sigma. Search must not care.
 */

// Same length, index-aligned: each accented char maps to its plain vowel.
const ACCENTED = "άὰᾶέὲήὴῆίὶῖϊΐόὸύὺῦϋΰώὼῶ";
const PLAIN = "αααεεηηηιιιιιοουυυυυωωω";

/**
 * Folds a Greek string for comparison: lowercase, accents removed,
 * final sigma normalized. "Παππάς" -> "παππασ", "ΠΑΠΠΑΣ" -> "παππασ".
 */
export function foldGreek(input: string): string {
  let folded = "";
  for (const ch of input.toLowerCase()) {
    const idx = ACCENTED.indexOf(ch);
    folded += idx >= 0 ? PLAIN[idx] : ch;
  }
  return folded.replace(/ς/g, "σ");
}

/**
 * The same folding expressed as SQL, so the database can apply it inside a
 * LIKE. Uses only standard `lower`/`translate` — no extensions required, so it
 * behaves identically on managed Postgres, self-hosted, or PGlite.
 * `column` is developer-supplied (never user input).
 */
export function sqlFoldExpression(column: string): string {
  return `translate(lower(${column}), '${ACCENTED}ς', '${PLAIN}σ')`;
}
