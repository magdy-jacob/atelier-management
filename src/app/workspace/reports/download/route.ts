import { requireStaff } from "@/lib/supabase/auth";
import {
  receiptCSV,
  receiptDownloadHeaders,
  receiptReportSchema,
  reportPeriod,
} from "@/lib/receipt-report";
export const dynamic = "force-dynamic";
const failure = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function GET(request: Request) {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return failure(403, "التصدير للأدمن فقط.");
  const q = new URL(request.url).searchParams;
  if (!q.has("from") || !q.has("to"))
    return failure(400, "حدد تاريخي الفترة صراحة.");
  const p = reportPeriod(q.get("from") ?? undefined, q.get("to") ?? undefined);
  if (!p.valid) return failure(400, "فترة غير صالحة؛ الحد ٣٦٦ يومًا.");
  const { data, error } = await db.rpc("admin_receipt_report", {
    p_from: p.from,
    p_to: p.to,
  });
  if (error)
    return failure(
      error.message.includes("report_too_large_narrow_period") ? 422 : 503,
      error.message.includes("report_too_large_narrow_period")
        ? "ضيّق الفترة إلى ٥٠٠٠ حركة أو أقل؛ لم يُصدّر جزء من البيانات."
        : "تعذر التحقق من دفتر القبض. لم يُنشأ ملف.",
    );
  const parsed = receiptReportSchema.safeParse(data);
  if (!parsed.success)
    return failure(503, "تعذر مطابقة مجموع وعدد الحركات؛ لم يُنشأ ملف.");
  return new Response(receiptCSV(parsed.data), {
    headers: receiptDownloadHeaders(`lovely-receipts-${p.from}-${p.to}.csv`),
  });
}
