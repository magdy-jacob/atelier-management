import { PrototypeBanner } from "@/components/atelier/prototype-banner";
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
  title: "Lovely | تأجير وتفصيل الفساتين",
  description: "Lovely لتأجير وتفصيل الفساتين، الكتالوج ومساحة العمل",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body>
        {prototypeEnabled() && <PrototypeBanner />}
        {children}
        <Toaster dir="rtl" position="top-center" richColors />
      </body>
    </html>
  );
}
