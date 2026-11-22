"use client";
import { useActionState, useRef, useState } from "react";
import {
  recordBookingHandover,
  recordBookingReturn,
  confirmDressReady,
  type ActionState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { formatDay, addDays } from "@/lib/domain";
import { aggregateMoney } from "@/lib/admin-dashboard";
import {
  handoverInPlannedDays,
  inspectionIssues,
  inspectionLabels,
  type WorkflowData,
} from "@/lib/workflow";
type Action = (previous: ActionState, form: FormData) => Promise<ActionState>;
function useWorkflowAction(run: Action, onSuccess: (s: string) => void) {
  const request = useRef<string | null>(null);
  return useActionState(async (previous: ActionState, form: FormData) => {
    request.current ??= crypto.randomUUID();
    form.set("request_id", request.current);
    let result: ActionState;
    try {
      result = await run(previous, form);
    } catch {
      return {
        error:
          "انقطع الاتصال قبل تأكيد النتيجة. راجع سجل الحجز ثم أعد نفس المحاولة دون تغيير القيم، ولا تنشئ طلبًا آخر قبل التحقق.",
      };
    }
    if (result.success) {
      request.current = null;
      onSuccess(result.success);
    }
    return result;
  }, {} as ActionState);
}
function Feedback({ state }: { state: ActionState }) {
  return state.error ? (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-7 text-red-900"
    >
      {state.error}
    </p>
  ) : null;
}
function HandoverForm({
  bookingId,
  enabled,
  today,
  inDays,
  hasDeposit,
  preview,
  onSuccess,
}: {
  bookingId: string;
  enabled: boolean;
  today: string;
  inDays: boolean;
  hasDeposit: boolean;
  preview: boolean;
  onSuccess: (s: string) => void;
}) {
  const [card, setCard] = useState(false),
    [ready, setReady] = useState(false);
  const [state, action, pending] = useWorkflowAction(
    recordBookingHandover,
    onSuccess,
  );
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      className="space-y-5"
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="expected_day" value={today} />
      <h3 className="text-base">تسليم الفستان للعميل</h3>
      <p className="text-xs leading-7 text-muted-foreground">
        يكفي مقدم مستلم ومسجل، وليس كامل الرصيد. يُسجّل الخروج في يوم مصر الحالي:{" "}
        {formatDay(today)}، داخل أيام الحجز المخططة.
      </p>
      {!hasDeposit && (
        <p className="rounded-xl bg-secondary p-4 text-xs leading-7">
          سجّل المقدم المستلم أولًا من نموذج الدفعات. لا يوجد حد مالي مفترض
          للمقدم.
        </p>
      )}
      {!inDays && (
        <p className="rounded-xl bg-secondary p-4 text-xs leading-7">
          اليوم خارج أيام هذا الحجز. راجع الموعد مع الأدمن، دون تغيير أو تمديد
          تلقائي.
        </p>
      )}
      <fieldset disabled={pending} className="space-y-4 text-xs leading-7">
        <label className="flex items-start gap-3">
          <input
            className="mt-2 size-4 accent-primary"
            type="checkbox"
            name="card_received"
            checked={card}
            onChange={(e) => setCard(e.target.checked)}
            required
          />
          استلمت البطاقة كضمان. أسجّل الحالة فقط، دون رقم أو صورة.
        </label>
        <label className="flex items-start gap-3">
          <input
            className="mt-2 size-4 accent-primary"
            type="checkbox"
            name="ready"
            checked={ready}
            onChange={(e) => setReady(e.target.checked)}
            required
          />
          راجعت الحجز وأؤكد جاهزية الفستان الفعلية وتسليمه اليوم. أي تنبيه تعارض
          يُراجع مع الأدمن ولا يغيّر الحجز تلقائيًا.
        </label>
        <Feedback state={state} />
        <Button
          type="submit"
          disabled={preview || !enabled || !inDays || !hasDeposit || pending}
        >
          {pending ? "جارٍ تأكيد التسليم…" : "تأكيد خروج الفستان"}
        </Button>
      </fieldset>
    </form>
  );
}
function ReturnForm({
  bookingId,
  enabled,
  remaining,
  today,
  preview,
  onSuccess,
}: {
  bookingId: string;
  enabled: boolean;
  remaining: string;
  today: string;
  preview: boolean;
  onSuccess: (s: string) => void;
}) {
  const [inspection, setInspection] = useState<"sound" | "maintenance">(
    "sound",
  );
  const [issues, setIssues] = useState<string[]>([]);
  const [card, setCard] = useState(false);
  const [state, action, pending] = useWorkflowAction(
    recordBookingReturn,
    onSuccess,
  );
  const settled = BigInt(remaining) === BigInt(0);
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      className="space-y-5"
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="expected_day" value={today} />
      <h3 className="text-base">استلام الفستان من العميل وفحصه</h3>
      <p className="text-xs leading-7 text-muted-foreground">
        يُسجّل يوم الاستلام الحالي {formatDay(today)} دون تغيير الموعد المخطط. لا
        صور للفحص، ولا أوامر إصلاح أو تقدير تكلفة.
      </p>
      <div
        className={`rounded-xl border p-4 text-xs leading-7 ${settled ? "bg-secondary" : "border-red-200 bg-red-50 text-red-900"}`}
      >
        المتبقي حسب السجل:{" "}
        {BigInt(remaining) >= BigInt(0)
          ? aggregateMoney(remaining)
          : "خطأ في تسوية السجل، راجع الأدمن"}
        .{" "}
        {!settled &&
          "لا يمكن إتمام العودة أو إغلاقها قبل تسجيل سداد المتبقي كله، بما فيه أي غرامة أضافها الأدمن."}
      </div>
      <fieldset disabled={pending} className="space-y-5">
        <label className="field">
          نتيجة فحص العودة
          <select
            name="inspection"
            value={inspection}
            onChange={(e) => {
              setInspection(e.target.value as "sound" | "maintenance");
              setIssues([]);
            }}
          >
            <option value="sound">سليم</option>
            <option value="maintenance">يحتاج صيانة</option>
          </select>
        </label>
        {inspection === "maintenance" && (
          <fieldset className="rounded-xl border bg-white p-4">
            <legend className="px-2 text-xs">
              أنواع الصيانة، يمكن اختيار أكثر من نوع
            </legend>
            <div className="grid grid-cols-2 gap-4">
              {inspectionIssues.map((issue) => (
                <label key={issue} className="flex items-center gap-3 text-xs">
                  <input
                    type="checkbox"
                    name="issues"
                    value={issue}
                    checked={issues.includes(issue)}
                    onChange={(e) =>
                      setIssues((current) =>
                        e.target.checked
                          ? [...current, issue]
                          : current.filter((i) => i !== issue),
                      )
                    }
                    className="size-4 accent-primary"
                  />
                  {inspectionLabels[issue]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex items-start gap-3 text-xs leading-7">
          <input
            type="checkbox"
            name="card_released"
            className="mt-2 size-4 accent-primary"
            checked={card}
            onChange={(e) => setCard(e.target.checked)}
            required
          />
          أؤكد استلام الفستان وفحصه اليوم ورد البطاقة للعميل. لا أسجّل رقم
          البطاقة أو صورتها.
        </label>
        <Feedback state={state} />
        <Button
          type="submit"
          disabled={
            preview ||
            !enabled ||
            !settled ||
            pending ||
            (inspection === "maintenance" && issues.length === 0)
          }
        >
          {pending ? "جارٍ تأكيد العودة…" : "تأكيد العودة والفحص ورد الضمان"}
        </Button>
      </fieldset>
    </form>
  );
}
function ReadyForm({
  bookingId,
  dressId,
  enabled,
  today,
  readyOn,
  preview,
  onSuccess,
}: {
  bookingId: string;
  dressId: string;
  enabled: boolean;
  today: string;
  readyOn: string | null;
  preview: boolean;
  onSuccess: (s: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [state, action, pending] = useWorkflowAction(
    confirmDressReady,
    onSuccess,
  );
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      className="mt-6 space-y-4 border-t pt-5"
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="dress_id" value={dressId} />
      <label className="flex items-start gap-3 text-xs leading-7">
        <input
          type="checkbox"
          name="ready"
          className="mt-2 size-4 accent-primary"
          checked={ready}
          onChange={(e) => setReady(e.target.checked)}
          disabled={pending}
          required
        />
        اكتمل التجهيز وأي صيانة لازمة، والفستان جاهز داخل الأتيليه.
      </label>
      <Feedback state={state} />
      <Button
        type="submit"
        variant="outline"
        disabled={
          preview || !enabled || pending || !!(readyOn && today < readyOn)
        }
      >
        {pending ? "جارٍ تحديث الجاهزية…" : "تأكيد اكتمال التجهيز"}
      </Button>
    </form>
  );
}
export function BookingWorkflow({
  bookingId,
  dressId,
  status,
  startsOn,
  returnsOn,
  paid,
  remaining,
  data,
  enabled,
  operationalAccess = true,
  admin = false,
  preview = false,
}: {
  bookingId: string;
  dressId: string;
  status: string;
  startsOn: string;
  returnsOn: string;
  paid: string;
  remaining: string;
  data: WorkflowData;
  enabled: boolean;
  operationalAccess?: boolean;
  admin?: boolean;
  preview?: boolean;
}) {
  const [success, setSuccess] = useState("");
  const maintenanceHeld =
    data.maintenance_required || data.operation === "maintenance";
  const operationLabels: Record<string, string> = {
    outside: "خارج الأتيليه حسب السجل",
    in_atelier: "جاهز داخل الأتيليه",
    preparation: "في التجهيز",
    maintenance: "يحتاج صيانة",
  };
  return (
    <section className="studio-card space-y-6 p-6 md:p-8">
      <h2 className="text-lg">التسليم والعودة والضمان</h2>
      <p className="text-xs leading-7 text-muted-foreground">
        ضمان بالحالة فقط. لا رقم أو صورة بطاقة، ولا مرفقات. اليوم حسب مصر{" "}
        {formatDay(data.today)}.
      </p>
      {!operationalAccess && (
        <p className="rounded-xl border bg-secondary p-4 text-xs leading-8">
          يمكنك مشاهدة هذا الحجز وتسجيل المقدم أو الباقي المستلم. التسليم
          والعودة وتأكيد التجهيز للحجز الذي أنشأته أو أُسند إليك، أو للأدمن.
        </p>
      )}
      {!enabled && (
        <p className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-xs leading-7">
          الحفظ غير متاح في المعاينة أو قبل اكتمال إعداد الاختبار الوظيفي.
          الحقول للمراجعة فقط.
        </p>
      )}
      {success && (
        <p
          role="status"
          className="rounded-xl border border-primary/20 bg-secondary p-4 text-xs leading-7 text-primary"
        >
          {success}
        </p>
      )}
      <div className="grid gap-4 text-xs leading-7 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-2 text-muted-foreground">التسليم واستلام الضمان</p>
          {data.handover ? (
            <p>
              خروج مسجل {formatDay(data.handover.handed_over_on)}. استلام الضمان
              مؤكد بالحالة فقط.
            </p>
          ) : (
            <p>
              لا يوجد سجل تسليم من هذه النسخة. لا تُفترض حالة استلام الضمان من
              حالة الحجز وحدها.
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-2 text-muted-foreground">العودة ورد الضمان</p>
          {data.return ? (
            <>
              <p>
                استلام مسجل {formatDay(data.return.returned_on)}. رد الضمان
                مؤكد. الفحص:{" "}
                {data.return.inspection === "sound" ? "سليم" : "يحتاج صيانة"}.
              </p>
              {data.return.issues.length > 0 && (
                <p>
                  {data.return.issues
                    .map(
                      (i) =>
                        inspectionLabels[i as keyof typeof inspectionLabels],
                    )
                    .join("، ")}
                </p>
              )}
              <p>
                يوم التجهيز الكامل:{" "}
                {formatDay(addDays(data.return.returned_on, 1))}.
              </p>
            </>
          ) : (
            <p>العودة ورد الضمان لم يُسجّلا بعد.</p>
          )}
        </div>
      </div>
      <p className="text-xs leading-7">
        حالة الفستان الحالية:{" "}
        {data.operation
          ? (operationLabels[data.operation] ?? data.operation)
          : "لم تُسجّل حالة تشغيل بعد"}
        .{" "}
        {data.ready_on && (
          <>أول يوم بعد التجهيز المسجل: {formatDay(data.ready_on)}.</>
        )}
      </p>
      {maintenanceHeld && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-8 text-red-900">
          الفستان يحتاج صيانة مسجلة. الأدمن وحده يؤكد انتهاء الصيانة ويعيد
          الجاهزية بعد يوم التجهيز. لا حجز جديد أو تغيير موعد أو تسليم قبل ذلك،
          ولا تمسح عودة سليمة لاحقة هذا الشرط.
        </p>
      )}
      {status === "confirmed" && (
        <HandoverForm
          bookingId={bookingId}
          enabled={enabled && operationalAccess && !maintenanceHeld}
          today={data.today}
          inDays={handoverInPlannedDays(data.today, startsOn, returnsOn)}
          hasDeposit={BigInt(paid) > BigInt(0)}
          preview={preview}
          onSuccess={setSuccess}
        />
      )}{" "}
      {status === "out" && (
        <ReturnForm
          bookingId={bookingId}
          enabled={enabled && operationalAccess}
          remaining={remaining}
          today={data.today}
          preview={preview}
          onSuccess={setSuccess}
        />
      )}{" "}
      {status === "returned" &&
        data.return &&
        (data.operation !== "in_atelier" || maintenanceHeld) && (
          <ReadyForm
            bookingId={bookingId}
            dressId={dressId}
            enabled={
              enabled && operationalAccess && (!maintenanceHeld || admin)
            }
            today={data.today}
            readyOn={data.ready_on}
            preview={preview}
            onSuccess={setSuccess}
          />
        )}
      <p className="border-t pt-5 text-xs leading-7 text-muted-foreground">
        تنبيه التعارض للأدمن مهم لكنه لا يفرض حظر تسليم آليًا، ولا يلغي أو يحرك
        حجزًا. الصيانة المسجلة شرط مستقل لا يرفعه إلا الأدمن. إنشاء حجز جديد يظل
        ملتزمًا بيوم التجهيز الكامل بعد يوم الاستلام المسجل.
      </p>
    </section>
  );
}
