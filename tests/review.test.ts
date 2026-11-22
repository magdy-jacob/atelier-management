import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingNumber,
  cairoMidnight,
  recordedDay,
  auditChanges,
} from "../src/lib/presentation";
import { money } from "../src/lib/domain";
import { aggregateMoney } from "../src/lib/admin-dashboard";
test("original booking numbers are preserved without inventing UUID numbers", () => {
  assert.equal(bookingNumber("b0000000-0000-4000-8000-000000000003"), "3");
  assert.equal(bookingNumber("aae47224-0000-4000-8000-000000000003"), null);
});
test("Cairo filters respect winter, summer and the skipped midnight", () => {
  assert.equal(cairoMidnight("2026-11-22"), "2026-11-21T22:00:00.000Z");
  assert.equal(cairoMidnight("2026-07-01"), "2026-06-30T21:00:00.000Z");
  assert.equal(cairoMidnight("2026-04-24"), "2026-04-23T22:00:00.000Z");
  assert.equal(cairoMidnight("2026-10-30"), "2026-10-29T22:00:00.000Z");
  assert.equal(
    recordedDay("2026-11-21T23:00:00Z"),
    recordedDay("2026-11-22T12:00:00Z"),
  );
});
test("whole pounds omit decimals and fractional piasters remain", () => {
  for (const format of [money, (n: number) => aggregateMoney(String(n))]) {
    assert.ok(!format(500000).includes("٫"));
    assert.ok(format(500025).includes("٫٢٥"));
  }
  assert.ok(aggregateMoney("999999999999999999999900").includes("٩"));
});
test("audit presentation filters technical IDs and retains meaningful old/new values", () => {
  assert.deepEqual(
    auditChanges(
      { id: "old", version: 1, name: "Old" },
      { id: "new", version: 2, name: "New" },
    ).map((x) => x.key),
    ["name"],
  );
});
