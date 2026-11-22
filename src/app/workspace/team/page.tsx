export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  Unavailable,
  AdminOnly,
} from "@/components/atelier/staff-frame";
import { Badge } from "@/components/ui/badge";
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
  const { data, error } = await db
    .from("profiles")
    .select("id,full_name,role,active")
    .order("created_at");
  return (
    <StaffFrame
      title="الفريق والصلاحيات"
      description="عرض حسابات التشغيل للأدمن فقط، دون كلمات مرور أو مفاتيح. إنشاء الحسابات وتغيير أدوارها يتمان حاليًا من إعدادات Supabase المصرح بها، وليس من هذه الشاشة."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/team"
    >
      {error ? (
        <Unavailable />
      ) : (
        <section className="studio-card divide-y">
          {data?.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div>
                <h2 className="mb-2 text-sm">{p.full_name}</h2>
                <p
                  dir="ltr"
                  className="break-all font-mono text-[9px] text-muted-foreground"
                >
                  {p.id}
                </p>
              </div>
              <Badge variant="outline">
                {p.role === "admin" ? "أدمن" : "موظف"}
              </Badge>
              <Badge
                className={
                  p.active
                    ? "bg-secondary text-primary"
                    : "bg-red-50 text-red-700"
                }
              >
                {p.active ? "نشط" : "معطل"}
              </Badge>
            </div>
          ))}
        </section>
      )}
    </StaffFrame>
  );
}
