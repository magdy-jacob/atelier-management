import { prototypeEnabled } from "@/lib/prototype";
import type { Metadata } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
const arabic = Noto_Sans_Arabic({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
});
export const metadata: Metadata = {
  robots: prototypeEnabled()
    ? { index: false, follow: false }
    : { index: true, follow: true },
  title: "أتيليه | حكاية كل فستان",
  description: "كتالوج الفساتين ومساحة إدارة الأتيليه",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body>
        {prototypeEnabled() && (
          <aside
            role="note"
            aria-label="نسخة اختبار فقط"
            className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-5 py-3 text-center text-xs leading-7 text-amber-950 shadow-sm"
          >
            نسخة اختبار فقط، وليست للتشغيل التجاري أو استقبال العملاء. لا تُدخل
            بيانات حقيقية. الحجز وتسجيل الدفعات الفعلية معطلان، ودورة التشغيل لم
            تكتمل.
          </aside>
        )}
        {children}
        <Toaster dir="rtl" position="top-center" richColors />
      </body>
    </html>
  );
}
