"use client";
import { useEffect, useRef } from "react";
import { functionalPortfolioEnabled } from "@/lib/portfolio-mode";
export function PrototypeBanner() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--prototype-offset",
        `${element.getBoundingClientRect().height}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--prototype-offset");
    };
  }, []);
  return (
    <aside
      ref={ref}
      role="note"
      aria-label="نسخة اختبار فقط"
      className="sticky top-0 z-[60] border-b border-pink-300 bg-pink-100 px-5 py-3 text-center text-xs leading-7 text-pink-950 shadow-sm"
    >
      {functionalPortfolioEnabled()
        ? "مشروع معرض أعمال، اختبار وظيفي ببيانات مصطنعة فقط. السجلات والمبالغ للتجربة، لا عملاء أو مدفوعات أو التزامات حقيقية."
        : "مشروع معرض أعمال ببيانات مصطنعة فقط. لا تُدخل بيانات حقيقية. استعراض الواجهة منفصل عن البيانات المحفوظة؛ إعداد الاختبار الوظيفي لم يكتمل بعد."}
    </aside>
  );
}
