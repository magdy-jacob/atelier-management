"use client";
import { useActionState, useState } from "react";
import {
  createRealBooking,
  recordRealPayment,
  ActionState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { SYNTHETIC_PHONE_PATTERN } from "@/lib/booking-identity";
import { money, toPiasters } from "@/lib/domain";
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
}: {
  dresses: { id: string; name: string; code: string }[];
  methods: string[];
  enabled: boolean;
  requestId: string;
  minDay?: string;
  preview?: boolean;
  synthetic?: boolean;
}) {
  const [state, action, pending] = useActionState(createRealBooking, {});
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("0");
  let remaining: string = "—";
  try {
    const a = toPiasters(total),
      b = toPiasters(deposit);
    remaining = b <= a ? money(a - b) : "المقدم يتجاوز السعر";
  } catch {}
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      onReset={(event) => event.preventDefault()}
      className="studio-card space-y-6 p-6 md:p-8"
    >
      <input name="request_id" type="hidden" value={requestId} />
      {synthetic && (
        <p className="rounded-xl border bg-secondary p-4 text-xs leading-7">
          اختبار وظيفي لمشروع معرض أعمال. تُحفظ السجلات المصطنعة في Supabase
          وتعمل القواعد فعليًا، دون تحصيل أو التزام مالي أو عملاء حقيقيين. الهاتف
          معرف اختبار يبدأ بـTEST- ولا يمكن الاتصال به.
        </p>
      )}
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
          <select name="dress_id" required defaultValue="">
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
        <label className="field">
          اسم العميل
          <input
            name="customer"
            required
            maxLength={120}
            defaultValue={synthetic ? "اختبار عميلة جديدة" : undefined}
            pattern={synthetic ? "اختبار .+" : undefined}
          />
          {synthetic && (
            <span className="text-[10px] leading-6">
              اسم شخصية مصطنعة يبدأ بكلمة اختبار، لا اسم عميل حقيقي.
            </span>
          )}
        </label>
        <label className="field">
          رقم الهاتف
          <input
            name="phone"
            type={synthetic ? "text" : "tel"}
            defaultValue={synthetic ? "TEST-001" : undefined}
            pattern={synthetic ? SYNTHETIC_PHONE_PATTERN : undefined}
            dir="ltr"
            required
            minLength={5}
            maxLength={24}
          />
        </label>
        <label className="field">
          الخروج المخطط
          <input name="starts_on" type="date" required min={minDay} />
        </label>
        <label className="field">
          العودة المخططة
          <input name="returns_on" type="date" required min={minDay} />
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
}: {
  bookingId: string;
  methods: string[];
  enabled: boolean;
  requestId: string;
  preview?: boolean;
  context?: "deposit" | "return_balance" | null;
  defaultAmount?: string;
}) {
  const [state, action, pending] = useActionState(
    recordRealPayment,
    {} as ActionState,
  );
  if (!context)
    return (
      <section className="studio-card space-y-4 p-6">
        <Feedback state={state} />
        <p className="text-xs leading-8 text-muted-foreground">
          لا توجد دفعة إضافية متاحة الآن. قبل عودة العميلة يُسجل المقدم الأول
          فقط؛ الباقي عند عودتها بالفستان. الحجز المغلق لا يقبل دفعات جديدة.
        </p>
      </section>
    );
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
