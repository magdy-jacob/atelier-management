import Link from "next/link";
import { configured } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { requireStaff } from "@/lib/supabase/auth";
import { Header } from "@/components/atelier/chrome";
import { DressForm, CategoryForm } from "@/components/atelier/forms";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  if (!configured())
    return (
      <>
        <Header />
        <main className="mx-auto max-w-2xl p-10 text-center">
          <h1 className="mb-5 text-2xl">مساحة العمل غير مهيأة بعد</h1>
          <p className="mb-6 text-sm leading-8 text-muted-foreground">
            أضف متغيرات البيئة وطبّق قاعدة البيانات باتباع README. هذه ليست بيئة
            إنتاج.
          </p>
          <Link className="underline" href="/demo">
            فتح الاستعراض التجريبي
          </Link>
        </main>
      </>
    );
  const { db, profile } = await requireStaff();
  const archived =
    profile.role === "admin" && (await searchParams).archived === "1";
  const [
    { data: categories, error: categoryError },
    { data: dresses, error: dressError },
    { data: bookings, error: bookingError },
  ] = await Promise.all([
    db.from("categories").select("id,name").order("name"),
    db
      .from("dresses")
      .select("id,name,code,size,color")
      .eq("archived", archived)
      .order("created_at", { ascending: false }),
    db
      .from("bookings")
      .select("id,starts_on,returns_on,status")
      .order("starts_on", { ascending: false })
      .limit(25),
  ]);
  const cleanup =
    profile.role === "admin"
      ? await db
          .from("image_deletion_jobs")
          .select("id,dress_id,dresses(name)", { count: "exact" })
          .eq("status", "pending")
          .order("created_at")
          .limit(10)
      : null;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-3 text-2xl">أهلًا، {profile.full_name}</h1>
            <p className="text-xs text-muted-foreground">
              {profile.role === "admin" ? "أدمن" : "موظف"} · بيانات متصلة بقاعدة
              Supabase
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              تسجيل الخروج
            </Button>
          </form>
        </div>
        <nav
          className="flex flex-wrap gap-3 border-b pb-5 text-xs"
          aria-label="مساحة العمل"
        >
          {profile.role === "admin" && (
            <Link
              className="rounded-full border bg-white px-4 py-2"
              href="/workspace/dashboard"
            >
              لوحة الأدمن المالية والتشغيلية
            </Link>
          )}
          {profile.role === "admin" && (
            <>
              <Link
                className="rounded-full border bg-white px-4 py-2"
                href="/workspace/notifications"
              >
                مركز الإشعارات
              </Link>
              <Link
                className="rounded-full border bg-white px-4 py-2"
                href="/workspace/reports"
              >
                تقارير القبض والتصدير
              </Link>
              <Link
                className="rounded-full border bg-white px-4 py-2"
                href="/workspace/categories"
              >
                إدارة التصنيفات
              </Link>
              <Link
                className="rounded-full border bg-white px-4 py-2"
                href="/workspace/activity"
              >
                سجل النشاط
              </Link>
              <Link
                className="rounded-full border bg-white px-4 py-2"
                href="/workspace/team"
              >
                الفريق والصلاحيات
              </Link>
            </>
          )}
          <Link
            href="/workspace/operations"
            className="rounded-full border bg-white px-4 py-2"
          >
            العمليات والتقويم
          </Link>
          <Link
            href="/workspace/bookings"
            className="rounded-full border bg-white px-4 py-2"
          >
            كل الحجوزات
          </Link>
          <Link
            href="/workspace/bookings/new"
            className="rounded-full border bg-primary px-4 py-2 text-white"
          >
            حجز جديد
          </Link>
        </nav>
        <p className="rounded-xl border border-pink-200 bg-pink-50 p-5 text-xs leading-7">
          مشروع معرض أعمال ببيانات مصطنعة فقط. إدارة المخزون والصور والتصنيفات
          متاحة للأدمن. في وضع الاختبار الوظيفي تُحفظ الحجوزات والدفعات والتسليم
          والعودة فعليًا في Supabase، دون أموال أو عملاء حقيقيين. الإلغاء وتعديل
          الموعد والسعر وإدارة حسابات الموظفين الكاملة ما زالت ضمن العمل؛ لا
          نفترض سياسات غير محسومة.
          {profile.role === "admin" && (
            <Link
              href="/workspace/portfolio"
              className="mr-2 font-medium underline"
            >
              تجربة سيناريو اليوم
            </Link>
          )}
        </p>
        {cleanup?.error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5 text-xs leading-7 text-red-900"
          >
            تعذر التحقق من ملفات صور تنتظر التنظيف. أعد تحميل مساحة العمل؛ لم
            نعتبر الملفات ممسوحة.
          </p>
        )}
        {!!cleanup?.count && (
          <section className="studio-card space-y-4 border-red-200 p-5">
            <h2 className="text-sm">تنظيف ملفات صور معلق ({cleanup.count})</h2>
            <p className="text-xs leading-7 text-muted-foreground">
              الصور أُزيلت من الكتالوج، لكن مسح ملفاتها لم يُؤكد. افتح الفستان
              لإعادة محاولة التنظيف. يُعرض هنا أول ١٠ طلبات فقط.
            </p>
            <div className="flex flex-wrap gap-3">
              {cleanup.data?.map((job) => {
                const d = Array.isArray(job.dresses)
                  ? job.dresses[0]
                  : job.dresses;
                return (
                  <Link
                    key={job.id}
                    className="rounded-full border px-4 py-2 text-xs underline underline-offset-4"
                    href={`/workspace/dresses/${job.dress_id}`}
                  >
                    {d?.name ?? "فتح الفستان"}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        {(categoryError || dressError || bookingError) && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
            تعذر تحميل بعض البيانات. راجع تهيئة قاعدة البيانات والصلاحيات.
          </p>
        )}
        <section className="studio-card p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg">
              {archived ? "الأرشيف" : "المخزون"} ({dresses?.length ?? 0})
            </h2>
            {profile.role === "admin" && (
              <Link
                href={archived ? "/workspace" : "/workspace?archived=1"}
                className="text-xs underline underline-offset-4"
              >
                {archived ? "عرض المخزون النشط" : "عرض الأرشيف"}
              </Link>
            )}
          </div>
          <div className="divide-y">
            {dresses?.map((d) => (
              <div
                className="flex flex-wrap justify-between gap-3 py-4 text-sm"
                key={d.id}
              >
                <Link
                  className="underline underline-offset-4"
                  href={`/workspace/dresses/${d.id}`}
                >
                  {d.name}
                </Link>
                <span dir="ltr" className="text-xs text-muted-foreground">
                  {d.code} · {d.color} · {d.size}
                </span>
              </div>
            ))}
            {!dresses?.length && (
              <p className="text-sm text-muted-foreground">
                لا توجد فساتين بعد.
              </p>
            )}
          </div>
        </section>
        {profile.role === "admin" && (
          <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
            <section className="studio-card p-6">
              <h2 className="mb-6 text-lg">إضافة فستان</h2>
              <DressForm categories={categories ?? []} />
            </section>
            <section className="studio-card p-6">
              <h2 className="mb-6 text-lg">إضافة تصنيف</h2>
              <CategoryForm />
            </section>
          </div>
        )}
        <section className="studio-card p-6">
          <h2 className="mb-5 text-lg">آخر الحجوزات المصرح بها</h2>
          {bookings?.length ? (
            <ul className="divide-y">
              {bookings.map((b) => (
                <li className="flex flex-wrap gap-4 py-4 text-xs" key={b.id}>
                  <Link
                    href={`/workspace/bookings/${b.id}`}
                    className="underline underline-offset-4"
                    dir="ltr"
                  >
                    {b.id.slice(0, 8)}
                  </Link>
                  <span>
                    {b.starts_on} ← {b.returns_on}
                  </span>
                  <span>{b.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              لا توجد حجوزات مرئية لهذا الحساب.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
