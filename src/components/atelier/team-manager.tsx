"use client";

import { useActionState, useRef, useState } from "react";
import {
  createEmployeeAccount,
  updateStaffAccount,
  toggleStaffActive,
  deleteStaffAccount,
  type StaffActionState,
} from "@/app/staff-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Pencil,
  Trash2,
  Shield,
  User,
  KeyRound,
  Mail,
  UserX,
  UserCheck,
} from "lucide-react";

export type TeamProfile = {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
  version: number;
};

export type TeamJob = {
  id: string;
  request_id: string;
  actor_id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string;
};

export type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "employee";
  active: boolean;
  version: number;
  assigned_password?: string | null;
};

type Feedback = (state: StaffActionState) => void;

function CopyButton({ text, label = "نسخ" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors"
      title={label}
    >
      {copied ? (
        <>
          <Check size={12} className="text-emerald-600" />
          <span className="text-emerald-600 font-medium">تم النسخ</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

function PasswordDisplay({ password }: { password?: string | null }) {
  const [show, setShow] = useState(false);

  if (!password) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        ••••••••{" "}
        <span className="text-[10px] text-muted-foreground/80 font-sans">
          (مسجلة مسبقًا - يمكن تعيين كلمة جديدة من زر التعديل)
        </span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        dir="ltr"
        className="font-mono text-xs font-semibold text-slate-800"
      >
        {show ? password : "•".repeat(Math.min(password.length, 14))}
      </span>
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <CopyButton text={password} label="نسخ الكلمة" />
    </div>
  );
}

function NewStaffAccount({
  enabled,
  preview,
  onFeedback,
}: {
  enabled: boolean;
  preview: boolean;
  onFeedback: Feedback;
}) {
  const request = useRef<string | null>(null);
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [, action, pending] = useActionState(
    async (previous: StaffActionState, form: FormData) => {
      request.current ??= crypto.randomUUID();
      form.set("request_id", request.current);
      form.set("role", role);
      try {
        const result = await createEmployeeAccount(previous, form);
        onFeedback(result);
        if (result.success) {
          setPassword("");
          request.current = null;
        }
        return result;
      } catch (err) {
        const result = {
          error: "تعذر إنشاء الحساب حاليًا. تأكد من صحة البيانات وأعد المحاولة.",
        };
        onFeedback(result);
        return result;
      }
    },
    {},
  );

  return (
    <section className="studio-card space-y-6 p-6 md:p-8">
      <div>
        <h2 className="text-lg font-semibold">إضافة عضو جديد إلى الفريق</h2>
        <p className="mt-1 text-xs leading-7 text-muted-foreground">
          يمكنك إنشاء حساب بصلاحيات موظف تشغيلية أو بصلاحيات أدمن كاملة لإدارة
          الأتيليه.
        </p>
      </div>

      <form
        action={preview ? undefined : action}
        onSubmit={preview ? (e) => e.preventDefault() : undefined}
        className="space-y-5"
      >
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">
            نوع الصلاحية
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRole("employee")}
              className={`flex items-start gap-3 rounded-xl border p-4 text-right transition-all ${
                role === "employee"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <User
                size={18}
                className={
                  role === "employee"
                    ? "text-primary mt-0.5"
                    : "text-muted-foreground mt-0.5"
                }
              />
              <div>
                <p className="text-xs font-semibold">موظف (صلاحيات تشغيلية)</p>
                <p className="text-[11px] text-muted-foreground leading-5 mt-0.5">
                  تسليم واستلام الفساتين، تسجيل المدفوعات، وإدارة العمليات
                  اليومية.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex items-start gap-3 rounded-xl border p-4 text-right transition-all ${
                role === "admin"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <Shield
                size={18}
                className={
                  role === "admin"
                    ? "text-primary mt-0.5"
                    : "text-muted-foreground mt-0.5"
                }
              />
              <div>
                <p className="text-xs font-semibold">
                  أدمن (صلاحيات إدارية كاملة)
                </p>
                <p className="text-[11px] text-muted-foreground leading-5 mt-0.5">
                  إدارة الفريق، التقارير، إضافة الفساتين وتعديل الأسعار وإلغاء
                  الحجوزات.
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">
            الاسم الكامل
            <input
              name="name"
              required
              minLength={1}
              maxLength={120}
              placeholder="مثال: سارة محمد"
              disabled={pending}
            />
          </label>
          <label className="field">
            البريد الإلكتروني
            <input
              dir="ltr"
              name="email"
              type="email"
              required
              placeholder="name@example.com"
              maxLength={100}
              disabled={pending}
            />
          </label>
        </div>

        <div className="field max-w-lg">
          <label className="text-xs font-medium">كلمة مرور الحساب</label>
          <div className="relative">
            <input
              dir="ltr"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="٨ أحرف على الأقل"
              disabled={pending}
              className="w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <span className="text-[11px] leading-6 text-muted-foreground">
            تُحفظ كلمة المرور وتظهر لك في حسابات الفريق لتتمكن من نسخها ومشاركتها
            مع العضو.
          </span>
        </div>

        <label className="flex items-start gap-3 text-xs leading-7">
          <input
            type="checkbox"
            name="confirm"
            required
            disabled={pending}
            className="mt-1 accent-primary"
          />
          <span>
            أؤكد إنشاء هذا الحساب بصلاحية{" "}
            <strong>{role === "admin" ? "أدمن (مدير)" : "موظف"}</strong> مع حفظ
            كلمة المرور.
          </span>
        </label>

        <Button type="submit" disabled={pending || !enabled || preview}>
          {pending
            ? "جارٍ إنشاء الحساب..."
            : role === "admin"
              ? "إنشاء حساب أدمن جديد"
              : "إنشاء حساب موظف جديد"}
        </Button>
      </form>
    </section>
  );
}

function TeamMemberCard({
  member,
  actorId,
  enabled,
  preview,
  onFeedback,
}: {
  member: TeamMember;
  actorId: string;
  enabled: boolean;
  preview: boolean;
  onFeedback: Feedback;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editRole, setEditRole] = useState<"admin" | "employee">(member.role);
  const [showEditPass, setShowEditPass] = useState(false);

  const isSelf = member.id === actorId;

  // Edit Action State
  const [, editAction, editPending] = useActionState(
    async (previous: StaffActionState, form: FormData) => {
      form.set("member_id", member.id);
      form.set("version", String(member.version));
      form.set("role", isSelf ? "admin" : editRole);
      try {
        const result = await updateStaffAccount(previous, form);
        onFeedback(result);
        if (result.success) setIsEditing(false);
        return result;
      } catch {
        const result = { error: "تعذر حفظ التعديلات. أعد المحاولة." };
        onFeedback(result);
        return result;
      }
    },
    {},
  );

  // Toggle Active Action State
  const [, toggleAction, togglePending] = useActionState(
    async (previous: StaffActionState, form: FormData) => {
      form.set("member_id", member.id);
      form.set("current_active", String(member.active));
      form.set("version", String(member.version));
      form.set("name", member.full_name);
      try {
        const result = await toggleStaffActive(previous, form);
        onFeedback(result);
        return result;
      } catch {
        const result = { error: "تعذر تغيير حالة الحساب." };
        onFeedback(result);
        return result;
      }
    },
    {},
  );

  // Delete Action State
  const [, deleteAction, deletePending] = useActionState(
    async (previous: StaffActionState, form: FormData) => {
      form.set("member_id", member.id);
      form.set("version", String(member.version));
      form.set("name", member.full_name);
      try {
        const result = await deleteStaffAccount(previous, form);
        onFeedback(result);
        return result;
      } catch {
        const result = { error: "تعذر حذف الحساب." };
        onFeedback(result);
        return result;
      }
    },
    {},
  );

  return (
    <article className="studio-card space-y-5 p-6 transition-all">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold">{member.full_name}</h3>
            {isSelf && (
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                حسابك الحالي
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <Mail size={13} className="text-muted-foreground" />
            <span dir="ltr" className="text-xs text-muted-foreground font-mono">
              {member.email}
            </span>
            {member.email !== "—" && (
              <CopyButton text={member.email} label="نسخ البريد" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              member.role === "admin"
                ? "border-pink-200 bg-pink-50 text-primary font-medium"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }
          >
            {member.role === "admin" ? (
              <span className="flex items-center gap-1">
                <Shield size={11} /> أدمن
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <User size={11} /> موظف
              </span>
            )}
          </Badge>
          <Badge
            className={
              member.active
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }
          >
            {member.active ? "نشط" : "معطل"}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              كلمة المرور:
            </span>
            <PasswordDisplay password={member.assigned_password} />
          </div>
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-xs h-8"
              disabled={!enabled || preview}
            >
              <Pencil size={12} className="ml-1" />
              تعديل البيانات
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <form
          action={preview ? undefined : editAction}
          onSubmit={preview ? (e) => e.preventDefault() : undefined}
          className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.02] p-5"
        >
          <h4 className="text-xs font-semibold text-primary">
            تعديل بيانات الحساب
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              اسم الحساب
              <input
                name="name"
                defaultValue={member.full_name}
                required
                maxLength={120}
                disabled={editPending}
              />
            </label>
            <label className="field">
              البريد الإلكتروني
              <input
                dir="ltr"
                type="email"
                name="email"
                defaultValue={member.email !== "—" ? member.email : ""}
                required
                maxLength={100}
                disabled={editPending}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="text-xs">كلمة مرور جديدة (اختياري)</label>
              <div className="relative">
                <input
                  dir="ltr"
                  type={showEditPass ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  placeholder="اتركه فارغًا للإبقاء على الحالية"
                  disabled={editPending}
                  className="w-full pr-9 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPass(!showEditPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showEditPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            {!isSelf && (
              <div className="space-y-1">
                <label className="text-xs">نوع الصلاحية</label>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditRole("employee")}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                      editRole === "employee"
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    موظف
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRole("admin")}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                      editRole === "admin"
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    أدمن
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              name="active"
              defaultChecked={member.active}
              disabled={editPending || isSelf}
              className="accent-primary"
            />
            الحساب نشط (أزل العلامة لتعطيل دخوله)
          </label>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={editPending || !enabled || preview}
            >
              {editPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
              disabled={editPending}
            >
              إلغاء
            </Button>
          </div>
        </form>
      )}

      {!isSelf && !isEditing && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <form
            action={preview ? undefined : toggleAction}
            onSubmit={preview ? (e) => e.preventDefault() : undefined}
          >
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={togglePending || !enabled || preview}
              className={
                member.active
                  ? "text-slate-700 hover:text-amber-800 hover:bg-amber-50 text-xs"
                  : "text-emerald-700 hover:bg-emerald-50 text-xs"
              }
            >
              {member.active ? (
                <>
                  <UserX size={13} className="ml-1.5" />
                  {togglePending ? "جارٍ التعطيل..." : "تعطيل الحساب مؤقتًا"}
                </>
              ) : (
                <>
                  <UserCheck size={13} className="ml-1.5" />
                  {togglePending ? "جارٍ التنشيط..." : "تنشيط الحساب"}
                </>
              )}
            </Button>
          </form>

          {!confirmDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={deletePending || !enabled || preview}
              className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={13} className="ml-1" />
              حذف الحساب
            </Button>
          ) : (
            <form
              action={preview ? undefined : deleteAction}
              onSubmit={preview ? (e) => e.preventDefault() : undefined}
              className="flex items-center gap-2"
            >
              <span className="text-[11px] text-red-700 font-medium">
                تأكيد الحذف نهائيًا؟
              </span>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={deletePending || !enabled || preview}
                className="text-xs h-8 bg-red-600 hover:bg-red-700 text-white hover:text-red-200"
              >
                {deletePending ? "جارٍ الحذف..." : "نعم، احذف الحساب"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                className="text-xs h-8"
              >
                تراجع
              </Button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export function TeamManager({
  members,
  profiles,
  jobs,
  actorId,
  managementEnabled,
  creationEnabled,
  preview = false,
}: {
  members?: TeamMember[];
  profiles?: TeamProfile[];
  jobs?: TeamJob[];
  actorId: string;
  managementEnabled: boolean;
  creationEnabled: boolean;
  preview?: boolean;
}) {
  const [feedback, setFeedback] = useState<StaffActionState>({});
  const [showDisabledOnly, setShowDisabledOnly] = useState(false);

  // Map legacy profiles to members if members prop was not passed (e.g. in demo)
  const allMembers: TeamMember[] =
    members ??
    (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: (p.role === "admin" ? "admin" : "employee") as "admin" | "employee",
      active: p.active,
      version: p.version,
      email: "—",
      assigned_password: null,
    }));

  const activeMembers = allMembers.filter((m) => m.active);
  const disabledMembers = allMembers.filter((m) => !m.active);
  const displayedMembers = showDisabledOnly ? disabledMembers : activeMembers;

  return (
    <div className="space-y-8">
      {preview && (
        <p className="rounded-xl border bg-white p-5 text-xs leading-8">
          معاينة تصميم ببيانات تجريبية. إدارة الفريق والإنشاء الفعلي متاحة
          للأدمن في مساحة العمل.
        </p>
      )}

      {feedback.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-xs leading-7 text-red-900 border border-red-200"
        >
          {feedback.error}
        </p>
      )}

      {feedback.success && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-xs leading-7 text-emerald-900 border border-emerald-200"
        >
          {feedback.success}
        </p>
      )}

      <NewStaffAccount
        enabled={creationEnabled}
        preview={preview}
        onFeedback={setFeedback}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              حسابات الفريق ({allMembers.length})
            </h2>
            <p className="text-xs leading-7 text-muted-foreground">
              يمكنك الاطلاع على كلمات المرور، تعديل بيانات أي عضو، تعطيله مؤقتًا،
              أو حذفه نهائيًا.
            </p>
          </div>

          {disabledMembers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisabledOnly(!showDisabledOnly)}
              className="text-xs"
            >
              {showDisabledOnly
                ? `عرض كل الفريق (${allMembers.length})`
                : `عرض الحسابات المعطلة فقط (${disabledMembers.length})`}
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {displayedMembers.map((member) => (
            <TeamMemberCard
              key={`${member.id}:${member.version}`}
              member={member}
              actorId={actorId}
              enabled={managementEnabled}
              preview={preview}
              onFeedback={setFeedback}
            />
          ))}

          {displayedMembers.length === 0 && (
            <p className="studio-card p-8 text-center text-xs text-muted-foreground">
              لا توجد حسابات معطلة حاليًا.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
