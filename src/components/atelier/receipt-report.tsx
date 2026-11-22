import Link from "next/link";
import { formatDay } from "@/lib/domain";
import { aggregateMoney } from "@/lib/admin-dashboard";
import type { ReceiptReportData } from "@/lib/receipt-report";
export function ReceiptReport({
  data,
  downloadHref,
  preview = false,
}: {
  data: ReceiptReportData;
  downloadHref: string;
  preview?: boolean;
}) {
  const local = new Intl.DateTimeFormat("ar-EG", {
    timeZone: "Africa/Cairo",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <section className="space-y-6">
      <p className="text-xs leading-7 text-muted-foreground">
        الفترة المعروضة: {formatDay(data.from)} إلى {formatDay(data.to)}، بتوقيت
        مصر.
      </p>
      <div className="studio-card flex flex-wrap items-center justify-between gap-5 p-6">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            {data.count} حركة قبض مسجلة خلال الفترة بتوقيت مصر
          </p>
          <p className="text-2xl font-semibold">
            {aggregateMoney(data.amount_piasters)}
          </p>
        </div>
        <Link
          prefetch={false}
          className="rounded-full bg-primary px-5 py-3 text-xs text-white"
          href={downloadHref}
        >
          {preview ? "تنزيل CSV مصطنع فقط" : "تنزيل دفتر القبض CSV"}
        </Link>
      </div>
      <p className="rounded-xl bg-secondary p-5 text-xs leading-7">
        هذا دفتر مبالغ مستلمة مسجلة، وليس قيمة الحجوزات أو الغرامات غير المحصلة
        أو صافي الربح. الفترة تخص وقت تسجيل الدفعة، لا يوم المناسبة. لا ينشئ
        التصدير دفعة أو تعديلًا. يحتوي التصدير الحقيقي أسماء وهواتف عملاء؛ احتفظ
        به لدى المخوّلين فقط.
      </p>
      {data.rows.length === 0 ? (
        <p className="studio-card p-6 text-sm">
          لا توجد حركات قبض مسجلة في هذه الفترة. ملف CSV سيحتوي عناوين الأعمدة
          فقط، وليس أرقامًا افتراضية.
        </p>
      ) : (
        <div className="studio-card divide-y">
          {data.rows.slice(0, 20).map((r) => (
            <article
              key={r.receipt_id}
              className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <h2 className="mb-2 text-sm">{r.customer_name}</h2>
                <p className="text-xs text-muted-foreground">
                  {r.dress_name} · <bdi>{r.dress_code}</bdi>
                </p>
              </div>
              <div className="text-xs leading-7 text-muted-foreground">
                <p>{local.format(new Date(r.recorded_at))}</p>
                <p>{r.method ?? "طريقة الاستلام غير مسجلة"}</p>
              </div>
              <p className="text-sm font-medium">
                {aggregateMoney(r.amount_piasters)}
              </p>
            </article>
          ))}
        </div>
      )}
      {data.rows.length > 20 && (
        <p className="text-xs text-muted-foreground">
          عرض أول ٢٠ حركة فقط؛ CSV يشمل كل {data.count} حركة ضمن الفترة. لا يوجد
          اقتطاع صامت للتصدير.
        </p>
      )}
      <p className="text-[10px] leading-6 text-muted-foreground">
        أُنشئت القراءة: {local.format(new Date(data.generated_at))}. عند تنزيل
        الملف تُقرأ الفترة من جديد؛ قد تظهر دفعات سُجلت بعد فتح الصفحة. الحد ٥٠٠٠
        حركة و٣٦٦ يومًا، وإلا يلزم تضييق الفترة بدل ملف ناقص.
      </p>
    </section>
  );
}
