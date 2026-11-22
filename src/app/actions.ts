"use server";
import { prototypeEnabled } from "@/lib/prototype";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { configured, supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth";
export type ActionState = {
  error?: string;
  success?: string;
  nextRequestId?: string;
};
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
  revalidatePath("/workspace/categories");
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

export async function createRealBooking(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db } = await requireStaff();
  if (prototypeEnabled())
    return {
      error: "هذه نسخة اختبار فقط. تسجيل الحجوزات والدفعات الفعلية معطل.",
    };
  const parsed = z
    .object({
      request_id: z.uuid(),
      dress_id: z.uuid(),
      customer: z.string().trim().min(1).max(120),
      phone: z
        .string()
        .trim()
        .min(5)
        .max(24)
        .regex(/^[+0-9 ()-]+$/)
        .refine((v) => v.replace(/\D/g, "").length >= 5),
      starts_on: z.string(),
      returns_on: z.string(),
      method: z.string().trim().max(40).default(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "راجع الاسم والهاتف والفستان وباقي الحقول." };
  const { validDay, toPiasters, formatDay } = await import("@/lib/domain");
  if (
    !validDay(parsed.data.starts_on) ||
    !validDay(parsed.data.returns_on) ||
    parsed.data.returns_on < parsed.data.starts_on
  )
    return { error: "راجع تاريخ الخروج والعودة." };
  let total: number, deposit: number;
  try {
    total = toPiasters(String(form.get("total")));
    deposit = toPiasters(String(form.get("deposit")));
  } catch {
    return { error: "اكتب مبالغ صحيحة بحد أقصى خانتين عشريتين." };
  }
  if (total <= 0 || deposit > total)
    return { error: "السعر أكبر من صفر، والمقدم لا يتجاوز السعر." };
  if (deposit > 0 && form.get("deposit_confirm") !== "on")
    return { error: "أكّد استلام المقدم فعليًا قبل تسجيله." };
  const d = parsed.data;
  const { data, error } = await db.rpc("create_booking", {
    p_request_id: d.request_id,
    p_dress_id: d.dress_id,
    p_customer_name: d.customer,
    p_phone: d.phone,
    p_start: d.starts_on,
    p_return: d.returns_on,
    p_total: total,
    p_deposit: deposit,
    p_method: deposit > 0 ? d.method || null : null,
  });
  if (error) {
    if (error.code === "23P01" || error.message.includes("no_dress_overlap")) {
      const duration = Math.round(
        (Date.parse(d.returns_on) - Date.parse(d.starts_on)) / 86400000,
      );
      const next = await db.rpc("next_available_day", {
        p_dress_id: d.dress_id,
        p_start: d.starts_on,
        p_duration: duration,
      });
      return {
        error:
          typeof next.data === "string" && !next.error
            ? `التاريخ متعارض مع حجز أو فترة التجهيز. أول بداية مقترحة: ${formatDay(next.data)}. الاقتراح ليس تأكيد حجز.`
            : "التاريخ متعارض مع حجز أو فترة التجهيز. راجع موعدًا آخر.",
      };
    }
    if (error.message.includes("request_id_payload_mismatch"))
      return {
        error:
          "هذا الطلب حُفظ من قبل بقيم مختلفة. راجع سجل الحجز قبل إنشاء طلب جديد.",
      };
    if (error.message.includes("policy_decisions_pending"))
      return {
        error: "الحجوزات الفعلية متوقفة لحين اعتماد الإعدادات والسياسات.",
      };
    if (
      error.message.includes("same_day") ||
      error.message.includes("invalid_dates")
    )
      return {
        error:
          "التاريخ غير مسموح وفق إعدادات اليوم الحالي والحجز في نفس اليوم.",
      };
    if (error.message.includes("payment_method"))
      return { error: "وصف الطريقة الاختياري لا يتجاوز ٤٠ حرفًا." };
    if (error.message.includes("operationally"))
      return { error: "الفستان غير متاح تشغيليًا. راجع حالته مع الأدمن." };
    return {
      error:
        "تعذر تأكيد الحفظ. لا تنشئ طلبًا جديدًا فورًا؛ أعد نفس المحاولة للتأكد دون تكرار بفضل معرف الطلب.",
    };
  }
  const id = z.uuid().safeParse(data);
  if (!id.success)
    return {
      error:
        "تعذر التحقق من نتيجة الحفظ. راجع قائمة الحجوزات قبل أي محاولة جديدة.",
    };
  revalidatePath("/workspace");
  revalidatePath("/workspace/bookings");
  revalidatePath("/workspace/customers");
  redirect(`/workspace/bookings/${id.data}`);
}
export async function recordRealPayment(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db } = await requireStaff();
  if (prototypeEnabled())
    return {
      error: "هذه نسخة اختبار فقط. تسجيل الحجوزات والدفعات الفعلية معطل.",
    };
  const parsed = z
    .object({
      request_id: z.uuid(),
      booking_id: z.uuid(),
      method: z.string().trim().max(40).default(""),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "أكّد استلام المبلغ فعليًا، ووصف الطريقة اختياري حتى ٤٠ حرفًا.",
    };
  const { toPiasters } = await import("@/lib/domain");
  let amount: number;
  try {
    amount = toPiasters(String(form.get("amount")));
  } catch {
    return { error: "أدخل مبلغًا صحيحًا بحد أقصى خانتين عشريتين." };
  }
  if (amount <= 0) return { error: "المبلغ يجب أن يكون أكبر من صفر." };
  const d = parsed.data;
  const { error } = await db.rpc("record_payment", {
    p_request_id: d.request_id,
    p_booking_id: d.booking_id,
    p_amount: amount,
    p_method: d.method || null,
  });
  if (error) {
    if (
      error.message.includes("overpayment") ||
      error.message.includes("invalid_amount")
    )
      return {
        error: "المبلغ يتجاوز المستحق أو غير صحيح. راجع أحدث رصيد قبل التسجيل.",
      };
    if (error.message.includes("request_id_payload_mismatch"))
      return {
        error:
          "هذا الطلب حُفظ من قبل بقيم مختلفة. راجع سجل الحجز قبل إنشاء طلب جديد.",
      };
    if (error.message.includes("policy_decisions_pending"))
      return { error: "التسجيل الفعلي لم يُفعّل بعد اكتمال اختبارات الربط." };
    if (error.code === "42501")
      return { error: "غير مسموح بتسجيل دفعة لهذا الحجز." };
    return {
      error:
        "لم نتمكن من تأكيد النتيجة. أعد نفس المحاولة بمعرف الطلب الحالي، ولا تضف دفعة أخرى قبل مراجعة السجل.",
    };
  }
  revalidatePath(`/workspace/bookings/${d.booking_id}`);
  revalidatePath("/workspace");
  return {
    success: "تم تسجيل الدفعة المستلمة في السجل، دون تحصيل إلكتروني.",
    nextRequestId: crypto.randomUUID(),
  };
}

export async function markNotificationRead(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "هذا الإجراء للأدمن فقط." };
  const { validDay } = await import("@/lib/domain");
  const parsed = z
    .object({
      booking_id: z.uuid(),
      kind: z.enum(["outgoing", "incoming", "overdue", "collision"]),
      event_on: z.string().refine(validDay),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "بيانات التنبيه غير صحيحة. أعد تحميل الصفحة." };
  const d = parsed.data;
  const { error } = await db.rpc("mark_notification_read", {
    p_booking_id: d.booking_id,
    p_kind: d.kind,
    p_event_on: d.event_on,
  });
  if (error)
    return {
      error: error.message.includes("notification_not_active")
        ? "التنبيه لم يعد نشطًا؛ حدّث الصفحة لمراجعة الحالة."
        : "تعذر تأكيد القراءة. أعد نفس المحاولة؛ تكرارها لا ينشئ سجلًا مكررًا.",
    };
  for (const path of [
    "/workspace/notifications",
    "/workspace/notifications/outgoing",
    "/workspace/notifications/incoming",
    "/workspace/notifications/overdue",
    "/workspace/notifications/collision",
  ])
    revalidatePath(path);
  return { success: "تم التعليم كمقروء. يظل التنبيه ظاهرًا حتى معالجة سببه." };
}

export async function addManualLateFee(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "إضافة الغرامة للأدمن فقط." };
  if (prototypeEnabled())
    return { error: "الإضافة المالية معطلة في نسخة الاختبار." };
  const parsed = z
    .object({
      request_id: z.uuid(),
      booking_id: z.uuid(),
      reason: z.string().trim().min(1).max(500),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "راجع سبب الغرامة وتأكيد إضافتها." };
  const { toPiasters } = await import("@/lib/domain");
  let amount: number;
  try {
    amount = toPiasters(String(form.get("amount")));
  } catch {
    return { error: "اكتب مبلغًا موجبًا بحد أقصى خانتين عشريتين." };
  }
  if (amount <= 0)
    return {
      error: "مبلغ الغرامة أكبر من صفر؛ لا تُضف غرامة إن لم تكن مطلوبة.",
    };
  const d = parsed.data;
  const { error } = await db.rpc("add_late_fee", {
    p_request_id: d.request_id,
    p_booking_id: d.booking_id,
    p_amount: amount,
    p_reason: d.reason,
  });
  if (error)
    return {
      error: error.message.includes("request_id_payload_mismatch")
        ? "نفس الطلب مسجل بقيم مختلفة. راجع سجل الحجز قبل إضافة أي مبلغ آخر."
        : error.message.includes("currently_overdue")
          ? "الحجز لم يعد مسجلًا كمتأخر خارج الأتيليه. حدّث الحالة أولًا."
          : "تعذر تأكيد الغرامة. راجع السجل وأعد نفس المحاولة، ولا تضف مبلغًا ثانيًا قبل التحقق.",
    };
  for (const path of [
    "/workspace/notifications",
    "/workspace/notifications/overdue",
    "/workspace/dashboard",
    `/workspace/bookings/${d.booking_id}`,
  ])
    revalidatePath(path);
  return {
    success:
      "أضيفت الغرامة الاختيارية إلى المستحق فقط. لم تُسجّل كدفعة ولم يُحصّل مال إلكترونيًا.",
  };
}

export async function manageCategory(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "إدارة التصنيفات للأدمن فقط." };
  const parsed = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      intent: z.enum(["rename", "delete"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "تعذر التحقق من التصنيف. حدّث الصفحة ثم أعد المحاولة." };
  const deleting = parsed.data.intent === "delete";
  if (deleting && form.get("confirm_delete") !== "on")
    return { error: "أكد حذف التصنيف غير المستخدم أولًا." };
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!deleting && !name.success)
    return { error: "اكتب اسم تصنيف من حرف إلى ٨٠ حرفًا." };
  const { error } = await db.rpc("manage_category", {
    p_id: parsed.data.id,
    p_version: parsed.data.version,
    p_name: deleting ? null : name.data,
    p_delete: deleting,
  });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "يوجد تصنيف آخر بنفس الاسم."
          : error.message.includes("category_in_use")
            ? "لا يمكن حذف التصنيف؛ توجد فساتين مرتبطة به، بما فيها المؤرشفة."
            : /category_stale|category_not_found/.test(error.message)
              ? "تغير التصنيف أو حُذف بعد فتح الصفحة. أعد تحميلها قبل التعديل."
              : "تعذر تأكيد النتيجة. راجع التصنيف والسجل ثم أعد المحاولة.",
    };
  for (const path of ["/", "/workspace", "/workspace/categories"])
    revalidatePath(path);
  revalidatePath("/dresses/[id]", "page");
  revalidatePath("/workspace/dresses/[id]", "page");
  return {
    success: deleting
      ? "حُذف التصنيف غير المستخدم دون حذف فساتين أو حجوزات."
      : "حُفظ اسم التصنيف، وسُجل التغيير في سجل النشاط.",
  };
}

