"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Shirt,
  CalendarDays,
  ArrowDownLeft,
  ArrowUpLeft,
  Search,
  Bell,
  Plus,
} from "lucide-react";
import { availabilityLabels, formatDay, type Dress } from "@/lib/domain";
import { aggregateMoney } from "@/lib/admin-dashboard";
import { Badge } from "@/components/ui/badge";
export type WorkspaceBooking = {
  id: string;
  dressName: string;
  image: string;
  customerName: string;
  starts_on: string;
  returns_on: string;
  status: string;
  remaining: string;
};
const statuses: Record<string, string> = {
  confirmed: "مؤكد",
  out: "خارج الأتيليه",
  returned: "تم الاستلام",
  cancelled: "ملغي",
};
export function WorkspaceBookingTable({
  bookings,
}: {
  bookings: WorkspaceBooking[];
}) {
  return (
    <div className="divide-y">
      {bookings.map((b) => (
        <Link
          href={`/workspace/bookings/${b.id}`}
          key={b.id}
          className="group relative grid grid-cols-2 gap-3 p-5 transition-colors hover:bg-muted/40 md:grid-cols-[1.4fr_1fr_1.1fr_1fr_1fr] md:items-center"
        >
          <div className="col-span-2 flex min-w-0 items-center gap-3 pl-20 md:col-span-1 md:pl-0">
            <Image
              src={b.image}
              alt=""
              width={46}
              height={58}
              className="h-[58px] w-[46px] shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium leading-6">{b.dressName}</p>
              <p
                dir="ltr"
                className="mt-1 text-right font-mono text-[9px] text-muted-foreground"
              >
                {b.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{b.customerName}</p>
          <p
            dir="ltr"
            className="text-right text-[10px] leading-7 text-muted-foreground"
          >
            {b.starts_on}
            <br className="hidden md:block" />
            <span className="md:hidden"> ← </span>
            {b.returns_on}
          </p>
          <div className="absolute left-5 top-6 md:static">
            <Badge
              variant="outline"
              className={
                b.status === "out"
                  ? "border-pink-100 bg-pink-50 text-primary"
                  : "border-transparent bg-secondary text-primary"
              }
            >
              {statuses[b.status] ?? b.status}
            </Badge>
          </div>
          <p className="col-span-2 flex items-center justify-between gap-3 text-xs md:col-span-1">
            <span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                المتبقي
              </span>
              {aggregateMoney(b.remaining)}
            </span>
            <ArrowUpLeft size={16} className="shrink-0 text-primary" />
          </p>
        </Link>
      ))}
      {!bookings.length && (
        <p className="p-10 text-center text-xs text-muted-foreground">
          لا توجد حجوزات في القائمة.
        </p>
      )}
    </div>
  );
}
export function WorkspaceOverview({
  dresses,
  bookings,
  attention,
  stats,
  today,
  inventory = false,
  archived = false,
  admin = false,
  totalDresses,
}: {
  dresses: Dress[];
  bookings: WorkspaceBooking[];
  attention: WorkspaceBooking[];
  stats: { dresses: number; outgoing: number; incoming: number };
  today: string;
  inventory?: boolean;
  archived?: boolean;
  admin?: boolean;
  totalDresses: number;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  const categories = ["الكل", ...new Set(dresses.map((d) => d.category))];
  const filtered = useMemo(
    () =>
      dresses.filter(
        (d) =>
          (category === "الكل" || d.category === category) &&
          `${d.name} ${d.code}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [dresses, category, search],
  );
  return (
    <>
      {!inventory && (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {[
              {
                label: "فساتين المجموعة",
                value: stats.dresses,
                sub: "في المخزون النشط",
                icon: Shirt,
              },
              {
                label: "تسليمات اليوم",
                value: stats.outgoing,
                sub: formatDay(today),
                icon: CalendarDays,
              },
              {
                label: "مطلوب استلامها",
                value: stats.incoming,
                sub: "اليوم وما تأخر عن العودة",
                icon: ArrowDownLeft,
              },
            ].map(({ label, value, sub, icon: Icon }) => (
              <article
                className="studio-card p-5 last:col-span-2 xl:last:col-span-1"
                key={label}
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <Icon size={17} className="text-primary" />
                </div>
                <p className="mb-3 text-2xl font-medium">
                  {value.toLocaleString("ar-EG")}
                </p>
                <p className="text-[10px] leading-6 text-muted-foreground">
                  {sub}
                </p>
              </article>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <section className="relative overflow-hidden rounded-2xl bg-[#fce5ee] p-7">
              <div className="relative z-10 max-w-[80%]">
                <span className="mb-5 inline-block rounded-full bg-white/65 px-3 py-1 text-[10px] text-primary">
                  مساحة مرتّبة ليوم أخف
                </span>
                <h2 className="mb-3 text-xl leading-9">
                  ورا كل فستان،
                  <br />
                  حكاية محتاجة اهتمام.
                </h2>
                <p className="mb-6 max-w-xs text-xs leading-7 text-[#71475a]">
                  راجع التسليم والعودة، وتابع الحجوزات اللي محتاجة تجهيز. كل
                  تفاصيل اليوم بين إيديك.
                </p>
                <Link
                  href="/workspace/operations"
                  className="inline-flex min-h-11 items-center gap-3 rounded-full border border-primary/20 px-5 py-3 text-xs text-primary"
                >
                  مراجعة مهام اليوم
                  <ArrowUpLeft size={14} />
                </Link>
              </div>
              <Shirt
                size={190}
                strokeWidth={0.5}
                className="absolute -bottom-7 -left-5 -rotate-12 text-primary/15"
              />
            </section>
            <section className="studio-card p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-medium">يحتاج انتباهك</h2>
                <Bell size={17} className="text-muted-foreground" />
              </div>
              {attention.slice(0, 4).map((b) => (
                <Link
                  key={b.id}
                  href={`/workspace/bookings/${b.id}`}
                  className="mb-4 flex items-start gap-3 last:mb-0"
                >
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-primary/60" />
                  <div>
                    <p className="text-xs leading-6">
                      {b.status === "out"
                        ? b.returns_on < today
                          ? "عودة تحتاج متابعة"
                          : "عودة منتظرة اليوم"
                        : "تسليم اليوم"}
                    </p>
                    <p className="mt-1 text-[10px] leading-6 text-muted-foreground">
                      {b.dressName} · {b.customerName}
                    </p>
                  </div>
                </Link>
              ))}
              {!attention.length && (
                <p className="text-xs leading-7 text-muted-foreground">
                  لا توجد تسليمات أو عودة تحتاج متابعة في القائمة الحالية.
                </p>
              )}
              <Link
                href="/workspace/operations"
                className="mt-5 inline-flex min-h-11 items-center text-[10px] text-primary"
              >
                فتح كل مهام اليوم ←
              </Link>
            </section>
          </div>
          <section className="studio-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-5">
              <h2 className="text-sm font-medium">آخر الحجوزات</h2>
              <Link
                href="/workspace/bookings"
                className="text-[10px] text-muted-foreground"
              >
                كل الحجوزات ←
              </Link>
            </div>
            <WorkspaceBookingTable bookings={bookings.slice(0, 8)} />
          </section>
        </>
      )}
      <section id="inventory" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl">
              {archived ? "أرشيف الفساتين" : "مجموعة الفساتين"}
            </h2>
            <p className="mt-2 text-[10px] leading-6 text-muted-foreground">
              {totalDresses.toLocaleString("ar-EG")} فستان{" "}
              {totalDresses > dresses.length
                ? `، يُعرض أحدث ${dresses.length.toLocaleString("ar-EG")}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {admin && (
              <>
                <Link
                  href={
                    archived
                      ? "/workspace?view=dresses"
                      : "/workspace?view=dresses&archived=1"
                  }
                  className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 py-3 text-xs"
                >
                  {archived ? "المخزون النشط" : "الأرشيف"}
                </Link>
                <a
                  href="#add-dress"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs text-white"
                >
                  <Plus size={15} />
                  إضافة فستان
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="relative min-w-0 grow sm:max-w-sm">
            <Search
              size={16}
              className="absolute right-4 top-3.5 text-muted-foreground"
            />
            <input
              aria-label="بحث المخزون بالاسم أو الكود"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو كود الفستان..."
              className="h-11 w-full rounded-xl border bg-white pr-11 pl-4 text-xs"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`min-h-11 rounded-full border px-4 py-2 text-[10px] ${category === c ? "border-primary bg-primary text-white" : "bg-white text-muted-foreground"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d) => (
            <Link
              key={d.id}
              href={`/workspace/dresses/${d.id}`}
              className="dress-card studio-card group overflow-hidden"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                <Image
                  src={d.image}
                  alt={d.name}
                  fill
                  className="dress-image object-cover"
                  sizes="(max-width:640px) 45vw,(max-width:1024px) 30vw,22vw"
                />
                <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[9px] text-primary">
                  {availabilityLabels[d.availability]}
                </span>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-xs leading-6">{d.name}</p>
                <p className="flex flex-wrap justify-between gap-2 text-[9px] text-muted-foreground">
                  <span>
                    {d.category} · {d.size}
                  </span>
                  <span dir="ltr">{d.code}</span>
                </p>
                <p className="flex items-center justify-between border-t pt-3 text-[10px] text-primary">
                  <span>تفاصيل الفستان</span>
                  <ArrowUpLeft size={14} />
                </p>
              </div>
            </Link>
          ))}
        </div>
        {!filtered.length && (
          <p className="studio-card p-10 text-center text-xs text-muted-foreground">
            لا توجد فساتين مطابقة.
          </p>
        )}
        <p className="text-[10px] leading-7 text-muted-foreground">
          تسميات الكتالوج يحددها الأدمن، ولا تؤكد توفر فستان لموعد معين. راجع
          التقويم قبل تأكيد الحجز.
        </p>
      </section>
    </>
  );
}
