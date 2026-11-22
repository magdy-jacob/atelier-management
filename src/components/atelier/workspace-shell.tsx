"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shirt,
  CalendarDays,
  Users,
  Wallet,
  Bell,
  Tags,
  History,
  UserRoundCog,
  PanelRightOpen,
  X,
  LogOut,
  ArrowUpLeft,
  Plus,
} from "lucide-react";
import { Brand } from "./chrome";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
const baseLinks = [
  { href: "/workspace", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/workspace?view=dresses", label: "الفساتين", icon: Shirt },
  { href: "/workspace/bookings", label: "الحجوزات", icon: CalendarDays },
  {
    href: "/workspace/operations",
    label: "العمليات والتقويم",
    icon: CalendarDays,
  },
];
const adminLinks = [
  { href: "/workspace/dashboard", label: "المالية والمؤشرات", icon: Wallet },
  { href: "/workspace/notifications", label: "التنبيهات", icon: Bell },
  { href: "/workspace/customers", label: "العملاء", icon: Users },
  { href: "/workspace/categories", label: "التصنيفات", icon: Tags },
  { href: "/workspace/team", label: "الفريق والصلاحيات", icon: UserRoundCog },
  { href: "/workspace/activity", label: "سجل النشاط", icon: History },
];
export function WorkspaceShell({
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const focusable = Array.from(
          navRef.current?.querySelectorAll<HTMLElement>(
            "a[href],button:not([disabled])",
          ) ?? [],
        ).filter((el) => el.getBoundingClientRect().height > 0);
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const previous = document.body.style.overflow;
    const opener = openerRef.current;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    navRef.current
      ?.querySelector<HTMLElement>(
        'button[aria-label="إغلاق القائمة الجانبية"]',
      )
      ?.focus();
    const wide = window.matchMedia("(min-width:1024px)");
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      opener?.focus();
    };
  }, [open]);
  const links = role === "admin" ? [...baseLinks, ...adminLinks] : baseLinks;
  const hrefFor = (href: string) =>
    preview
      ? ({
          "/workspace": "/demo/studio",
          "/workspace?view=dresses": "/demo/studio?view=dresses",
          "/workspace/dashboard": "/demo/admin",
          "/workspace/bookings": "/demo/records?tab=bookings",
          "/workspace/operations": "/demo/operations",
          "/workspace/team": "/demo/team",
          "/workspace/reports": "/demo/reports",
          "/workspace/notifications": "/demo/notifications",
          "/workspace/categories": "/demo/categories",
        }[href] ?? "/demo/studio")
      : href;
  return (
    <div className="workspace-shell min-h-screen bg-[#fff9fb]">
      {open && (
        <button
          className="fixed inset-0 z-40 bg-[#27131e]/45 backdrop-blur-sm lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={navRef}
        id="workspace-navigation"
        aria-label="قائمة مساحة العمل"
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 right-0 z-50 w-64 flex-col overflow-y-auto bg-[#27131e] px-5 py-7 text-white lg:flex`}
      >
        <div className="flex items-start justify-between gap-2">
          <Brand dark />
          <button
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة الجانبية"
            className="rounded-lg p-2 text-white lg:hidden"
          >
            <X size={19} />
          </button>
        </div>
        <p className="mb-3 mt-10 px-3 text-[10px] text-[#edb7ce]">
          مساحة العمل
        </p>
        <nav aria-label="مساحة العمل" className="space-y-1.5">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={hrefFor(href)}
              onClick={() => setOpen(false)}
              aria-current={active === href ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-xs transition-colors ${active === href ? "bg-[#fce5ee] text-[#73143c]" : "text-[#f9d9e7] hover:bg-white/10"}`}
            >
              <Icon size={17} strokeWidth={1.5} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-5 pt-10">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fce5ee] text-sm text-primary">
              {name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs">{name}</p>
              <p className="mt-2 text-[10px] text-[#edb7ce]">
                {role === "admin" ? "أدمن" : "موظف"}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 px-3 text-xs text-[#f9d9e7]"
          >
            <ArrowUpLeft size={16} />
            عرض الكتالوج
          </Link>
          {!preview && (
            <form action={signOut}>
              <button className="flex min-h-11 w-full items-center gap-3 px-3 text-xs text-[#f9d9e7]">
                <LogOut size={16} />
                تسجيل الخروج
              </button>
            </form>
          )}
        </div>
      </aside>
      <div className="min-w-0 lg:mr-64" inert={open}>
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b bg-white/95 px-5 py-4 backdrop-blur md:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              ref={openerRef}
              aria-label="فتح القائمة"
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(true)}
            >
              <PanelRightOpen size={21} />
            </Button>
            <div className="lg:hidden">
              <span className="serif text-2xl italic text-primary">Lovely</span>
            </div>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              مساحة العمل <span className="mx-3 opacity-40">/</span>
              <span className="text-foreground">{title}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:block">
              {name}
            </span>
            <Link
              href={hrefFor("/workspace/operations")}
              aria-label="فتح العمليات والتقويم"
              className="rounded-xl border p-2.5 text-muted-foreground"
            >
              <CalendarDays size={18} />
            </Link>
            {role === "admin" && (
              <Link
                href={hrefFor("/workspace/notifications")}
                aria-label="فتح مركز التنبيهات"
                className="rounded-xl border p-2.5 text-muted-foreground"
              >
                <Bell size={18} />
              </Link>
            )}
          </div>
        </header>
        <main
          className="mx-auto max-w-[1500px] space-y-7 px-5 py-7 md:px-9 md:py-9"
          key={pathname}
        >
          {preview && (
            <p className="rounded-xl border bg-white p-3 text-center text-xs leading-7 text-muted-foreground">
              معاينة غير متصلة. لا تُحفظ التغييرات في هذه الصفحة.
            </p>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-medium leading-relaxed">{title}</h1>
              {description && (
                <p className="mt-3 max-w-3xl text-xs leading-7 text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {!preview && active !== "/workspace/portfolio" && (
              <Link
                href="/workspace/bookings/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs text-white"
              >
                <Plus size={16} />
                حجز جديد
              </Link>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