function refreshWorkflow(bookingId: string) {
  for (const path of [
    "/workspace",
    "/workspace/bookings",
    `/workspace/bookings/${bookingId}`,
    "/workspace/operations",
    "/workspace/dashboard",
    "/workspace/notifications",
    "/workspace/notifications/incoming",
    "/workspace/notifications/outgoing",
    "/workspace/notifications/overdue",
    "/workspace/notifications/collision",
  ])
    revalidatePath(path);
}
function workflowError(message: string) {
  if (message.includes("outstanding_balance_before_return"))
    return "لا يمكن إتمام العودة قبل سداد المتبقي كله، شامل أي غرامة مسجلة. سجل الدفعة المستلمة أولًا ثم أعد المحاولة.";
  if (message.includes("deposit_required"))
    return "سجّل المقدم المستلم أولًا. لا يشترط سداد باقي الحجز عند التسليم.";
  if (message.includes("outside_planned_handover_days"))
    return "التسليم متاح داخل أيام الحجز المخططة فقط. لا تغير التاريخ تلقائيًا؛ راجع الحجز مع الأدمن.";
  if (message.includes("invalid_inspection"))
    return "اختر سليم دون أعطال، أو يحتاج صيانة مع نوع واحد على الأقل من القائمة.";
  if (message.includes("preparation_day_not_finished"))
    return "يوم التجهيز الكامل بعد يوم الاستلام المسجل لم ينته بعد.";
  if (message.includes("return_workflow_required"))
    return "ما زال هناك حجز مسجل خارج الأتيليه. راجع تسجيل العودة أولًا.";
  if (/request_id_payload_mismatch|request_id_conflict/.test(message))
    return "معرف المحاولة مسجل ببيانات مختلفة. راجع سجل الحجز قبل أي محاولة جديدة.";
  if (/booking_not_confirmed|booking_not_out/.test(message))
    return "تغيرت حالة الحجز. حدّث الصفحة وراجع العملية المسجلة قبل إعادة المحاولة.";
  return "تعذر تأكيد العملية. راجع سجل الحجز ثم أعد نفس المحاولة دون تغيير القيم. لم يتم تأكيد نجاحها.";
}
async function workflowDayValid(form: FormData) {
  const { dateInZone } = await import("@/lib/domain");
  return form.get("expected_day") === dateInZone(new Date(), "Africa/Cairo");
}
export async function recordBookingHandover(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db } = await requireStaff();
  if (prototypeEnabled()) return { error: "التسليم معطل في نسخة الاختبار." };
  if (!(await workflowDayValid(form)))
    return {
      error: "تغير اليوم في مصر منذ فتح الشاشة. حدّث الصفحة قبل التسجيل.",
    };
  const parsed = z
    .object({
      request_id: z.uuid(),
      booking_id: z.uuid(),
      card_received: z.literal("on"),
      ready: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error:
        "أكد استلام الضمان وفحص جاهزية الفستان أولًا، دون رقم أو صورة بطاقة.",
    };
  const { error } = await db.rpc("record_handover", {
    p_request_id: parsed.data.request_id,
    p_booking_id: parsed.data.booking_id,
    p_card_received: true,
    p_ready: true,
  });
  if (error) return { error: workflowError(error.message) };
  refreshWorkflow(parsed.data.booking_id);
  return {
    success:
      "سُجل خروج الفستان واستلام الضمان كحالة فقط. يبقى المتبقي مستحقًا عند العودة.",
  };
}
export async function recordBookingReturn(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db } = await requireStaff();
  if (prototypeEnabled())
    return { error: "تسجيل العودة معطل في نسخة الاختبار." };
  if (!(await workflowDayValid(form)))
    return {
      error: "تغير اليوم في مصر منذ فتح الشاشة. حدّث الصفحة قبل التسجيل.",
    };
  const { inspectionIssues } = await import("@/lib/workflow");
  const parsed = z
    .object({
      request_id: z.uuid(),
      booking_id: z.uuid(),
      card_released: z.literal("on"),
      inspection: z.enum(["sound", "maintenance"]),
      issues: z.array(z.enum(inspectionIssues)).max(4),
    })
    .safeParse({ ...Object.fromEntries(form), issues: form.getAll("issues") });
  if (!parsed.success)
    return {
      error:
        "راجع الفحص وتأكيد استلام الفستان اليوم ورد الضمان. لا توجد صور أو بيانات هوية مطلوبة.",
    };
  const d = parsed.data;
  if (
    (d.inspection === "sound" && d.issues.length > 0) ||
    (d.inspection === "maintenance" && d.issues.length === 0)
  )
    return {
      error:
        "السليم دون أعطال؛ عند الصيانة اختر نوعًا واحدًا على الأقل ويمكن اختيار أكثر من نوع.",
    };
  const { error } = await db.rpc("record_return", {
    p_request_id: d.request_id,
    p_booking_id: d.booking_id,
    p_card_released: true,
    p_inspection: d.inspection,
    p_issues: d.issues,
  });
  if (error) return { error: workflowError(error.message) };
  refreshWorkflow(d.booking_id);
  return {
    success:
      "سُجلت العودة والفحص ورد الضمان بعد التحقق من سداد الرصيد كله. راجع حالة الفستان ويوم التجهيز.",
  };
}
export async function confirmDressReady(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db } = await requireStaff();
  if (prototypeEnabled())
    return { error: "تغيير حالة الجاهزية معطل في نسخة الاختبار." };
  const parsed = z
    .object({
      booking_id: z.uuid(),
      dress_id: z.uuid(),
      ready: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "أكد اكتمال التجهيز وأي صيانة قبل تغيير الحالة." };
  const { data: b, error: readError } = await db
    .from("bookings")
    .select("dress_id")
    .eq("id", parsed.data.booking_id)
    .maybeSingle();
  if (readError || b?.dress_id !== parsed.data.dress_id)
    return { error: "تعذر التحقق من الحجز والفستان ضمن صلاحياتك." };
  const { error } = await db.rpc("set_dress_operation", {
    p_dress_id: parsed.data.dress_id,
    p_status: "in_atelier",
  });
  if (error) return { error: workflowError(error.message) };
  refreshWorkflow(parsed.data.booking_id);
  return {
    success:
      "سُجل الفستان جاهزًا داخل الأتيليه. لم يتغير أي حجز أو موعد تلقائيًا.",
  };
}

