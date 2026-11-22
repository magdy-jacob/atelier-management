import Link from "next/link";
import { ArrowUpLeft, Flower2 } from "lucide-react";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-3 ${dark ? "text-white" : "text-primary"}`}
    >
      <span
        className={`grid size-10 place-items-center rounded-full border ${dark ? "border-white/25" : "border-primary/25"}`}
      >
        <Flower2 size={22} />
      </span>
      <span>
        <span className="block text-xl font-semibold leading-tight">
          أتيليه
        </span>
        <span
          className="block text-[9px] tracking-[.32em] opacity-60"
          dir="ltr"
        >
          THE DRESS EDIT
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
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[11px] leading-6 text-amber-950">
      {short
        ? "بيئة عرض فقط • كل الأسماء والأرقام والعمليات تجريبية"
        : "نسخة أولية للعرض • بيانات وصور مولدة للتجربة وليست مخزونًا أو حجوزات حقيقية • اسم الأتيليه قابل للتغيير"}
    </div>
  );
}
