import { WhatsAppContact } from "@/components/atelier/whatsapp-contact";
import { DressGallery } from "@/components/atelier/dress-gallery";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { Header, DemoNotice } from "@/components/atelier/chrome";
import { getCatalogue } from "@/lib/catalogue";
import { availabilityLabels } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
export default async function DressDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { dresses, demo, error } = await getCatalogue();
  if (error)
    return (
      <>
        <Header />
        <p role="alert" className="p-12 text-center">
          {error}
        </p>
      </>
    );
  const d = dresses.find((d) => d.id === id);
  if (!d) notFound();
  return (
    <>
      <Header />
      {demo && <DemoNotice />}
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Link
          href="/#collection"
          className="mb-8 flex items-center gap-2 text-xs text-muted-foreground"
        >
          <ArrowRight size={15} />
          الرجوع للمجموعة
        </Link>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <DressGallery
            images={d.images?.length ? d.images : [d.image]}
            name={d.name}
          />
          <div>
            <Badge variant="outline" className="mb-6 bg-white">
              {availabilityLabels[d.availability]}
            </Badge>
            <p
              dir="ltr"
              className="mb-3 text-right font-mono text-xs text-muted-foreground"
            >
              {d.code}
            </p>
            <h1 className="mb-5 text-4xl">{d.name}</h1>
            <p className="mb-8 text-sm leading-8 text-muted-foreground">
              تفاصيل تختاريها على ذوقك، ولحظة تفضل في بالك.
            </p>
            <dl className="mb-8 grid grid-cols-3 border-y py-6 text-sm">
              {[
                ["التصنيف", d.category],
                ["اللون", d.color],
                ["المقاس", d.size],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="mb-3 text-xs text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-3 rounded-xl bg-secondary p-5 text-xs leading-7">
              <Info size={18} className="mt-1 shrink-0" />
              <div>
                لمعرفة السعر والتوفر في تاريخ مناسبتك، اسألي فريق الأتيليه بكود{" "}
                <b dir="ltr">{d.code}</b>. لا يتم تأكيد الحجوزات من الموقع.
              </div>
            </div>
            {demo && (
              <p className="mt-5 text-xs text-muted-foreground">
                هذه بيانات وصورة مولدة للتجربة فقط.
              </p>
            )}
          </div>
        </div>
      </main>
      <WhatsAppContact code={d.code}/>
    </>
  );
}
