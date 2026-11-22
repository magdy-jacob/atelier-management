export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/auth";
import { StaffFrame, Unavailable } from "@/components/atelier/staff-frame";
import { BookingList } from "@/components/atelier/records";
export default async function Bookings() {
  const { db, profile } = await requireStaff();
  const { data, error } = await db
    .from("bookings")
    .select(
      "id,starts_on,returns_on,status,agreed_price_piasters,dresses(name)",
    )
    .order("starts_on", { ascending: false })
    .limit(100);
  const bookings = (data ?? []).map((b) => ({
    ...b,
    dressName:
      (Array.isArray(b.dresses) ? b.dresses[0] : b.dresses)?.name ??
      "فستان غير متاح",
  }));
  return (
    <StaffFrame
      title="الحجوزات"
      description="آخر ١٠٠ حجز من كل حجوزات الأتيليه. الموظف والأدمن يسجلان المقدم والباقي المستلم، دون إتاحة لوحة مالية عامة للموظف."
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
      {error ? <Unavailable /> : <BookingList bookings={bookings} />}
    </StaffFrame>
  );
}
