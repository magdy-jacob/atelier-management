"use client";
import { useActionState, useRef, useState } from "react";
import {
  deleteDressImage,
  retryImageCleanup,
  type ActionState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
function useDeletionAction(
  run: (previous: ActionState, form: FormData) => Promise<ActionState>,
  onResult?: (result: ActionState) => void,
) {
  const request = useRef<string | null>(null);
  return useActionState(async (previous: ActionState, form: FormData) => {
    request.current ??= crypto.randomUUID();
    form.set("request_id", request.current);
    let result: ActionState;
    try {
      result = await run(previous, form);
    } catch {
      result = {
        error:
          "انقطع الاتصال قبل تأكيد الحذف. حدّث الصفحة: الصورة قد تكون أُزيلت، وأي تنظيف معلق سيظهر للأدمن. لا تؤكد حذف صورة أخرى بدلًا منها.",
      };
    }
    if (result.success) request.current = null;
    onResult?.(result);
    return result;
  }, {} as ActionState);
}
function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-xs leading-7 text-red-900"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-3 text-xs leading-7"
        >
          {state.success}
        </p>
      )}
    </>
  );
}
export function ImageDeleteForm({
  dressId,
  imageId,
  version,
  preview = false,
  disabled = false,
  onResult,
}: {
  dressId: string;
  imageId: string;
  version: number;
  preview?: boolean;
  disabled?: boolean;
  onResult?: (result: ActionState) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useDeletionAction(
    deleteDressImage,
    onResult,
  );
  return (
    <details className="rounded-xl border border-red-100 p-3 text-[11px]">
      <summary className="cursor-pointer text-red-800">حذف هذه الصورة</summary>
      <form
        action={preview ? undefined : action}
        onSubmit={preview ? (e) => e.preventDefault() : undefined}
        className="mt-4 space-y-4"
      >
        <input type="hidden" name="id" value={dressId} />
        <input type="hidden" name="image_id" value={imageId} />
        <input type="hidden" name="version" value={version} />
        <p className="leading-6 text-muted-foreground">
          تُزال الصورة من الكتالوج أولًا، ثم يُتحقق من مسح ملفها. إذا تعذر المسح
          يبقى طلب تنظيف ظاهر للأدمن. قد تبقى نسخة مخبأة من رابط قديم مؤقتًا. لا
          استعادة تلقائية.
        </p>
        {disabled && (
          <p className="leading-6">احفظ ترتيب الصور أولًا قبل الحذف.</p>
        )}
        <label className="flex items-start gap-2 leading-6">
          <input
            className="mt-1 accent-primary"
            type="checkbox"
            name="confirm"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={pending || disabled}
            required
          />
          أؤكد حذف هذه الصورة وملفها، وليس الفستان أو حجوزاته.
        </label>
        {!onResult && <Feedback state={state} />}
        <Button
          type="submit"
          variant="outline"
          className="h-auto min-h-10 w-full whitespace-normal border-red-200 px-2 py-2 text-[10px] text-red-800"
          disabled={preview || pending || !confirmed || disabled}
        >
          {pending
            ? "جارٍ التحقق…"
            : preview
              ? "الحذف معطل في المعاينة"
              : "تأكيد حذف الصورة"}
        </Button>
      </form>
    </details>
  );
}
export type CleanupJob = { id: string; dress_id: string; created_at: string };
export function ImageCleanupJobs({
  jobs,
  preview = false,
  onResult,
}: {
  jobs: CleanupJob[];
  preview?: boolean;
  onResult?: (result: ActionState) => void;
}) {
  const [state, action, pending] = useDeletionAction(
    retryImageCleanup,
    onResult,
  );
  if (!jobs.length) return null;
  return (
    <section className="mt-6 space-y-4 rounded-xl border border-red-200 bg-red-50/40 p-4">
      <h3 className="text-sm">تنظيف ملفات معلق ({jobs.length})</h3>
      <p className="text-xs leading-7">
        هذه الصور لم تعد في الكتالوج، لكن مسح ملفاتها لم يُؤكد. لا نعرض نجاح
        الحذف الكامل قبل التحقق. أعد محاولة التنظيف، دون حذف صورة أخرى.
      </p>
      {jobs.map((job) => (
        <form
          key={job.id}
          action={preview ? undefined : action}
          onSubmit={preview ? (e) => e.preventDefault() : undefined}
        >
          <input type="hidden" name="job_id" value={job.id} />
          <Button
            type="submit"
            variant="outline"
            className="h-auto min-h-10 whitespace-normal text-xs"
            disabled={preview || pending}
          >
            {pending
              ? "جارٍ التحقق من الملف…"
              : preview
                ? "إعادة التنظيف معطلة في المعاينة"
                : "إعادة محاولة تنظيف الملف"}
          </Button>
        </form>
      ))}
      {!onResult && <Feedback state={state} />}
    </section>
  );
}
