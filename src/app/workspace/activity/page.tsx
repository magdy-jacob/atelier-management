export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  Unavailable,
  AdminOnly,
} from "@/components/atelier/staff-frame";
import { AuditTable } from "@/components/atelier/records";
import { Button } from "@/components/ui/button";
import { validDay, addDays } from "@/lib/domain";
const entities = [
  "profiles",
  "settings",
  "categories",
  "dresses",
  "dress_prices",
  "dress_operations",
  "dress_images",
  "customers",
  "bookings",
  "payments",
  "late_fees",
];
export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; from?: string; to?: string }>;
}) {
  const { db, profile } = await requireStaff();
  const params = await searchParams;
  if (profile.role !== "admin")
    return (
      <StaffFrame
        title="سجل النشاط"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/activity"
      >
        <AdminOnly />
      </StaffFrame>
    );
  const entity = entities.includes(params.entity ?? "") ? params.entity! : "";
  const from = validDay(params.from ?? "") ? params.from! : "";
  const to = validDay(params.to ?? "") ? params.to! : "";
  let query = db
    .from("activity_logs")
    .select("id,actor_id,action,entity,entity_id,created_at,old_data,new_data")
    .order("id", { ascending: false })
    .limit(100);
  if (entity) query = query.eq("entity", entity);
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lt("created_at", `${addDays(to, 1)}T00:00:00Z`);
  const [{ data: logs, error }, { data: staff }] = await Promise.all([
    query,
    db.from("profiles").select("id,full_name"),
  ]);
  const names = Object.fromEntries(
    (staff ?? []).map((p) => [p.id, p.full_name]),
  );
  return (
    <StaffFrame
      title="سجل النشاط"
      description="آخر ١٠٠ حدث مطابق، للأدمن فقط. لا يمكن تعديل أو حذف السجل من حسابات التطبيق. التوقيت والفلاتر الزمنية هنا UTC لحين اعتماد منطقة الفرع الزمنية."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/activity"
    >
      <form
        className="studio-card flex flex-wrap items-end gap-4 p-5"
        method="get"
      >
        <label className="field">
          الكيان
          <select name="entity" defaultValue={entity}>
            <option value="">كل الكيانات</option>
            {entities.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="field">
          من يوم (UTC)
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label className="field">
          إلى يوم (UTC)
          <input type="date" name="to" defaultValue={to} />
        </label>
        <Button type="submit" className="h-11">
          تصفية
        </Button>
      </form>
      {from && to && to < from ? (
        <p role="alert" className="text-sm text-red-700">
          تاريخ النهاية يسبق البداية.
        </p>
      ) : error ? (
        <Unavailable />
      ) : (
        <AuditTable logs={logs ?? []} names={names} />
      )}
    </StaffFrame>
  );
}
