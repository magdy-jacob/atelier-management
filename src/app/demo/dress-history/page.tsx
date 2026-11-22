import { StaffFrame } from "@/components/atelier/staff-frame";
import { DressHistory } from "@/components/atelier/dress-history";
export default async function DressHistoryPreview({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const admin = (await searchParams).role !== "employee";
  return (
    <StaffFrame
      preview
      title="سجل فستان مصطنع"
      description="حجوزات وتغييرات فستان للأدمن فقط. بيانات توضيحية غير متصلة، ولا تعديل أو حفظ من هنا."
      name={admin ? "أدمن تجريبي" : "موظف تجريبي"}
      role={admin ? "admin" : "employee"}
      active="/workspace"
    >
      {!admin && (
        <p className="studio-card p-6 text-xs leading-8">
          السجل التاريخي للفستان للأدمن فقط. الموظف يفتح الحجز المسموح له من
          قائمة الحجوزات.
        </p>
      )}
      <DressHistory
        admin={admin}
        preview
        bookings={[
          {
            id: "fixture-booking",
            dressName: "اختبار فستان السجل",
            starts_on: "2026-12-08",
            returns_on: "2026-12-09",
            status: "confirmed",
            agreed_price_piasters: 12500,
          },
          {
            id: "fixture-cancelled",
            dressName: "اختبار فستان السجل",
            starts_on: "2026-12-05",
            returns_on: "2026-12-06",
            status: "cancelled",
            agreed_price_piasters: 10000,
          },
        ]}
        logs={[
          {
            id: 1,
            actor_id: "fixture-admin",
            action: "UPDATE",
            entity: "bookings",
            entity_id: "fixture-booking",
            created_at: "2026-11-22T12:00:00Z",
            old_data: {
              dress_id: "fixture-dress",
              starts_on: "2026-12-05",
              agreed_price_piasters: 10000,
            },
            new_data: {
              dress_id: "fixture-dress",
              starts_on: "2026-12-08",
              agreed_price_piasters: 12500,
            },
          },
        ]}
        names={{ "fixture-admin": "أدمن تجريبي" }}
      />
    </StaffFrame>
  );
}
