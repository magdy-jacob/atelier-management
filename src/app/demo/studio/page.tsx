import { StaffFrame } from "@/components/atelier/staff-frame";
import { WorkspaceOverview } from "@/components/atelier/workspace-overview";
import { sampleDresses, sampleBookings } from "@/lib/domain";
export default async function StudioPreview({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; view?: string }>;
}) {
  const p = await searchParams;
  const admin = p.role !== "employee";
  const bookings = sampleBookings.map((b) => ({
    id: b.id,
    dressName: sampleDresses.find((d) => d.id === b.dressId)!.name,
    image: sampleDresses.find((d) => d.id === b.dressId)!.image,
    customerName: b.customer,
    starts_on: b.start,
    returns_on: b.end,
    status: b.status,
    remaining: String(b.total - b.paid),
  }));
  return (
    <StaffFrame
      title="كل تفاصيل يومك، في مكان واحد."
      description="تابع الفساتين والحجوزات، وخلي كل مناسبة تبدأ من هنا."
      name="فريق Lovely"
      role={admin ? "admin" : "employee"}
      active={p.view === "dresses" ? "/workspace?view=dresses" : "/workspace"}
      preview
    >
      <WorkspaceOverview
        dresses={sampleDresses}
        bookings={bookings}
        attention={bookings}
        stats={{ dresses: 6, outgoing: 1, incoming: 2 }}
        today="2026-12-05"
        totalDresses={6}
        admin={admin}
        inventory={p.view === "dresses"}
      />
    </StaffFrame>
  );
}
