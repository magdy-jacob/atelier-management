"use client";
import { useActionState, useState } from "react";
import {
  createRealBooking,
  recordRealPayment,
  ActionState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { SYNTHETIC_PHONE_PATTERN } from "@/lib/booking-identity";
import { money, toPiasters, addDays, dateInZone } from "@/lib/domain";
import {
  BookingCalendarPicker,
  type BookingRange,
} from "./booking-calendar-picker";
function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-7 text-red-800"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-xs leading-7 text-pink-800"
        >
          {state.success}
        </p>
      )}
    </>
  );
}
export function LiveBookingForm({
  dresses,
  methods,
  enabled,
  requestId,
  minDay,
  preview = false,
  synthetic = false,
  existingBookings = [],
}: {
  dresses: { id: string; name: string; code: string }[];
  methods: string[];
  enabled: boolean;
  requestId: string;
  minDay?: string;
  preview?: boolean;
  synthetic?: boolean;
  existingBookings?: BookingRange[];
}) {
  const [state, action, pending] = useActionState(createRealBooking, {});
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [selectedDressId, setSelectedDressId] = useState(dresses[0]?.id ?? "");
  const [startsOn, setStartsOn] = useState("");
  const [returnsOn, setReturnsOn] = useState("");
  const [dateValidationWarning, setDateValidationWarning] = useState<
    string | null
  >(null);

  const todayCairo = dateInZone(new Date(), "Africa/Cairo");
  const effectiveMinDay =
    minDay && minDay > todayCairo ? minDay : addDays(todayCairo, 1);

  let remaining: string = "—";
  try {
    const a = toPiasters(total),
      b = toPiasters(deposit);
    remaining = b <= a ? money(a - b) : "المقدم يتجاوز السعر";
  } catch {}

  const handleStartDateChange = (val: string) => {
    if (!val) {
      setStartsOn("");
      return;
    }
    if (val < effectiveMinDay) {
      setDateValidationWarning(
        "لا يمكن حجز الفستان في نفس اليوم أو في تاريخ ماضٍ. أقرب موعد متاح هو غدًا: " +
          effectiveMinDay,
      );
      setStartsOn("");
      return;
    }
    const isBooked = existingBookings.some(
      (b) =>
        b.dress_id === selectedDressId &&
        val >= b.starts_on &&
        val <= addDays(b.returns_on, 1),
    );
    if (isBooked) {
      setDateValidationWarning(
        "هذا اليوم محجوز بالفعل لهذا الفستان أو يوافق يوم تجهيز. اختر يومًا متاحًا.",
      );
      setStartsOn("");
      return;
    }
    setDateValidationWarning(null);
    setStartsOn(val);
    if (returnsOn && returnsOn < val) {
      setReturnsOn("");
    }
  };

  const handleReturnDateChange = (val: string) => {
    if (!val) {
      setReturnsOn("");
      return;
    }
    if (val < effectiveMinDay) {
      setDateValidationWarning("تاريخ العودة غير صحيح.");
      setReturnsOn("");
      return;
    }
    if (startsOn && val < startsOn) {
      setDateValidationWarning(
        "تاريخ العودة لا يمكن أن يكون قبل تاريخ الخروج.",
      );
      setReturnsOn("");
      return;
    }
    const startCheck = startsOn || val;
    let cur = startCheck;
    let conflict = false;
    while (cur <= val) {
      const isOcc = existingBookings.some(
        (b) =>
          b.dress_id === selectedDressId &&
          cur >= b.starts_on &&
          cur <= addDays(b.returns_on, 1),
      );
      if (isOcc) {
        conflict = true;
        break;
      }
      cur = addDays(cur, 1);
    }
    if (conflict) {
      setDateValidationWarning(
        "الفترة المحددة تتعارض مع حجز قائم لهذا الفستان أو مع يوم التجهيز.",
      );
      setReturnsOn("");
      return;
    }
    setDateValidationWarning(null);
    setReturnsOn(val);
  };

  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      onReset={(event) => event.preventDefault()}
      className="studio-card space-y-6 p-6 md:p-8"
    >
      <input name="request_id" type="hidden" value={requestId} />
      {!enabled && (
        <p className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-xs leading-7">
          الحفظ الفعلي غير مفعل بعد. الحجز بالأيام بتوقيت مصر، وقبل الخروج بيوم
          على الأقل، ويُحجز يوم كامل للتجهيز بعد العودة. يلزم إتمام اختبارات
          الربط قبل تفعيل الحفظ. وصف طريقة الاستلام اختياري ولا يوجد تحصيل
          إلكتروني.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          الفستان
          <select
            name="dress_id"
            required
            value={selectedDressId}
            onChange={(e) => {
              setSelectedDressId(e.target.value);
              setStartsOn("");
              setReturnsOn("");
              setDateValidationWarning(null);
            }}
          >
            <option value="" disabled>
              اختر الفستان
            </option>
            {dresses.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.code}
              </option>
            ))}
          </select>
        </label>

        {/* Visual calendar showing booked & preparation days as locked */}
        <div className="sm:col-span-2 space-y-2">
          <BookingCalendarPicker
            selectedDressId={selectedDressId}
            existingBookings={existingBookings}
            startsOn={startsOn}
            returnsOn={returnsOn}
            onSelectRange={(start, end) => {
              setStartsOn(start);
              setReturnsOn(end);
              setDateValidationWarning(null);
            }}
            minDay={effectiveMinDay}
          />
          {dateValidationWarning && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 leading-6"
            >
              {dateValidationWarning}
            </p>
          )}
        </div>

        <label className="field">
          التسليم
          <input
            name="starts_on"
            type="date"
            required
            min={effectiveMinDay}
            value={startsOn}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
        </label>
        <label className="field">
          الاستلام
          <input
            name="returns_on"
            type="date"
            required
            min={startsOn || effectiveMinDay}
            value={returnsOn}
            onChange={(e) => handleReturnDateChange(e.target.value)}
          />
        </label>
        <label className="field">
          اسم العميل
          <input
            name="customer"
            required
            maxLength={120}
            placeholder="اسم العميل (عربي أو إنجليزي)"
          />
        </label>
        <label className="field">
          رقم الهاتف
          <input
            name="phone"
            type="tel"
            placeholder="مثال: 012 861xxxxx"
            dir="ltr"
            required
            minLength={5}
            maxLength={24}
          />
        </label>
        <label className="field">
          السعر النهائي المتفق عليه (جنيه)
          <input
            name="total"
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0.01"
            max="99999999.99"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            required
          />
        </label>
        <label className="field">
          المقدم المستلم (جنيه)
          <input
            name="deposit"
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0"
            max="99999999.99"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            required
          />
        </label>
        <label className="field">
          طريقة استلام المقدم (اختياري)
          <input
            name="method"
            list="deposit-methods"
            maxLength={40}
            placeholder="يمكن تركها فارغة أو كتابة أي طريقة"
          />
          <datalist id="deposit-methods">
            {methods.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <span className="text-[10px] leading-6 text-muted-foreground">
            كاش، إنستاباي، أورانج كاش وفودافون كاش اقتراحات، وليست طرقًا مفروضة
            أو حصرية.
          </span>
        </label>
        <div className="rounded-xl bg-secondary p-4">
          <p className="mb-3 text-[11px] text-muted-foreground">
            المتبقي المحسوب
          </p>
          <output className="text-lg">{remaining}</output>
        </div>
      </div>
      <label className="flex items-start gap-3 text-xs leading-7">
        <input
          name="deposit_confirm"
          type="checkbox"
          className="mt-2 size-4 accent-primary"
        />
        أؤكد استلام المقدم المكتوب فعليًا، إن كان أكبر من صفر. هذا تسجيل في السجل
        وليس تحصيلًا إلكترونيًا.
      </label>
      <p className="text-[10px] leading-7 text-muted-foreground">
        لم نعتمد دمج العملاء على الهاتف؛ لا ينفذ هذا النموذج دمجًا تلقائيًا. عند
        تعذر التأكد من نتيجة الشبكة، أعد نفس المحاولة ولا تنشئ طلبًا ثانيًا قبل
        مراجعة السجل. معرف الطلب يمنع التكرار.
      </p>
      <Feedback state={state} />
      <Button
        type="submit"
        className="h-11 w-full sm:w-auto sm:px-8"
        disabled={pending || !enabled || preview || !dresses.length}
      >
        {pending
          ? "جارٍ التحقق والحفظ…"
          : enabled
            ? "تأكيد الحجز والمقدم المسجل"
            : "الحفظ الفعلي غير مفعل"}
      </Button>
    </form>
  );
}
export function LivePaymentForm({
  bookingId,
  methods,
  enabled,
  requestId,
  preview = false,
  context = "return_balance",
  defaultAmount,
  feeTotal = "0",
  remainingAmount,
}: {
  bookingId: string;
  methods: string[];
  enabled: boolean;
  requestId: string;
  preview?: boolean;
  context?: "deposit" | "return_balance" | null;
  defaultAmount?: string;
  feeTotal?: string;
  remainingAmount?: string;
}) {
  const [state, action, pending] = useActionState(
    recordRealPayment,
    {} as ActionState,
  );
  if (!context) return null;
  const hasFee = Number(feeTotal) > 0;
  return (
    <section className="studio-card p-6">
      <h2 className="mb-3 text-base">
        {context === "deposit" ? "تسجيل المقدم الأول" : "تسجيل رصيد العودة"}
      </h2>
      <p className="mb-5 text-xs leading-7 text-muted-foreground">
        {context === "deposit"
          ? "للحجز الذي لم يُسجل له أي مقدم بعد، وقبل التسليم فقط. لا يمكن زيادة مقدم مسجل من هذا النموذج."
          : "يستخدم فقط عند عودة العميلة بالفستان فعلًا، لا لدفع الرصيد مقدمًا. يبقى إتمام العودة مشروطًا بسداد المتبقي كله."}{" "}
        لا تحصيل إلكتروني.
      </p>
      {context === "return_balance" && hasFee && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
          <p className="font-semibold text-sm mb-1">
            توضيح المتبقي المطلوب سداده:
          </p>
          <p>
            المبلغ المقترح أدناه (<strong>{defaultAmount} ج.م</strong>) هو <strong>كامل المبلغ المتبقي المستحق شاملاً الغرامة المسجلة ({money(Number(feeTotal))})</strong>.
          </p>
          <p className="text-[11px] text-amber-800/90 mt-1 font-medium">
            ⚠️ لا تقم بإضافة مبلغ الغرامة يدوياً مرة أخرى، منعاً لظهور رسالة «المبلغ يتجاوز المستحق».
          </p>
        </div>
      )}
      {!enabled && (
        <p className="mb-5 rounded-xl border border-pink-200 bg-pink-50 p-4 text-xs leading-7">
          التسجيل متوقف لحين إتمام اختبارات الربط وتفعيل الحفظ، أو لأن حالة
          الحجز لا تقبل دفعة. وصف الطريقة اختياري.
        </p>
      )}
      <form
        action={preview ? undefined : action}
        onSubmit={preview ? (e) => e.preventDefault() : undefined}
        className="space-y-5"
      >
        <input name="context" type="hidden" value={context} />
        <input name="booking_id" type="hidden" value={bookingId} />
        <input
          name="request_id"
          type="hidden"
          value={state.nextRequestId ?? requestId}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            المبلغ (جنيه)
            <input
              defaultValue={defaultAmount}
              name="amount"
              type="number"
              min="0.01"
              max="99999999.99"
              step="0.01"
              required
            />
          </label>
          <label className="field">
            طريقة الاستلام (اختياري)
            <input
              name="method"
              list="payment-methods"
              maxLength={40}
              placeholder="يمكن تركها فارغة أو كتابة أي طريقة"
            />
            <datalist id="payment-methods">
              {methods.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        </div>
        <label className="flex items-start gap-3 text-xs leading-7">
          <input
            type="checkbox"
            name="confirm"
            required
            className="mt-2 size-4 accent-primary"
          />
          أؤكد استلام هذا المبلغ فعليًا ومراجعة رصيد الحجز.
        </label>
        {context === "return_balance" && (
          <label className="flex items-start gap-3 text-xs leading-7">
            <input
              name="returning_confirm"
              type="checkbox"
              required
              className="mt-2 size-4 accent-primary"
            />
            العميلة عادت بالفستان اليوم، وهذا المبلغ من الرصيد المستلم عند
            الرجوع، وليس قبل عودتها.
          </label>
        )}
        <Feedback state={state} />
        <Button
          type="submit"
          className="h-11"
          disabled={!enabled || pending || preview}
        >
          {pending ? "جارٍ التسجيل…" : "تسجيل الدفعة في السجل"}
        </Button>
      </form>
    </section>
  );
}
