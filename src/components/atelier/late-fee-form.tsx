"use client";
import { useActionState, useRef, useState } from "react";
import { addManualLateFee, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
export function LateFeeForm({
  bookingId,
  enabled,
  preview = false,
}: {
  bookingId: string;
  enabled: boolean;
  preview?: boolean;
}) {
  const request = useRef<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: ActionState, form: FormData) => {
      request.current ??= crypto.randomUUID();
      form.set("request_id", request.current);
      let result: ActionState;
      try {
        result = await addManualLateFee(previous, form);
      } catch {
        return {
          error:
            "انقطع الاتصال قبل تأكيد النتيجة. راجع سجل الحجز ثم أعد نفس المحاولة دون تغيير القيم؛ لا تفتح طلبًا جديدًا قبل التحقق.",
        };
      }
      if (result.success) {
        request.current = null;
        setAmount("");
        setReason("");
        setConfirmed(false);
      }
      return result;
    },
    {} as ActionState,
  );
  return (
    <details className="mt-6 border-t border-red-200 pt-5">
      <summary className="cursor-pointer text-xs font-medium text-red-900">
        إضافة غرامة تأخير اختيارية، للأدمن فقط
      </summary>
      <form
        action={preview ? undefined : action}
        onSubmit={preview ? (e) => e.preventDefault() : undefined}
        className="mt-5 space-y-4"
      >
        <input type="hidden" name="booking_id" value={bookingId} />
        <p className="text-xs leading-7 text-muted-foreground">
          ليس كل تأخير عليه غرامة. لا يُضاف شيء تلقائيًا؛ هذا قرار يدوي يزيد
          المستحق في السجل، ولا يخصم أموالًا أو يرسل رسالة للعميل.
        </p>
        {!enabled && (
          <p className="rounded-xl border border-pink-200 bg-pink-50 p-3 text-xs leading-7">
            الحفظ غير متاح في المعاينة أو قبل اكتمال إعداد الاختبار الوظيفي. لا
            تُرسل هذه الحقول عملية مالية.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            مبلغ الغرامة (جنيه)
            <input
              name="amount"
              type="number"
              min="0.01"
              max="99999999.99"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={pending}
            />
          </label>
          <label className="field">
            سبب الغرامة
            <input
              name="reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              disabled={pending}
            />
          </label>
        </div>
        <label className="flex items-start gap-3 text-xs leading-7">
          <input
            name="confirm"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={pending}
            required
            className="mt-2 size-4 accent-primary"
          />
          راجعت الحجز وأوافق على إضافة هذه الغرامة الاختيارية للمستحق، وليست
          دفعة مستلمة.
        </label>
        {state.error && (
          <p role="alert" className="text-xs leading-7 text-red-800">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-xs leading-7 text-pink-900">
            {state.success}
          </p>
        )}
        <Button type="submit" disabled={pending || !enabled || preview}>
          {pending ? "جارٍ تسجيل الغرامة…" : "إضافة الغرامة للمستحق"}
        </Button>
      </form>
    </details>
  );
}
