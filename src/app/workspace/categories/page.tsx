export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  AdminOnly,
  Unavailable,
} from "@/components/atelier/staff-frame";
import { CategoryManager } from "@/components/atelier/category-manager";
import { CategoryForm } from "@/components/atelier/forms";
export default async function Categories() {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return (
      <StaffFrame
        title="التصنيفات"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/categories"
      >
        <AdminOnly />
      </StaffFrame>
    );
  const { data, error, count } = await db
    .from("categories")
    .select("id,name,version,dresses(count)", { count: "exact" })
    .order("name")
    .limit(200);
  return (
    <StaffFrame
      title="إدارة التصنيفات"
      name={profile.full_name}
      role={profile.role}
      active="/workspace/categories"
    >
      <section className="studio-card max-w-xl p-6">
        <h2 className="mb-5 text-base">إضافة تصنيف</h2>
        <CategoryForm />
      </section>
      {error ? (
        <Unavailable />
      ) : (
        <>
          {(count ?? 0) > 200 && (
            <p
              role="alert"
              className="rounded-xl bg-pink-50 p-4 text-xs leading-7"
            >
              يعرض أول ٢٠٠ تصنيف فقط. توجد تصنيفات أخرى غير معروضة؛ هذه ليست
              القائمة الكاملة.
            </p>
          )}
          <CategoryManager
            categories={(data ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              version: c.version,
              dressCount: c.dresses[0]?.count ?? 0,
            }))}
          />
        </>
      )}
    </StaffFrame>
  );
}
