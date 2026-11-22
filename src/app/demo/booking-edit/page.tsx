import Link from "next/link";
import { StaffFrame } from "@/components/atelier/staff-frame";
import { BookingEditPanel } from "@/components/atelier/booking-edit-panel";
export default async function BookingEditPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const view = (await searchParams).view,
    admin = view !== "employee",
    status =
      view === "out" ? "out" : view === "cancelled" ? "cancelled" : "confirmed";
  return (
    <StaffFrame
      preview
      title="تعديل حجز محفوظ"
      description="معاينة مصطنعة لا تحفظ. الأدمن يعدل الموعد والسعر قبل التسليم، بسبب وسجل كامل، دون تغيير الإيصالات أو العميلة أو الفستان."
      name={admin ? "أدمن تجريبي" : "موظف تجريبي"}
      role={admin ? "admin" : "employee"}
      active="/workspace/bookings"
    >
      <nav
        aria-label="حالات معاينة تعديل الحجز"
        className="flex flex-wrap gap-3 text-xs"
      >
        {[
          ["admin", "قبل التسليم"],
          ["out", "بعد التسليم"],
          ["employee", "صلاحية موظف"],
          ["cancelled", "حجز ملغى"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/demo/booking-edit?view=${key}`}
            className="rounded-full border bg-white px-4 py-3"
          >
            {label}
          </Link>
        ))}
      </nav>
      <BookingEditPanel
        preview
        enabled
        admin={admin}
        paid="2500"
        booking={{
          id: "11111111-1111-4111-8111-111111111111",
          version: 2,
          starts_on: "2026-12-08",
          returns_on: "2026-12-09",
          agreed_price_piasters: "12500",
          status,
        }}
        history={[
          {
            id: "fixture",
            reason: "اختبار نقل الموعد مع الاحتفاظ بالمقدم",
            old_start: "2026-12-05",
            old_return: "2026-12-06",
            new_start: "2026-12-08",
            new_return: "2026-12-09",
            old_price_piasters: "10000",
            new_price_piasters: "12500",
            recorded_by: "fixture",
            actor_name: "أدمن تجريبي",
            created_at: "2026-11-22T12:00:00Z",
          },
        ]}
      />
    </StaffFrame>
  );
}
