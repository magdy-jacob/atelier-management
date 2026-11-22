import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpLeft, Sparkles, Heart } from "lucide-react";
import { Header, DemoNotice, Brand } from "@/components/atelier/chrome";
import { Catalogue } from "@/components/atelier/catalogue";
import { getCatalogue } from "@/lib/catalogue";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { dresses, demo, error } = await getCatalogue();
  return (
    <>
      <Header />
      {demo && <DemoNotice />}
      <main>
        <section className="relative mx-auto grid max-w-7xl overflow-hidden px-5 pt-8 md:grid-cols-2 md:gap-12 md:px-10 md:pt-14">
          <div className="flex flex-col items-start justify-center pb-10 pt-6 md:pb-16">
            <div className="mb-6 flex items-center gap-2 text-[10px] tracking-wider text-primary">
              <span className="h-px w-8 bg-primary/50" />
              تفاصيل صغيرة. لحظات ما بتتنسيش.
            </div>
            <h1 className="text-4xl leading-[1.7] font-medium tracking-tight sm:text-5xl md:text-[56px]">
              لكل لحظة حلوة،
              <br />
              <span className="text-[#a61d55]">فستان يحكيها.</span>
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-8 text-muted-foreground">
              تصفّحي المجموعة، واختاري اللي يشبهك.
              <br />
              فساتين بتفاصيل مميزة لمناسبتك الجاية.
            </p>
            <a
              href="#collection"
              className="mt-8 inline-flex h-12 items-center gap-8 rounded-full bg-primary px-7 text-sm text-white"
            >
              اكتشفي المجموعة
              <ArrowDown size={17} />
            </a>
            <div className="mt-10 flex items-center gap-6 border-t pt-5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-2">
                <Sparkles size={13} />
                اختيارات لكل مناسبة
              </span>
              <span>الحجز من خلال الأتيليه فقط</span>
            </div>
          </div>
          <div className="relative min-h-[350px] overflow-hidden rounded-t-[150px] bg-[#fce5ee] sm:min-h-[450px] md:min-h-[520px]">
            <Image
              src="/dresses/sage-demo.webp"
              alt="صورة توضيحية لفستان سهرة أخضر"
              fill
              className="object-cover object-center"
              priority
              sizes="(max-width:768px) 100vw, 50vw"
            />
            <div className="absolute bottom-7 right-6 flex items-center gap-3 rounded-xl border border-white/60 bg-white/85 p-4 backdrop-blur">
              <Heart className="size-8 text-primary" strokeWidth={1} />
              <div>
                <p className="mb-1 text-sm">جمالك في تفاصيلك</p>
                <p className="text-[10px] text-muted-foreground">
                  من مجموعة الصور التوضيحية
                </p>
              </div>
            </div>
          </div>
        </section>
        <div className="mt-8 border-y bg-[#fcf0f5] px-5 py-5 text-center text-xs leading-6 text-primary">
          سهرة <span className="mx-5 opacity-30">✦</span> خطوبة{" "}
          <span className="mx-5 opacity-30">✦</span> أفراح{" "}
          <span className="mx-5 opacity-30">✦</span> لحظات تستاهل
        </div>
        {error ? (
          <div
            role="alert"
            className="m-8 rounded-xl border border-red-200 bg-red-50 p-8 text-center"
          >
            {error}
          </div>
        ) : (
          <Catalogue dresses={dresses} />
        )}
        <section className="mx-5 mb-12 rounded-2xl bg-[#fce5ee] px-6 py-12 text-center md:mx-auto md:max-w-6xl">
          <p className="mb-3 text-[10px] tracking-[.2em]" dir="ltr">
            MADE FOR YOUR MOMENT
          </p>
          <h2 className="mb-4 text-2xl">لقيتي الفستان اللي في بالك؟</h2>
          <p className="mx-auto max-w-lg text-xs leading-7 text-muted-foreground">
            احتفظي بكود الفستان واسألي فريق الأتيليه عن توفره في معاد مناسبتك.
            عرض الكتالوج لا يُعتبر تأكيد حجز.
          </p>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-8 md:px-10">
          <Brand />
          <p className="text-[10px] text-muted-foreground">
            كتالوج الفساتين · لا يوجد حجز أو دفع إلكتروني
          </p>
          <Link className="text-xs text-muted-foreground" href="/login">
            مساحة الفريق
            <ArrowUpLeft className="mr-2 inline size-3" />
          </Link>
        </div>
      </footer>
    </>
  );
}