export async function reorderDressImages(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "غير مسموح" };
  const parsed = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      images: z.array(z.uuid()).max(1000),
    })
    .safeParse({
      id: form.get("id"),
      version: form.get("version"),
      images: form.getAll("image_ids"),
    });
  if (!parsed.success)
    return {
      error:
        "قائمة صور غير صحيحة؛ الحد التقني ١٠٠٠ صورة. حدّث الصفحة ثم أعد المحاولة.",
    };
  const { error } = await db.rpc("reorder_dress_images", {
    p_dress_id: parsed.data.id,
    p_expected_version: parsed.data.version,
    p_image_ids: parsed.data.images,
  });
  if (error)
    return {
      error:
        error.message.includes("stale_dress_version") ||
        error.message.includes("image_set_changed_refresh")
          ? "تغيرت الصور أو نسخة البيانات. حدّث الصفحة وراجع الترتيب قبل الحفظ."
          : "تعذر تأكيد الترتيب. حدّث الصفحة للتحقق؛ لم نُجر أي إعادة ترتيب بديلة.",
    };
  revalidatePath("/");
  revalidatePath("/workspace");
  revalidatePath(`/workspace/dresses/${parsed.data.id}`);
  revalidatePath(`/dresses/${parsed.data.id}`);
  return { success: "تم حفظ ترتيب الصور؛ الأولى هي الرئيسية في الكتالوج." };
}

