export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/auth";
import { StaffFrame, Unavailable } from "@/components/atelier/staff-frame";
import { WorkspaceBookingTable } from "@/components/atelier/workspace-overview";
import {
  bookingForWorkspace,
  workspaceBookingColumns,
} from "@/lib/workspace-view";
export default async function Bookings() {
  const { db, profile } = await requireStaff();
  const { data, error } = await db
    .from("bookings")
    .select(workspaceBookingColumns)
    .order("created_at", { ascending: false })
    .limit(10);
  const bookings = (data ?? []).map((b) =>
    bookingForWorkspace(
      b,
      (path) =>
        db.storage.from("dress-images").getPublicUrl(path).data.publicUrl,
    ),
  );
  return (
    <StaffFrame
      title="الحجوزات"
      description="آخر ١٠ حجوزات."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/bookings"
    >
      <Link
        href="/workspace/bookings/new"
        className="inline-block rounded-xl bg-primary px-5 py-3 text-xs text-white"
      >
        إنشاء حجز
      </Link>
      {error ? (
        <Unavailable />
      ) : (
        <section className="studio-card overflow-hidden">
          <WorkspaceBookingTable bookings={bookings} />
        </section>
      )}
    </StaffFrame>
  );
}
