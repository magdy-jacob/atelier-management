import Link from "next/link";
import { requireStaff } from "@/lib/supabase/auth";
import { StaffFrame, Unavailable } from "@/components/atelier/staff-frame";
import {
  WorkspaceOverview,
  type WorkspaceBooking,
} from "@/components/atelier/workspace-overview";
import { DressForm, CategoryForm } from "@/components/atelier/forms";
import {
  bookingForWorkspace,
  firstWorkspaceImage,
  workspaceBookingColumns,
} from "@/lib/workspace-view";
import { dateInZone, type Dress } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; view?: string }>;
}) {
  const { db, profile } = await requireStaff();
  const params = await searchParams;
  const admin = profile.role === "admin";
  const archived = admin && params.archived === "1";
  const inventory = params.view === "dresses" || archived;
  const today = dateInZone(new Date(), "Africa/Cairo");
  const [
    categories,
    dressRows,
    bookingRows,
    attentionRows,
    dressCount,
    outgoing,
    incoming,
  ] = await Promise.all([
    db.from("categories").select("id,name").order("name"),
    db
      .from("dresses")
      .select(
        "id,name,code,size,color,public_availability,categories(name),dress_images(id,path,sort_order)",
        { count: "exact" },
      )
      .eq("archived", archived)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("bookings")
      .select(workspaceBookingColumns)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("bookings")
      .select(workspaceBookingColumns)
      .or(
        `and(status.eq.confirmed,starts_on.eq.${today}),and(status.eq.out,returns_on.lte.${today})`,
      )
      .order("returns_on")
      .limit(6),
    db
      .from("dresses")
      .select("id", { head: true, count: "exact" })
      .eq("archived", false),
    db
      .from("bookings")
      .select("id", { head: true, count: "exact" })
      .eq("status", "confirmed")
      .eq("starts_on", today),
    db
      .from("bookings")
      .select("id", { head: true, count: "exact" })
      .eq("status", "out")
      .lte("returns_on", today),
  ]);
  const cleanup = admin
    ? await db
        .from("image_deletion_jobs")
        .select("id,dress_id,dresses(name)", { count: "exact" })
        .eq("status", "pending")
        .order("created_at")
        .limit(10)
    : null;
  const urlFor = (path: string) =>
    db.storage.from("dress-images").getPublicUrl(path).data.publicUrl;
  const dresses: Dress[] = (dressRows.data ?? []).map((d) => ({
    ...d,
    category:
      (Array.isArray(d.categories) ? d.categories[0] : d.categories)?.name ??
      "بدون تصنيف",
    availability: d.public_availability,
    image: firstWorkspaceImage(d.dress_images, urlFor),
  }));
  const mapBooking = (
    b: NonNullable<typeof bookingRows.data>[number],
  ): WorkspaceBooking => bookingForWorkspace(b, urlFor);
  const failed =
    [
      categories,
      dressRows,
      bookingRows,
      attentionRows,
      dressCount,
      outgoing,
      incoming,
    ].some((r) => !!r.error) ||
    dressRows.count === null ||
    dressCount.count === null ||
    outgoing.count === null ||
    incoming.count === null;
  return (
    <StaffFrame
      title={
        inventory
          ? archived
            ? "أرشيف الفساتين"
            : "الفساتين"
          : "كل تفاصيل يومك، في مكان واحد."
      }
      description={
        inventory
          ? "إدارة المجموعة والصور والتصنيفات، وكل تفاصيل الفستان."
          : "تابع الفساتين والحجوزات، وخلي كل مناسبة تبدأ من هنا."
      }
      name={profile.full_name}
      role={profile.role}
      active={inventory ? "/workspace?view=dresses" : "/workspace"}
    >
      {failed ? (
        <Unavailable />
      ) : (
        <WorkspaceOverview
          dresses={dresses}
          bookings={(bookingRows.data ?? []).map(mapBooking)}
          attention={(attentionRows.data ?? []).map(mapBooking)}
          stats={{
            dresses: dressCount.count!,
            outgoing: outgoing.count!,
            incoming: incoming.count!,
          }}
          totalDresses={dressRows.count ?? 0}
          today={today}
          inventory={inventory}
          archived={archived}
          admin={admin}
        />
      )}
      {cleanup?.error && <Unavailable />}
      {!!cleanup?.count && (
        <section className="studio-card space-y-4 border-red-200 p-6">
          <h2 className="text-sm">تنظيف ملفات صور معلق ({cleanup.count})</h2>
          <p className="text-xs leading-7 text-muted-foreground">
            أُزيلت الصور من الكتالوج، لكن مسح ملفاتها لم يُؤكد. افتح الفستان
            لإعادة المحاولة. يُعرض أول10طلبات فقط.
          </p>
          <div className="flex flex-wrap gap-3">
            {cleanup.data?.map((job) => (
              <Link
                key={job.id}
                className="rounded-xl border px-4 py-3 text-xs text-primary"
                href={`/workspace/dresses/${job.dress_id}`}
              >
                {(Array.isArray(job.dresses) ? job.dresses[0] : job.dresses)
                  ?.name ?? "فتح الفستان"}
              </Link>
            ))}
          </div>
        </section>
      )}
      {admin && (
        <details
          id="add-dress"
          className="studio-card scroll-mt-28 p-6"
          open={inventory || undefined}
        >
          <summary className="cursor-pointer text-sm font-medium">
            إضافة فستان أو تصنيف
          </summary>
          <div className="mt-6 grid items-start gap-8 xl:grid-cols-[2fr_1fr]">
            <section>
              <h2 className="mb-6 text-lg">إضافة فستان</h2>
              <DressForm categories={categories.data ?? []} />
            </section>
            <section className="xl:border-r xl:pr-8">
              <h2 className="mb-6 text-lg">إضافة تصنيف</h2>
              <CategoryForm />
            </section>
          </div>
        </details>
      )}
    </StaffFrame>
  );
}
