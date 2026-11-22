import { DashboardPeriodForm } from "@/components/atelier/dashboard-period";
export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  AdminOnly,
  Unavailable,
} from "@/components/atelier/staff-frame";
import { AdminSummary } from "@/components/atelier/admin-summary";
import { dashboardSchema } from "@/lib/admin-dashboard";
import { dateInZone, validDay } from "@/lib/domain";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return (
      <StaffFrame
        title="لوحة الأدمن"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/dashboard"
      >
        <AdminOnly />
      </StaffFrame>
    );
  const query = await searchParams;
  const today = dateInZone(new Date(), "Africa/Cairo");
  const from = query.from ?? `${today.slice(0, 7)}-01`,
    to = query.to ?? today;
  const valid =
    validDay(from) &&
    validDay(to) &&
    to >= from &&
    (Date.parse(to) - Date.parse(from)) / 86400000 <= 365;
  const result = valid
    ? await db.rpc("admin_dashboard", { p_from: from, p_to: to })
    : null;
  const parsed =
    result && !result.error ? dashboardSchema.safeParse(result.data) : null;
  return (
    <StaffFrame
      title="لوحة الأدمن"
      description="تابع المبالغ المستلمة والمتبقيات ومؤشرات الأتيليه. اختر فترة بالأيام حتى ٣٦٦ يومًا."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/dashboard"
    >
      <DashboardPeriodForm
        from={validDay(from) ? from : ""}
        to={validDay(to) ? to : ""}
      />

      {!valid ? (
        <p role="alert" className="studio-card p-6 text-sm">
          اختر فترة صحيحة لا تتجاوز ٣٦٦ يومًا. لم تُحمّل أرقام لفترة بديلة.
        </p>
      ) : parsed?.success ? (
        <AdminSummary data={parsed.data} />
      ) : (
        <Unavailable />
      )}
    </StaffFrame>
  );
}
