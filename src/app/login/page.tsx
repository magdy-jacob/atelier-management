export const dynamic = "force-dynamic";
import Link from "next/link";
import { Header } from "@/components/atelier/chrome";
import { LoginForm } from "@/components/atelier/forms";
import { configured } from "@/lib/supabase/server";
export default function Login() {
  const ready = configured();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-md px-5 py-16">
        <div className="studio-card p-8">
          <p className="mb-3 text-[10px] tracking-widest text-muted-foreground">
            مساحة الفريق
          </p>
          <h1 className="mb-3 text-2xl">أهلًا برجوعك</h1>
          <p className="mb-8 text-xs leading-7 text-muted-foreground">
            دخول الأدمن والموظفين فقط. لا يوجد تسجيل عام.
          </p>
          {!ready && (
            <p className="mb-6 rounded-xl border border-pink-200 bg-pink-50 p-4 text-xs leading-7">
              المشروع لم يُربط بـ Supabase بعد. لن يعمل الدخول قبل تهيئة قاعدة
              البيانات وإنشاء الحسابات.
            </p>
          )}
          <LoginForm ready={ready} />
          <Link
            href="/demo"
            className="mt-6 block text-center text-xs text-primary underline underline-offset-4"
          >
            استعراض الواجهة ببيانات تجريبية
          </Link>
        </div>
      </main>
    </>
  );
}
