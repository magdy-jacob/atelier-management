import { cookies } from "next/headers";
import { getBookingConfig, bookingConfigReady } from "@/lib/booking-config";
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
  const config = await getBookingConfig(db);
  const cookieStore = await cookies();
  const unmarked = new Set(
    (cookieStore.get("unmarked_notifications")?.value ?? "")
      .split(",")
      .filter(Boolean),
  );

  const { data, error } = await db.rpc("get_admin_notifications", {
    p_kind: filter ?? null,
  });
  const parsed = !error ? notificationResultSchema.safeParse(data) : null;
  const items = (parsed?.data?.items ?? []).map((item) => {
    const key = `${item.kind}:${item.booking_id}:${item.event_on}`;
    if (unmarked.has(key)) {
      return { ...item, read_at: null };
    }
    return item;
  });
  return (
    <StaffFrame
      title="مركز الإشعارات"
      name={profile.full_name}
      role={profile.role}
      active="/workspace/notifications"
    >
      <NotificationTabs filter={filter} />

      {parsed?.success ? (
        <NotificationList
          items={items}
          total={parsed.data.total}
          mutationsEnabled={bookingConfigReady(config)}
        />
      ) : (
        <Unavailable />
      )}
    </StaffFrame>
  );
}
