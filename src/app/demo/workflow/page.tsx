import Link from "next/link";
import { StaffFrame } from "@/components/atelier/staff-frame";
import { BookingWorkflow } from "@/components/atelier/booking-workflow";
import type { WorkflowData } from "@/lib/workflow";
export default async function WorkflowPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const requested = (await searchParams).view ?? "return";
  const view = [
    "shared-read",
    "handover",
    "return",
    "unpaid",
    "returned",
    "maintenance-admin",
  ].includes(requested)
    ? requested
    : "return";
  const returned = view === "returned" || view === "maintenance-admin";
  const admin = view === "maintenance-admin";
  const handover = view === "handover" || view === "shared-read";
  const data: WorkflowData = {
    today: admin ? "2026-12-07" : "2026-12-05",
    handover: handover
      ? null
      : {
          id: "demo-handover",
          handed_over_on: "2026-12-03",
          card_received: true,
          recorded_by: "demo-staff",
        },
    return: returned
      ? {
          id: "demo-return",
          returned_on: "2026-12-05",
          card_released: true,
          inspection: "maintenance",
          issues: ["accessories", "zipper"],
          recorded_by: "demo-staff",
        }
      : null,
    operation: handover ? "in_atelier" : returned ? "maintenance" : "outside",
    ready_on: returned ? "2026-12-07" : null,
    maintenance_required: returned,
  };
  return (
    <StaffFrame
      preview
      title="التسليم والعودة والفحص"
      description="معاينة بنفس مكونات الحجز الفعلي، ببيانات مصطنعة وحفظ معطل. لا رقم أو صورة هوية، ولا صورة فحص أو تحصيل إلكتروني."
      name={admin ? "أدمن تجريبي" : "موظف تجريبي"}
      role={admin ? "admin" : "employee"}
      active="/workspace/bookings"
    >
      <nav className="flex flex-wrap gap-2" aria-label="حالات معاينة الدورة">
        {[
          ["handover", "تسليم بالمقدم"],
          ["return", "عودة بعد سداد الرصيد"],
          ["unpaid", "عودة برصيد لم يُسدد"],
          ["returned", "فحص محفوظ وتجهيز"],
          ["maintenance-admin", "إنهاء صيانة، أدمن"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/demo/workflow?view=${key}`}
            className={`rounded-full border px-4 py-2 text-xs ${view === key ? "bg-primary text-white" : "bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <BookingWorkflow
        operationalAccess={view !== "shared-read"}
        admin={admin}
        key={view}
        bookingId="demo-booking"
        dressId="demo-dress"
        status={handover ? "confirmed" : returned ? "returned" : "out"}
        startsOn={handover ? "2026-12-05" : "2026-12-03"}
        returnsOn={handover ? "2026-12-06" : "2026-12-04"}
        paid={view === "unpaid" || handover ? "100000" : "300000"}
        remaining={view === "unpaid" || handover ? "200000" : "0"}
        data={data}
        enabled={false}
        preview
      />
    </StaffFrame>
  );
}
