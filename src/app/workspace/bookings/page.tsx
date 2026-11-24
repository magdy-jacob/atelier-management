export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/auth";
import { StaffFrame, Unavailable } from "@/components/atelier/staff-frame";
import { WorkspaceBookingsView } from "@/components/atelier/workspace-bookings-view";
import {
  bookingForWorkspace,
  workspaceBookingColumns,
} from "@/lib/workspace-view";

export default async function Bookings({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const { db, profile } = await requireStaff();
  const params = await searchParams;
  const initialStatus = params?.status ?? "all";

  const { data, error } = await db
    .from("bookings")
    .select(workspaceBookingColumns)
    .order("created_at", { ascending: false })
    .limit(50);
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
      description="آخر ٥٠ حجزًا مسجلًا."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/bookings"
    >
      <div className="flex items-center justify-between">
        <Link
          href="/workspace/bookings/new"
          className="inline-block rounded-xl bg-primary px-5 py-3 text-xs text-white"
        >
          إنشاء حجز
        </Link>
      </div>
      {error ? (
        <Unavailable />
      ) : (
        <WorkspaceBookingsView
          bookings={bookings}
          initialStatus={initialStatus}
        />
      )}
    </StaffFrame>
  );
}
