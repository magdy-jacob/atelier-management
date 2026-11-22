import { test } from "node:test";
import assert from "node:assert/strict";
import { handoverInPlannedDays, workflowSchema } from "../src/lib/workflow";
test("handover window includes planned start/return days, not invented early/extended dates", () => {
  assert.equal(
    handoverInPlannedDays("2026-12-05", "2026-12-05", "2026-12-06"),
    true,
  );
  assert.equal(
    handoverInPlannedDays("2026-12-06", "2026-12-05", "2026-12-06"),
    true,
  );
  assert.equal(
    handoverInPlannedDays("2026-12-04", "2026-12-05", "2026-12-06"),
    false,
  );
  assert.equal(
    handoverInPlannedDays("2026-12-07", "2026-12-05", "2026-12-06"),
    false,
  );
  assert.equal(handoverInPlannedDays("bad", "2026-12-05", "2026-12-06"), false);
});
test("workflow response fails closed on invalid dates or unknown state", () => {
  const valid = {
    today: "2026-12-05",
    handover: null,
    return: null,
    operation: null,
    ready_on: null,
  };
  assert.equal(workflowSchema.safeParse(valid).success, true);
  assert.equal(
    workflowSchema.safeParse({ ...valid, today: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    workflowSchema.safeParse({ ...valid, operation: "unknown" }).success,
    false,
  );
});
