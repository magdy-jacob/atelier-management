import { StaffFrame } from "@/components/atelier/staff-frame";
import { OperationsBoard } from "@/components/atelier/operations";
import { sampleBookings, sampleDresses } from "@/lib/domain";
export default async function DemoOperations({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; role?: string }>;
}) {
  const params = await searchParams;
  const admin = params.role !== "employee";
  return (
    <StaffFrame
      title="العمليات والتقويم"
      description="معاينة ببيانات مصطنعة ويوم ثابت ٥ ديسمبر ٢٠٢٦. لا اتصال بقاعدة حقيقية ولا تسجيل تسليم أو عودة أو إشعار."
      name={admin ? "أدمن تجريبي" : "موظف تجريبي"}
      role={admin ? "admin" : "employee"}
      active="/workspace/operations"
      preview
    >
      <OperationsBoard
        preview
        admin={admin}
        today="2026-12-05"
        month={params.month ?? "2026-12"}
        bookings={sampleBookings.map((b) => ({
          id: b.id,
          dressName:
            sampleDresses.find((d) => d.id === b.dressId)?.name ?? b.dressId,
          starts_on: b.start,
          returns_on: b.end,
          status: b.status,
        }))}
      />
    </StaffFrame>
  );
}
