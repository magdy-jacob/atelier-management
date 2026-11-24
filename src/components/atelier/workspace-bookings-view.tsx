"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  WorkspaceBookingTable,
  type WorkspaceBooking,
} from "./workspace-overview";

const filterOptions = [
  { key: "all", label: "الكل" },
  { key: "confirmed", label: "مؤكد" },
  { key: "out", label: "خارج الأتيليه" },
  { key: "returned", label: "تم الاستلام" },
  { key: "cancelled", label: "ملغي" },
] as const;

export function WorkspaceBookingsView({
  bookings,
  initialStatus = "all",
}: {
  bookings: WorkspaceBooking[];
  initialStatus?: string;
}) {
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [search, setSearch] = useState("");

  const statusCounts = useMemo(() => {
    return {
      all: bookings.length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      out: bookings.filter((b) => b.status === "out").length,
      returned: bookings.filter((b) => b.status === "returned").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };
  }, [bookings]);

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        b.dressName.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q),
    );
  }, [bookings, search]);

  const activeBookings = useMemo(() => {
    return searchFiltered.filter(
      (b) => b.status !== "returned" && b.status !== "cancelled",
    );
  }, [searchFiltered]);

  const finishedBookings = useMemo(() => {
    return searchFiltered.filter(
      (b) => b.status === "returned" || b.status === "cancelled",
    );
  }, [searchFiltered]);

  const specificFiltered = useMemo(() => {
    if (selectedStatus === "all") return [];
    return searchFiltered.filter((b) => b.status === selectedStatus);
  }, [searchFiltered, selectedStatus]);

  const activeOption = filterOptions.find((o) => o.key === selectedStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="تصفية الحجوزات حسب الحالة"
          className="flex flex-wrap items-center gap-2"
        >
          {filterOptions.map((opt) => {
            const count = statusCounts[opt.key] ?? 0;
            const isSelected = selectedStatus === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedStatus(opt.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-all ${
                  isSelected
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="relative min-w-[220px] max-w-xs">
          <Search
            size={14}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالفستان أو العميل…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {selectedStatus === "all" ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              الحجوزات النشطة ({activeBookings.length})
            </h2>
            <section className="studio-card overflow-hidden">
              <WorkspaceBookingTable
                bookings={activeBookings}
                emptyMessage={
                  search
                    ? "لا توجد حجوزات نشطة تطابق البحث."
                    : "لا توجد حجوزات نشطة حاليًا."
                }
              />
            </section>
          </div>

          {finishedBookings.length > 0 && (
            <details className="studio-card group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition-all">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <span>الحجوزات المنتهية (المستلمة والملغاة)</span>
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                    {finishedBookings.length}
                  </span>
                </span>
                <span className="text-[11px] underline">
                  عرض / إخفاء الحجوزات السابقة
                </span>
              </summary>
              <div className="mt-5 border-t border-slate-200 pt-5">
                <section className="studio-card overflow-hidden bg-white">
                  <WorkspaceBookingTable
                    bookings={finishedBookings}
                    emptyMessage="لا توجد حجوزات منتهية."
                  />
                </section>
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            الحجوزات: {activeOption?.label} ({specificFiltered.length})
          </h2>
          <section className="studio-card overflow-hidden">
            <WorkspaceBookingTable
              bookings={specificFiltered}
              emptyMessage={
                search
                  ? `لا توجد حجوزات بحالة "${activeOption?.label}" تطابق البحث.`
                  : `لا توجد حجوزات بحالة "${activeOption?.label}" في القائمة.`
              }
            />
          </section>
        </div>
      )}
    </div>
  );
}
