import Link from "next/link";
import { Header, DemoNotice } from "@/components/atelier/chrome";
import { InventoryEditor } from "@/components/atelier/inventory-editor";
import { sampleDresses } from "@/lib/domain";
export default function InventoryPreview() {
  const d = sampleDresses[0];
  return (
    <>
      <Header />
      <DemoNotice short />
      <main className="mx-auto max-w-6xl px-5 py-9">
        <Link
          href="/demo"
          className="mb-6 inline-block text-xs text-muted-foreground"
        >
          ← الرجوع للاستعراض
        </Link>
        <h1 className="mb-3 text-2xl">إدارة الفستان</h1>
        <p className="mb-8 text-xs leading-7 text-muted-foreground">
          معاينة للتصميم ببيانات تجريبية. الحفظ والرفع والأرشفة معطلة هنا، وتتاح
          داخل حساب الأدمن المصرح، لا من شاشة المعاينة.
        </p>
        <InventoryEditor
          preview
          dress={{
            id: d.id,
            version: 1,
            name: d.name,
            code: d.code,
            color: d.color,
            size: d.size,
            category_id: "evening",
            public_availability: d.availability,
            archived: false,
          }}
          categories={[
            { id: "evening", name: "سهرة" },
            { id: "engagement", name: "خطوبة" },
            { id: "wedding", name: "أفراح" },
          ]}
          images={[
            { id: "sample", url: d.image, sort_order: 0 },
            {
              id: "sample-2",
              url: "/dresses/sage-detail-top.webp",
              sort_order: 1,
            },
            {
              id: "sample-3",
              url: "/dresses/sage-detail-hem.webp",
              sort_order: 2,
            },
          ]}
        />
      </main>
    </>
  );
}
