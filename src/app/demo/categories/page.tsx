import { StaffFrame } from "@/components/atelier/staff-frame";
import { CategoryManager } from "@/components/atelier/category-manager";
import { CategoryForm } from "@/components/atelier/forms";
export default function CategoryPreview() {
  return (
    <StaffFrame
      title="إدارة التصنيفات"
      description="معاينة مصطنعة؛ إضافة التصنيف وحفظ الاسم والحذف معطلة. لا حذف لتصنيف مرتبط بفستان، حتى المؤرشف."
      name="أدمن تجريبي"
      role="admin"
      active="/workspace/categories"
      preview
    >
      <section className="studio-card max-w-xl p-6">
        <h2 className="mb-5 text-base">إضافة تصنيف</h2>
        <CategoryForm preview />
      </section>
      <CategoryManager
        preview
        categories={[
          { id: "evening", name: "سهرة · تجريبي", version: 2, dressCount: 3 },
          {
            id: "engagement",
            name: "خطوبة · تجريبي",
            version: 1,
            dressCount: 2,
          },
          { id: "wedding", name: "أفراح · تجريبي", version: 1, dressCount: 1 },
          {
            id: "unused",
            name: "تصنيف غير مستخدم · تجريبي",
            version: 1,
            dressCount: 0,
          },
        ]}
      />
    </StaffFrame>
  );
}
