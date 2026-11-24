"use client";
import { useActionState, useState, useEffect, useRef } from "react";
import {
  signIn,
  createCategory,
  createDress,
  ActionState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ImagePlus } from "lucide-react";
const initial: ActionState = {};
function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-xs leading-7 text-red-800"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-lg bg-pink-50 p-3 text-xs leading-7 text-pink-800"
        >
          {state.success}
        </p>
      )}
    </>
  );
}
export function LoginForm({ ready }: { ready: boolean }) {
  const [state, action, pending] = useActionState(signIn, initial);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={action} className="space-y-5">
      <label className="field">
        البريد الإلكتروني
        <input
          name="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label className="field">
        كلمة المرور
        <div className="relative">
        <input className="!pl-12 w-full"
          name="password"
          type={showPassword ? "text" : "password"}
          dir="ltr"
          autoComplete="current-password"
          required
          maxLength={256}
        />
        <button type="button" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary">
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button></div>
      </label>
      <Feedback state={state} />
      <Button
        className="h-11 w-full"
        type="submit"
        disabled={pending || !ready}
      >
        {pending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
      </Button>
    </form>
  );
}
export function CategoryForm({ preview = false }: { preview?: boolean } = {}) {
  const [state, action, pending] = useActionState(createCategory, initial);
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      className="space-y-4"
    >
      <label className="field">
        اسم التصنيف
        <input name="name" maxLength={80} required />
      </label>
      <Feedback state={state} />
      <Button type="submit" disabled={pending || preview}>
        {pending ? "جارٍ الحفظ…" : "إضافة تصنيف"}
      </Button>
    </form>
  );
}
export function DressForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createDress, initial);
  const [selectedCount, setSelectedCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setSelectedCount(0);
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["name", "اسم الفستان"],
          ["code", "الكود الفريد"],
          ["color", "اللون"],
          ["size", "المقاس"],
        ].map(([name, label]) => (
          <label className="field" key={name}>
            {label}
            <input
              name={name}
              required
              maxLength={
                name === "name"
                  ? 120
                  : name === "code"
                    ? 40
                    : name === "color"
                      ? 60
                      : 30
              }
            />
          </label>
        ))}
        <label className="field sm:col-span-2">
          التصنيف
          <select name="category_id" required defaultValue="">
            <option disabled value="">
              اختر تصنيفًا
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-foreground">
          نطاق السعر الاسترشادي (اختياري)
        </h3>
        <p className="text-[11px] leading-5 text-muted-foreground">
          حدد الحد الأدنى والأقصى لسعر التأجير بالجنيه، أو يمكنك تعيينه لاحقًا.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            السعر من (جنيه)
            <input
              name="minimum"
              type="number"
              min="0"
              step="0.01"
              max="99999999.99"
              dir="ltr"
              placeholder="مثال: 500"
            />
          </label>
          <label className="field">
            السعر إلى (جنيه)
            <input
              name="maximum"
              type="number"
              min="0"
              step="0.01"
              max="99999999.99"
              dir="ltr"
              placeholder="مثال: 1500"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ImagePlus size={16} className="text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground">
            صور الفستان (اختياري - يمكنك رفع أكثر من صورة)
          </h3>
        </div>
        <label className="field">
          <span>اختر الصور</span>
          <input
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setSelectedCount(e.target.files?.length ?? 0)}
          />
        </label>
        {selectedCount > 0 && (
          <p className="text-xs font-medium text-primary">
            تم اختيار {selectedCount} {selectedCount === 1 ? "صورة" : selectedCount === 2 ? "صورتين" : "صور"} للرفع مع الفستان.
          </p>
        )}
        <p className="text-[11px] leading-5 text-muted-foreground">
          يمكنك تحديد صورة أو عدة صور معًا بصيغة JPEG أو PNG أو WebP (بحد أقصى ٥ ميجابايت للصورة). يتم ضغط الصور تلقائيًا وتحويلها إلى WebP.
        </p>
      </div>

      <p className="text-xs leading-6 text-muted-foreground">
        يضاف الفستان بحالة غير متاح لحين استكمال صوره وتجهيزه للعرض.
      </p>
      <Feedback state={state} />
      <Button type="submit" disabled={pending || !categories.length} className="h-11">
        {pending
          ? "جارٍ حفظ الفستان ورفع الصور…"
          : selectedCount > 1
            ? `إضافة فستان مع ${selectedCount} صور`
            : "إضافة فستان"}
      </Button>
    </form>
  );
}
