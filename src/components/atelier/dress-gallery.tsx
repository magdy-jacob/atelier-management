"use client";
import Image from "next/image";
import { useState } from "react";
export function DressGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [selected, setSelected] = useState(0);
  const safeImages = images.length ? images : ["/placeholder.svg"];
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-t-[130px] rounded-b-2xl bg-muted">
        <Image
          src={safeImages[selected] ?? safeImages[0]}
          alt={`${name}، صورة ${selected + 1}`}
          fill
          sizes="(max-width:768px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>
      {safeImages.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-3" aria-label="صور الفستان">
          {safeImages.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`عرض الصورة ${i + 1}`}
              aria-pressed={selected === i}
              className={`relative h-24 w-20 overflow-hidden rounded-xl border-2 ${selected === i ? "border-primary" : "border-transparent"}`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