async function runImageCleanup(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  job: { id: string; path: string; dress_id: string; status: string },
): Promise<ActionState> {
  const safeJob = z
    .object({
      id: z.uuid(),
      dress_id: z.uuid(),
      path: z
        .string()
        .min(1)
        .refine(
          (path) =>
            !path.startsWith("/") &&
            !path
              .split("/")
              .some((part) => part === "" || part === "." || part === "..") &&
            !/[\x00-\x1f]/.test(path),
        ),
      status: z.enum(["pending", "completed"]),
    })
    .safeParse(job);
  if (!safeJob.success)
    return { error: "مسار تنظيف غير صالح أو غير متحقق منه؛ لم نمسح أي ملف." };
  const refresh = () => {
    revalidatePath("/");
    revalidatePath("/workspace");
    revalidatePath(`/workspace/dresses/${job.dress_id}`);
    revalidatePath(`/dresses/${job.dress_id}`);
  };
  if (job.status === "completed") {
    refresh();
    return { success: "حذف هذه الصورة وملفها مؤكد بالفعل." };
  }
  const { finishImageCleanup } = await import("@/lib/image-cleanup");
  const status = await finishImageCleanup({
    remove: async () => {
      const { error } = await db.storage
        .from("dress-images")
        .remove([job.path]);
      if (error) throw error;
    },
    exists: async () => {
      const result = await db.storage.from("dress-images").exists(job.path);
      return result.data;
    },
    complete: async () => {
      const { error } = await db.rpc("complete_dress_image_delete", {
        p_job_id: job.id,
      });
      if (error) throw error;
    },
  });
  refresh();
  return status === "completed"
    ? {
        success:
          "أُزيلت الصورة من الكتالوج وتأكد مسح ملفها. قد تبقى نسخة مخبأة لدى رابط قديم مؤقتًا.",
      }
    : {
        error:
          "أُزيلت الصورة من الكتالوج، لكن مسح ملفها لم يُؤكد. طلب التنظيف محفوظ وسيظهر هنا للأدمن لإعادة المحاولة، ولم يُدّعَ اكتمال مسح الملف.",
      };
}
export async function deleteDressImage(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "غير مسموح" };
  const p = z
    .object({
      id: z.uuid(),
      image_id: z.uuid(),
      request_id: z.uuid(),
      version: z.coerce.number().int().positive(),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "اختر الصورة وأكد حذفها صراحة." };
  const { data, error } = await db.rpc("queue_dress_image_delete", {
    p_request_id: p.data.request_id,
    p_dress_id: p.data.id,
    p_image_id: p.data.image_id,
    p_expected_version: p.data.version,
    p_confirm: true,
  });
  if (error) {
    const prior = await db
      .from("image_deletion_jobs")
      .select("id,dress_id,image_id,recorded_by,path,status")
      .eq("request_id", p.data.request_id)
      .maybeSingle();
    if (
      !prior.error &&
      prior.data &&
      prior.data.dress_id === p.data.id &&
      prior.data.image_id === p.data.image_id &&
      prior.data.recorded_by === profile.id
    )
      return runImageCleanup(db, prior.data);
    revalidatePath("/workspace");
    revalidatePath(`/workspace/dresses/${p.data.id}`);
    return {
      error:
        error.message.includes("stale_dress_version") ||
        error.message.includes("image_missing_refresh")
          ? "تغيرت الصور أو البيانات. حدّث الصفحة وراجع الصورة قبل تأكيد جديد."
          : "تعذر تأكيد إزالة الصورة. حدّث الصفحة للتحقق من الصور وطلبات التنظيف قبل إعادة المحاولة؛ لم نُنشئ طلب حذف بديلًا.",
    };
  }
  const parsed = z
    .object({
      id: z.uuid(),
      dress_id: z.uuid(),
      path: z.string().min(1),
      status: z.enum(["pending", "completed"]),
    })
    .safeParse(data);
  if (!parsed.success)
    return {
      error:
        "تعذر التحقق من نتيجة الإزالة. حدّث الصفحة وتحقق من قائمة التنظيف؛ لن نمسح مسارًا غير متحقق منه.",
    };
  return runImageCleanup(db, parsed.data);
}
export async function retryImageCleanup(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "غير مسموح" };
  const id = z.uuid().safeParse(form.get("job_id"));
  if (!id.success) return { error: "طلب تنظيف غير صحيح." };
  const { data, error } = await db
    .from("image_deletion_jobs")
    .select("id,dress_id,path,status")
    .eq("id", id.data)
    .maybeSingle();
  if (error || !data)
    return {
      error: "تعذر التحقق من طلب التنظيف أو الصلاحيات. لم نمسح أي ملف.",
    };
  return runImageCleanup(db, data);
}
