import Link from "next/link";
import { StaffFrame } from "@/components/atelier/staff-frame";
import {
  AuditTable,
  BookingList,
  BookingLedger,
} from "@/components/atelier/records";
export default async function RecordsPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const active = ["activity", "history", "ledger"].includes(view ?? "")
    ? view
    : "activity";
  const booking = {
    id: "DEMO-BOOKING-1024",
    starts_on: "2026-12-05",
    returns_on: "2026-12-06",
    status: "confirmed",
    agreed_price_piasters: 300000,
    dressName: "همسة زيتون",
  };
  const logs = [
    {
      id: 3,
      actor_id: "admin-demo",
      action: "INSERT",
      entity: "payments",
      entity_id: "DEMO-PAYMENT",
      created_at: "2026-12-01T12:30:00Z",
      old_data: null,
      new_data: {
        booking_id: "DEMO-BOOKING-1024",
        amount_piasters: 100000,
        kind: "deposit",
      },
    },
    {
      id: 2,
      actor_id: "admin-demo",
      action: "UPDATE",
      entity: "dresses",
      entity_id: "DEMO-DRESS",
      created_at: "2026-12-01T10:15:00Z",
      old_data: { name: "همسة زيتون", version: 1 },
      new_data: { name: "همسة زيتون", version: 2 },
    },
    {
      id: 1,
      actor_id: "admin-demo",
      action: "INSERT",
      entity: "bookings",
      entity_id: "DEMO-BOOKING-1024",
      created_at: "2026-12-01T10:00:00Z",
      old_data: null,
      new_data: { starts_on: "2026-12-05", returns_on: "2026-12-06" },
    },
  ];
  return (
    <StaffFrame
      preview
      title={
        active === "activity"
          ? "سجل النشاط"
          : active === "history"
            ? "سجل العميل"
            : "دفعات الحجز"
      }
      description="بيانات تجريبية لا تخص أي عميل. نفس مكونات العرض المستخدمة في الصفحات المحمية، دون اتصال بحساب أو تنفيذ عمليات."
      name="مدير تجريبي"
      role="admin"
      active={
        active === "activity" ? "/workspace/activity" : "/workspace/customers"
      }
    >
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          ["activity", "سجل النشاط"],
          ["history", "تاريخ الحجوزات"],
          ["ledger", "تفاصيل الدفعات"],
        ].map(([key, label]) => (
          <Link
            href={`/demo/records?view=${key}`}
            key={key}
            className="rounded-full border bg-white px-4 py-2"
          >
            {label}
          </Link>
        ))}
      </div>
      {active === "activity" ? (
        <AuditTable logs={logs} names={{ "admin-demo": "مدير تجريبي" }} />
      ) : active === "history" ? (
        <BookingList preview bookings={[booking]} />
      ) : (
        <BookingLedger
          price={300000}
          fees={0}
          payments={[
            {
              id: "DEMO-PAYMENT",
              amount_piasters: 100000,
              method: "نقدي تجريبي",
              kind: "deposit",
              recorded_at: "2026-12-01T12:30:00Z",
            },
          ]}
        />
      )}
    </StaffFrame>
  );
}
