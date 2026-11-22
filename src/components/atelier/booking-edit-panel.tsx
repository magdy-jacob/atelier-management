"use client";
import { useActionState, useRef, useState } from "react";
import { editBooking, type BookingEditState } from "@/app/booking-edit-actions";
import { Button } from "@/components/ui/button";
import { aggregateMoney } from "@/lib/admin-dashboard";
import { decimalPiasters } from "@/lib/receipt-report";
import { formatDay, validDay } from "@/lib/domain";
export type EditableBooking = {
  id: string;
  version: number;
  starts_on: string;
  returns_on: string;
  agreed_price_piasters: string;
  status: string;
};
export type BookingChange = {
  id: string;
  reason: string;
  old_start: string;
  old_return: string;
  new_start: string;
  new_return: string;
  old_price_piasters: string;
  new_price_piasters: string;
  recorded_by: string;
  actor_name: string | null;
  created_at: string;
};
function EditForm({
  booking,
  enabled,
  preview,
  onFeedback,
}: {
  booking: EditableBooking;
  enabled: boolean;
  preview: boolean;
  onFeedback: (value: BookingEditState) => void;
}) {
  const request = useRef<string | null>(null);
  const [start, setStart] = useState(booking.starts_on),
    [end, setEnd] = useState(booking.returns_on);
  const [, action, pending] = useActionState(
    async (previous: BookingEditState, form: FormData) => {
      request.current ??= crypto.randomUUID();
      form.set("request_id", request.current);
      try {
        const result = await editBooking(previous, form);
        onFeedback(result);
        if (result.success) request.current = null;
        return result;
      } catch {
        const result = {
          error:
            "انقطع الاتصال قبل تأكيد النتيجة. راجع تاريخ الحجز ثم أعد نفس الطلب دون تغيير القيم.",
        };
        onFeedback(result);
        return result;
      }
    },
    {},
  );
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      onReset={(e) => e.preventDefault()}
      className="space-y-5"
    >
      <input type="hidden" name="booking_id" value={booking.id} />
      <input type="hidden" name="version" value={booking.version} />
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="field">
          بداية الحجز الجديدة
          <input
            type="date"
            name="starts_on"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            disabled={pending}
          />
        </label>
        <label className="field">
          العودة المخططة الجديدة
          <input
            type="date"
            name="returns_on"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
            disabled={pending}
          />
        </label>
        <label className="field">
          السعر المتفق عليه بالجنيه
          <input
            dir="ltr"
            type="number"
            inputMode="decimal"
            name="total"
            min="0.01"
            max="99999999.99"
            step="0.01"
            required
            defaultValue={decimalPiasters(booking.agreed_price_piasters)}
            disabled={pending}
          />
        </label>
      </div>
      {validDay(start) && validDay(end) && (
        <p className="rounded-xl bg-secondary/50 p-4 text-xs leading-8">
          الموعد المدخل بالأيام: {formatDay(start)} إلى {formatDay(end)}. يبقى
          اليوم التالي للعودة للتجهيز كاملًا.
        </p>
      )}
      <label className="field">
        سبب تعديل الحجز
        <textarea
          name="reason"
          rows={3}
          required
          maxLength={500}
          disabled={pending}
        />
      </label>
      <label className="flex items-start gap-3 text-xs leading-8">
        <input
          className="mt-2 accent-primary"
          type="checkbox"
          name="confirm"
          required
          disabled={pending}
        />
        أؤكد تعديل الموعد والسعر فقط قبل التسليم، مع بقاء العميلة والفستان
        والإيصالات والسجل، دون رد مبالغ أو تغيير المقدم.
      </label>
      <Button type="submit" disabled={pending || !enabled || preview}>
        {pending ? "جارٍ التحقق من التعديل..." : "حفظ تعديل الموعد والسعر"}
      </Button>
    </form>
  );
}
export function BookingEditPanel({
  booking,
  paid,
  admin,
  enabled,
  history,
  preview = false,
}: {
  booking: EditableBooking;
  paid: string;
  admin: boolean;
  enabled: boolean;
  history: BookingChange[];
  preview?: boolean;
}) {
  const [feedback, setFeedback] = useState<BookingEditState>({});
  return (
    <section className="studio-card space-y-6 p-6 md:p-8">
      <h2 className="text-lg">تعديل الموعد والسعر</h2>
      {feedback.success && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-4 text-xs leading-8 text-primary"
        >
          {feedback.success}
        </p>
      )}
      {feedback.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-xs leading-8 text-red-900"
        >
          {feedback.error}
        </p>
      )}
      {!admin ? (
        <p className="text-xs leading-8 text-muted-foreground">
          تعديل الموعد والسعر للأدمن فقط. لا تتغير الدفعات أو العميلة أو الفستان
          تلقائيًا.
        </p>
      ) : (
        <>
          <p className="text-xs leading-8 text-muted-foreground">
            قبل تسليم الفستان فقط، بسبب محفوظ. المقبوض المسجل الآن{" "}
            {aggregateMoney(paid)}، ولا ينزل السعر الجديد عن المقبوض. يُمنع
            التعارض ويظل يوم التجهيز كاملًا بعد العودة. عند تغيير التواريخ تبدأ
            من الغد على الأقل حسب مصر؛ تعديل السعر وحده يمكنه إبقاء الموعد
            الحالي.
          </p>
          {preview && (
            <p className="rounded-xl bg-secondary p-4 text-xs leading-8">
              معاينة مصطنعة لا تحفظ. التعديل الحقيقي من تفاصيل حجز مساحة العمل
              للأدمن.
            </p>
          )}
          {booking.status !== "confirmed" ? (
            <p className="text-xs leading-8">
              انتهى نطاق التعديل: الحجز خارج الأتيليه أو عائد أو ملغى. تاريخ
              التعديلات السابق يبقى محفوظًا.
            </p>
          ) : (
            <>
              <EditForm
                key={`${booking.id}:${booking.version}`}
                booking={booking}
                enabled={enabled}
                preview={preview}
                onFeedback={setFeedback}
              />
              {!enabled && !preview && (
                <p className="text-xs leading-8 text-muted-foreground">
                  الحفظ مغلق قبل اكتمال إعداد هذه الميزة.
                </p>
              )}
            </>
          )}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-sm">تاريخ تعديل الحجز، للأدمن</h3>
            <p className="text-xs leading-7 text-muted-foreground">
              آخر ١٠٠ تعديل لهذا الحجز. لا تُحذف الدفعات أو يُعاد تأريخها بسبب
              تغيير السعر أو الموعد.
            </p>
            {!history.length && (
              <p className="text-xs text-muted-foreground">
                لا توجد تعديلات مسجلة في هذه القائمة.
              </p>
            )}
            {history.map((h) => (
              <article
                key={h.id}
                className="space-y-3 rounded-xl border p-4 text-xs leading-8"
              >
                <p className="font-medium">
                  {h.actor_name ?? "حساب أدمن مسجل"} ·{" "}
                  {new Intl.DateTimeFormat("ar-EG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Cairo",
                  }).format(new Date(h.created_at))}{" "}
                  بتوقيت القاهرة
                </p>
                <p>
                  الموعد السابق: {formatDay(h.old_start)} إلى{" "}
                  {formatDay(h.old_return)}.
                </p>
                <p>
                  الموعد المحفوظ: {formatDay(h.new_start)} إلى{" "}
                  {formatDay(h.new_return)}.
                </p>
                <p>
                  السعر: {aggregateMoney(h.old_price_piasters)} ←{" "}
                  {aggregateMoney(h.new_price_piasters)}.
                </p>
                <p className="break-words">السبب: {h.reason}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
