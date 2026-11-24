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
  const [settleRemaining, setSettleRemaining] = useState(false);
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

      <div
        className={`rounded-xl border p-4 text-xs leading-7 ${settled ? "bg-secondary" : "border-amber-200 bg-amber-50/80 text-amber-950"}`}
      >
        <p className="font-semibold text-sm">
          المتبقي حسب السجل:{" "}
          {BigInt(remaining) >= BigInt(0)
            ? aggregateMoney(remaining)
            : "خطأ في تسوية السجل، راجع الأدمن"}
          {BigInt(remaining) > BigInt(0) ? " (شامل أي غرامة مسجلة)" : ""}.
        </p>
        {!settled && BigInt(remaining) > BigInt(0) && (
          <label className="mt-3 flex items-start gap-3 cursor-pointer pt-2 border-t border-amber-200/80">
            <input
              type="checkbox"
              name="settle_remaining"
              className="mt-1 size-4 accent-primary"
              checked={settleRemaining}
              onChange={(e) => setSettleRemaining(e.target.checked)}
            />
            <span className="leading-6">
              استلمت كامل المبلغ المتبقي الآن (<strong>{aggregateMoney(remaining)}</strong> نقداً أو بالتحويل)، وسجّله كدفعة نهائية تلقائياً مع تأكيد العودة.
            </span>
          </label>
        )}
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
            (!settled && !settleRemaining) ||
            pending ||
            (inspection === "maintenance" && issues.length === 0)
          }
        >
          {pending
            ? "جارٍ تأكيد العودة…"
            : !settled && settleRemaining
              ? `سداد المتبقي (${aggregateMoney(remaining)}) وتأكيد العودة`
              : "تأكيد العودة والفحص ورد الضمان"}
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
      {!enabled && (
        <p className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-xs leading-7">
          الحفظ غير متاح في هذه الصفحة أو قبل اكتمال إعداد الخدمة. الحقول
          للمراجعة فقط.
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
      {status === "returned" ? (
        preview ? (
          <>
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
            {data.return &&
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
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-emerald-900">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
              ✓
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                تمت عودة الفستان
              </p>
              <p className="text-xs text-emerald-800/80 mt-0.5">
                تم استلام الفستان من العميل ورد الضمان، والعملية مكتملة بنجاح.
              </p>
            </div>
          </div>
        )
      ) : (
        <>
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
          )}
          {status === "out" && (
            <ReturnForm
              bookingId={bookingId}
              enabled={enabled && operationalAccess}
              remaining={remaining}
              today={data.today}
              preview={preview}
              onSuccess={setSuccess}
            />
          )}
        </>
      )}
    </section>
  );
}
