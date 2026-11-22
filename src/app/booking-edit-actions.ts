"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/auth";
import { getBookingConfig, bookingConfigReady } from "@/lib/booking-config";
import { validDay, toPiasters } from "@/lib/domain";
export type BookingEditState = { error?: string; success?: string };
export async function editBooking(
  _prior: BookingEditState,
  form: FormData,
): Promise<BookingEditState> {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return { error: "تعديل الموعد والسعر للأدمن فقط." };
  const cfg = await getBookingConfig(db);
  if (!bookingConfigReady(cfg) || !cfg?.booking_edit_ready)
    return { error: "إعداد تعديل الحجوزات لم يكتمل أو تعذر التحقق منه." };
  const p = z
    .object({
      booking_id: z.uuid(),
      request_id: z.uuid(),
      version: z.coerce.number().int().positive(),
      starts_on: z.string().refine(validDay),
      returns_on: z.string().refine(validDay),
      reason: z.string().trim().min(1).max(500),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success || p.data.returns_on < p.data.starts_on)
    return {
      error: "راجع التواريخ وسبب التعديل وأكد الاحتفاظ بالسجل والدفعات.",
    };
  let total: number;
  try {
    total = toPiasters(String(form.get("total")));
  } catch {
    return { error: "أدخل سعرًا صحيحًا بحد أقصى خانتين عشريتين." };
  }
  if (total <= 0)
    return {
      error: "السعر يجب أن يكون أكبر من صفر ولا يقل عن المقبوض المسجل.",
    };
  const d = p.data;
  const { data, error } = await db.rpc("edit_booking", {
    p_request_id: d.request_id,
    p_booking_id: d.booking_id,
    p_expected_version: d.version,
    p_start: d.starts_on,
    p_return: d.returns_on,
    p_total: total,
    p_reason: d.reason,
    p_confirm: true,
  });
  const paths = [
    `/workspace/bookings/${d.booking_id}`,
    "/workspace/bookings",
    "/workspace/operations",
    "/workspace/notifications",
    "/workspace/dashboard",
    "/workspace/activity",
  ];
  if (error) {
    if (error.message.includes("dress_in_maintenance"))
      return {
        error:
          "الفستان في الصيانة؛ لا ينقل الموعد حتى يؤكد الأدمن انتهاءها ويعيد الجاهزية. يمكن إبقاء الموعد لتعديل السعر فقط قبل التسليم.",
      };
    if (error.message.includes("stale_booking_version")) {
      for (const path of paths) revalidatePath(path);
      return {
        error:
          "تغير الحجز منذ فتح النموذج. راجع أحدث موعد وسعر وحالة قبل إعادة التعديل.",
      };
    }
    if (error.message.includes("booking_edit_before_handover_only"))
      return {
        error:
          "التعديل قبل التسليم فقط. لا يغير حجزًا خارج الأتيليه أو عائدًا أو ملغى.",
      };
    if (error.message.includes("booking_price_below_receipts"))
      return {
        error:
          "السعر الجديد أقل من إجمالي المبالغ المستلمة فعليًا. لا نحذف إيصالًا أو نخترع رد مبلغ لتطبيق التعديل.",
      };
    if (error.message.includes("booking_edit_advance_required"))
      return {
        error:
          "عند تغيير التواريخ تكون البداية من الغد على الأقل حسب أيام مصر. يمكن إبقاء الموعد الحالي لتعديل السعر فقط قبل التسليم.",
      };
    if (error.message.includes("actual_preparation_conflict"))
      return {
        error: "الموعد الجديد يقطع يوم التجهيز الكامل بعد عودة مسجلة للفستان.",
      };
    if (error.code === "23P01")
      return {
        error:
          "الموعد يتعارض مع حجز قائم أو يوم تجهيزه. لم يتغير الحجز ولا سجله أو دفعاته.",
      };
    if (error.message.includes("request_id_payload_mismatch"))
      return {
        error:
          "هذا الطلب محفوظ بقيم مختلفة. راجع تاريخ التعديلات قبل بدء طلب جديد.",
      };
    return {
      error:
        "لم يتأكد حفظ التعديل. راجع أحدث الحجز وأعد نفس الطلب دون تغيير القيم، ولا تفترض أن التعديل تم.",
    };
  }
  const result = z
    .object({ version: z.number().int().positive(), unchanged: z.boolean() })
    .safeParse(data);
  if (!result.success)
    return {
      error:
        "تعذر التحقق من نتيجة التعديل. راجع الحجز وتاريخ تعديلاته قبل المحاولة.",
    };
  for (const path of paths) revalidatePath(path);
  return {
    success: result.data.unchanged
      ? "القيم مطابقة للحجز الحالي؛ لم ننشئ تعديلًا أو سجلًا زائفًا."
      : "تأكد حفظ تعديل الموعد/السعر وسببه وتاريخه والأدمن المسؤول. بقيت العميلة والفستان والإيصالات كما هي، دون رد مبلغ.",
  };
}
