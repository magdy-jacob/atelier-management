"use client";

import { useMemo, useState } from "react";
import { addDays, dateInZone } from "@/lib/domain";
import { monthWindow } from "@/lib/operations";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  RotateCcw,
} from "lucide-react";

export type BookingRange = {
  dress_id: string;
  starts_on: string;
  returns_on: string;
};

export function BookingCalendarPicker({
  selectedDressId,
  existingBookings,
  startsOn,
  returnsOn,
  onSelectRange,
  minDay,
}: {
  selectedDressId: string;
  existingBookings: BookingRange[];
  startsOn: string;
  returnsOn: string;
  onSelectRange: (start: string, end: string) => void;
  minDay: string;
}) {
  const todayCairo = dateInZone(new Date(), "Africa/Cairo");
  const [currentMonth, setCurrentMonth] = useState(todayCairo.slice(0, 7));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const window = useMemo(
    () => monthWindow(currentMonth, todayCairo),
    [currentMonth, todayCairo],
  );

  const dressBookings = useMemo(() => {
    if (!selectedDressId) return [];
    return existingBookings.filter((b) => b.dress_id === selectedDressId);
  }, [existingBookings, selectedDressId]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("ar-EG", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${window.start}T12:00:00Z`));
  }, [window.start]);

  const getDayInfo = (day: string) => {
    const isPastOrToday = day < minDay;
    const isBooked = dressBookings.some(
      (b) => day >= b.starts_on && day <= b.returns_on,
    );
    const isPrep = dressBookings.some((b) => day === addDays(b.returns_on, 1));
    const isBlocked = isPastOrToday || isBooked || isPrep;

    const isStart = day === startsOn;
    const isReturn = day === returnsOn;
    const isInRange =
      startsOn && returnsOn && day > startsOn && day < returnsOn;

    return {
      isPastOrToday,
      isBooked,
      isPrep,
      isBlocked,
      isStart,
      isReturn,
      isInRange,
    };
  };

  const handleDayClick = (day: string) => {
    const info = getDayInfo(day);
    if (info.isBlocked) return;

    setErrorMessage(null);

    // If starting a new selection or both were already chosen
    if (!startsOn || (startsOn && returnsOn)) {
      onSelectRange(day, "");
      return;
    }

    // If start is chosen, choosing return
    if (startsOn && !returnsOn) {
      if (day < startsOn) {
        onSelectRange(day, "");
        return;
      }

      // Check if any day between startsOn and day is blocked
      let hasConflict = false;
      let cur = startsOn;
      while (cur <= day) {
        const curInfo = getDayInfo(cur);
        if (curInfo.isBooked || curInfo.isPrep) {
          hasConflict = true;
          break;
        }
        cur = addDays(cur, 1);
      }

      if (hasConflict) {
        setErrorMessage(
          "الفترة المختارة تحتوي على أيام محجوزة أو أيام تجهيز لهذا الفستان. اختر موعدًا آخر لا يتعارض.",
        );
        return;
      }

      onSelectRange(startsOn, day);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            تقويم الحجز وتوافر الفستان: {monthLabel}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {(startsOn || returnsOn) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectRange("", "");
                setErrorMessage(null);
              }}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw size={12} className="ml-1" />
              إعادة التحديد
            </Button>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentMonth(window.previous)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-700 hover:bg-slate-100 transition-colors"
              title="الشهر السابق"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(window.next)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-700 hover:bg-slate-100 transition-colors"
              title="الشهر التالي"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
      </div>

      {!selectedDressId && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-6">
          يرجى اختيار الفستان أولاً لمعرفة الأيام المتاحة والمحجوزة له بدقة.
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 leading-6"
        >
          {errorMessage}
        </p>
      )}

      <div className="hidden grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground sm:grid">
        {[
          "السبت",
          "الأحد",
          "الاثنين",
          "الثلاثاء",
          "الأربعاء",
          "الخميس",
          "الجمعة",
        ].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: window.offset }, (_, i) => (
          <div key={`offset-${i}`} className="min-h-11 sm:min-h-12" />
        ))}

        {window.days.map((day) => {
          const info = getDayInfo(day);
          const dayNumber = Number(day.slice(8));
          const isToday = day === todayCairo;

          let bgClass =
            "bg-white text-slate-700 border-slate-200 hover:border-primary hover:bg-primary/5 cursor-pointer";
          let label = "";

          if (info.isStart || info.isReturn) {
            bgClass =
              "bg-primary text-white border-primary font-bold shadow-sm cursor-pointer";
            label =
              info.isStart && info.isReturn
                ? "خروج وعودة"
                : info.isStart
                  ? "خروج"
                  : "عودة";
          } else if (info.isInRange) {
            bgClass =
              "bg-primary/15 text-primary border-primary/30 font-medium cursor-pointer";
          } else if (info.isBooked) {
            bgClass =
              "bg-rose-50 text-rose-700 border-rose-200 cursor-not-allowed opacity-80";
            label = "محجوز";
          } else if (info.isPrep) {
            bgClass =
              "bg-amber-50 text-amber-800 border-dashed border-amber-300 cursor-not-allowed opacity-80";
            label = "تجهيز";
          } else if (info.isPastOrToday) {
            bgClass =
              "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60";
            if (isToday) label = "اليوم (مغلق)";
          }

          return (
            <button
              key={day}
              type="button"
              disabled={info.isBlocked}
              onClick={() => handleDayClick(day)}
              className={`flex flex-col items-center justify-between min-h-11 sm:min-h-12 rounded-xl border p-1 text-center transition-all ${bgClass}`}
              title={
                info.isBooked
                  ? "محجوز لهذا الفستان"
                  : info.isPrep
                    ? "يوم تجهيز وتنظيف"
                    : info.isPastOrToday
                      ? "غير متاح (اليوم أو ماضي)"
                      : "متاح للحجز - اضغط للاختيار"
              }
            >
              <span className="text-xs sm:text-sm font-mono leading-none">
                {dayNumber}
              </span>
              {label && (
                <span className="text-[8px] sm:text-[9px] leading-tight font-sans">
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
            متاح للحجز
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-rose-300 bg-rose-100" />
            محجوز للفستان (مغلق)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-amber-300 bg-amber-100" />
            يوم تجهيز وتنظيف (مغلق)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-slate-200" />
            اليوم والماضي (مغلق)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            الفترة المحددة
          </span>
        </div>

        <div className="text-[11px] font-medium text-slate-700">
          {startsOn && !returnsOn && <span>اختر الآن تاريخ الاستلام.</span>}
          {startsOn && returnsOn && (
            <span className="text-primary font-semibold">
              تم تحديد الفترة: من {startsOn} إلى {returnsOn}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
