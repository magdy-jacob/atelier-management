import { z } from "zod";
import { dateInZone, validDay } from "./domain";
const amount = z.string().regex(/^\d+$/);
export const receiptReportSchema = z
  .object({
    from: z.string().refine(validDay),
    to: z.string().refine(validDay),
    generated_at: z.string().datetime({ offset: true }),
    count: z.number().int().min(0).max(5000),
    amount_piasters: amount,
    rows: z
      .array(
        z.object({
          receipt_id: z.string().uuid(),
          booking_id: z.string().uuid(),
          recorded_at: z.string().datetime({ offset: true }),
          amount_piasters: amount,
          method: z.string().nullable(),
          dress_code: z.string(),
          dress_name: z.string(),
          customer_name: z.string(),
          customer_phone: z.string(),
          recorded_by_name: z.string().nullable(),
        }),
      )
      .max(5000),
  })
  .superRefine((data, ctx) => {
    if (
      !/^\d+$/.test(data.amount_piasters) ||
      data.rows.some((r) => !/^\d+$/.test(r.amount_piasters))
    )
      return;
    if (
      data.count !== data.rows.length ||
      new Set(data.rows.map((r) => r.receipt_id)).size !== data.count ||
      BigInt(data.amount_piasters) !==
        data.rows.reduce((n, r) => n + BigInt(r.amount_piasters), BigInt(0))
    )
      ctx.addIssue({
        code: "custom",
        message: "Receipt report does not reconcile",
      });
  });
export type ReceiptReportData = z.infer<typeof receiptReportSchema>;
export function reportPeriod(from?: string, to?: string) {
  const today = dateInZone(new Date(), "Africa/Cairo");
  const start = from ?? `${today.slice(0, 7)}-01`,
    end = to ?? today;
  return {
    from: start,
    to: end,
    valid:
      validDay(start) &&
      validDay(end) &&
      end >= start &&
      (Date.parse(end) - Date.parse(start)) / 86400000 <= 365,
  };
}
export function csvCell(value: string) {
  const safe =
    /^[\s\uFEFF]*[=+@\-]/u.test(value) || /^[\t\r\n]/u.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function decimalPiasters(value: string) {
  if (!/^\d+$/.test(value)) throw new Error("Invalid piasters");
  const n = BigInt(value);
  return `${n / BigInt(100)}.${(n % BigInt(100)).toString().padStart(2, "0")}`;
}
export function receiptCSV(input: ReceiptReportData) {
  const data = receiptReportSchema.parse(input);
  const headers = [
    "معرف الدفعة",
    "معرف الحجز",
    "وقت التسجيل UTC",
    "وقت التسجيل بتوقيت القاهرة",
    "كود الفستان",
    "الفستان",
    "اسم العميل",
    "هاتف العميل",
    "المبلغ المستلم جنيه مصري",
    "وصف طريقة الاستلام",
    "سجلها",
  ];
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  });
  const rows = data.rows.map((r) => [
    r.receipt_id,
    r.booking_id,
    r.recorded_at,
    local.format(new Date(r.recorded_at)),
    r.dress_code,
    r.dress_name,
    r.customer_name,
    r.customer_phone,
    decimalPiasters(r.amount_piasters),
    r.method ?? "",
    r.recorded_by_name ?? "",
  ]);
  return (
    "\uFEFF" +
    [headers, ...rows]
      .map((row, rowIndex) =>
        row
          .map((cell, index) =>
            csvCell(
              rowIndex > 0 && (index === 4 || index === 7) ? `'${cell}` : cell,
            ),
          )
          .join(","),
      )
      .join("\r\n") +
    "\r\n"
  );
}
export const receiptDownloadHeaders = (name: string) => ({
  "Content-Type": "text/csv; charset=utf-8",
  "Content-Disposition": `attachment; filename="${name}"`,
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
});
