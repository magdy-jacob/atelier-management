import Link from "next/link";
import { requireStaff } from "@/lib/supabase/auth";
import { StaffFrame, AdminOnly, Unavailable } from "./staff-frame";
import { NotificationList } from "./notification-list";
import {
  notificationResultSchema,
  notificationLabels,
  type NotificationKind,
} from "@/lib/notifications";
export function NotificationTabs({
  filter,
  preview = false,
}: {
  filter?: NotificationKind;
  preview?: boolean;
}) {
  const base = preview ? "/demo/notifications" : "/workspace/notifications";
  return (
    <nav aria-label="أنواع التنبيهات" className="flex flex-wrap gap-2">
      {[[undefined, "كل التنبيهات"], ...Object.entries(notificationLabels)].map(
        ([key, label]) => (
          <Link
            key={key ?? "all"}
            href={key ? `${base}/${key}` : base}
            className={`rounded-full border px-4 py-2 text-xs ${key === filter ? "bg-primary text-white" : "bg-white"}`}
          >
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}
export async function NotificationsPage({
  filter,
}: {
  filter?: NotificationKind;
}) {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return (
      <StaffFrame
        title="مركز الإشعارات"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/notifications"
      >
        <AdminOnly />
      </StaffFrame>
    );
  const { data, error } = await db.rpc("get_admin_notifications", {
    p_kind: filter ?? null,
  });
  const parsed = !error ? notificationResultSchema.safeParse(data) : null;
  return (
    <StaffFrame
      title="مركز الإشعارات"
      description="إشعارات داخل الموقع فقط للأدمن. حالة القراءة محفوظة لكل حساب، ولا تحذف التنبيه التشغيلي ما دام سببه قائمًا. لا بريد أو WhatsApp أو Push."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/notifications"
    >
      <NotificationTabs filter={filter} />
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-7">
        تجهيز وخروج يبدأ قبل الموعد بيوم ويظل ظاهرًا إذا لم يسجل التسليم. العودة
        تظهر في يومها، والتأخير بعد تجاوزه ما دام الفستان مسجلًا خارج الأتيليه.
        قراءة التنبيه لا تغير الحجز ولا تحسب غرامة. أعد تحميل الصفحة لتحديث
        اليوم والحالات.
      </p>
      {parsed?.success ? (
        <NotificationList items={parsed.data.items} total={parsed.data.total} />
      ) : (
        <Unavailable />
      )}
    </StaffFrame>
  );
}
