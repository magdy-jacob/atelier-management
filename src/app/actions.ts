"use server";
import {
  bookingMutationsAllowed,
  getBookingConfig,
  bookingConfigReady,
} from "@/lib/booking-config";
import { validBookingPhone, validSyntheticName } from "@/lib/booking-identity";
import { imageAttachmentConfirmed } from "@/lib/image-attachment";
import { functionalPortfolioEnabled } from "@/lib/portfolio-mode";
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
      error: "خدمة تسجيل الدخول غير مهيأة حاليًا. راجع إعدادات الاتصال.",
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

async function prepareAndUploadDressImages(
  db: Awaited<ReturnType<typeof requireStaff>>["db"],
  dressId: string,
  files: File[],
): Promise<{ successCount: number; error?: string }> {
  if (files.length === 0) return { successCount: 0 };
  const { MAX_IMAGE_BYTES, prepareDressImage } =
    await import("@/lib/image-processing");

  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES || file.size === 0) {
      return {
        successCount: 0,
        error: `حجم الصورة "${file.name}" غير صالح (يجب أن يكون أكبر من صفر وبحد أقصى ٥ ميجابايت).`,
      };
    }
  }

  const prepared: { name: string; bytes: Buffer }[] = [];
  for (const file of files) {
    try {
      const bytes = await prepareDressImage(
        Buffer.from(await file.arrayBuffer()),
        file.type,
      );
      prepared.push({ name: file.name, bytes });
    } catch {
      return {
        successCount: 0,
        error: `تعذر قراءة الصورة "${file.name}". استخدم صورة ثابتة JPEG أو PNG أو WebP، بحد أقصى ٥ ميجابايت و٤٠ مليون بكسل.`,
      };
    }
  }

  const { data: last } = await db
    .from("dress_images")
    .select("sort_order")
    .eq("dress_id", dressId)
    .order("sort_order", { ascending: false })
    .limit(1);
  let nextSortOrder = (last?.[0]?.sort_order ?? -1) + 1;

  let successCount = 0;
  for (const item of prepared) {
    const path = `${dressId}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await db.storage
      .from("dress-images")
      .upload(path, item.bytes, {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "3600",
      });
    if (uploadError) {
      return {
        successCount,
        error: `تعذر رفع الصورة "${item.name}". ${successCount > 0 ? `تم رفع ${successCount} صور حتى الآن.` : ""} راجع اتصال الشبكة وصلاحيات التخزين.`,
      };
    }
    const { error: rowError } = await db.from("dress_images").insert({
      dress_id: dressId,
      path,
      sort_order: nextSortOrder++,
    });
    const confirmed = await imageAttachmentConfirmed(!!rowError, async () => {
      const recovered = await db
        .from("dress_images")
        .select("id")
        .eq("dress_id", dressId)
        .eq("path", path)
        .maybeSingle();
      return !recovered.error && !!recovered.data;
    });
    if (!confirmed) {
      return {
        successCount,
        error: `تعذر تأكيد ربط الصورة "${item.name}". مسار المتابعة للأدمن: ${path}`,
      };
    }
    successCount++;
  }

  return { successCount };
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
        .regex(/^[a-zA-Z0-9_\/-]+$/),
      color: z.string().trim().min(1).max(60),
      size: z.string().trim().min(1).max(30),
      category_id: z.uuid(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "راجع الحقول. الكود حروف إنجليزية وأرقام وشرطات فقط." };

  // Parse optional price range
  const minRaw = form.get("minimum")?.toString().trim();
  const maxRaw = form.get("maximum")?.toString().trim();
  let priceRange: { min: number; max: number } | null = null;
  if (minRaw || maxRaw) {
    if (!minRaw || !maxRaw) {
      return {
        error: "يرجى إدخال كل من الحد الأدنى والحد الأقصى لنطاق السعر معًا.",
      };
    }
    const { toPiasters } = await import("@/lib/domain");
    let min: number, max: number;
    try {
      min = toPiasters(minRaw);
      max = toPiasters(maxRaw);
    } catch {
      return { error: "اكتب نطاق أسعار صحيحًا بالأرقام." };
    }
    if (min < 0 || max < min) {
      return { error: "الحد الأقصى للسعر يجب ألا يقل عن الحد الأدنى." };
    }
    priceRange = { min, max };
  }

  // Parse optional images
  const rawFiles = form.getAll("images").concat(form.getAll("image"));
  const files = rawFiles.filter(
    (f): f is File => f instanceof File && f.size > 0 && f.name !== "",
  );

  if (files.length > 0) {
    const { MAX_IMAGE_BYTES, prepareDressImage } =
      await import("@/lib/image-processing");
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES || file.size === 0) {
        return {
          error: `حجم الصورة "${file.name}" غير صالح (الحد الأقصى ٥ ميجابايت).`,
        };
      }
      try {
        await prepareDressImage(
          Buffer.from(await file.arrayBuffer()),
          file.type,
        );
      } catch {
        return {
          error: `تعذر قراءة الصورة "${file.name}". استخدم صورة ثابتة JPEG أو PNG أو WebP، بحد أقصى ٥ ميجابايت.`,
        };
      }
    }
  }

  const { data: insertedDress, error } = await db
    .from("dresses")
    .insert({ ...parsed.data, public_availability: "unavailable" })
    .select("id")
    .single();
  if (error || !insertedDress)
    return {
      error:
        error?.code === "23505"
          ? "الكود مستخدم بالفعل"
          : "تعذر إضافة الفستان. راجع التصنيف والصلاحيات.",
    };

  const dressId = insertedDress.id;

  if (priceRange) {
    const { error: priceError } = await db.rpc("set_dress_price_range", {
      p_dress_id: dressId,
      p_expected_version: 0,
      p_min: priceRange.min,
      p_max: priceRange.max,
    });
    if (priceError) {
      console.error("Failed to set dress price range:", priceError);
    }
  }

  let uploadedCount = 0;
  if (files.length > 0) {
    const uploadResult = await prepareAndUploadDressImages(db, dressId, files);
    uploadedCount = uploadResult.successCount;
    if (uploadResult.error) {
      revalidatePath("/workspace");
      revalidatePath("/");
      revalidatePath(`/workspace/dresses/${dressId}`);
      return {
        error: `تم إنشاء الفستان لكن حدث خطأ أثناء رفع بعض الصور: ${uploadResult.error}`,
      };
    }
  }

  revalidatePath("/workspace");
  revalidatePath("/");
  revalidatePath(`/workspace/dresses/${dressId}`);

  const details: string[] = [];
  if (uploadedCount > 0) {
    details.push(uploadedCount === 1 ? "الصورة" : `${uploadedCount} صور`);
  }
  if (priceRange) {
    details.push("نطاق السعر");
  }

  return {
    success:
      details.length > 0
        ? `تمت إضافة الفستان مع ${details.join(" و ")} بنجاح.`
        : "تمت إضافة الفستان بحالة غير متاح لحين استكمال صوره وبياناته.",
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
        .regex(/^[a-zA-Z0-9_\/-]+$/),
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
  if (!id.success) return { error: "معرف الفستان غير صالح." };

  const rawFiles = form.getAll("images").concat(form.getAll("image"));
  const files = rawFiles.filter(
    (f): f is File => f instanceof File && f.size > 0 && f.name !== "",
  );
  if (files.length === 0)
    return { error: "اختر صورة واحدة على الأقل صالحة للرفع." };

  const { data: dress, error: dressError } = await db
    .from("dresses")
    .select("id")
    .eq("id", id.data)
    .single();
  if (dressError || !dress) return { error: "الفستان غير موجود أو غير مسموح." };

  const { successCount, error } = await prepareAndUploadDressImages(
    db,
    id.data,
    files,
  );
  if (error) return { error };

  revalidatePath("/");
  revalidatePath("/workspace");
  revalidatePath(`/workspace/dresses/${id.data}`);
  revalidatePath(`/dresses/${id.data}`);

  return {
    success:
      successCount === 1
        ? "تم رفع الصورة بعد ضغطها وإزالة بياناتها الوصفية."
        : `تم رفع ${successCount} صور بنجاح بعد ضغطها وإزالة بياناتها الوصفية.`,
  };
}
export const uploadDressImages = uploadDressImage;

export async function createRealBooking(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db } = await requireStaff();
  const config = await getBookingConfig(db);
  if (!bookingConfigReady(config))
    return {
      error:
        "إعداد الحفظ الوظيفي غير مكتمل أو تعذر التحقق منه. لم تُسجل العملية.",
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
        .refine(
          (v) =>
            validBookingPhone(v, false) ||
            validBookingPhone(v, true),
        ),
      starts_on: z.string(),
      returns_on: z.string(),
      method: z.string().trim().max(40).default(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error:
        "راجع الاسم ورقم الهاتف وتاريخ الحجز وباقي الحقول وتأكد من كتابتها بشكل صحيح.",
    };
  const { validDay, toPiasters, formatDay, dateInZone } = await import("@/lib/domain");
  if (
    !validDay(parsed.data.starts_on) ||
    !validDay(parsed.data.returns_on) ||
    parsed.data.returns_on < parsed.data.starts_on
  )
    return { error: "راجع تاريخ الخروج والعودة." };

  const tz = config?.business_timezone || "Africa/Cairo";
  const todayInCairo = dateInZone(new Date(), tz);
  if (parsed.data.starts_on <= todayInCairo) {
    return {
      error: "لا يمكن حجز فستان في نفس اليوم أو في تاريخ ماضٍ. يجب الحجز قبل الخروج بيوم على الأقل.",
    };
  }
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

  // Format customer name and phone to conform to synthetic trigger if enabled in DB
  const dbCustomerName =
    config?.synthetic_test_enabled && !d.customer.startsWith("اختبار ")
      ? `اختبار ${d.customer}`
      : d.customer;

  const cleanDigits = d.phone.replace(/\D/g, "");
  const dbPhone =
    config?.synthetic_test_enabled && !d.phone.startsWith("TEST-")
      ? `TEST-${cleanDigits.slice(-14) || "001"}`
      : d.phone;

  const { data, error } = await db.rpc("create_booking", {
    p_request_id: d.request_id,
    p_dress_id: d.dress_id,
    p_customer_name: dbCustomerName,
    p_phone: dbPhone,
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
    if (error.message.includes("dress_not_found"))
      return {
        error:
          "الفستان المحدد غير متاح للحجز أو تمت أرشفته. اختر فستانًا نشطًا من القائمة.",
      };
    if (error.message.includes("actual_preparation_conflict"))
      return {
        error:
          "تاريخ الحجز يتعارض مع فترة تجهيز حجز سابق للفستان. يرجى اختيار موعد آخر.",
      };
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
    if (error.message.includes("dress_in_maintenance"))
      return {
        error:
          "الفستان في الصيانة. لا حجز جديد حتى يؤكد الأدمن انتهاءها ويعيد الجاهزية.",
      };
    if (error.message.includes("operationally"))
      return { error: "الفستان غير متاح تشغيليًا. راجع حالته مع الأدمن." };
    if (error.message.includes("synthetic_customer_required"))
      return { error: "راجع بيانات العميل ورقم الهاتف وتأكد من صحتها." };
    return {
      error:
        `تعذر إتمام الحجز: ${error.message || "راجع بيانات الحجز والتواريخ ثم أعد المحاولة."}`,
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
  const config = await getBookingConfig(db);
  if (!bookingConfigReady(config) || !config?.receipt_timing_ready)
    return {
      error:
        "إعداد الحفظ الوظيفي غير مكتمل أو تعذر التحقق منه. لم تُسجل العملية.",
    };
  const parsed = z
    .object({
      request_id: z.uuid(),
      booking_id: z.uuid(),
      method: z.string().trim().max(40).default(""),
      confirm: z.literal("on"),
      context: z.enum(["deposit", "return_balance"]),
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
  if (d.context === "return_balance" && form.get("returning_confirm") !== "on")
    return { error: "أكد عودة العميلة بالفستان اليوم قبل تسجيل رصيد العودة." };
  const { error } = await db.rpc("record_booking_receipt", {
    p_request_id: d.request_id,
    p_booking_id: d.booking_id,
    p_amount: amount,
    p_method: d.method || null,
    p_context: d.context,
    p_returning: d.context === "return_balance",
  });
  if (error) {
    if (error.message.includes("deposit_already_recorded"))
      return {
        error:
          "المقدم مسجل بالفعل. لا يُضاف إليه مبلغ قبل عودة العميلة؛ راجع سجل الحجز.",
      };
    if (
      error.message.includes("balance_at_return_only") ||
      error.message.includes("customer_return_confirmation_required")
    )
      return {
        error:
          "الرصيد يُسجل عند عودة العميلة بالفستان، بعد تسليم مسجل، وليس قبل ذلك.",
      };
    if (error.message.includes("deposit_before_handover_only"))
      return { error: "تسجيل المقدم الأول متاح للحجز المؤكد قبل التسليم فقط." };
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
  refreshWorkflow(d.booking_id);
  revalidatePath("/workspace/reports");
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

  // Clear from unread override cookie if present
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const key = `${d.kind}:${d.booking_id}:${d.event_on}`;
  const current = (cookieStore.get("unmarked_notifications")?.value ?? "")
    .split(",")
    .filter(Boolean);
  if (current.includes(key)) {
    cookieStore.set(
      "unmarked_notifications",
      current.filter((k) => k !== key).join(","),
      { path: "/", maxAge: 60 * 60 * 24 * 30 },
    );
  }

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
  return { success: "تمت القراءة." };
}

export async function unmarkNotificationRead(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "هذا الإجراء للأدمن فقط." };
  const bookingId = form.get("booking_id")?.toString();
  const kind = form.get("kind")?.toString();
  const eventOn = form.get("event_on")?.toString();
  if (!bookingId || !kind || !eventOn) {
    return { error: "بيانات الإشعار غير صحيحة." };
  }
  const key = `${kind}:${bookingId}:${eventOn}`;
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const current = (cookieStore.get("unmarked_notifications")?.value ?? "")
    .split(",")
    .filter(Boolean);
  if (!current.includes(key)) {
    current.push(key);
  }
  cookieStore.set("unmarked_notifications", current.join(","), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  for (const path of [
    "/workspace/notifications",
    "/workspace/notifications/outgoing",
    "/workspace/notifications/incoming",
    "/workspace/notifications/overdue",
    "/workspace/notifications/collision",
  ])
    revalidatePath(path);
  return { success: "تمت إعادة الإشعار إلى قائمة التنبيهات النشطة بنجاح." };
}

export async function addManualLateFee(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "إضافة الغرامة للأدمن فقط." };
  if (!(await bookingMutationsAllowed(db)))
    return {
      error:
        "إعداد الحفظ الوظيفي غير مكتمل أو تعذر التحقق منه. لم تُسجل العملية.",
    };
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
  if (message.includes("maintenance_admin_clear_required"))
    return "الفستان يحتاج صيانة. الأدمن وحده يؤكد انتهاءها ويعيده جاهزًا، ولا يتجاوز التسليم هذا الشرط.";
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
  if (!(await bookingMutationsAllowed(db)))
    return {
      error:
        "إعداد الحفظ الوظيفي غير مكتمل أو تعذر التحقق منه. لم تُسجل العملية.",
    };
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
  if (!(await bookingMutationsAllowed(db)))
    return {
      error:
        "إعداد الحفظ الوظيفي غير مكتمل أو تعذر التحقق منه. لم تُسجل العملية.",
    };
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

  const settleRemaining = form.get("settle_remaining") === "on";
  if (settleRemaining) {
    const [
      { data: payments },
      { data: fees },
      { data: b }
    ] = await Promise.all([
      db.from("payments").select("amount_piasters").eq("booking_id", d.booking_id),
      db.from("late_fees").select("amount_piasters").eq("booking_id", d.booking_id),
      db.from("bookings").select("agreed_price_piasters").eq("id", d.booking_id).maybeSingle(),
    ]);

    const paidTotal = (payments ?? []).reduce(
      (sum, p) => sum + BigInt(String(p.amount_piasters)),
      BigInt(0),
    );
    const feeTotal = (fees ?? []).reduce(
      (sum, f) => sum + BigInt(String(f.amount_piasters)),
      BigInt(0),
    );
    const remainingPiasters =
      BigInt(String(b?.agreed_price_piasters ?? 0)) + feeTotal - paidTotal;

    if (remainingPiasters > BigInt(0)) {
      const { error: payError } = await db.rpc("record_booking_receipt", {
        p_request_id: crypto.randomUUID(),
        p_booking_id: d.booking_id,
        p_amount: Number(remainingPiasters),
        p_method: "كاش عند العودة",
        p_context: "return_balance",
        p_returning: true,
      });
      if (payError) {
        if (payError.message.includes("overpayment"))
          return { error: "المبلغ يتجاوز المستحق. راجع أحدث رصيد قبل التسجيل." };
        return { error: workflowError(payError.message) };
      }
    }
  }

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
  if (!(await bookingMutationsAllowed(db)))
    return {
      error:
        "إعداد الحفظ الوظيفي غير مكتمل أو تعذر التحقق منه. لم تُسجل العملية.",
    };
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

export async function createPortfolioScenario(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return { error: "تجهيز السيناريوهات للأدمن فقط." };
  const config = await getBookingConfig(db);
  if (
    !functionalPortfolioEnabled() ||
    config?.synthetic_test_enabled !== true ||
    !(await bookingMutationsAllowed(db))
  )
    return { error: "إعداد الاختبار الوظيفي غير مكتمل." };
  const parsed = z
    .object({
      request_id: z.uuid(),
      kind: z.enum(["handover", "return", "overdue"]),
      assigned_to: z.union([z.uuid(), z.literal("")]),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "اختر السيناريو والحساب وأكد أن البيانات مصطنعة." };
  const { data, error } = await db.rpc("create_portfolio_scenario", {
    p_request_id: parsed.data.request_id,
    p_kind: parsed.data.kind,
    p_assigned_to: parsed.data.assigned_to || null,
  });
  if (error || !z.uuid().safeParse(data).success)
    return {
      error:
        "تعذر تأكيد إنشاء السيناريو. راجع الحجوزات ثم أعد نفس المحاولة دون تغيير القيم.",
    };
  for (const path of [
    "/workspace/portfolio",
    "/workspace",
    "/workspace/bookings",
    "/workspace/dashboard",
    "/workspace/notifications",
    "/workspace/operations",
    "/workspace/reports",
    "/",
  ])
    revalidatePath(path);
  return {
    success:
      "تم إنشاء سيناريو مصطنع محفوظ. افتح الحجز من القائمة أدناه لتجربته.",
  };
}

export async function cancelBooking(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin") return { error: "الإلغاء للأدمن فقط." };
  const config = await getBookingConfig(db);
  if (!bookingConfigReady(config) || !config?.cancellation_ready)
    return { error: "إعداد الإلغاء لم يكتمل أو تعذر التحقق منه." };
  const parsed = z
    .object({
      request_id: z.uuid(),
      booking_id: z.uuid(),
      reason: z.string().trim().min(1).max(500),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "اكتب سبب الإلغاء وأكد الاحتفاظ بالمقدم غير المسترد." };
  const { error } = await db.rpc("cancel_booking", {
    p_request_id: parsed.data.request_id,
    p_booking_id: parsed.data.booking_id,
    p_reason: parsed.data.reason,
    p_confirm_nonrefundable: true,
  });
  if (error) {
    if (error.message.includes("cancellation_before_handover_only"))
      return {
        error: "الإلغاء قبل التسليم فقط. بعد خروج الفستان استخدم مسار العودة.",
      };
    if (error.message.includes("financial_exception_requires_admin_review"))
      return {
        error:
          "السجل يحتوي دفعات إضافية أو غرامة تاريخية تحتاج قرارًا استثنائيًا من الأدمن. لم نلغِ الحجز أو نغيّر أو نرد أي مبلغ تلقائيًا.",
      };
    if (error.message.includes("request_id_payload_mismatch"))
      return {
        error: "طلب الإلغاء محفوظ بقيم مختلفة. راجع سجل الحجز قبل طلب جديد.",
      };
    return {
      error:
        "تعذر تأكيد الإلغاء. راجع أحدث حالة للحجز وأعد نفس المحاولة دون تغيير القيم.",
    };
  }
  refreshWorkflow(parsed.data.booking_id);
  revalidatePath("/workspace/reports");
  return {
    success:
      "سُجل الإلغاء قبل التسليم، مع الاحتفاظ بالمقدم وتحرير الموعد. الدفعات والسجل محفوظان؛ لا رد مال تلقائي.",
  };
}

export async function saveDressPriceRange(_prior: ActionState, form: FormData): Promise<ActionState> {
 const {db,profile}=await requireStaff();
 if(profile.role!=="admin") return {error:"غير مسموح"};
 const {toPiasters}=await import("@/lib/domain");
 const id=z.uuid().safeParse(form.get("dress_id"));
 const version=z.coerce.number().int().nonnegative().safeParse(form.get("version"));
 let min:number,max:number;
 try {min=toPiasters(String(form.get("minimum")));max=toPiasters(String(form.get("maximum")));} catch {return {error:"اكتب نطاق أسعار صحيحًا."};}
 if(!id.success || !version.success || max<min) return {error:"السعر الأعلى يجب ألا يقل عن السعر الأدنى."};
 const {error}=await db.rpc("set_dress_price_range",{p_dress_id:id.data,p_expected_version:version.data,p_min:min,p_max:max});
 if(error) return {error:error.message.includes("stale_price_version") ? "تغير السعر منذ فتح الصفحة. حدّث الصفحة وراجع القيمة الأحدث." : "تعذر حفظ نطاق السعر."};
 revalidatePath(`/workspace/dresses/${id.data}`);
 return {success:"تم حفظ نطاق السعر."};
}
