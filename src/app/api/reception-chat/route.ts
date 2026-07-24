import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiInteractionLogs, availabilityRules, clinics } from "@/db/schema";
import { aiEnabled, aiModel, chatComplete } from "@/lib/ai/provider";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const WEEKDAYS_GR = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

// Intent guardrail: anything that smells clinical never reaches the AI.
const MEDICAL_PATTERNS =
  /πόνο|πονά|φάρμακ|δόση|δοσολογ|αλλεργ|διάγνωσ|θεραπε[ίι]|σύμπτωμ|συμπτώμ|πυρετ|αιμορραγ|έγκυος|εγκυμοσ|εξάνθημ|χάπι|αντιβί|συνταγ|ασφαλές να|πρέπει να πάρω|τι έχω/i;

const REFUSAL =
  "Δεν μπορώ να απαντήσω σε ιατρικές ερωτήσεις — αυτές τις απαντά μόνο ο ιατρός. Μπορώ να σας βοηθήσω με ώρες λειτουργίας, τοποθεσία και κρατήσεις. Για οτιδήποτε ιατρικό, καλέστε το ιατρείο.";

function hoursSummary(rules: { weekday: number; startTime: string; endTime: string }[]): string {
  if (rules.length === 0) return "Κατόπιν ραντεβού.";
  const byDay = new Map<number, string[]>();
  for (const r of rules) {
    if (!byDay.has(r.weekday)) byDay.set(r.weekday, []);
    byDay.get(r.weekday)!.push(`${r.startTime}–${r.endTime}`);
  }
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => byDay.has(d))
    .map((d) => `${WEEKDAYS_GR[d]}: ${byDay.get(d)!.sort().join(", ")}`)
    .join(" · ");
}

export async function POST(req: Request) {
  // Public, unauthenticated endpoint that can reach a paid AI provider —
  // throttle hard before doing any work.
  const ip = clientIp(req.headers);
  const { allowed, retryAfterSec } = rateLimit(`chat:${ip}`, 15, 5 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { reply: "Λάβαμε πολλά μηνύματα. Δοκιμάστε ξανά σε λίγο ή καλέστε μας τηλεφωνικά." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const body = (await req.json().catch(() => null)) as { slug?: string; message?: string } | null;
  const slug = body?.slug ?? "";
  const message = (body?.message ?? "").trim().slice(0, 500);
  if (!slug || !message) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const clinic = await db.query.clinics.findFirst({
    where: and(eq(clinics.slug, slug), eq(clinics.bookingEnabled, true)),
  });
  if (!clinic) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 1. Hard guardrail before any AI call
  if (MEDICAL_PATTERNS.test(message)) {
    return NextResponse.json({ reply: REFUSAL });
  }

  const rules = await db.query.availabilityRules.findMany({
    where: eq(availabilityRules.clinicId, clinic.id),
    columns: { weekday: true, startTime: true, endTime: true },
  });
  const hours = hoursSummary(rules);

  // 2. AI path — knows ONLY public clinic info, no patient records exist here
  if (aiEnabled()) {
    try {
      const reply = await chatComplete({
        system: `Είσαι ο βοηθός υποδοχής του ιατρείου «${clinic.name}». Απαντάς ΜΟΝΟ σε γενικά/διοικητικά ερωτήματα με βάση τις παρακάτω πληροφορίες. ΠΟΤΕ δεν δίνεις ιατρικές συμβουλές, δεν σχολιάζεις συμπτώματα/φάρμακα και δεν έχεις πρόσβαση σε φακέλους ασθενών — αν ερωτηθείς κάτι ιατρικό, παραπέμπεις στον ιατρό. Απαντάς σύντομα, ευγενικά, στα ελληνικά.

Διεύθυνση: ${clinic.address ?? "—"}
Τηλέφωνο: ${clinic.phone ?? "—"}
Ωράριο (κατόπιν ραντεβού): ${hours}
Κρατήσεις: online σε αυτή τη σελίδα (επιλογή ημέρας και ώρας) ή τηλεφωνικά.
Πληροφορίες: ${clinic.bookingInfo ?? "—"}`,
        user: message,
        maxTokens: 300,
      });
      await db.insert(aiInteractionLogs).values({
        clinicId: clinic.id,
        feature: "reception_chat",
        inputPseudonymized: message,
        output: reply,
        model: aiModel(),
      });
      return NextResponse.json({ reply });
    } catch {
      // fall through to rule-based
    }
  }

  // 3. Rule-based fallback (AI disabled or failed)
  let reply: string;
  if (/ώρ|ανοιχτ|ωράριο|λειτουργ/i.test(message)) {
    reply = `Το ωράριό μας (κατόπιν ραντεβού): ${hours}`;
  } else if (/πού|διεύθυνσ|τοποθεσ|χάρτη|έρθω/i.test(message)) {
    reply = `Θα μας βρείτε: ${clinic.address ?? "επικοινωνήστε τηλεφωνικά"}. ${clinic.phone ? `Τηλέφωνο: ${clinic.phone}` : ""}`;
  } else if (/τηλέφων|καλέσ|επικοινων/i.test(message)) {
    reply = `Τηλέφωνο ιατρείου: ${clinic.phone ?? "—"}.`;
  } else if (/ραντεβού|κράτησ|κλείσω|ακυρώσ/i.test(message)) {
    reply =
      "Μπορείτε να κλείσετε ραντεβού από αυτή τη σελίδα: επιλέξτε ημέρα και ώρα και συμπληρώστε τα στοιχεία σας. Για αλλαγή ή ακύρωση, καλέστε μας.";
  } else {
    reply = `Μπορώ να βοηθήσω με ώρες λειτουργίας, τοποθεσία και ραντεβού. ${clinic.phone ? `Για οτιδήποτε άλλο: ${clinic.phone}` : ""}`;
  }
  return NextResponse.json({ reply });
}
