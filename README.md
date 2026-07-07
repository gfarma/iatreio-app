# Iatreio — SaaS Διαχείρισης Ιατρείου 🇬🇷

Multi-specialty πρόγραμμα διαχείρισης ιατρείου για την ελληνική αγορά, με AI-native
διοικητικό layer (ποτέ διάγνωση) και δημόσια σελίδα online κρατήσεων ανά ιατρείο.

**🌐 Live demo:** https://iatreio.46-225-102-204.sslip.io — login `owner@demo.gr` /
`demo1234` · [δημόσια σελίδα κράτησης](https://iatreio.46-225-102-204.sslip.io/demo-derma/booking)

> ⚠️ **Demo περιβάλλον — μόνο πλαστά δεδομένα.** Δεν μπαίνουν πραγματικά δεδομένα
> ασθενών πριν: (1) κλειδωθεί DPA-backed AI πάροχος (EU), (2) γίνει security review,
> (3) αποφασιστεί το τελικό hosting (Vercel/Neon EU ή δικό μας VPS).

## Χαρακτηριστικά (MVP — Φάση 1)

- **Auth & ρόλοι**: owner / doctor / staff, με multi-clinic support και clinic switcher.
- **RBAC**: η γραμματεία διαχειρίζεται ραντεβού/δημογραφικά/τιμολόγηση αλλά **δεν βλέπει κλινικές σημειώσεις**.
- **Ασθενείς**: CRUD με configurable πεδία ανά ειδικότητα (`SpecialtyTemplate`, JSON — χωρίς migrations).
- **Ραντεβού**: ημερολόγιο day/week/month ανά ιατρό, αλλαγή κατάστασης, σύνδεση με φάκελο.
- **Δημόσια κράτηση** `/{clinic-slug}/booking`: SEO-friendly (meta + JSON-LD), υπολογισμός ελεύθερων slots από εβδομαδιαίους κανόνες διαθεσιμότητας, honeypot + rate-limit + server-side revalidation του slot.
- **Επισκέψεις**: σημειώσεις + πεδία ειδικότητας + κωδικοί ICD-10, σύνδεση με ραντεβού.
- **Τιμολόγηση**: αποδείξεις με per-clinic αρίθμηση, εκτυπώσιμες. Πεδία myDATA έτοιμα (Φάση 2).
- **GDPR**: audit log σε κάθε read/write ασθενή, consent tracking, export JSON, ανωνυμοποίηση (right to erasure), viewer στο `/audit`.

### AI features (Φάση 1.5 — πίσω από `ENABLE_AI_FEATURES`)

Όλα vendor-neutral (OpenAI-compatible endpoint μέσω `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`):

1. **Δόμηση σημειώσεων** — με υποχρεωτικό preview + «Αποδοχή» από τον ιατρό (human-in-the-loop).
2. **Πρόταση ICD-10** — 2-3 προτάσεις, ο ιατρός επιλέγει.
3. **Reception chatbot** στη σελίδα κράτησης — keyword guardrail πριν το AI call, μηδενική πρόσβαση σε φακέλους, rule-based fallback όταν το AI είναι κλειστό (δουλεύει και τώρα!).
4. **No-show πρόβλεψη** — καθαρά στατιστική (χωρίς LLM/GDPR ρίσκο), badge στον φάκελο.

Κάθε AI call καταγράφεται στο `AIInteractionLog` με **ψευδωνυμοποιημένο** input
(αφαίρεση ονόματος/ΑΜΚΑ/τηλεφώνου/email πριν φύγει οτιδήποτε από την εφαρμογή).

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind 4 · **Drizzle ORM** ·
PostgreSQL (**PGlite** τοπικά — zero setup, **Neon** σε production) · session auth με `jose`.

Γιατί Drizzle: το ίδιο Postgres schema τρέχει σε embedded PGlite τοπικά και σε Neon
serverless σε production, χωρίς docker και χωρίς αλλαγές.

## Τοπική εκτέλεση

```bash
npm install
npm run db:migrate   # φτιάχνει την τοπική PGlite DB στο .data/
npm run db:seed      # demo ιατρεία, χρήστες, ασθενείς, ραντεβού
npm run dev
```

Άνοιξε http://localhost:3000 — **demo λογαριασμοί** (κωδικός `demo1234`):

| Email | Ρόλος |
|---|---|
| `owner@demo.gr` | Διαχειριστής (2 ιατρεία) |
| `doctor@demo.gr` | Ιατρός |
| `staff@demo.gr` | Γραμματεία |

Δημόσια σελίδα κράτησης: http://localhost:3000/demo-derma/booking

```bash
npm test             # unit tests (slots, pseudonymization, no-show, timezones)
npm run build        # production build
```

## Deploy (Vercel + Neon) — ~5 λεπτά

1. [Neon](https://neon.tech): νέο project σε **EU region** (π.χ. Frankfurt) → αντέγραψε το connection string.
2. [Vercel](https://vercel.com/new): Import το repo `gfarma/iatreio-app` → Environment Variables:
   - `DATABASE_URL` = το Neon string
   - `AUTH_SECRET` = `openssl rand -base64 32`
   - `ENABLE_AI_FEATURES` = `false` (μέχρι να κλειδωθεί EU AI πάροχος)
3. Deploy. Μετά το πρώτο deploy, τρέξε migrations + seed τοπικά προς τη Neon:
   ```bash
   DATABASE_URL="postgresql://…" npm run db:migrate
   DATABASE_URL="postgresql://…" npm run db:seed
   ```
4. Έτοιμο — κάθε push στο `main` κάνει auto-deploy.

## Αρχιτεκτονική / αποφάσεις

- **Tenancy guard**: κάθε σελίδα/action περνά από `requireContext()` (ενεργό ιατρείο +
  ρόλος) και **κάθε** query φιλτράρει με `clinicId` — δεν υπάρχει global fetch οντότητας.
- **Public bookings χωρίς junk patients**: η online κράτηση αποθηκεύει contact στοιχεία
  πάνω στο ραντεβού (`contactName/Phone/Email`)· η γραμματεία τη συνδέει με (νέο ή
  υπάρχοντα) ασθενή όταν επιβεβαιώσει — αποφεύγονται διπλοεγγραφές.
- **Χρόνος**: όλα αποθηκεύονται UTC· τα ωράρια ορίζονται σε ώρα Ελλάδας
  (`Europe/Athens`) με DST-safe μετατροπή χωρίς εξωτερικές βιβλιοθήκες.
- **GDPR erasure = ανωνυμοποίηση** in-place, ώστε τιμολόγια/audit να κρατούν
  referential integrity χωρίς προσωπικά δεδομένα.
- **Όρια AI (σκόπιμα)**: καμία patient-specific διαγνωστική/θεραπευτική πρόταση —
  παραμένουμε εκτός SaMD (EU MDR Rule 11 / AI Act high-risk).

## Phase 2 (placeholders μόνο)

myDATA μέσω αδειοδοτημένου παρόχου (`mydata_status`/`mydata_uid` έτοιμα) ·
ΗΔΙΚΑ e-συνταγογράφηση · SMS/email υπενθυμίσεις (abstraction υπάρχει ως TODO στο
booking action) · ambient scribe add-on · custom domains ανά ιατρείο.

---

© 2026 gfarma — All rights reserved (βλ. LICENSE). Χτίστηκε με Claude Code.
