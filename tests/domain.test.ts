import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  validDay,
  overlaps,
  firstAvailable,
  sampleBookings,
  toPiasters,
} from "../src/lib/domain";
test("December 5-6 rental blocks December 6 and 7, permits 8", () => {
  const b = { start: "2026-12-05", end: "2026-12-06" };
  assert.ok(overlaps(b, { start: "2026-12-06", end: "2026-12-06" }));
  assert.ok(overlaps(b, { start: "2026-12-07", end: "2026-12-07" }));
  assert.equal(overlaps(b, { start: "2026-12-08", end: "2026-12-08" }), false);
});
test("preparation on either side cannot overlap", () => {
  assert.ok(
    overlaps(
      { start: "2026-12-03", end: "2026-12-04" },
      { start: "2026-12-05", end: "2026-12-06" },
    ),
  );
});
test("first available day respects preparation", () =>
  assert.equal(
    firstAvailable("2026-12-06", 1, sampleBookings, "sage"),
    "2026-12-08",
  ));
test("cancelled bookings do not occupy a dress", () =>
  assert.equal(
    firstAvailable(
      "2026-12-06",
      0,
      sampleBookings.map((b) => ({ ...b, status: "cancelled" })),
      "sage",
    ),
    "2026-12-06",
  ));
test("calendar date validation rejects rollover", () => {
  assert.ok(validDay("2028-02-29"));
  assert.equal(validDay("2026-02-29"), false);
  assert.equal(validDay("2026-02-30"), false);
  assert.equal(validDay("bad"), false);
});
test("date arithmetic across year and leap day", () => {
  assert.equal(addDays("2026-12-31", 2), "2027-01-02");
  assert.equal(addDays("2028-02-28", 2), "2028-03-01");
});
test("money stored in integer piasters, no float rounding", () => {
  assert.equal(toPiasters("0.29"), 29);
  assert.equal(toPiasters("3000"), 300000);
  assert.equal(toPiasters("40.5"), 4050);
  assert.throws(() => toPiasters("1.001"));
  assert.throws(() => toPiasters("-1"));
  assert.throws(() => toPiasters("1e4"));
});
test("fixed demo day is Saturday", () =>
  assert.equal(new Date("2026-12-05T12:00:00Z").getUTCDay(), 6));
