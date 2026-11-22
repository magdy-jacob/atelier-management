"use client";
import { useActionState, useRef } from "react";
import { createPortfolioScenario, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
export function PortfolioScenarioForm({
  enabled,
  staff,
  preview = false,
}: {
  enabled: boolean;
  staff: { id: string; full_name: string }[];
  preview?: boolean;
}) {
  const request = useRef<string | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: ActionState, form: FormData) => {
      request.current ??= crypto.randomUUID();
      form.set("request_id", request.current);
      try {
        const result = await createPortfolioScenario(previous, form);
        if (result.success) request.current = null;
        return result;
      } catch {
        return {
          error:
            "تعذر تأكيد النتيجة. أعد نفس المحاولة دون تغيير القيم، أو راجع الحجوزات قبل إنشاء سيناريو آخر.",
        };
      }
    },
    {} as ActionState,
  );
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      className="studio-card space-y-5 p-6 md:p-8"
    >
      <h2 className="text-lg">جهّز تجربة اليوم</h2>
      <p className="max-w-3xl text-xs leading-8 text-muted-foreground">
        ينشئ فستانًا وعميلة وحجزًا منفصلين، كلهم مصطنعون. السعر ١٠٠ جنيه تجريبي،
        بلا تحصيل حقيقي. التواريخ والسجلات السابقة في السيناريو مصطنعة للشرح،
        وليست عمليات حدثت فعلًا. لا يغيّر بيانات المراجعة الأصلية أو يسمح بالحجز
        العادي في نفس اليوم.
      </p>
      {preview && (
        <p className="rounded-xl bg-secondary p-4 text-xs leading-7">
          معاينة تصميم فقط. إنشاء السيناريوهات المحفوظة متاح من حساب الأدمن في
          مساحة العمل الفعلية.
        </p>
      )}
      {!enabled && !preview && (
        <p
          role="alert"
          className="rounded-xl bg-secondary p-4 text-xs leading-7"
        >
          إعداد الاختبار الوظيفي لم يكتمل. يلزم تطابق إعداد التطبيق والقاعدة قبل
          إنشاء أي بيانات.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field">
          السيناريو
          <select name="kind" defaultValue="handover" disabled={pending}>
            <option value="handover">تسليم اليوم بمقدم ٢٥ جنيهًا</option>
            <option value="return">عودة اليوم، الرصيد مسدد بالكامل</option>
            <option value="overdue">
              متأخر، لتجربة الإشعار والغرامة الاختيارية
            </option>
          </select>
        </label>
        <label className="field">
          إسناد الحجز
          <select name="assigned_to" defaultValue="" disabled={pending}>
            <option value="">لحسابي</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-start gap-3 text-xs leading-7">
        <input
          type="checkbox"
          name="confirm"
          required
          disabled={pending}
          className="mt-1 accent-primary"
        />
        أفهم أن هذا ينشئ بيانات محفوظة وهمية، ولا يسجل مالًا أو ضمانًا حقيقيًا.
      </label>
      <Button disabled={pending || !enabled || preview} type="submit">
        {pending ? "جارٍ التجهيز..." : "إنشاء سيناريو مصطنع"}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs leading-7 text-red-800">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-xs leading-7 text-primary">
          {state.success}
        </p>
      )}
    </form>
  );
}
