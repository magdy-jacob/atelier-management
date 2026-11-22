"use client";
import { useActionState, useRef } from "react";
import { cancelBooking, type ActionState } from "@/app/actions";
import { aggregateMoney } from "@/lib/admin-dashboard";
import { Button } from "@/components/ui/button";
export type CancellationRecord = {
  reason: string;
  retained_deposit_piasters: string;
  created_at: string;
};
export function CancellationPanel({
  bookingId,
  status,
  admin,
  enabled,
  deposit,
  cancellation,
  preview = false,
}: {
  bookingId: string;
  status: string;
  admin: boolean;
  enabled: boolean;
  deposit: string;
  cancellation: CancellationRecord | null;
  preview?: boolean;
}) {
  const request = useRef<string | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: ActionState, form: FormData) => {
      request.current ??= crypto.randomUUID();
      form.set("request_id", request.current);
      try {
        const result = await cancelBooking(previous, form);
        if (result.success) request.current = null;
        return result;
      } catch {
        return {
          error:
            "تعذر تأكيد النتيجة. راجع الحجز وأعد نفس المحاولة دون تغيير القيم، ولا تبدأ طلبًا جديدًا قبل التحقق.",
        };
      }
    },
    {} as ActionState,
  );
  if (!admin) return null;
  return (
    <section className="studio-card space-y-5 border-red-200 p-6 md:p-8">
      <h2 className="text-lg">إلغاء الحجز قبل التسليم</h2>
      {state.success && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-4 text-xs leading-7 text-primary"
        >
          {state.success}
        </p>
      )}
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-xs leading-7 text-red-900"
        >
          {state.error}
        </p>
      )}
      {cancellation ? (
        <div className="space-y-3 text-xs leading-8">
          <p>
            سُجل الإلغاء، مع الاحتفاظ بالمقدم{" "}
            {aggregateMoney(cancellation.retained_deposit_piasters)} دون رد
            تلقائي. بقيت الدفعات والسجل محفوظين.
          </p>
          <p>السبب: {cancellation.reason}</p>
        </div>
      ) : status === "cancelled" ? (
        <p className="text-xs leading-8 text-muted-foreground">
          الحجز ملغي. تبقى الدفعات محفوظة دون رد تلقائي. تفاصيل قرار الإلغاء
          تظهر ضمن صلاحية الحساب.
        </p>
      ) : status !== "confirmed" ? (
        <p className="text-xs leading-8 text-muted-foreground">
          لا يُلغى حجز بعد تسليم الفستان. استخدم مسار العودة والفحص وتسوية
          الرصيد؛ لا يتغير سجل الدفعات تلقائيًا.
        </p>
      ) : !admin ? (
        <p className="text-xs leading-8 text-muted-foreground">
          قرار الإلغاء للأدمن فقط. المقدم غير مسترد، ولا تُحذف الدفعات أو بيانات
          الحجز.
        </p>
      ) : (
        <form
          action={preview ? undefined : action}
          onSubmit={preview ? (e) => e.preventDefault() : undefined}
          className="space-y-5"
        >
          <input type="hidden" name="booking_id" value={bookingId} />
          <p className="text-xs leading-8 text-muted-foreground">
            الإلغاء متاح قبل تسليم الفستان فقط. يُحرر الموعد دون حذف الحجز أو
            الدفعات، ويُحتفظ بالمقدم المسجل {aggregateMoney(deposit)}. لا رد مال
            إلكتروني ولا تسوية استثنائية مفترضة.
          </p>
          <label className="field">
            سبب الإلغاء
            <textarea
              name="reason"
              required
              maxLength={500}
              rows={3}
              disabled={pending}
            />
          </label>
          <label className="flex items-start gap-3 text-xs leading-8">
            <input
              type="checkbox"
              name="confirm"
              required
              disabled={pending}
              className="mt-2 accent-primary"
            />
            أؤكد الإلغاء قبل التسليم والاحتفاظ بالمقدم غير المسترد، دون حذف
            دفعات أو رد مبالغ.
          </label>
          {(!enabled || preview) && (
            <p className="text-xs leading-7 text-muted-foreground">
              الحفظ غير متاح في المعاينة أو قبل اكتمال إعداد هذه الميزة.
            </p>
          )}
          <Button
            variant="destructive"
            type="submit"
            disabled={pending || !enabled || preview}
          >
            {pending
              ? "جارٍ تأكيد الإلغاء..."
              : "تأكيد إلغاء الحجز والاحتفاظ بالمقدم"}
          </Button>
        </form>
      )}
    </section>
  );
}
