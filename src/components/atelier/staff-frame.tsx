import Link from "next/link";
import { Header, DemoNotice } from "./chrome";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
export function StaffFrame({
  title,
  description,
  name,
  role,
  active,
  preview = false,
  children,
}: {
  title: string;
  description?: string;
  name: string;
  role: string;
  active: string;
  preview?: boolean;
  children: React.ReactNode;
}) {
  const links = [
    ["/workspace", "نظرة عامة"],
    ["/workspace/bookings", "الحجوزات"],
    ["/workspace/operations", "العمليات والتقويم"],
    ...(role === "admin"
      ? [
          ["/workspace/customers", "العملاء"],
          ["/workspace/activity", "سجل النشاط"],
          ["/workspace/team", "الفريق"],
        ]
      : []),
  ];
  return (
    <>
      <Header />
      {preview && <DemoNotice short />}
      <main className="mx-auto max-w-6xl space-y-7 px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {name} · {role === "admin" ? "أدمن" : "موظف"}
            {preview ? " · معاينة فقط" : ""}
          </p>
          {!preview && (
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit">
                تسجيل الخروج
              </Button>
            </form>
          )}
        </div>
        <nav
          className="flex flex-wrap gap-2 border-b pb-5"
          aria-label="مساحة العمل"
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={preview ? "/demo" : href}
              className={`rounded-full border px-4 py-2 text-xs ${active === href ? "border-primary bg-primary text-white" : "bg-white text-muted-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div>
          <h1 className="mb-3 text-2xl">{title}</h1>
          {description && (
            <p className="max-w-3xl text-xs leading-7 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children}
      </main>
    </>
  );
}
export function Unavailable() {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm leading-8 text-red-800"
    >
      تعذر تحميل البيانات. راجع الاتصال والصلاحيات ثم أعد المحاولة. لم يتم تغيير
      أي بيانات.
    </p>
  );
}
export function AdminOnly() {
  return (
    <p className="studio-card p-8 text-sm leading-8">
      هذه الصفحة للأدمن فقط، ولم يتم تحميل أي بيانات خاصة.
    </p>
  );
}
