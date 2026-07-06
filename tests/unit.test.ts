import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFreeSlots } from "../src/lib/slots";
import { pseudonymize } from "../src/lib/ai/pseudonymize";
import { noShowRisk } from "../src/lib/noshow";
import { zonedToUtc, utcToLocalTimeStr, weekdayOfDateStr } from "../src/lib/dates";

test("zonedToUtc: Athens summer time is UTC+3", () => {
  const d = zonedToUtc("2026-07-07", "09:00");
  assert.equal(d.toISOString(), "2026-07-07T06:00:00.000Z");
  assert.equal(utcToLocalTimeStr(d), "09:00");
});

test("zonedToUtc: Athens winter time is UTC+2", () => {
  const d = zonedToUtc("2026-01-15", "09:00");
  assert.equal(d.toISOString(), "2026-01-15T07:00:00.000Z");
});

test("weekdayOfDateStr", () => {
  assert.equal(weekdayOfDateStr("2026-07-07"), 2); // Τρίτη
  assert.equal(weekdayOfDateStr("2026-07-12"), 0); // Κυριακή
});

test("computeFreeSlots: generates slots inside the window, skips busy and past", () => {
  const rules = [{ weekday: 2, startTime: "09:00", endTime: "11:00", slotMinutes: 30 }];
  const busy = [
    { startsAt: zonedToUtc("2026-07-07", "09:30"), endsAt: zonedToUtc("2026-07-07", "10:00") },
  ];
  const now = zonedToUtc("2026-07-07", "08:00");
  const slots = computeFreeSlots("2026-07-07", rules, busy, now);
  assert.deepEqual(
    slots.map((s) => s.label),
    ["09:00", "10:00", "10:30"],
  );
});

test("computeFreeSlots: no rules for that weekday -> empty", () => {
  const rules = [{ weekday: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 30 }];
  assert.deepEqual(computeFreeSlots("2026-07-07", rules, [], new Date(0)), []);
});

test("pseudonymize strips names, ΑΜΚΑ, phones, emails", () => {
  const out = pseudonymize(
    "Ο Νίκος Παππάς (ΑΜΚΑ 12345678901, τηλ 6941234567, nikos@mail.gr) αναφέρει κνησμό.",
    { firstName: "Νίκος", lastName: "Παππάς", amka: "12345678901", phone: "6941234567", email: "nikos@mail.gr" },
  );
  assert.ok(!out.includes("Νίκος"));
  assert.ok(!out.includes("Παππάς"));
  assert.ok(!out.includes("12345678901"));
  assert.ok(!out.includes("6941234567"));
  assert.ok(!out.includes("nikos@mail.gr"));
  assert.ok(out.includes("κνησμό"));
});

test("noShowRisk: smoothed estimate with labels", () => {
  assert.equal(noShowRisk([]).label, "χαμηλός");
  const risky = noShowRisk([
    { status: "no_show" },
    { status: "no_show" },
    { status: "completed" },
  ]);
  assert.equal(risky.label, "μέτριος");
  assert.equal(risky.sample, 3);
  const veryRisky = noShowRisk(Array(10).fill({ status: "no_show" }));
  assert.equal(veryRisky.label, "υψηλός");
});
