import type { Metadata } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
const arabic = Noto_Sans_Arabic({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
});
export const metadata: Metadata = {
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
        {children}
        <Toaster dir="rtl" position="top-center" richColors />
      </body>
    </html>
  );
}
