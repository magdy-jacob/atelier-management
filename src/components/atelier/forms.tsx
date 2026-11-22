"use client";
import { useActionState, useState } from "react";
import {
  signIn,
  createCategory,
  createDress,
  ActionState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
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
  return (
    <form action={action} className="space-y-4">
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
        <label className="field">
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
      <p className="text-xs leading-7 text-muted-foreground">
        يضاف الفستان بحالة غير متاح. بعد الحفظ، افتح صفحة إدارة الفستان لرفع
        الصور واستكمال بياناته.
      </p>
      <Feedback state={state} />
      <Button type="submit" disabled={pending || !categories.length}>
        {pending ? "جارٍ الحفظ…" : "إضافة فستان"}
      </Button>
    </form>
  );
}
