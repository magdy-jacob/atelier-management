import Link from "next/link";
import { formatDay } from "@/lib/domain";
import {
  monthWindow,
  operationalAlerts,
  plannedDayBookings,
  type OperationBooking,
} from "@/lib/operations";

function AlertGroup({
  title,
  bookings,
  urgent,
  preview,
}: {
  title: string;
  bookings: OperationBooking[];
  urgent?: boolean;
  preview: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 ${urgent ? "border-red-200 bg-red-50" : "bg-white"}`}
    >
      <h3 className={`mb-4 text-sm ${urgent ? "text-red-900" : ""}`}>
        {title}{" "}
        <span className="text-xs">
          ({bookings.length.toLocaleString("ar-EG")})
        </span>
      </h3>
      {bookings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          لا توجد بنود في البيانات المعروضة.
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border bg-white/70 p-3 text-xs leading-7"
            >
              <Link
                href={preview ? "#calendar" : `/workspace/bookings/${b.id}`}
                className="font-medium underline underline-offset-4"
              >
                {b.dressName}
              </Link>
              <p className="text-[11px] text-muted-foreground">
                خروج {formatDay(b.starts_on)} · عودة {formatDay(b.returns_on)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function OperationsBoard({
  bookings,
  today,
  month,
  preview = false,
  admin = false,
  truncated = false,
}: {
  bookings: OperationBooking[];
  today: string;
  month?: string;
  preview?: boolean;
  admin?: boolean;
  truncated?: boolean;
}) {
  const window = monthWindow(month, today);
  const alerts = operationalAlerts(bookings, today);
  const path = preview ? "/demo/operations" : "/workspace/operations";
  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${window.start}T12:00:00Z`));
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5">
        <p className="text-sm">
          اليوم في مصر: <time dateTime={today}>{formatDay(today)}</time>
        </p>
        <Link
          href={`${path}?month=${today.slice(0, 7)}`}
          className="rounded-full border px-4 py-2 text-xs"
        >
          الشهر الحالي
        </Link>
      </div>
      <p className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-xs leading-7">
        هذه قراءة للمواعيد والحالات المسجلة، لا تؤكد تسليمًا أو عودة فعلية. فترة
        التجهيز في التقويم محسوبة من موعد العودة المخطط. لا تُرسل إشعارات خارج
        الموقع، ولا تُحسب غرامة تلقائيًا. تغيرات اليوم تظهر عند إعادة تحميل
        الصفحة.
      </p>
      {truncated && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-7"
        >
          تجاوزت نتيجة واحدة حد العرض (١٠٠٠ حجز). الأعداد والتقويم غير مكتملين؛
          لا تعتمد عليهما كحصر شامل. ضيّق الفترة أو راجع قاعدة البيانات مع
          الأدمن.
        </p>
      )}
      {admin ? (
        <div className="grid gap-4 md:grid-cols-2">
          <AlertGroup
            title="تجهيز للخروج غدًا"
            bookings={alerts.outgoing}
            preview={preview}
          />
          <AlertGroup
            title="خروج مقرر اليوم"
            bookings={alerts.outgoingToday}
            preview={preview}
          />
          <AlertGroup
            title="عودة مطلوبة اليوم"
            bookings={alerts.incoming}
            preview={preview}
          />
          <AlertGroup
            title="متأخر عن العودة المسجلة"
            bookings={alerts.overdue}
            urgent
            preview={preview}
          />
          <AlertGroup
            title="موعد خروج سابق دون تسجيل التسليم"
            bookings={alerts.unrecorded}
            preview={preview}
          />
        </div>
      ) : (
        <p className="text-xs leading-7 text-muted-foreground">
          التقويم يعرض الحجوزات المصرح بها لهذا الحساب فقط. مركز التنبيهات العام
          للأدمن.
        </p>
      )}
      <section id="calendar" className="studio-card overflow-hidden p-4 md:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl">تقويم {monthLabel}</h2>
          <div className="flex gap-2">
            <Link
              aria-label="الشهر السابق"
              className="rounded-full border px-4 py-2 text-xs"
              href={`${path}?month=${window.previous}`}
            >
              السابق
            </Link>
            <Link
              aria-label="الشهر التالي"
              className="rounded-full border px-4 py-2 text-xs"
              href={`${path}?month=${window.next}`}
            >
              التالي
            </Link>
          </div>
        </div>
        <div className="mb-5 flex flex-wrap gap-3 text-[11px]">
          <span className="rounded bg-primary/10 px-3 py-2">حجز مخطط</span>
          <span className="rounded border border-dashed border-pink-500 bg-pink-50 px-3 py-2">
            يوم تجهيز مخطط
          </span>
          <span className="rounded bg-red-100 px-3 py-2">
            تجاوز العودة وهو مسجل خارج الأتيليه
          </span>
        </div>
        <p className="mb-4 text-[11px] leading-6 text-muted-foreground">
          عرض الشهر يضم العودة ويوم التجهيز التالي. الحجوزات الملغاة مستبعدة. لا
          يظهر سعر أو هاتف عميل في التقويم.
        </p>
        <div className="hidden grid-cols-7 gap-2 pb-3 text-center text-xs md:grid">
          {[
            "السبت",
            "الأحد",
            "الاثنين",
            "الثلاثاء",
            "الأربعاء",
            "الخميس",
            "الجمعة",
          ].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {Array.from({ length: window.offset }, (_, i) => (
            <div key={`empty-${i}`} className="hidden md:block" />
          ))}
          {window.days.map((day) => {
            const items = plannedDayBookings(bookings, day);
            return (
              <article
                key={day}
                className={`min-h-24 min-w-0 rounded-xl border p-3 ${day === today ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-white"}`}
              >
                <h3 className="mb-2 text-[11px]">
                  <time dateTime={day}>
                    {new Intl.DateTimeFormat("ar-EG", {
                      weekday: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${day}T12:00:00Z`))}
                  </time>
                  {day === today && (
                    <span className="mr-1 text-primary">اليوم</span>
                  )}
                </h3>
                {items.length ? (
                  <ul className="space-y-2">
                    {items.map((b) => (
                      <li key={b.id}>
                        <Link
                          href={
                            preview
                              ? "#calendar"
                              : `/workspace/bookings/${b.id}`
                          }
                          className={`block break-words rounded-md px-2 py-2 text-[10px] leading-5 ${b.preparation ? "border border-dashed border-pink-500 bg-pink-50" : b.status === "out" && b.returns_on < today ? "bg-red-100 text-red-900" : "bg-primary/10"}`}
                        >
                          {b.dressName}
                          {b.preparation && (
                            <span className="block">تجهيز مخطط</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] leading-5 text-muted-foreground">
                    لا مواعيد في البيانات المعروضة
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
