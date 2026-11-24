"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/auth";
import { staffAuthAdmin, staffAuthConfigured } from "@/lib/supabase/admin";
import { functionalPortfolioEnabled } from "@/lib/portfolio-mode";
import {
  provisionEmployee,
  validEmployeePassword,
  type EmployeeJob,
} from "@/lib/employee-provisioning";
export type StaffActionState = { error?: string; success?: string };
const jobSchema = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  user_id: z.uuid(),
  actor_id: z.uuid(),
  full_name: z.string(),
  email: z.string(),
  status: z.enum(["pending", "completed"]),
});
async function context() {
  const c = await requireStaff();
  if (c.profile.role !== "admin") return null;
  const cfg = await c.db.rpc("get_staff_management_config");
  if (
    cfg.error ||
    cfg.data?.ready !== true ||
    cfg.data?.synthetic_test_enabled !== true ||
    !functionalPortfolioEnabled()
  )
    return null;
  return c;
}
function refresh() {
  for (const path of [
    "/workspace/team",
    "/workspace/activity",
    "/workspace/dashboard",
  ])
    revalidatePath(path);
}
async function runJob(
  job: EmployeeJob,
  password: string,
  actor: string,
  role: "admin" | "employee" = "employee",
): Promise<StaffActionState> {
  if (job.actor_id !== actor || !staffAuthConfigured())
    return {
      error: "خدمة إنشاء الحسابات غير مهيأة أو الطلب غير مملوك لهذا الأدمن.",
    };
  const service = staffAuthAdmin();
  const result = await provisionEmployee(job, password, {
    read: async () => {
      const { data, error } = await service.auth.admin.getUserById(job.user_id);
      if (error && (error.status === 404 || error.code === "user_not_found"))
        return null;
      if (error || !data.user) throw new Error("auth_read_unverified");
      return data.user;
    },
    create: async (value) => {
      const { data, error } = await service.auth.admin.createUser({
        id: job.user_id,
        email: job.email,
        password: value,
        email_confirm: true,
        app_metadata: {
          lovely_staff_job: job.id,
          lovely_staff_actor: job.actor_id,
          role,
        },
        user_metadata: {
          assigned_password: value,
          role,
          full_name: job.full_name,
        },
      });
      if (error || !data.user) throw new Error("auth_create_unverified: " + error?.message);
      return data.user;
    },
    complete: async () => {
      const { data, error } = await service.rpc("complete_employee_account", {
        p_job_id: job.id,
        p_actor_id: actor,
      });
      if (error || data !== job.user_id)
        throw new Error("profile_completion_unverified");
    },
  });
  refresh();
  if (result.status === "conflict")
    return {
      error:
        "تعارض في هوية حساب Auth مع الطلب المحفوظ. لم نربط حسابًا مختلفًا أو نحذفه. يلزم فحص مسؤول الإعداد.",
    };
  if (result.status !== "completed")
    return {
      error:
        "لم يتأكد اكتمال الإنشاء. أعد المحاولة بنفس البيانات وكلمة المرور.",
    };
  return {
    success: result.recovered
      ? "الحساب الموجود لنفس الطلب تحقق وربط بنجاح."
      : role === "admin"
        ? "أُنشئ حساب أدمن جديد بصلاحيات إدارية كاملة وكلمة مرور مسجلة بنجاح."
        : "أُنشئ حساب موظف نشط وربط بنجاح.",
  };
}
export async function createEmployeeAccount(
  _prior: StaffActionState,
  form: FormData,
): Promise<StaffActionState> {
  const c = await context();
  if (!c)
    return { error: "هذه الميزة للأدمن فقط." };
  if (!staffAuthConfigured())
    return {
      error:
        "يلزم إعداد مفتاح Auth الإداري على الخادم. لا تضعه في المتصفح أو المحادثات.",
    };
  const roleInput = form.get("role")?.toString() === "admin" ? "admin" : "employee";
  const p = z
    .object({
      request_id: z.uuid(),
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().toLowerCase().email().max(100),
      password: z.string().min(8).max(72),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success)
    return {
      error:
        "راجع الاسم والبريد الإلكتروني وكلمة مرور من 8 أحرف على الأقل، ثم أكد الإنشاء.",
    };
  const { data, error } = await c.db.rpc("begin_employee_account", {
    p_request_id: p.data.request_id,
    p_name: p.data.name,
    p_email: p.data.email,
  });
  if (error) {
    if (error.message.includes("employee_email_has_job"))
      return {
        error:
          "لهذا البريد طلب محفوظ بالفعل أو حساب موجود مسبقًا.",
      };
    if (error.message.includes("request_id_payload_mismatch"))
      return {
        error:
          "هذا الطلب محفوظ باسم أو بريد مختلف. استكمل الطلب نفسه دون تغيير هويته.",
      };
    return { error: "تعذر بدء طلب الإنشاء: " + error.message };
  }
  const job = jobSchema.safeParse(data);
  if (!job.success || job.data.actor_id !== c.profile.id)
    return { error: "تعذر التحقق من هوية طلب الإنشاء." };
  return runJob(job.data, p.data.password, c.profile.id, roleInput);
}
export async function recoverEmployeeAccount(
  _prior: StaffActionState,
  form: FormData,
): Promise<StaffActionState> {
  const c = await context();
  const id = z.uuid().safeParse(form.get("job_id"));
  if (!c || !id.success) return { error: "غير مسموح بالطلب." };
  const { data, error } = await c.db
    .from("employee_account_jobs")
    .select("id,request_id,user_id,actor_id,full_name,email,status")
    .eq("id", id.data)
    .maybeSingle();
  const job = jobSchema.safeParse(data);
  if (error || !job.success || job.data.actor_id !== c.profile.id)
    return { error: "تعذر التحقق من طلبك المحفوظ." };
  return runJob(job.data, "", c.profile.id);
}
export async function updateEmployeeProfile(
  _prior: StaffActionState,
  form: FormData,
): Promise<StaffActionState> {
  const c = await context();
  if (!c) return { error: "تعديل الموظفين للأدمن فقط داخل الاختبار الوظيفي." };
  const p = z
    .object({
      request_id: z.uuid(),
      employee_id: z.uuid(),
      version: z.coerce.number().int().positive(),
      name: z.string().trim().min(1).max(120),
      reason: z.string().trim().min(1).max(500),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "راجع الاسم والسبب وأكد التغيير." };
  const { error } = await c.db.rpc("update_employee_profile", {
    p_request_id: p.data.request_id,
    p_employee_id: p.data.employee_id,
    p_expected_version: p.data.version,
    p_name: p.data.name,
    p_active: form.get("active") === "on",
    p_reason: p.data.reason,
  });
  if (error) {
    if (error.message.includes("stale_employee_version")) {
      refresh();
      return {
        error:
          "تغير حساب الموظف منذ فتح النموذج. راجع أحدث بياناته قبل المحاولة.",
      };
    }
    if (error.message.includes("admin_profile_protected"))
      return {
        error:
          "حسابات الأدمن محمية من هذه الشاشة. لا تغيير دور أو تعطيل للأدمن.",
      };
    if (error.message.includes("synthetic_employee_required"))
      return {
        error:
          "الاسم الجديد في مشروع الاختبار يبدأ بكلمة اختبار. يمكن إبقاء الاسم القديم عند تغيير حالة الحساب فقط.",
      };
    return {
      error:
        "تعذر تأكيد التغيير. راجع بيانات الموظف وأعد نفس الطلب دون تغيير القيم.",
    };
  }
  refresh();
  return {
    success:
      "حُفظ اسم/حالة الموظف مع السبب والسجل. التعطيل يمنع صلاحيات الموقع دون حذف حساب Auth أو تاريخه.",
  };
}

export async function updateStaffAccount(
  _prior: StaffActionState,
  form: FormData,
): Promise<StaffActionState> {
  const c = await context();
  if (!c) return { error: "تعديل الفريق للأدمن فقط." };

  const memberId = form.get("member_id")?.toString();
  const name = form.get("name")?.toString().trim();
  const email = form.get("email")?.toString().trim().toLowerCase();
  const password = form.get("password")?.toString();
  const role = form.get("role")?.toString() === "admin" ? "admin" : "employee";
  const active = form.get("active") === "on";
  const version = Number(form.get("version") || 1);

  if (!memberId || !name || !email) {
    return { error: "الاسم والبريد الإلكتروني مطلوبان." };
  }

  // 1. Update in DB if allowed and needed
  if (memberId !== c.profile.id) {
    const { error: profileError } = await c.db.rpc("update_employee_profile", {
      p_request_id: crypto.randomUUID(),
      p_employee_id: memberId,
      p_expected_version: version,
      p_name: name,
      p_active: active,
      p_reason: "تعديل بيانات الحساب بواسطة الأدمن",
    });
    if (profileError && !profileError.message.includes("admin_profile_protected")) {
      console.warn("update_employee_profile warning:", profileError.message);
    }
  }

  // 2. Update Auth (Email, Password, Role, user_metadata)
  if (staffAuthConfigured()) {
    const service = staffAuthAdmin();
    const updatePayload: {
      email?: string;
      email_confirm?: boolean;
      password?: string;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    } = {
      email,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role,
      },
      app_metadata: {
        role,
      },
    };

    if (password && password.trim().length >= 8) {
      updatePayload.password = password.trim();
      updatePayload.user_metadata!.assigned_password = password.trim();
    }

    const { error: authError } = await service.auth.admin.updateUserById(
      memberId,
      updatePayload,
    );
    if (authError) {
      return {
        error: `تعذر تحديث بيانات الحساب في Auth: ${authError.message}`,
      };
    }
  }

  refresh();
  return { success: "تم حفظ جميع تعديلات الحساب بنجاح." };
}

export async function toggleStaffActive(
  _prior: StaffActionState,
  form: FormData,
): Promise<StaffActionState> {
  const c = await context();
  if (!c) return { error: "هذا الإجراء للأدمن فقط." };

  const memberId = form.get("member_id")?.toString();
  const currentActive = form.get("current_active") === "true";
  const version = Number(form.get("version") || 1);
  const name = form.get("name")?.toString() || "حساب موظف";

  if (!memberId) return { error: "معرف الحساب غير صحيح." };
  if (memberId === c.profile.id) {
    return { error: "لا يمكنك تعطيل حسابك الحالي المسجل به." };
  }

  const newActive = !currentActive;

  await c.db.rpc("update_employee_profile", {
    p_request_id: crypto.randomUUID(),
    p_employee_id: memberId,
    p_expected_version: version,
    p_name: name,
    p_active: newActive,
    p_reason: newActive ? "تنشيط الحساب بواسطة الأدمن" : "تعطيل الحساب بواسطة الأدمن",
  });

  if (staffAuthConfigured()) {
    const service = staffAuthAdmin();
    await service.auth.admin.updateUserById(memberId, {
      ban_duration: newActive ? "none" : "876000h",
      user_metadata: { active: newActive },
    });
  }

  refresh();
  return {
    success: newActive
      ? "تم تنشيط الحساب بنجاح، ويمكن لصاحبه تسجيل الدخول الآن."
      : "تم تعطيل الحساب بنجاح، ومُنع من تسجيل الدخول.",
  };
}

export async function deleteStaffAccount(
  _prior: StaffActionState,
  form: FormData,
): Promise<StaffActionState> {
  const c = await context();
  if (!c) return { error: "حذف الحسابات للأدمن فقط." };

  const memberId = form.get("member_id")?.toString();
  const version = Number(form.get("version") || 1);
  const name = form.get("name")?.toString() || "حساب موظف";

  if (!memberId) return { error: "معرف الحساب غير صحيح." };
  if (memberId === c.profile.id) {
    return { error: "لا يمكنك حذف حسابك الحالي المسجل به." };
  }

  // 1. Disable in DB to maintain audit constraints
  await c.db.rpc("update_employee_profile", {
    p_request_id: crypto.randomUUID(),
    p_employee_id: memberId,
    p_expected_version: version,
    p_name: name,
    p_active: false,
    p_reason: "حذف الحساب من الفريق بواسطة الأدمن",
  });

  // 2. Delete user from Auth so they cannot sign in or reset password
  if (staffAuthConfigured()) {
    const service = staffAuthAdmin();
    const { error: authDeleteError } = await service.auth.admin.deleteUser(memberId);
    if (authDeleteError) {
      console.warn("Auth user deletion warning:", authDeleteError.message);
    }
  }

  refresh();
  return { success: "تم حذف الحساب بنجاح ومنعه نهائيًا من الدخول." };
}
