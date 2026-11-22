import test from "node:test";
import assert from "node:assert/strict";
import {
  monthWindow,
  operationalAlerts,
  plannedDayBookings,
  type OperationBooking,
} from "../src/lib/operations";
const b: OperationBooking = {
  id: "test",
  dressName: "Synthetic dress",
  starts_on: "2026-12-05",
  returns_on: "2026-12-06",
  status: "confirmed",
};
test("month cells and Arabic Saturday offset are computed for December 2026", () => {
  const w = monthWindow("2026-12", "2026-11-22");
  assert.equal(w.offset, 3);
  assert.equal(w.days.length, 31);
  assert.equal(w.previous, "2026-11");
  assert.equal(w.next, "2027-01");
  assert.equal(w.days.at(-1), "2026-12-31");
});
test("month parsing falls back safely and supports leap February", () => {
  assert.equal(monthWindow("2026-13", "2026-11-22").month, "2026-11");
  assert.equal(monthWindow("bad", "2026-11-22").month, "2026-11");
  assert.equal(monthWindow("2028-02", "2026-11-22").days.length, 29);
  assert.equal(monthWindow("2027-02", "2026-11-22").days.length, 28);
});
test("planned preparation occupies exactly one day, including across month boundary", () => {
  assert.equal(plannedDayBookings([b], "2026-12-06")[0].preparation, false);
  assert.equal(plannedDayBookings([b], "2026-12-07")[0].preparation, true);
  assert.equal(plannedDayBookings([b], "2026-12-08").length, 0);
  assert.equal(
    plannedDayBookings([{ ...b, returns_on: "2026-12-31" }], "2027-01-01")[0]
      .preparation,
    true,
  );
});
test("cancelled records neither alert nor occupy planned calendar", () => {
  const records = [{ ...b, status: "cancelled" as const }];
  assert.equal(plannedDayBookings(records, "2026-12-05").length, 0);
  assert.ok(
    Object.values(operationalAlerts(records, "2026-12-05")).every(
      (v) => v.length === 0,
    ),
  );
});
test("outgoing alert is one day before; confirmed past date is not mislabeled overdue return", () => {
  assert.equal(operationalAlerts([b], "2026-12-04").outgoing.length, 1);
  assert.equal(operationalAlerts([b], "2026-12-05").outgoingToday.length, 1);
  const late = operationalAlerts([b], "2026-12-07");
  assert.equal(late.unrecorded.length, 1);
  assert.equal(late.overdue.length, 0);
});
test("return and overdue alerts require recorded outside status and stop on return", () => {
  const out = { ...b, status: "out" as const };
  assert.equal(operationalAlerts([out], "2026-12-06").incoming.length, 1);
  assert.equal(operationalAlerts([out], "2026-12-06").overdue.length, 0);
  assert.equal(operationalAlerts([out], "2026-12-07").overdue.length, 1);
  assert.equal(
    operationalAlerts([{ ...b, status: "returned" }], "2026-12-07").overdue
      .length,
    0,
  );
});
