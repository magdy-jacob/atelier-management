export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  Unavailable,
  AdminOnly,
} from "@/components/atelier/staff-frame";
import { Button } from "@/components/ui/button";
export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; by?: string }>;
}) {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return (
      <StaffFrame
        title="العملاء"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/customers"
      >
        <AdminOnly />
      </StaffFrame>
    );
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const by = params.by === "phone" ? "phone" : "full_name";
  let query = db
    .from("customers")
    .select("id,full_name,phone")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike(by, `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await query;
  return (
    <StaffFrame
      title="العملاء"
      description="آخر ١٠٠ عميل مطابق ضمن صلاحيات حسابك. قائمة العملاء والسجل المجمّع للأدمن فقط؛ الموظف يرى بيانات العميل اللازمة داخل الحجز المصرح له به. لا توجد مطابقة تلقائية أو دمج لأرقام الهاتف حتى اعتماد السياسة."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/customers"
    >
      <form
        method="get"
        className="studio-card flex flex-wrap items-end gap-4 p-5"
      >
        <label className="field grow">
          بحث
          <input
            name="q"
            maxLength={80}
            defaultValue={q}
            placeholder="اسم العميل أو رقم الهاتف"
          />
        </label>
        <label className="field">
          البحث في
          <select name="by" defaultValue={by}>
            <option value="full_name">الاسم</option>
            <option value="phone">الهاتف</option>
          </select>
        </label>
        <Button type="submit" className="h-11">
          بحث
        </Button>
      </form>
      {error ? (
        <Unavailable />
      ) : (
        <section className="studio-card divide-y">
          {data?.map((c) => (
            <Link
              key={c.id}
              href={`/workspace/customers/${c.id}`}
              className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-muted/30"
            >
              <h2 className="text-sm">{c.full_name}</h2>
              <span dir="ltr" className="text-xs text-muted-foreground">
                {c.phone}
              </span>
              <span className="text-xs text-primary">عرض السجل ←</span>
            </Link>
          ))}
          {!data?.length && (
            <p className="p-10 text-center text-xs text-muted-foreground">
              لا يوجد عملاء مطابقون أو مصرح بعرضهم.
            </p>
          )}
        </section>
      )}
    </StaffFrame>
  );
}
