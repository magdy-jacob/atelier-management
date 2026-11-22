"use client";
import { useActionState, useRef, useState } from "react";
import {
  createEmployeeAccount,
  recoverEmployeeAccount,
  updateEmployeeProfile,
  type StaffActionState,
} from "@/app/staff-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
type Feedback = (state: StaffActionState) => void;
function EmployeeEditor({
  profile,
  enabled,
  preview,
  onFeedback,
}: {
  profile: TeamProfile;
  enabled: boolean;
  preview: boolean;
  onFeedback: Feedback;
}) {
  const request = useRef<string | null>(null);
  const [, action, pending] = useActionState(
    async (previous: StaffActionState, form: FormData) => {
      request.current ??= crypto.randomUUID();
      form.set("request_id", request.current);
      try {
        const result = await updateEmployeeProfile(previous, form);
        onFeedback(result);
        if (result.success) request.current = null;
        return result;
      } catch {
        const result = {
          error:
            "لم تتأكد نتيجة التغيير. أعد نفس الطلب دون تغيير القيم بعد مراجعة الحساب.",
        };
        onFeedback(result);
        return result;
      }
    },
    {},
  );
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      onReset={(e) => e.preventDefault()}
      className="grid gap-4 border-t pt-5 md:grid-cols-2"
    >
      <input type="hidden" name="employee_id" value={profile.id} />
      <input type="hidden" name="version" value={profile.version} />
      <label className="field">
        اسم الموظف
        <input
          name="name"
          defaultValue={profile.full_name}
          required
          maxLength={120}
          disabled={pending}
        />
      </label>
      <label className="field">
        سبب التغيير
        <input
          name="reason"
          required
          maxLength={500}
          placeholder="مثال: اختبار تعطيل الحساب"
          disabled={pending}
        />
      </label>
      <label className="flex items-start gap-3 text-xs leading-7">
        <input
          className="mt-2 accent-primary"
          type="checkbox"
          name="active"
          defaultChecked={profile.active}
          disabled={pending}
        />
        الحساب نشط، أزل العلامة لتعطيل صلاحيات الموقع دون حذف السجل.
      </label>
      <label className="flex items-start gap-3 text-xs leading-7">
        <input
          className="mt-2 accent-primary"
          type="checkbox"
          name="confirm"
          required
          disabled={pending}
        />
        أؤكد تعديل هذا الموظف فقط مع الاحتفاظ بتاريخه وصلاحية موظف.
      </label>
      <Button
        type="submit"
        className="w-fit"
        disabled={pending || !enabled || preview}
      >
        {pending ? "جارٍ الحفظ..." : "حفظ اسم وحالة الموظف"}
      </Button>
    </form>
  );
}
function NewEmployee({
  enabled,
  preview,
  job,
  onFeedback,
}: {
  enabled: boolean;
  preview: boolean;
  job: TeamJob | null;
  onFeedback: Feedback;
}) {
  const request = useRef<string | null>(job?.request_id ?? null),
    [password, setPassword] = useState("");
  const [, action, pending] = useActionState(
    async (previous: StaffActionState, form: FormData) => {
      request.current ??= crypto.randomUUID();
      form.set("request_id", request.current);
      try {
        const result = await createEmployeeAccount(previous, form);
        onFeedback(result);
        if (result.success) {
          setPassword("");
          request.current = null;
        }
        return result;
      } catch {
        const result = {
          error:
            "تعذر تأكيد النتيجة. راجع الطلبات المحفوظة أو أعد الطلب نفسه بكلمة المرور نفسها، ولا تبدأ حسابًا بديلًا قبل التحقق.",
        };
        onFeedback(result);
        return result;
      }
    },
    {},
  );
  return (
    <section className="studio-card space-y-5 p-6 md:p-8">
      <h2 className="text-lg">
        {job ? "استكمال طلب محفوظ" : "إنشاء موظف تجريبي"}
      </h2>
      <p className="text-xs leading-8 text-muted-foreground">
        حساب تسجيل دخول فعلي ببيانات مصطنعة وصلاحية موظف فقط، وليس دعوة بريدية.
        الاسم يبدأ بكلمة اختبار. البريد معرف غير قابل للتواصل ضمن
        example.invalid. لا تستخدم اسمًا أو بريدًا أو كلمة مرور تخص شخصًا حقيقيًا.
      </p>
      {!enabled && !preview && (
        <p className="rounded-xl bg-secondary p-4 text-xs leading-7">
          إنشاء الحسابات ينتظر إعداد Auth الإداري على الخادم وتفعيل الترحيل
          المطلوب. إدارة حالة الموظفين لا تحتاج عرض المفتاح أو وضعه هنا.
        </p>
      )}
      {job && (
        <p className="rounded-xl bg-secondary p-4 text-xs leading-8">
          استكمل بالهوية المحفوظة. إن كان الحساب أُنشئ بالفعل فسنتحقق من ربطه
          فقط، ولن نغير كلمة مروره الأصلية بالكلمة المدخلة الآن.
        </p>
      )}
      <form
        action={preview ? undefined : action}
        onSubmit={preview ? (e) => e.preventDefault() : undefined}
        onReset={(e) => e.preventDefault()}
        className="space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">
            اسم تجريبي
            <input
              name="name"
              required
              minLength={8}
              maxLength={120}
              defaultValue={job?.full_name ?? "اختبار موظف جديد"}
              readOnly={!!job}
              disabled={pending}
            />
          </label>
          <label className="field">
            معرف البريد التجريبي
            <input
              dir="ltr"
              name="email"
              type="email"
              required
              pattern="test-[a-z0-9][a-z0-9._\-]{0,39}@example\.invalid"
              placeholder="test-staff@example.invalid"
              defaultValue={job?.email ?? ""}
              readOnly={!!job}
              disabled={pending}
            />
          </label>
        </div>
        <label className="field max-w-lg">
          كلمة مرور للحساب التجريبي
          <input
            dir="ltr"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
          <span className="text-[11px] leading-6 text-muted-foreground">
            ١٢ حرفًا على الأقل، وبحد ٧٢ بايت. لا تُحفظ في سجل العمليات ولا تُعرض
            بعد الإنشاء. لا توجد هنا استعادة أو تغيير كلمة مرور.
          </span>
        </label>
        <label className="flex items-start gap-3 text-xs leading-8">
          <input
            type="checkbox"
            name="confirm"
            required
            disabled={pending}
            className="mt-2 accent-primary"
          />
          أؤكد إنشاء/استكمال حساب مصطنع دون إرسال بريد أو تغيير دور أي حساب
          موجود.
        </label>
        <Button type="submit" disabled={pending || !enabled || preview}>
          {pending
            ? "جارٍ التحقق والربط..."
            : job
              ? "استكمال نفس الطلب"
              : "إنشاء حساب موظف"}
        </Button>
      </form>
    </section>
  );
}
function RecoverJob({
  job,
  enabled,
  preview,
  onFeedback,
}: {
  job: TeamJob;
  enabled: boolean;
  preview: boolean;
  onFeedback: Feedback;
}) {
  const [, action, pending] = useActionState(
    async (previous: StaffActionState, form: FormData) => {
      try {
        const result = await recoverEmployeeAccount(previous, form);
        onFeedback(result);
        return result;
      } catch {
        const result = {
          error:
            "تعذر التحقق الآن. بقي الطلب والحساب كما هما دون حذف أو تغيير كلمة مرور.",
        };
        onFeedback(result);
        return result;
      }
    },
    {},
  );
  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
    >
      <input type="hidden" name="job_id" value={job.id} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending || !enabled || preview}
      >
        {pending ? "جارٍ التحقق..." : "تحقق وأكمل الربط فقط"}
      </Button>
    </form>
  );
}
export function TeamManager({
  profiles,
  jobs,
  actorId,
  managementEnabled,
  creationEnabled,
  preview = false,
}: {
  profiles: TeamProfile[];
  jobs: TeamJob[];
  actorId: string;
  managementEnabled: boolean;
  creationEnabled: boolean;
  preview?: boolean;
}) {
  const [feedback, setFeedback] = useState<StaffActionState>({}),
    [resume, setResume] = useState<TeamJob | null>(null);
  return (
    <div className="space-y-6">
      {preview && (
        <p className="rounded-xl border bg-white p-5 text-xs leading-8">
          معاينة تصميم ببيانات مصطنعة، الحفظ معطل هنا فقط. الإجراءات المحفوظة في
          مساحة العمل الفعلية للأدمن.
        </p>
      )}
      {feedback.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-5 text-xs leading-8 text-red-900"
        >
          {feedback.error}
        </p>
      )}
      {feedback.success && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-5 text-xs leading-8 text-primary"
        >
          {feedback.success}
        </p>
      )}
      {!managementEnabled && !preview && (
        <p
          role="alert"
          className="rounded-xl bg-secondary p-5 text-xs leading-8"
        >
          إدارة الموظفين مغلقة حتى يتطابق إعداد الاختبار الوظيفي والترحيل. لا
          يمكن تعديل الأدوار أو حساب الأدمن من هذه الشاشة.
        </p>
      )}
      <NewEmployee
        key={resume?.id ?? "new"}
        enabled={creationEnabled}
        preview={preview}
        job={resume}
        onFeedback={setFeedback}
      />
      {resume && (
        <Button variant="outline" onClick={() => setResume(null)}>
          الرجوع إلى طلب جديد
        </Button>
      )}
      <section className="space-y-4">
        <h2 className="text-lg">حسابات الفريق</h2>
        <p className="text-xs leading-8 text-muted-foreground">
          التعطيل يوقف صلاحيات التطبيق فورًا ولا يحذف حساب Auth أو سجلات
          الحجوزات. الحسابات الإدارية محمية، ولا ترقية أدوار من هذه الشاشة.
          الاسم المعدل يبدأ بكلمة اختبار.
        </p>
        {profiles.map((p) => (
          <article
            key={`${p.id}:${p.version}`}
            className="studio-card space-y-5 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm">{p.full_name}</h3>
                <p
                  dir="ltr"
                  className="mt-2 break-all font-mono text-[10px] text-muted-foreground"
                >
                  {p.id}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {p.role === "admin" ? "أدمن، محمي" : "موظف"}
                </Badge>
                <Badge
                  className={
                    p.active
                      ? "bg-secondary text-primary"
                      : "bg-red-50 text-red-700"
                  }
                >
                  {p.active ? "نشط" : "معطل"}
                </Badge>
              </div>
            </div>
            {p.role === "employee" && (
              <EmployeeEditor
                profile={p}
                enabled={managementEnabled}
                preview={preview}
                onFeedback={setFeedback}
              />
            )}
          </article>
        ))}
      </section>
      <section className="studio-card space-y-5 p-6 md:p-8">
        <h2 className="text-lg">طلبات الإنشاء المحفوظة</h2>
        <p className="text-xs leading-8 text-muted-foreground">
          آخر ٢٠ طلبًا، دون كلمات مرور. التحقق لا ينشئ حسابًا ولا يغير كلمة مروره.
          الاستكمال متاح لصاحب الطلب الإداري نفسه، ويستخدم نفس المعرف لمنع
          التكرار.
        </p>
        {!jobs.length && (
          <p className="text-xs text-muted-foreground">
            لا توجد طلبات محفوظة في هذه القائمة.
          </p>
        )}
        {jobs.map((j) => (
          <article key={j.id} className="space-y-3 border-t pt-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="text-sm">{j.full_name}</h3>
              <Badge variant="outline">
                {j.status === "completed" ? "مكتمل" : "بانتظار التحقق"}
              </Badge>
            </div>
            <p dir="ltr" className="break-all text-xs">
              {j.email}
            </p>
            {j.status === "pending" && j.actor_id === actorId && (
              <div className="flex flex-wrap gap-3">
                <RecoverJob
                  job={j}
                  enabled={creationEnabled}
                  preview={preview}
                  onFeedback={setFeedback}
                />
                <Button
                  variant="outline"
                  disabled={!creationEnabled || preview}
                  onClick={() => setResume(j)}
                >
                  استكمال بنفس الهوية
                </Button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
