import Link from "next/link";
import { StaffFrame } from "@/components/atelier/staff-frame";
import { CancellationPanel } from "@/components/atelier/cancellation-panel";
import { LivePaymentForm } from "@/components/atelier/live-booking-forms";
import { BookingLedger } from "@/components/atelier/records";
export default async function CancellationPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const requested = (await searchParams).view;
  const cancelled = requested === "cancelled",
    out = requested === "out",
    employee = requested === "employee";
  return (
    <StaffFrame
      preview
      title="الإلغاء وتوقيت الدفعات"
      description="معاينة ببيانات مصطنعة وحفظ معطل. الإلغاء قبل التسليم للأدمن، والمقدم غير مسترد. بعد التسليم تكون العودة لا الإلغاء. لا رد مال تلقائي."
      name={employee ? "موظف تجريبي" : "أدمن تجريبي"}
      role={employee ? "employee" : "admin"}
      active="/workspace/bookings"
    >
      <nav
        aria-label="حالات معاينة الإلغاء"
        className="flex flex-wrap gap-3 text-xs"
      >
        {[
          ["admin", "قبل التسليم"],
          ["out", "عند العودة"],
          ["cancelled", "حجز ملغى"],
          ["employee", "صلاحية موظف"],
        ].map(([view, label]) => (
          <Link
            key={view}
            href={`/demo/cancellation?view=${view}`}
            className="rounded-full border bg-white px-4 py-3"
          >
            {label}
          </Link>
        ))}
      </nav>
      {cancelled && (
        <BookingLedger
          cancelled
          price={10000}
          fees="0"
          payments={[
            {
              id: "fixture",
              amount_piasters: 2500,
              kind: "deposit",
              method: null,
              recorded_at: "2026-12-04T12:00:00Z",
            },
          ]}
        />
      )}
      {out && (
        <LivePaymentForm
          preview
          enabled
          requestId="demo-return-payment"
          bookingId="demo-booking"
          methods={[]}
          context="return_balance"
          defaultAmount="75.00"
        />
      )}
      <CancellationPanel
        preview
        enabled
        bookingId="demo-booking"
        status={cancelled ? "cancelled" : out ? "out" : "confirmed"}
        admin={!employee}
        deposit="2500"
        cancellation={
          cancelled
            ? {
                reason: "اختبار إلغاء قبل التسليم",
                retained_deposit_piasters: "2500",
                created_at: "2026-12-04T12:00:00Z",
              }
            : null
        }
      />
    </StaffFrame>
  );
}
