"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Shirt,
  CalendarDays,
  Users,
  Wallet,
  Bell,
  Settings2,
  ArrowUpLeft,
  Plus,
  Search,
  ArrowDownLeft,
  Clock3,
  Check,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  LogOut,
  Info,
  CircleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Brand, DemoNotice } from "./chrome";
import {
  sampleBookings,
  sampleDresses,
  Booking,
  money,
  toPiasters,
  overlaps,
  firstAvailable,
  formatDay,
  validDay,
  addDays,
  availabilityLabels,
} from "@/lib/domain";
const nav = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "dresses", label: "الفساتين", icon: Shirt },
  { id: "bookings", label: "الحجوزات", icon: CalendarDays },
  { id: "calendar", label: "التقويم", icon: CalendarDays },
  { id: "customers", label: "العملاء", icon: Users },
  { id: "finance", label: "المالية", icon: Wallet },
  { id: "alerts", label: "التنبيهات", icon: Bell },
  { id: "policies", label: "قرارات قبل التشغيل", icon: Settings2 },
];
const policies = [
  [
    "الحجز والتوقيت",
    "تحديد اليوم أو الساعة، والسماح بالحجز في نفس اليوم. النموذج التجريبي يستخدم أيامًا فقط.",
  ],
  [
    "الإلغاء ورد المقدم",
    "نسبة الاسترداد، ومن له صلاحية الإلغاء ورد الأموال. لا تُنفذ تلقائيًا.",
  ],
  ["تعديل الحجز", "تحديد من يعدل السعر أو الميعاد، ومتى يلزم سبب أو موافقة."],
  [
    "ضمان التسليم",
    "مراجعة قانونية للاحتفاظ بأصل البطاقة، ثم اعتماد بديل أو سياسة مناسبة. لا نخزن أرقام أو صور هوية.",
  ],
  ["المدفوعات", "تحديد طرق الدفع المتاحة، وإجراءات التصحيح والاسترداد."],
  [
    "فحص العودة",
    "اعتماد عناصر الفحص والصور المطلوبة قبل تشغيل التسليم والاستلام.",
  ],
  [
    "الموظفون والعملاء",
    "تأكيد نطاق الحجوزات التي يراها كل موظف، وطريقة مطابقة أرقام العملاء.",
  ],
  [
    "بيانات الأتيليه",
    "اسم الأتيليه، الشعار، صور الفساتين الحقيقية وبيانات التواصل.",
  ],
];
function Status({ booking }: { booking: Booking }) {
  const late = booking.status === "out" && booking.end < "2026-12-05";
  const text = late
    ? "متأخر"
    : {
        confirmed: "مؤكد",
        out: "خارج الأتيليه",
        returned: "تم الاستلام",
        cancelled: "ملغي",
      }[booking.status];
  return (
    <Badge
      className={`border-0 px-3 py-1 ${late ? "bg-red-50 text-red-700" : booking.status === "out" ? "bg-amber-50 text-amber-800" : "bg-[#eef2e9] text-primary"}`}
    >
      {text}
    </Badge>
  );
}
export function DemoWorkspace() {
  const [tab, setTab] = useState("overview");
  const [role, setRole] = useState("admin");
  const [bookings, setBookings] = useState<Booking[]>(sampleBookings);
  const [search, setSearch] = useState("");
  const [newBooking, setNewBooking] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("2026-12");
  const [mobileNav, setMobileNav] = useState(false);
  const admin = role === "admin";
  const visibleNav = nav.filter(
    (n) => admin || !["finance", "policies", "alerts"].includes(n.id),
  );
  const current = visibleNav.find((n) => n.id === tab) ?? visibleNav[0];
  const activeTab = current.id;
  const stats = [
    {
      label: "فساتين المجموعة",
      value: sampleDresses.length,
      sub: "نماذج توضيحية",
      icon: Shirt,
    },
    {
      label: "حجوزات اليوم",
      value: bookings.filter((b) => b.start === "2026-12-05").length,
      sub: "السبت، ٥ ديسمبر ٢٠٢٦",
      icon: CalendarDays,
    },
    {
      label: "مطلوب استلامها",
      value: bookings.filter((b) => b.status === "out" && b.end <= "2026-12-05")
        .length,
      sub: "منها حالة متأخرة",
      icon: ArrowDownLeft,
    },
    ...(admin
      ? [
          {
            label: "المبالغ المسجلة",
            value: money(bookings.reduce((n, b) => n + b.paid, 0)),
            sub: "أموال تجريبية وليست إيرادًا فعليًا",
            icon: Wallet,
          },
        ]
      : []),
  ];
  const filtered = bookings.filter((b) =>
    `${b.id} ${b.customer} ${sampleDresses.find((d) => d.id === b.dressId)?.name}`.includes(
      search,
    ),
  );
  const calendarDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return [
      ...Array((first + 1) % 7).fill(null),
      ...Array.from(
        { length: count },
        (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
      ),
    ] as (string | null)[];
  }, [month]);
  function changeMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7));
  }
  function createBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fd = new FormData(event.currentTarget);
    const dressId = String(fd.get("dress"));
    const start = String(fd.get("start"));
    const end = String(fd.get("end"));
    let total: number, paid: number;
    try {
      total = toPiasters(String(fd.get("total")));
      paid = toPiasters(String(fd.get("paid")));
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!validDay(start) || !validDay(end) || end < start) {
      setError("راجع تواريخ الخروج والعودة");
      return;
    }
    if (total <= 0 || paid > total) {
      setError("السعر يجب أن يكون أكبر من صفر، والمقدم لا يتجاوز السعر");
      return;
    }
    const conflict = bookings.find(
      (b) =>
        b.dressId === dressId &&
        b.status !== "cancelled" &&
        overlaps({ start, end }, b),
    );
    if (conflict) {
      const duration = Math.round(
        (Date.parse(end) - Date.parse(start)) / 86400000,
      );
      setError(
        `التاريخ يتعارض مع الحجز ${conflict.id} أو يوم التجهيز. أول موعد مقترح: ${formatDay(firstAvailable(start, duration, bookings, dressId))}`,
      );
      return;
    }
    const b: Booking = {
      id: `BK-DEMO-${bookings.length + 1}`,
      dressId,
      customer: String(fd.get("customer")).trim(),
      phone: String(fd.get("phone")).trim(),
      start,
      end,
      total,
      paid,
      status: "confirmed",
    };
    if (!b.customer || !b.phone) {
      setError("الاسم ورقم الهاتف مطلوبان");
      return;
    }
    setBookings([...bookings, b]);
    setNewBooking(false);
    toast.success("تمت إضافة حجز تجريبي داخل هذه الصفحة فقط");
  }
  function exportCSV() {
    const rows = [
      [
        "booking",
        "dress",
        "customer",
        "start",
        "return",
        "total_egp",
        "paid_egp",
        "remaining_egp",
      ],
      ...bookings.map((b) => [
        b.id,
        b.dressId,
        b.customer,
        b.start,
        b.end,
        b.total / 100,
        b.paid / 100,
        (b.total - b.paid) / 100,
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r
            .map(
              (v) =>
                '"' +
                String(v)
                  .replaceAll('"', '""')
                  .replace(/^\s*[=+@-]/, "'$&") +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "atelier-demo-bookings.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function bookingTable() {
    return (
      <>
        <div className="divide-y md:hidden">
          {filtered.map((b) => {
            const d = sampleDresses.find((d) => d.id === b.dressId)!;
            return (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className="block w-full p-5 text-right"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Image
                      src={d.image}
                      width={38}
                      height={48}
                      className="rounded-lg"
                      alt=""
                    />
                    <div>
                      <p className="mb-1 text-xs font-medium">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {b.customer}
                      </p>
                    </div>
                  </div>
                  <Status booking={b} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-[10px]">
                  <span dir="ltr" className="text-muted-foreground">
                    {b.start} → {b.end}
                  </span>
                  <span>المتبقي: {money(b.total - b.paid)}</span>
                </div>
              </button>
            );
          })}
          {!filtered.length && (
            <p className="p-8 text-center text-xs">لا توجد حجوزات مطابقة</p>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[690px] text-right text-xs">
            <thead className="border-b bg-[#fafbf8] text-muted-foreground">
              <tr>
                {[
                  "الفستان / الحجز",
                  "العميل",
                  "الخروج ← العودة",
                  "الحالة",
                  "المتبقي",
                  "",
                ].map((s, i) => (
                  <th key={i} className="px-5 py-4 font-normal">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const d = sampleDresses.find((d) => d.id === b.dressId)!;
                return (
                  <tr
                    key={b.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Image
                          src={d.image}
                          width={40}
                          height={50}
                          alt=""
                          className="rounded-lg"
                        />
                        <div className="space-y-1">
                          <p className="font-medium">{d.name}</p>
                          <p
                            className="font-mono text-[9px] text-muted-foreground"
                            dir="ltr"
                          >
                            {b.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5">{b.customer}</td>
                    <td className="px-5">
                      <div dir="ltr" className="whitespace-nowrap text-[10px]">
                        {b.start} → {b.end}
                      </div>
                    </td>
                    <td className="px-5">
                      <Status booking={b} />
                    </td>
                    <td className="px-5 whitespace-nowrap">
                      {money(b.total - b.paid)}
                    </td>
                    <td className="px-4">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`تفاصيل ${b.id}`}
                        onClick={() => setSelected(b)}
                      >
                        <ArrowUpLeft size={16} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-10 text-center text-muted-foreground">
              لا توجد حجوزات مطابقة
            </p>
          )}
        </div>
      </>
    );
  }
  return (
    <div className="min-h-screen bg-[#f6f7f2]">
      <aside
        className={`${mobileNav ? "fixed inset-y-0 right-0 z-50 flex" : "hidden"} w-60 flex-col bg-[#303e30] px-5 py-7 text-white lg:fixed lg:inset-y-0 lg:right-0 lg:flex`}
      >
        <Brand dark />
        <div className="mt-10 mb-3 px-3 text-[10px] text-[#a5b39e]">
          مساحة العمل
        </div>
        <nav className="space-y-2">
          {visibleNav.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setTab(n.id);
                setSearch("");
                setMobileNav(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs transition-colors ${activeTab === n.id ? "bg-[#edf1e5] text-[#34462e]" : "text-[#d7dece] hover:bg-white/10"}`}
            >
              <n.icon size={17} strokeWidth={1.5} />
              {n.label}
              {n.id === "alerts" && (
                <span className="mr-auto rounded bg-white/10 px-2 text-[10px]">
                  ٣
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-5 pt-10">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-[10px] leading-6 text-[#c7d0bf]">
            بيئة استعراض فقط
            <br />
            لا بيانات حقيقية أو عمليات محفوظة.
          </div>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 text-xs text-[#d7dece]"
          >
            <LogOut size={15} />
            عرض الكتالوج العام
          </Link>
        </div>
      </aside>
      {mobileNav && (
        <button
          onClick={() => setMobileNav(false)}
          aria-label="إغلاق القائمة"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}
      <div className="lg:mr-60">
        <DemoNotice short />
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-4 md:px-9">
          <div className="flex items-center gap-3">
            <Button
              className="lg:hidden"
              size="icon"
              variant="ghost"
              aria-label="فتح القائمة"
              onClick={() => setMobileNav(true)}
            >
              <PanelRightClose size={20} />
            </Button>
            <span className="text-xs text-muted-foreground">
              مساحة العمل <span className="mx-3 opacity-40">/</span>
              <span className="text-foreground">{current.label}</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
              عرض تجريبي:
              <select
                aria-label="الدور التجريبي"
                className="rounded-lg border px-2 py-2 text-foreground"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setTab("overview");
                }}
              >
                <option value="admin">أدمن</option>
                <option value="employee">موظف</option>
              </select>
            </label>
            <span className="grid size-9 place-items-center rounded-full bg-[#eee8dd] text-xs text-[#796949]">
              أت
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-5 py-7 md:px-9 md:py-9">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-[10px] text-muted-foreground">
                السبت، ٥ ديسمبر ٢٠٢٦ · يوم تجريبي ثابت
              </div>
              <h1 className="text-2xl font-medium">
                {activeTab === "overview"
                  ? "كل تفاصيل يومك، في مكان واحد."
                  : current.label}
              </h1>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {activeTab === "overview"
                  ? "تابع الفساتين والحجوزات، وخلي كل مناسبة تبدأ من هنا."
                  : "البيانات للتجربة فقط. العمليات الحقيقية تحتاج تهيئة واعتماد السياسات."}
              </p>
            </div>
            {["overview", "bookings", "calendar"].includes(activeTab) && (
              <Button
                onClick={() => {
                  setError("");
                  setNewBooking(true);
                }}
                className="h-11 gap-2 rounded-xl px-5"
              >
                <Plus size={16} />
                حجز تجريبي جديد
              </Button>
            )}
          </div>
          {activeTab === "overview" && (
            <>
              <div
                className={`mb-7 grid grid-cols-2 gap-4 ${admin ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
              >
                {stats.map((s) => (
                  <div key={s.label} className="studio-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">
                        {s.label}
                      </p>
                      <s.icon size={17} className="text-[#7d8c72]" />
                    </div>
                    <div className="mb-3 text-2xl font-medium">{s.value}</div>
                    <p className="text-[9px] text-muted-foreground">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="mb-7 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
                <section className="relative overflow-hidden rounded-2xl bg-[#e6ebdd] p-7">
                  <div className="relative z-10 max-w-[75%]">
                    <span className="mb-5 inline-block rounded-full bg-white/60 px-3 py-1 text-[9px] text-primary">
                      مساحة مرتّبة ليوم أخف
                    </span>
                    <h2 className="mb-3 text-xl leading-9">
                      ورا كل فستان،
                      <br />
                      حكاية محتاجة اهتمام.
                    </h2>
                    <p className="mb-6 max-w-xs text-xs leading-7 text-[#6d7865]">
                      راجع التسليم والعودة قبل بداية اليوم، وتابع الحجوزات اللي
                      محتاجة تجهيز.
                    </p>
                    <Button
                      variant="outline"
                      className="rounded-full border-primary/20 bg-transparent text-xs"
                      onClick={() => setTab("bookings")}
                    >
                      مراجعة الحجوزات
                      <ArrowUpLeft size={13} />
                    </Button>
                  </div>
                  <Shirt
                    size={190}
                    strokeWidth={0.5}
                    className="absolute -bottom-7 -left-4 -rotate-12 text-[#829570]/25"
                  />
                </section>
                <section className="studio-card p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-sm font-medium">يحتاج انتباهك</h2>
                    <Bell size={16} className="text-muted-foreground" />
                  </div>
                  {[
                    [
                      "تأخير في عودة فستان",
                      "ليلة مخمل · كان متوقعًا ٤ ديسمبر",
                      "red",
                    ],
                    ["عودة منتظرة اليوم", "وردة المساء · حجز BK-1023", "amber"],
                    ["تسليم اليوم", "همسة زيتون · حجز BK-1024", "green"],
                  ].map(([a, b, c]) => (
                    <div
                      key={a}
                      className="mb-5 flex items-start gap-3 last:mb-0"
                    >
                      <span
                        className={`mt-1 size-2 shrink-0 rounded-full ${c === "red" ? "bg-red-400" : c === "amber" ? "bg-amber-400" : "bg-[#839a71]"}`}
                      />
                      <div>
                        <p className="mb-1.5 text-xs">{a}</p>
                        <p className="text-[10px] leading-6 text-muted-foreground">
                          {b}
                        </p>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
              <section className="studio-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5">
                  <h2 className="text-sm font-medium">الحجوزات الجارية</h2>
                  <button
                    className="text-[10px] text-muted-foreground"
                    onClick={() => setTab("bookings")}
                  >
                    كل الحجوزات ←
                  </button>
                </div>
                {bookingTable()}
              </section>
            </>
          )}
          {activeTab === "bookings" && (
            <section className="studio-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="relative">
                  <Search className="absolute top-3 right-3 size-4 text-muted-foreground" />
                  <Input
                    aria-label="بحث الحجوزات"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="العميل، الفستان، رقم الحجز"
                    className="h-10 w-64 pr-9"
                  />
                </div>
                {admin && (
                  <Button variant="outline" onClick={exportCSV}>
                    تصدير CSV تجريبي
                  </Button>
                )}
              </div>
              {bookingTable()}
            </section>
          )}
          {activeTab === "dresses" && (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {sampleDresses.map((d) => (
                <div key={d.id} className="studio-card overflow-hidden">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={d.image}
                      alt={d.name}
                      fill
                      className="object-cover"
                      sizes="(max-width:768px) 50vw, 25vw"
                    />
                    <Badge className="absolute top-3 right-3 bg-white/90 text-primary">
                      {availabilityLabels[d.availability]}
                    </Badge>
                  </div>
                  <div className="space-y-2 p-4">
                    <h2 className="text-sm">{d.name}</h2>
                    <p className="text-[10px] text-muted-foreground">
                      {d.code} · {d.category} · {d.size}
                    </p>
                    <Link
                      href={`/demo/dresses/${d.id}`}
                      className="block pt-2 text-[10px] text-primary"
                    >
                      فتح التفاصيل ←
                    </Link>
                    {admin && (
                      <Link
                        href="/demo/inventory"
                        className="block pt-2 text-[10px] text-muted-foreground underline underline-offset-4"
                      >
                        معاينة إدارة الفستان
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "calendar" && (
            <section className="studio-card overflow-hidden">
              <div className="flex items-center justify-between p-5">
                <h2 className="text-base">
                  {new Intl.DateTimeFormat("ar-EG", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${month}-01T12:00:00Z`))}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="الشهر السابق"
                    onClick={() => changeMonth(-1)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="الشهر التالي"
                    onClick={() => changeMonth(1)}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                </div>
              </div>
              <p className="px-5 pb-5 text-[10px] leading-6 text-muted-foreground">
                تظهر فترة الحجز ويوم التجهيز التالي للعودة. هذا تقويم بالأيام
                لعرض القاعدة فقط.
              </p>
              <div className="grid grid-cols-7 bg-muted/50 text-center text-[10px]">
                {["س", "ح", "ن", "ث", "ر", "خ", "ج"].map((s, i) => (
                  <div className="p-3" key={i}>
                    {s}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => (
                  <div
                    key={day ?? `blank${i}`}
                    className={`min-h-24 border-t border-l p-1.5 md:min-h-32 md:p-3 ${day === "2026-12-05" ? "bg-[#edf1e7]" : ""}`}
                  >
                    <div
                      className={`mb-2 text-[10px] ${day === "2026-12-05" ? "font-bold text-primary" : "text-muted-foreground"}`}
                    >
                      {day && Number(day.slice(-2))}
                    </div>
                    {day &&
                      bookings
                        .filter(
                          (b) =>
                            b.status !== "cancelled" &&
                            day >= b.start &&
                            day <= addDays(b.end, 1),
                        )
                        .map((b) => (
                          <button
                            key={b.id}
                            onClick={() => setSelected(b)}
                            className={`mb-1 block w-full truncate rounded p-1 text-right text-[8px] md:text-[9px] ${day > b.end ? "border border-dashed border-amber-300 bg-amber-50 text-amber-800" : "bg-[#dde5d4] text-primary"}`}
                          >
                            {day > b.end
                              ? "تجهيز"
                              : sampleDresses.find((d) => d.id === b.dressId)
                                  ?.name}
                          </button>
                        ))}
                  </div>
                ))}
              </div>
            </section>
          )}
          {activeTab === "customers" && (
            <section className="studio-card divide-y">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-6"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid size-10 place-items-center rounded-full bg-secondary">
                      <Users size={16} />
                    </span>
                    <div>
                      <h2 className="mb-2 text-xs">{b.customer}</h2>
                      <p
                        className="text-[10px] text-muted-foreground"
                        dir="ltr"
                      >
                        {b.phone}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(b)}
                  >
                    عرض الحجز
                  </Button>
                </div>
              ))}
              <p className="p-5 text-[10px] leading-6 text-muted-foreground">
                أرقام وأسماء وهمية. مطابقة العملاء المتكررين تحتاج اعتماد سياسة
                أولًا.
              </p>
            </section>
          )}
          {activeTab === "finance" && admin && (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                {[
                  ["قيمة الحجوزات", bookings.reduce((s, b) => s + b.total, 0)],
                  ["مدفوعات مسجلة", bookings.reduce((s, b) => s + b.paid, 0)],
                  [
                    "المتبقي",
                    bookings.reduce((s, b) => s + b.total - b.paid, 0),
                  ],
                ].map(([title, value]) => (
                  <div key={title} className="studio-card p-6">
                    <p className="mb-5 text-xs text-muted-foreground">
                      {title}
                    </p>
                    <p className="text-2xl">{money(Number(value))}</p>
                  </div>
                ))}
              </div>
              <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-xs leading-7">
                <Info size={18} className="mt-1 shrink-0" />
                ملخص تجريبي للأدمن فقط. لا يعادل الإيراد المحاسبي، ولا يشمل
                استردادات أو غرامات. سياسات تلك الإجراءات لم تُعتمد.
              </div>
              <section className="studio-card overflow-hidden">
                {bookingTable()}
              </section>
            </>
          )}
          {activeTab === "alerts" && (
            <section className="studio-card divide-y">
              {bookings
                .filter(
                  (b) => b.status !== "returned" && b.status !== "cancelled",
                )
                .map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelected(b)}
                    className="flex w-full items-center gap-4 p-6 text-right"
                  >
                    <CircleAlert
                      className={
                        b.end < "2026-12-05" ? "text-red-500" : "text-[#879774]"
                      }
                      size={22}
                    />
                    <div>
                      <h2 className="mb-2 text-sm">
                        {b.end < "2026-12-05"
                          ? "تأخير في الاستلام"
                          : b.start === "2026-12-05"
                            ? "خروج اليوم"
                            : "استلام منتظر"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {sampleDresses.find((d) => d.id === b.dressId)?.name} ·{" "}
                        {b.customer}
                      </p>
                    </div>
                    <ArrowUpLeft className="mr-auto" size={16} />
                  </button>
                ))}
              <p className="p-5 text-[10px] text-muted-foreground">
                داخل الموقع فقط، ولا يختفي تنبيه تشغيلي بمجرد قراءته.
              </p>
            </section>
          )}
          {activeTab === "policies" && (
            <div className="grid gap-4 md:grid-cols-2">
              {policies.map(([title, desc]) => (
                <section key={title} className="studio-card p-6">
                  <Badge
                    variant="outline"
                    className="mb-4 border-amber-200 bg-amber-50 text-[9px] text-amber-800"
                  >
                    بانتظار قرار
                  </Badge>
                  <h2 className="mb-3 text-sm font-medium">{title}</h2>
                  <p className="text-xs leading-7 text-muted-foreground">
                    {desc}
                  </p>
                </section>
              ))}
            </div>
          )}
          <div className="mt-9 flex items-center gap-2 text-[9px] leading-6 text-muted-foreground">
            <Clock3 size={12} />
            تغيير الدور هنا للمعاينة فقط، وليس نظام صلاحيات. الإنتاج يعتمد على
            Supabase Auth وRLS.
          </div>
        </main>
      </div>
      <Dialog open={newBooking} onOpenChange={setNewBooking}>
        <DialogContent
          dir="rtl"
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader className="text-right">
            <DialogTitle>حجز تجريبي جديد</DialogTitle>
            <DialogDescription className="text-right text-xs leading-7">
              محاكاة محلية لا تُحفظ عند تحديث الصفحة. تعتمد الأيام ويوم تجهيز
              واحد لتجربة مثال الوثيقة فقط.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createBooking} className="space-y-4">
            <label className="field">
              الفستان
              <select name="dress" required>
                {sampleDresses.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.code}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field">
                اسم العميل
                <input
                  name="customer"
                  required
                  maxLength={120}
                  placeholder="اسم تجريبي"
                />
              </label>
              <label className="field">
                رقم الهاتف
                <input
                  name="phone"
                  dir="ltr"
                  required
                  maxLength={24}
                  type="tel"
                  placeholder="01000000000"
                />
              </label>
              <label className="field">
                تاريخ الخروج
                <input
                  name="start"
                  type="date"
                  required
                  defaultValue="2026-12-08"
                />
              </label>
              <label className="field">
                تاريخ العودة
                <input
                  name="end"
                  type="date"
                  required
                  defaultValue="2026-12-09"
                />
              </label>
              <label className="field">
                السعر المتفق عليه (جنيه)
                <input
                  name="total"
                  type="number"
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  required
                  defaultValue="3000"
                />
              </label>
              <label className="field">
                المقدم (جنيه)
                <input
                  name="paid"
                  type="number"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  required
                  defaultValue="1000"
                />
              </label>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-xs leading-7 text-red-700"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="h-11 w-full">
              <Check size={16} />
              إضافة للتجربة فقط
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right">
              تفاصيل الحجز {selected?.id}
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              عرض تجريبي، لا يتم تنفيذ تحصيل أو تسليم فعلي
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-xl bg-muted p-5">
                <h2 className="mb-2">
                  {sampleDresses.find((d) => d.id === selected.dressId)?.name}
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  {selected.customer}
                </p>
                <Status booking={selected} />
              </div>
              <dl className="grid grid-cols-2 gap-5 text-xs">
                {[
                  ["موعد الخروج", selected.start],
                  ["موعد العودة", selected.end],
                  ["السعر", money(selected.total)],
                  ["المدفوع", money(selected.paid)],
                  ["المتبقي", money(selected.total - selected.paid)],
                  ["أول يوم حجز جديد", addDays(selected.end, 2)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="mb-2 text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[11px] leading-7">
                إجراءات الدفع والتسليم والعودة والإلغاء متوقفة في العرض لحين
                اعتماد السياسات وربط قاعدة البيانات. لا يتم تحصيل أي مبلغ من
                هنا.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
