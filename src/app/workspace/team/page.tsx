export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import { staffAuthConfigured, staffAuthAdmin } from "@/lib/supabase/admin";
import { functionalPortfolioEnabled } from "@/lib/portfolio-mode";
import {
  StaffFrame,
  Unavailable,
  AdminOnly,
} from "@/components/atelier/staff-frame";
import { TeamManager, type TeamMember } from "@/components/atelier/team-manager";

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

  let authUsersMap = new Map();
  if (staffAuthConfigured()) {
    try {
      const service = staffAuthAdmin();
      const { data: authData } = await service.auth.admin.listUsers();
      authUsersMap = new Map((authData?.users ?? []).map((u) => [u.id, u]));
    } catch {
      // Fallback if listUsers unavailable
    }
  }

  const teamMembers: TeamMember[] = (profiles ?? []).map((p) => {
    const authUser = authUsersMap.get(p.id);
    const effectiveRole =
      authUser?.app_metadata?.role === "admin" ||
      authUser?.user_metadata?.role === "admin" ||
      p.role === "admin"
        ? "admin"
        : "employee";
    return {
      id: p.id,
      full_name: p.full_name,
      role: effectiveRole,
      active: p.active,
      version: p.version,
      email: authUser?.email ?? "—",
      assigned_password: authUser?.user_metadata?.assigned_password ?? null,
    };
  });

  return (
    <StaffFrame
      title="الفريق والصلاحيات"
      description="إدارة حسابات الفريق وصلاحياتهم وكلمات المرور. يمكنك إضافة وتعديل وتعطيل وحذف الموظفين والمسؤولين."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/team"
    >
      {error ? (
        <Unavailable />
      ) : (
        <TeamManager
          members={teamMembers}
          actorId={profile.id}
          managementEnabled={enabled}
          creationEnabled={enabled && staffAuthConfigured()}
        />
      )}
    </StaffFrame>
  );
}
