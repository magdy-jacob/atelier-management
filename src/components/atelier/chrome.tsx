import Link from "next/link";
import Image from "next/image";
import { ArrowUpLeft } from "lucide-react";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Lovely، الصفحة الرئيسية"
      className={`flex items-center gap-2 md:gap-3 ${dark ? "text-white" : "text-primary"}`}
    >
      <Image
        src="/brand/lovely-logo.webp"
        alt="شعار Lovely لتأجير وتفصيل الفساتين"
        width={72}
        height={72}
        priority
        className="size-14 shrink-0 rounded-full border border-primary/15 object-cover md:size-[72px]"
      />
      <span>
        <span
          className="serif block text-2xl font-semibold italic leading-tight md:text-3xl"
          dir="ltr"
        >
          Lovely
        </span>
        <span className="mt-1 block text-[9px] leading-5 opacity-80">
          تأجير وتفصيل الفساتين
        </span>
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
        <Brand />
        <nav className="flex items-center gap-4 text-xs md:gap-8 md:text-sm">
          <Link className="hidden sm:block" href="/#collection">
            مجموعة الفساتين
          </Link>
          <Link
            className="text-muted-foreground hover:text-primary"
            href="/demo"
          >
            استعراض النظام
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 border-b border-primary/40 pb-1"
          >
            دخول الفريق
            <ArrowUpLeft size={14} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
export function DemoNotice({ short = false }: { short?: boolean }) {
  return (
    <div className="border-b border-pink-200 bg-pink-50 px-4 py-2 text-center text-[11px] leading-6 text-pink-950">
      {short
        ? "بيئة عرض فقط • كل الأسماء والأرقام والعمليات تجريبية"
        : "نسخة أولية للعرض • بيانات وصور مولدة للتجربة وليست مخزونًا أو حجوزات حقيقية"}
      <Link
        href="/workspace"
        className="mx-3 inline-block font-medium underline underline-offset-4"
      >
        فتح بيانات مساحة العمل، بدخول الفريق
      </Link>
    </div>
  );
}
