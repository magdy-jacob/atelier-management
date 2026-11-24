"use client";
import { useActionState, useState } from "react";
import { manageCategory, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
export type CategoryRow = {
  id: string;
  name: string;
  version: number;
  dressCount: number;
};
function CategoryItem({
  category: c,
  preview,
  onSuccess,
}: {
  category: CategoryRow;
  preview: boolean;
  onSuccess: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(
    async (previous: ActionState, form: FormData) => {
      let result: ActionState;
      try {
        result = await manageCategory(previous, form);
      } catch {
        return {
          error:
            "انقطع الاتصال قبل تأكيد النتيجة. راجع التصنيف وسجل النشاط قبل إعادة المحاولة.",
        };
      }
      if (result.success) onSuccess(result.success);
      return result;
    },
    {} as ActionState,
  );
  return (
    <article className="studio-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base">{c.name}</h2>
        <p className="text-xs text-muted-foreground">
          {c.dressCount.toLocaleString("ar-EG")} فستان مرتبط، يشمل المؤرشف
        </p>
      </div>
      <form
        key={c.version}
        action={preview ? undefined : action}
        onSubmit={preview ? (e) => e.preventDefault() : undefined}
        className="space-y-4"
      >
        <input type="hidden" name="id" value={c.id} />
        <input type="hidden" name="version" value={c.version} />
        <label className="field">
          اسم التصنيف
          <input
            name="name"
            defaultValue={c.name}
            maxLength={80}
            required
            disabled={pending}
          />
        </label>
        <Button
          type="submit"
          name="intent"
          value="rename"
          disabled={pending || preview}
        >
          {pending ? "جارٍ الحفظ…" : "حفظ اسم التصنيف"}
        </Button>
        <details className="border-t pt-4">
          <summary className="cursor-pointer text-xs text-red-800">
            حذف تصنيف غير مستخدم
          </summary>
          <p className="my-4 text-xs leading-7 text-muted-foreground">
            لا يُحذف تصنيف مرتبط بأي فستان، حتى المؤرشف. حذف التصنيف لا يحذف
            فساتين أو حجوزات. لن تتغير سياسة العرض أو حالة التوفر.
          </p>
          <label className="flex items-start gap-3 text-xs leading-7">
            <input
              type="checkbox"
              name="confirm_delete"
              className="mt-2 size-4 accent-red-800"
              disabled={pending || c.dressCount > 0}
            />
            أؤكد حذف هذا التصنيف غير المستخدم نهائيًا.
          </label>
          <Button
            type="submit"
            name="intent"
            value="delete"
            variant="outline"
            className="mt-4 text-red-800"
            disabled={pending || preview || c.dressCount > 0}
          >
            حذف التصنيف غير المستخدم
          </Button>
          {c.dressCount > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              الحذف محظور لوجود فساتين مرتبطة.
            </p>
          )}
        </details>
      </form>
      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-xs leading-7 text-red-800"
        >
          {state.error}
        </p>
      )}
    </article>
  );
}
export function CategoryManager({
  categories,
  preview = false,
}: {
  categories: CategoryRow[];
  preview?: boolean;
}) {
  const [success, setSuccess] = useState("");
  return (
    <div className="space-y-5">
      {success && (
        <p
          role="status"
          className="rounded-xl bg-pink-50 p-4 text-xs leading-7 text-pink-900"
        >
          {success}
        </p>
      )}
      <div className="grid items-start gap-5 md:grid-cols-2">
        {categories.length ? (
          categories.map((c) => (
            <CategoryItem
              key={c.id}
              category={c}
              preview={preview}
              onSuccess={setSuccess}
            />
          ))
        ) : (
          <p className="studio-card p-6 text-sm">
            لا توجد تصنيفات. أضف أول تصنيف لربطه بالفساتين.
          </p>
        )}
      </div>
    </div>
  );
}
