import { DressHistory } from "@/components/atelier/dress-history";
import { Unavailable } from "@/components/atelier/staff-frame";
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
  const cleanup =
    profile.role === "admin"
      ? await db
          .from("image_deletion_jobs")
          .select("id,dress_id,created_at")
          .eq("dress_id", id)
          .eq("status", "pending")
          .order("created_at")
      : null;
  if (cleanup?.error)
    throw new Error("تعذر التحقق من ملفات الصور المعلقة؛ أعد المحاولة.");
  // The id was validated above. Only admin sessions fetch historical rows;
  // employee rendering never receives the bookings, audit JSON or actor names.
  const history =
    profile.role === "admin"
      ? await Promise.all([
          db
            .from("bookings")
            .select("id,starts_on,returns_on,status,agreed_price_piasters")
            .eq("dress_id", id)
            .order("starts_on", { ascending: false })
            .limit(100),
          db
            .from("activity_logs")
            .select(
              "id,actor_id,action,entity,entity_id,created_at,old_data,new_data",
            )
            .or(
              `entity_id.eq.${id},old_data->>dress_id.eq.${id},new_data->>dress_id.eq.${id}`,
            )
            .order("id", { ascending: false })
            .limit(100),
          db.from("profiles").select("id,full_name"),
        ])
      : null;
  const historyError = history?.some((r) => !!r.error);
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
          cleanupJobs={cleanup?.data ?? []}
        />
        {history &&
          (historyError ? (
            <Unavailable />
          ) : (
            <DressHistory
              admin
              bookings={(history[0].data ?? []).map((b) => ({
                ...b,
                agreed_price_piasters: Number(b.agreed_price_piasters),
                dressName: dress.name,
              }))}
              logs={history[1].data ?? []}
              names={Object.fromEntries(
                (history[2].data ?? []).map((p) => [p.id, p.full_name]),
              )}
            />
          ))}
      </main>
    </>
  );
}
