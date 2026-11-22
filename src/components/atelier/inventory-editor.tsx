"use client";
import Image from "next/image";
import { useActionState } from "react";
import { Archive, ImagePlus, Save, RotateCcw } from "lucide-react";
import {
  editDress,
  archiveDress,
  uploadDressImage,
  ActionState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
export type EditableDress = {
  id: string;
  version: number;
  name: string;
  code: string;
  color: string;
  size: string;
  category_id: string;
  public_availability: "available" | "reserved" | "unavailable";
  archived: boolean;
};
export type InventoryImage = { id: string; url: string; sort_order: number };
const initial: ActionState = {};
function Message({ state }: { state: ActionState }) {
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
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs leading-7 text-green-800"
        >
          {state.success}
        </p>
      )}
    </>
  );
}
export function InventoryEditor({
  dress,
  categories,
  images,
  preview = false,
  readOnly = false,
}: {
  dress: EditableDress;
  categories: { id: string; name: string }[];
  images: InventoryImage[];
  preview?: boolean;
  readOnly?: boolean;
}) {
  const [editState, editAction, editing] = useActionState(editDress, initial);
  const [archiveState, archiveAction, archiving] = useActionState(
    archiveDress,
    initial,
  );
  const [imageState, imageAction, uploading] = useActionState(
    uploadDressImage,
    initial,
  );
  return (
    <div className="grid items-start gap-7 lg:grid-cols-[1.3fr_1fr]">
      <section className="studio-card p-6 md:p-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg">بيانات الفستان</h2>
          <Badge variant="outline" className="text-[10px]">
            {dress.archived ? "مؤرشف" : "في المخزون"} · نسخة {dress.version}
          </Badge>
        </div>
        <form
          key={`edit-${dress.version}`}
          action={preview || readOnly ? undefined : editAction}
          onSubmit={preview || readOnly ? (e) => e.preventDefault() : undefined}
          className="space-y-5"
        >
          <input type="hidden" name="id" value={dress.id} />
          <input type="hidden" name="version" value={dress.version} />
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                ["name", "اسم الفستان", 120],
                ["code", "الكود الفريد", 40],
                ["color", "اللون", 60],
                ["size", "المقاس", 30],
              ] as const
            ).map(([key, label, max]) => (
              <label key={key} className="field">
                {label}
                <input
                  name={key}
                  defaultValue={dress[key]}
                  required
                  maxLength={max}
                  readOnly={readOnly}
                />
              </label>
            ))}
            <label className="field">
              التصنيف
              <select
                name="category_id"
                defaultValue={dress.category_id}
                required
                disabled={readOnly}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              حالة العرض العامة
              <select
                name="public_availability"
                defaultValue={dress.public_availability}
                required
                disabled={readOnly}
              >
                <option value="available">متاح</option>
                <option value="reserved">محجوز</option>
                <option value="unavailable">غير متاح</option>
              </select>
            </label>
          </div>
          <div className="rounded-xl bg-secondary p-4 text-[11px] leading-7 text-muted-foreground">
            حالة العرض يدوية في هذه المرحلة، ولا تثبت التوفر في موعد معين. السعر
            الاسترشادي لا يظهر هنا لحين اعتماد شكل تخزينه. التعديلات المتزامنة
            محمية برقم نسخة لمنع الكتابة فوق تعديل أحدث.
          </div>
          {!readOnly && (
            <>
              <Message state={editState} />
              <Button
                type="submit"
                disabled={editing || preview}
                className="h-11 px-5"
              >
                <Save size={16} />
                {preview
                  ? "معاينة فقط، الحفظ غير مفعل"
                  : editing
                    ? "جارٍ الحفظ…"
                    : "حفظ التعديلات"}
              </Button>
            </>
          )}
        </form>
        {!readOnly && (
          <section className="mt-9 border-t pt-7">
            <div className="mb-4 flex items-center gap-2">
              <Archive size={17} className="text-muted-foreground" />
              <h3 className="text-sm">
                {dress.archived ? "استعادة من الأرشيف" : "أرشفة الفستان"}
              </h3>
            </div>
            <p className="mb-5 text-xs leading-7 text-muted-foreground">
              الأرشفة تخفي الفستان من الكتالوج العام فقط. لا تلغي أي حجز ولا
              تمحو المدفوعات أو التاريخ. صور سبق نشر رابطها تظل قابلة للعرض
              برابطها المباشر.
            </p>
            <form
              key={`archive-${dress.version}`}
              action={preview ? undefined : archiveAction}
              onSubmit={preview ? (e) => e.preventDefault() : undefined}
              className="space-y-4"
            >
              <input name="id" type="hidden" value={dress.id} />
              <input name="version" type="hidden" value={dress.version} />
              <input
                name="archive"
                type="hidden"
                value={String(!dress.archived)}
              />
              <label className="flex items-start gap-3 text-xs leading-7">
                <input
                  name="confirm"
                  type="checkbox"
                  required
                  className="mt-2 size-4 accent-primary"
                />
                أؤكد{" "}
                {dress.archived
                  ? "إعادة عرض الفستان ضمن المخزون"
                  : "إخفاء الفستان من الكتالوج دون إلغاء حجوزاته"}
                .
              </label>
              <Message state={archiveState} />
              <Button
                type="submit"
                variant="outline"
                disabled={archiving || preview}
                className="h-10"
              >
                {dress.archived ? (
                  <RotateCcw size={15} />
                ) : (
                  <Archive size={15} />
                )}{" "}
                {archiving
                  ? "جارٍ التحديث…"
                  : dress.archived
                    ? "استعادة الفستان"
                    : "أرشفة الفستان"}
              </Button>
            </form>
          </section>
        )}
      </section>
      <section className="studio-card p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg">صور الفستان</h2>
          <span className="text-xs text-muted-foreground">
            {images.length} صور
          </span>
        </div>
        {images.length ? (
          <div className="mb-7 grid grid-cols-2 gap-3">
            {images.map((image, i) => (
              <div
                key={image.id}
                className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted"
              >
                <Image
                  src={image.url}
                  alt={`${dress.name}، صورة ${i + 1}`}
                  fill
                  sizes="(max-width:768px) 50vw, 23vw"
                  className="object-cover"
                />
                {i === 0 && (
                  <span className="absolute right-2 bottom-2 rounded-full bg-white/90 px-3 py-1 text-[9px]">
                    الصورة الرئيسية
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-7 flex min-h-56 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/40 text-muted-foreground">
            <ImagePlus size={32} strokeWidth={1} />
            <p className="text-xs">لم تُضف صور لهذا الفستان بعد</p>
          </div>
        )}
        {!readOnly && (
          <form
            action={preview ? undefined : imageAction}
            onSubmit={preview ? (e) => e.preventDefault() : undefined}
            className="space-y-5"
          >
            <input type="hidden" name="id" value={dress.id} />
            <label className="field">
              إضافة صورة
              <input
                name="image"
                aria-label="صورة الفستان"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                disabled={preview}
              />
            </label>
            <p className="text-[11px] leading-7 text-muted-foreground">
              صورة ثابتة JPEG أو PNG أو WebP، بحد أقصى ٥ ميجابايت و٤٠ مليون
              بكسل. نحولها إلى WebP ونزيل بياناتها الوصفية قبل الرفع. هذه صور
              كتالوج متاحة برابط مباشر، لا ترفع هوية أو بيانات شخصية.
            </p>
            <Message state={imageState} />
            <Button
              type="submit"
              disabled={uploading || preview}
              className="h-11 w-full"
            >
              <ImagePlus size={16} />
              {uploading
                ? "جارٍ معالجة ورفع الصورة…"
                : preview
                  ? "الرفع غير مفعل في المعاينة"
                  : "رفع الصورة"}
            </Button>
            <p className="text-[10px] leading-6 text-muted-foreground">
              تظهر الصور بترتيب إضافتها. حذف الصور وإعادة ترتيبها لم يُوصلا
              بالواجهة بعد.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
