export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/atelier/chrome";
import { InventoryEditor } from "@/components/atelier/inventory-editor";
import { requireStaff } from "@/lib/supabase/auth";
import { configured } from "@/lib/supabase/server";
import { z } from "zod";
export default async function ManageDress({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!configured()) redirect("/workspace");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, profile } = await requireStaff();
  const [
    { data: dress, error },
    { data: categories, error: categoriesError },
    { data: photos, error: photosError },
  ] = await Promise.all([
    db
      .from("dresses")
      .select(
        "id,version,name,code,color,size,category_id,public_availability,archived",
      )
      .eq("id", id)
      .single(),
    db.from("categories").select("id,name").order("name"),
    db
      .from("dress_images")
      .select("id,path,sort_order")
      .eq("dress_id", id)
      .order("sort_order")
      .order("id"),
  ]);
  if ((error && error.code !== "PGRST116") || categoriesError || photosError)
    throw new Error("تعذر تحميل بيانات الفستان أو صوره.");
  if (!dress) notFound();
  const images = (photos ?? []).map((image) => ({
    ...image,
    url: db.storage.from("dress-images").getPublicUrl(image.path).data
      .publicUrl,
  }));
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-9">
        <Link
          href="/workspace"
          className="mb-6 inline-block text-xs text-muted-foreground"
        >
          ← العودة لمساحة العمل
        </Link>
        <h1 className="mb-3 text-2xl">{dress.name}</h1>
        <p className="mb-8 text-xs leading-7 text-muted-foreground">
          {profile.role === "admin"
            ? "إدارة البيانات والصور والأرشفة. السعر الإداري وعمليات الحجز تبقى منفصلة."
            : "بيانات الفستان. التعديل ورفع الصور للأدمن فقط."}
        </p>
        <InventoryEditor
          key={dress.id}
          dress={dress}
          categories={categories ?? []}
          images={images}
          readOnly={profile.role !== "admin"}
        />
      </main>
    </>
  );
}
