export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  Unavailable,
} from "@/components/atelier/staff-frame";
import { Button } from "@/components/ui/button";
import { displayCustomerName, displayCustomerPhone } from "@/lib/presentation";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; by?: string }>;
}) {
  const { db, profile } = await requireStaff();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const by = params.by === "phone" ? "phone" : "full_name";

  let query = db
    .from("customers")
    .select("id,full_name,phone,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (q) {
    if (by === "phone") {
      const d = q.replace(/\D/g, "");
      if (d.startsWith("0")) {
        const alt = d.slice(1);
        query = query.or(
          `phone.ilike.%${q}%,phone.ilike.%${d}%,phone.ilike.%${alt}%`,
        );
      } else {
        query = query.ilike("phone", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
      }
    } else {
      query = query.ilike("full_name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    }
  }

  const { data, error } = await query;

  type GroupedCustomer = {
    primaryId: string;
    name: string;
    phones: string[];
    allIds: string[];
    count: number;
  };

  const groupsMap = new Map<string, GroupedCustomer>();

  for (const c of data ?? []) {
    const cleanName = displayCustomerName(c.full_name);
    const key = cleanName.toLowerCase();
    const cleanPhone = displayCustomerPhone(c.phone);

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        primaryId: c.id,
        name: cleanName,
        phones: cleanPhone && cleanPhone !== "—" ? [cleanPhone] : [],
        allIds: [c.id],
        count: 1,
      });
    } else {
      const group = groupsMap.get(key)!;
      group.allIds.push(c.id);
      group.count += 1;
      if (
        cleanPhone &&
        cleanPhone !== "—" &&
        !group.phones.includes(cleanPhone)
      ) {
        group.phones.push(cleanPhone);
      }
    }
  }

  const groupedCustomers = Array.from(groupsMap.values());

  return (
    <StaffFrame
      title="العملاء"
      description="قائمة العملاء المجمّعة حسب الاسم؛ تُعرض جميع سجلات وحجوزات العميل تحت بروفايل موحد."
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
          {groupedCustomers.map((c) => (
            <Link
              key={c.primaryId}
              href={`/workspace/customers/${c.primaryId}`}
              className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-foreground">
                  {c.name}
                </h2>
                {c.count > 1 && (
                  <span className="text-[11px] text-muted-foreground">
                    مجمّع من {c.count} حسابات مسجلة
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2" dir="ltr">
                {c.phones.map((phone) => (
                  <span
                    key={phone}
                    className="rounded bg-muted px-2.5 py-1 text-xs text-muted-foreground font-mono"
                  >
                    {phone}
                  </span>
                ))}
              </div>
              <span className="text-xs text-primary font-medium">
                عرض السجلات ←
              </span>
            </Link>
          ))}
          {!groupedCustomers.length && (
            <p className="p-10 text-center text-xs text-muted-foreground">
              لا يوجد عملاء مطابقون أو مصرح بعرضهم.
            </p>
          )}
        </section>
      )}
    </StaffFrame>
  );
}
