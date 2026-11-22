import test from "node:test";
import assert from "node:assert/strict";
import { aggregateMoney, dashboardSchema } from "../src/lib/admin-dashboard";
test("aggregate currency preserves piasters above JavaScript safe integer range", () => {
  const value = aggregateMoney("900719925474099329");
  const digits = value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^0-9]/g, "");
  assert.equal(digits, "900719925474099329");
});
test("aggregate currency keeps zero and one piaster separate and rejects malformed sums", () => {
  assert.notEqual(aggregateMoney("0"), aggregateMoney("1"));
  assert.throws(() => aggregateMoney("1.2"));
  assert.throws(() => aggregateMoney("-1"));
  assert.throws(() => aggregateMoney(""));
});
test("dashboard schema cannot silently turn missing or malformed amounts into zero", () => {
  assert.equal(
    dashboardSchema.safeParse({ receipt_piasters: null }).success,
    false,
  );
});
