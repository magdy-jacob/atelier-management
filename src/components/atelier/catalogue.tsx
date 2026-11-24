"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpLeft, Search, SlidersHorizontal, X } from "lucide-react";
import { Dress, availabilityLabels } from "@/lib/domain";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
export function Catalogue({ dresses }: { dresses: Dress[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("الكل");
  const [status, setStatus] = useState("all");
  const categories = [
    "الكل",
    ...Array.from(new Set(dresses.map((d) => d.category))),
  ];
  const filtered = useMemo(
    () =>
      dresses.filter(
        (d) =>
          (category === "الكل" || d.category === category) &&
          (status === "all" || d.availability === status) &&
          `${d.name} ${d.code}`
            .toLocaleLowerCase("ar")
            .includes(query.trim().toLocaleLowerCase("ar")),
      ),
    [dresses, category, status, query],
  );
  return (
    <section
      id="collection"
      className="mx-auto max-w-7xl scroll-mt-8 px-5 py-12 md:px-10 md:py-20"
    >
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div
            className="mb-2 text-[10px] tracking-[.22em] text-muted-foreground"
            dir="ltr"
          >
            A DRESS FOR EVERY STORY
          </div>
          <h2 className="text-3xl font-medium">اختاري حكايتك</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} تصاميم
        </span>
      </div>
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row">
        <div className="flex flex-wrap gap-2" aria-label="التصنيفات">
          {categories.map((c) => (
            <Button
              key={c}
              variant={category === c ? "default" : "outline"}
              className="h-10 rounded-full px-6"
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute top-3 right-3 size-4 text-muted-foreground" />
            <Input
              aria-label="ابحثي بالاسم أو الكود"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="الاسم أو كود الفستان"
              className="h-10 bg-white pr-10"
            />
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-xs">
            <SlidersHorizontal size={14} />
            <span className="sr-only">التوفر</span>
            <select
              aria-label="حالة التوفر"
              className="max-w-28 bg-transparent outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">كل الحالات</option>
              <option value="available">متاح</option>
              <option value="reserved">محجوز</option>
              <option value="unavailable">غير متاح</option>
            </select>
          </label>
        </div>
      </div>
      {filtered.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 md:gap-x-7">
          {filtered.map((d, i) => (
            <Link
              href={`/dresses/${d.id}`}
              key={d.id}
              className="dress-card group block"
            >
              <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-2xl bg-[#f9e7ef]">
                <Image
                  className="dress-image object-cover"
                  src={d.image}
                  alt={d.name}
                  fill
                  sizes="(max-width: 768px) 48vw, 32vw"
                  priority={i < 3}
                />
                <Badge
                  className={`absolute top-3 right-3 rounded-full border-0 px-3 py-1.5 text-[10px] ${d.availability === "available" ? "bg-white/90 text-primary" : "bg-[#f8d8e6]/95 text-[#7d2148]"}`}
                >
                  {d.availability === "available" && (
                    <span className="size-1.5 rounded-full bg-[#b1245d]" />
                  )}
                  {availabilityLabels[d.availability]}
                </Badge>
                <span className="absolute bottom-3 left-3 grid size-9 place-items-center rounded-full bg-white/90 text-primary group-hover:bg-primary group-hover:text-white">
                  <ArrowUpLeft size={16} />
                </span>
              </div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                <h3 className="text-sm font-medium md:text-base">{d.name}</h3>
                <span
                  dir="ltr"
                  className="font-mono text-[10px] text-muted-foreground"
                >
                  {d.code}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground md:text-xs">
                {d.category}
                <span className="mx-2">·</span>
                {d.color}
                <span className="mx-2">·</span>مقاس {d.size}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed py-20 text-center">
          <p className="mb-4 text-muted-foreground">
            لا توجد فساتين مطابقة للبحث
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setCategory("الكل");
              setStatus("all");
            }}
          >
            <X size={14} />
            مسح الفلاتر
          </Button>
        </div>
      )}
    </section>
  );
}
