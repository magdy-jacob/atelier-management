"use client";
import Image from "next/image";
import { ImageDeleteForm } from "./image-deletion";
import { useActionState, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { reorderDressImages, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { InventoryImage } from "./inventory-editor";
export function ImageOrdering({
  dressId,
  version,
  name,
  images,
  preview = false,
  readOnly = false,
  onSuccess,
  onChanged,
  onDeleteResult,
}: {
  dressId: string;
  version: number;
  name: string;
  images: InventoryImage[];
  preview?: boolean;
  readOnly?: boolean;
  onSuccess?: (message: string) => void;
  onChanged?: () => void;
  onDeleteResult?: (result: ActionState) => void;
}) {
  const [ordered, setOrdered] = useState(images);
  const [state, action, pending] = useActionState(
    async (previous: ActionState, form: FormData) => {
      try {
        const result = await reorderDressImages(previous, form);
        if (result.success) onSuccess?.(result.success);
        return result;
      } catch {
        return {
          error:
            "انقطع الاتصال قبل تأكيد النتيجة. حدّث الصفحة للتحقق من الترتيب المحفوظ قبل محاولة مختلفة.",
        };
      }
    },
    {} as ActionState,
  );
  const changed = ordered.some((image, i) => image.id !== images[i]?.id);
  const move = (index: number, delta: number) => {
    onChanged?.();
    setOrdered((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  };
  return (
    <div className="space-y-5">
      <p className="text-[11px] leading-7 text-muted-foreground">
        أول صورة هي الرئيسية في الكتالوج. التقديم والتأخير معاينة محلية حتى حفظ
        الترتيب. احفظ أي تعديل لبيانات الفستان أولًا؛ تغيير الصور يحدث نسخة
        البيانات.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {ordered.map((image, index) => (
          <article
            key={image.id}
            data-image-id={image.id}
            className="min-w-0 space-y-2"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
              <Image
                src={image.url}
                alt={`${name}، صورة ${index + 1}`}
                fill
                sizes="(max-width:768px) 50vw, 23vw"
                className="object-cover"
              />
              {index === 0 && (
                <span className="absolute right-2 bottom-2 rounded-full bg-white/90 px-3 py-1 text-[9px]">
                  {changed ? "الرئيسية بعد الحفظ" : "الصورة الرئيسية"}
                </span>
              )}
            </div>
            {!readOnly && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  aria-label={`تقديم الصورة ${index + 1}`}
                  type="button"
                  variant="outline"
                  className="h-10 px-2 text-[10px]"
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={13} />
                  تقديم
                </Button>
                <Button
                  aria-label={`تأخير الصورة ${index + 1}`}
                  type="button"
                  variant="outline"
                  className="h-10 px-2 text-[10px]"
                  disabled={pending || index === ordered.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={13} />
                  تأخير
                </Button>
              </div>
            )}
            {!readOnly && (
              <ImageDeleteForm
                dressId={dressId}
                imageId={image.id}
                version={version}
                preview={preview}
                disabled={changed || pending}
                onResult={onDeleteResult}
              />
            )}
          </article>
        ))}
      </div>
      {!readOnly && (
        <form
          action={preview ? undefined : action}
          onSubmit={preview ? (e) => e.preventDefault() : undefined}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={dressId} />
          <input type="hidden" name="version" value={version} />
          {ordered.map((i) => (
            <input key={i.id} type="hidden" name="image_ids" value={i.id} />
          ))}
          {changed && (
            <p
              aria-live="polite"
              className="rounded-xl bg-secondary p-3 text-xs leading-7"
            >
              ترتيب جديد غير محفوظ
              {preview
                ? "، المعاينة لا تغيّر الكتالوج"
                : ". احفظ لتحديث الكتالوج والصورة الرئيسية"}
              .
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
          {state.success && !onSuccess && (
            <p
              role="status"
              className="rounded-xl bg-secondary p-4 text-xs leading-7"
            >
              {state.success}
            </p>
          )}
          <Button
            type="submit"
            variant="outline"
            className="h-11 w-full"
            disabled={preview || pending || !changed}
          >
            {pending
              ? "جارٍ حفظ الترتيب…"
              : preview
                ? "حفظ الترتيب معطل في المعاينة"
                : "حفظ ترتيب الصور"}
          </Button>
        </form>
      )}
    </div>
  );
}
