import test from "node:test";
import assert from "node:assert/strict";
import {
  csvCell,
  decimalPiasters,
  receiptCSV,
  receiptReportSchema,
  reportPeriod,
} from "../src/lib/receipt-report";
import { demoReceiptReport } from "../src/lib/demo-receipts";
test("receipt CSV protects formula cells, whitespace variants and embedded delimiters", () => {
  for (const input of [
    "=1+1",
    "+201234567890",
    "-1+1",
    "@SUM(1)",
    " \t=1",
    "\r=1",
    "\uFEFF=1",
  ])
    assert.ok(csvCell(input).startsWith("\"'"));
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
});
test("receipt export preserves exact piasters and reconciles every row before export", () => {
  assert.equal(decimalPiasters("900719925474099301"), "9007199254740993.01");
  assert.equal(decimalPiasters("1"), "0.01");
  assert.throws(() => decimalPiasters("1.2"));
  const invalid = structuredClone(demoReceiptReport);
  invalid.amount_piasters = "300051";
  assert.equal(receiptReportSchema.safeParse(invalid).success, false);
  assert.throws(() => receiptCSV(invalid));
  invalid.amount_piasters = "bad";
  assert.equal(receiptReportSchema.safeParse(invalid).success, false);
  invalid.amount_piasters = "300050";
  invalid.rows[1].receipt_id = invalid.rows[0].receipt_id;
  assert.equal(receiptReportSchema.safeParse(invalid).success, false);
  invalid.amount_piasters = "300050";
  invalid.count = 3;
  assert.equal(receiptReportSchema.safeParse(invalid).success, false);
});
test("receipt CSV is UTF-8 Excel-friendly with literal phone/code text and no invented payment method", () => {
  const data = structuredClone(demoReceiptReport);
  data.rows[0].customer_phone = "01000000000";
  data.rows[0].dress_code = "00123";
  const csv = receiptCSV(data);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'01000000000"'));
  assert.ok(csv.includes('"\'00123"'));
  assert.ok(csv.includes("1000.25"));
  assert.ok(csv.includes("\r\n"));
  assert.equal(csv.split("\r\n").length, 4);
});
test("receipt reporting periods reject reversed, rolled and oversized days without fallback", () => {
  assert.equal(reportPeriod("2026-12-05", "2026-12-04").valid, false);
  assert.equal(reportPeriod("2026-02-30", "2026-03-01").valid, false);
  assert.equal(reportPeriod("2026-01-01", "2027-01-02").valid, false);
  assert.equal(reportPeriod("2026-01-01", "2027-01-01").valid, true);
  assert.equal(reportPeriod("bad", "2026-12-05").from, "bad");
});
