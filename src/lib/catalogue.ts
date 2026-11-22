import { configured, supabaseServer } from "./supabase/server";
import { Dress, sampleDresses } from "./domain";
export async function getCatalogue(): Promise<{
  dresses: Dress[];
  demo: boolean;
  error?: string;
}> {
  if (!configured()) return { dresses: sampleDresses, demo: true };
  const db = await supabaseServer();
  const { data, error } = await db
    .from("dresses")
    .select(
      "id,code,name,color,size,public_availability,categories(name),dress_images(path,sort_order)",
    )
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error)
    return {
      dresses: [],
      demo: false,
      error: "تعذر تحميل الكتالوج. حاول مرة أخرى لاحقًا.",
    };
  return {
    demo: false,
    dresses: (data ?? []).map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      color: d.color,
      size: d.size,
      category:
        (Array.isArray(d.categories) ? d.categories[0] : d.categories)?.name ??
        "بدون تصنيف",
      availability: d.public_availability,
      images: [...d.dress_images]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(
          (image) =>
            db.storage.from("dress-images").getPublicUrl(image.path).data
              .publicUrl,
        ),
      image: d.dress_images.length
        ? db.storage
            .from("dress-images")
            .getPublicUrl(
              [...d.dress_images].sort((a, b) => a.sort_order - b.sort_order)[0]
                .path,
            ).data.publicUrl
        : "/placeholder.svg",
    })),
  };
}
