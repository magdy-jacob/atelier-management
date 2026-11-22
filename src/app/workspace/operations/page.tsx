export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import { getBookingConfig } from "@/lib/booking-config";
import { dateInZone, addDays } from "@/lib/domain";
import { monthWindow, type OperationBooking } from "@/lib/operations";
import { StaffFrame, Unavailable } from "@/components/atelier/staff-frame";
import { OperationsBoard } from "@/components/atelier/operations";

export default async function Operations({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { db, profile } = await requireStaff();
  const config = await getBookingConfig(db);
  if (
    config?.date_precision !== "day" ||
    config.business_timezone !== "Africa/Cairo"
  )
    return (
      <StaffFrame
        title="العمليات والتقويم"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/operations"
      >
        <p role="alert" className="studio-card p-6 text-sm leading-8">
          تعذر التحقق من إعدادات أيام مصر. طبّق المهاجرة الثالثة وراجع الإعدادات
          قبل الاعتماد على المواعيد. لم يتم افتراض توقيت بديل.
        </p>
      </StaffFrame>
    );
  const today = dateInZone(new Date(), config.business_timezone);
  const window = monthWindow((await searchParams).month, today);
  const columns = "id,starts_on,returns_on,status,dresses(name)";
  const calendar = await db
    .from("bookings")
    .select(columns, { count: "exact" })
    .neq("status", "cancelled")
    .lte("starts_on", window.end)
    .gte("returns_on", addDays(window.start, -1))
    .order("starts_on")
    .limit(1000);
  const results = [calendar];
  {
    // Active staff already have shared booking reads; these queues confer no writes.
    const alertResults = await Promise.all([
      db
        .from("bookings")
        .select(columns, { count: "exact" })
        .eq("status", "confirmed")
        .gte("starts_on", today)
        .lte("starts_on", addDays(today, 1))
        .order("starts_on")
        .limit(1000),
      db
        .from("bookings")
        .select(columns, { count: "exact" })
        .eq("status", "out")
        .lte("returns_on", today)
        .order("returns_on")
        .limit(1000),
      db
        .from("bookings")
        .select(columns, { count: "exact" })
        .eq("status", "confirmed")
        .lt("starts_on", today)
        .order("starts_on")
        .limit(1000),
    ]);
    results.push(...alertResults);
  }
  const mapped = results.flatMap((r) =>
    (r.data ?? []).map((b) => ({
      id: b.id,
      starts_on: b.starts_on,
      returns_on: b.returns_on,
      status: b.status as OperationBooking["status"],
      dressName:
        (Array.isArray(b.dresses) ? b.dresses[0] : b.dresses)?.name ??
        "فستان غير متاح",
    })),
  );
  const bookings = [...new Map(mapped.map((b) => [b.id, b])).values()];
  return (
    <StaffFrame
      title="العمليات والتقويم"
      description="مواعيد من قاعدة البيانات ضمن صلاحيات حسابك. اليوم محسوب بتوقيت مصر، والأحداث بالأيام فقط. التنبيهات هنا مشتقة من الحالات المسجلة وليست سجل إشعارات مقروءة أو إثبات تسليم."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/operations"
    >
      {results.some((r) => r.error) ? (
        <Unavailable />
      ) : (
        <OperationsBoard
          bookings={bookings}
          today={today}
          month={window.month}
          admin={profile.role === "admin"}
          truncated={results.some((r) => (r.count ?? 0) > 1000)}
        />
      )}
    </StaffFrame>
  );
}
