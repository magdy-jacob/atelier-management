export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import { staffAuthConfigured } from "@/lib/supabase/admin";
import { functionalPortfolioEnabled } from "@/lib/portfolio-mode";
import {
  StaffFrame,
  Unavailable,
  AdminOnly,
} from "@/components/atelier/staff-frame";
import { TeamManager } from "@/components/atelier/team-manager";
export default async function Team() {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return (
      <StaffFrame
        title="الفريق"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/team"
      >
        <AdminOnly />
      </StaffFrame>
    );
  const [{ data: profiles, error }, { data: cfg, error: cfgError }] =
    await Promise.all([
      db
        .from("profiles")
        .select("id,full_name,role,active,version")
        .order("created_at"),
      db.rpc("get_staff_management_config"),
    ]);
  const enabled =
    !cfgError &&
    cfg?.ready === true &&
    cfg?.synthetic_test_enabled === true &&
    functionalPortfolioEnabled();
  const { data: jobs, error: jobsError } = enabled
    ? await db
        .from("employee_account_jobs")
        .select("id,request_id,user_id,actor_id,full_name,email,status")
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [], error: null };
  return (
    <StaffFrame
      title="الفريق والصلاحيات"
      description="إنشاء موظفين تجريبيين وإدارة أسمائهم وحالتهم للأدمن. لا دعوات بريدية، لا حذف للتاريخ ولا تغيير للأدوار."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/team"
    >
      {error || jobsError ? (
        <Unavailable />
      ) : (
        <TeamManager
          profiles={profiles ?? []}
          jobs={jobs ?? []}
          actorId={profile.id}
          managementEnabled={enabled}
          creationEnabled={enabled && staffAuthConfigured()}
        />
      )}
    </StaffFrame>
  );
}
