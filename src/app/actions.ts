"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { configured, supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth";
export type ActionState = { error?: string; success?: string };
export async function signIn(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!configured())
    return {
      error: "لم يتم ربط Supabase بعد. استخدم استعراض النظام لتجربة الواجهة.",
    };
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(256) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "راجع البريد الإلكتروني وكلمة المرور." };
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error)
    return { error: "تعذر تسجيل الدخول. راجع البيانات أو حاول لاحقًا." };
  redirect("/workspace");
}
export async function signOut() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect("/login");
}
export async function createDress(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "غير مسموح" };
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      code: z
        .string()
        .trim()
        .min(1)
        .max(40)
        .regex(/^[a-zA-Z0-9_-]+$/),
      color: z.string().trim().min(1).max(60),
      size: z.string().trim().min(1).max(30),
      category_id: z.uuid(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "راجع الحقول. الكود حروف إنجليزية وأرقام وشرطات فقط." };
  const { error } = await db
    .from("dresses")
    .insert({ ...parsed.data, public_availability: "unavailable" });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "الكود مستخدم بالفعل"
          : "تعذر إضافة الفستان. راجع التصنيف والصلاحيات.",
    };
  revalidatePath("/workspace");
  revalidatePath("/");
  return {
    success: "تمت إضافة الفستان بحالة غير متاح لحين استكمال صوره وبياناته.",
  };
}
export async function createCategory(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "غير مسموح" };
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) return { error: "أدخل اسم تصنيف صحيحًا." };
  const { error } = await db.from("categories").insert({ name: name.data });
  if (error) return { error: "تعذر الإضافة، قد يكون الاسم مكررًا." };
  revalidatePath("/workspace");
  return { success: "تمت إضافة التصنيف" };
}

export async function editDress(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "غير مسموح" };
  const parsed = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      name: z.string().trim().min(1).max(120),
      code: z
        .string()
        .trim()
        .min(1)
        .max(40)
        .regex(/^[a-zA-Z0-9_-]+$/),
      color: z.string().trim().min(1).max(60),
      size: z.string().trim().min(1).max(30),
      category_id: z.uuid(),
      public_availability: z.enum(["available", "reserved", "unavailable"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "راجع بيانات الفستان والكود والتصنيف." };
  const { id, version, ...values } = parsed.data;
  const { data, error } = await db
    .from("dresses")
    .update(values)
    .eq("id", id)
    .eq("version", version)
    .select("id");
  if (error)
    return {
      error:
        error.code === "23505"
          ? "كود الفستان مستخدم بالفعل."
          : "تعذر حفظ التعديلات.",
    };
  if (!data?.length)
    return {
      error:
        "البيانات تغيّرت منذ فتح الصفحة، أو لم يعد الفستان موجودًا. حدّث الصفحة وراجع أحدث نسخة قبل الحفظ.",
    };
  revalidatePath("/");
  revalidatePath("/workspace");
  revalidatePath(`/workspace/dresses/${id}`);
  revalidatePath(`/dresses/${id}`);
  return { success: "تم حفظ بيانات الفستان." };
}
export async function archiveDress(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "غير مسموح" };
  if (form.get("confirm") !== "on")
    return { error: "أكّد أنك راجعت أثر الأرشفة أولًا." };
  const parsed = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      archive: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "بيانات غير صحيحة." };
  const { id, version, archive } = parsed.data;
  const { data, error } = await db
    .from("dresses")
    .update({ archived: archive === "true" })
    .eq("id", id)
    .eq("version", version)
    .select("id");
  if (error) return { error: "تعذر تغيير حالة الأرشفة." };
  if (!data?.length)
    return { error: "توجد نسخة أحدث من البيانات. حدّث الصفحة قبل المتابعة." };
  revalidatePath("/");
  revalidatePath("/workspace");
  revalidatePath(`/workspace/dresses/${id}`);
  revalidatePath(`/dresses/${id}`);
  return {
    success:
      archive === "true"
        ? "تمت الأرشفة دون حذف أي حجز أو دفعة."
        : "تمت إعادة الفستان من الأرشيف.",
  };
}
export async function uploadDressImage(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "غير مسموح" };
  const id = z.uuid().safeParse(form.get("id"));
  const file = form.get("image");
  if (!id.success || !(file instanceof File))
    return { error: "اختر فستانًا وصورة صالحة." };
  const { data: dress, error: dressError } = await db
    .from("dresses")
    .select("id")
    .eq("id", id.data)
    .single();
  if (dressError || !dress) return { error: "الفستان غير موجود أو غير مسموح." };
  const { MAX_IMAGE_BYTES, prepareDressImage } =
    await import("@/lib/image-processing");
  if (file.size > MAX_IMAGE_BYTES || file.size === 0)
    return {
      error: "حجم الصورة يجب أن يكون أكبر من صفر وبحد أقصى ٥ ميجابايت.",
    };
  let bytes: Buffer;
  try {
    bytes = await prepareDressImage(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
  } catch {
    return {
      error:
        "تعذر قراءة الصورة. استخدم صورة ثابتة JPEG أو PNG أو WebP، بحد أقصى ٥ ميجابايت و٤٠ مليون بكسل.",
    };
  }
  const path = `${id.data}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await db.storage
    .from("dress-images")
    .upload(path, bytes, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "3600",
    });
  if (uploadError)
    return {
      error:
        "تعذر رفع الصورة. راجع اتصال الشبكة وصلاحيات Storage ثم أعد المحاولة.",
    };
  const { data: last } = await db
    .from("dress_images")
    .select("sort_order")
    .eq("dress_id", id.data)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error: rowError } = await db.from("dress_images").insert({
    dress_id: id.data,
    path,
    sort_order: (last?.[0]?.sort_order ?? -1) + 1,
  });
  if (rowError) {
    let cleanup = await db.storage.from("dress-images").remove([path]);
    if (cleanup.error)
      cleanup = await db.storage.from("dress-images").remove([path]);
    return {
      error: cleanup.error
        ? `فشل ربط الصورة وتعذر حذف الملف المرفوع بعد محاولتين. على مسؤول Storage إزالة الملف غير المرتبط: ${path}`
        : "تعذر ربط الصورة بالفستان، وتم التراجع عن الرفع. أعد المحاولة.",
    };
  }
  revalidatePath("/");
  revalidatePath(`/workspace/dresses/${id.data}`);
  revalidatePath(`/dresses/${id.data}`);
  return { success: "تم رفع الصورة بعد ضغطها وإزالة بياناتها الوصفية." };
}
