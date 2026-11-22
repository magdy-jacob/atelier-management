import Link from "next/link";
import { formatDay } from "@/lib/domain";
import { aggregateMoney, type AdminDashboardData } from "@/lib/admin-dashboard";
export function AdminSummary({
  data,
  preview = false,
}: {
  data: AdminDashboardData;
  preview?: boolean;
}) {
  const number = (v: number) => v.toLocaleString("ar-EG");
  return (
    <div className="space-y-7">
      <section className="studio-card p-6 md:p-8">
        <p className="mb-3 text-xs text-muted-foreground">
          {preview
            ? "بيانات معاينة مصطنعة وليست فعلية"
            : "قراءة فعلية من السجل عند تحميل الصفحة"}
        </p>
        <h2 className="mb-4 text-2xl">الصورة المالية المسجلة</h2>
        <p className="text-xs leading-7 text-muted-foreground">
          الفترة من {formatDay(data.from)} إلى {formatDay(data.to)}، شاملة
          اليومين بتوقيت مصر. المتحصلات أدناه تعني الدفعات المسجلة عند استلامها،
          لا قيمة الحجوزات ولا صافي الإيراد أو الربح. لا يوجد طرح مصروفات أو
          حساب ضرائب أو استردادات في هذا الملخص.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [
              "مبالغ مستلمة مسجلة في الفترة",
              aggregateMoney(data.receipt_piasters),
              `${number(data.receipt_count)} دفعة، تشمل المقدم والباقي`,
            ],
            [
              "غرامات أضيفت في الفترة",
              aggregateMoney(data.fee_piasters),
              `${number(data.fee_count)} بند، إضافتها لا تعني تحصيلها`,
            ],
            [
              "متبقي حالي على الحجوزات غير الملغاة",
              aggregateMoney(data.outstanding_piasters),
              "كل التواريخ، السعر والغرامات ناقص الدفعات المسجلة",
            ],
          ].map(([label, value, detail]) => (
            <div key={label} className="min-w-0 rounded-2xl bg-secondary p-5">
              <p className="mb-4 text-xs leading-7">{label}</p>
              <p className="break-words text-xl leading-9">{value}</p>
              <p className="mt-3 text-[10px] leading-6 text-muted-foreground">
                {detail}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg">التشغيل الحالي</h2>
          <Link
            href={preview ? "/demo/operations" : "/workspace/operations"}
            className="text-xs underline underline-offset-4"
          >
            فتح التقويم والتنبيهات التشغيلية
          </Link>
        </div>
        <p className="mb-5 text-xs leading-7 text-muted-foreground">
          حالات السجل الحالية لجميع التواريخ، وليست عدد الحجوزات خلال الفترة
          المالية. اليوم في مصر {formatDay(data.today)}. مرور الموعد لا يثبت
          تسليمًا أو عودة ولا يغير الحالة تلقائيًا.
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["فساتين في المخزون", data.active_dresses],
            ["فساتين مؤرشفة", data.archived_dresses],
            ["موظفون نشطون", data.active_employees],
            ["حجوزات مؤكدة", data.confirmed_bookings],
            ["مسجل خارج الأتيليه", data.outside_bookings],
            ["مسجل تم إرجاعه", data.returned_bookings],
            ["متأخر عن العودة وهو خارج الأتيليه", data.overdue_bookings],
            ["حجوزات أُنشئت في الفترة", data.created_in_period],
          ].map(([label, value]) => (
            <article
              key={label}
              className={`studio-card min-w-0 p-5 ${label === "متأخر عن العودة وهو خارج الأتيليه" && Number(value) > 0 ? "border-red-200 bg-red-50" : ""}`}
            >
              <h3 className="min-h-12 text-xs leading-6 text-muted-foreground">
                {label}
              </h3>
              <p className="mt-3 text-2xl">{number(Number(value))}</p>
            </article>
          ))}
        </div>
      </section>
      <p className="rounded-xl border border-pink-200 bg-pink-50 p-5 text-xs leading-7">
        الملخص للأدمن فقط. لا يغيّر أي سجل ولا يشغّل الحجوزات. مركز الإشعارات
        المحفوظ وحالة القراءة، والتسليم والعودة والإلغاء والاسترداد والتقارير
        والتصدير ما زالت مسارات منفصلة مطلوب استكمالها؛ هذه الشاشة لا تعني
        اكتمال دورة التشغيل.
      </p>
    </div>
  );
}
