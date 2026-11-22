import { notFound } from "next/navigation";
import { z } from "zod";
import {
  notificationKinds,
  type OperationalNotification,
} from "@/lib/notifications";
import { NotificationTabs } from "@/components/atelier/notification-page";
import { NotificationList } from "@/components/atelier/notification-list";
import { StaffFrame } from "@/components/atelier/staff-frame";
export default async function NotificationPreview({
  params,
  searchParams,
}: {
  params: Promise<{ kind?: string[] }>;
  searchParams: Promise<{ returned?: string }>;
}) {
  const parts = (await params).kind ?? [];
  if (parts.length > 1) notFound();
  const parsed = parts[0]
    ? z.enum(notificationKinds).safeParse(parts[0])
    : null;
  if (parsed && !parsed.success) notFound();
  const filter = parsed?.success ? parsed.data : undefined;
  const items: OperationalNotification[] = [
    {
      booking_id: "preview-critical",
      kind: "collision",
      event_on: "2026-12-05",
      starts_on: "2026-12-03",
      returns_on: "2026-12-04",
      dress_name: "ليلة مخمل · تنبيه مهم تجريبي",
      customer_name: "عميلة تجريبية ٣",
      read_at: null,
      related_booking_id: "preview-next",
      related_starts_on: "2026-12-06",
    },
    {
      booking_id: "preview-1",
      kind: "outgoing",
      event_on: "2026-12-05",
      starts_on: "2026-12-06",
      returns_on: "2026-12-07",
      dress_name: "همسة زيتون · تجريبي",
      customer_name: "عميلة تجريبية ١",
      read_at: null,
    },
    {
      booking_id: "preview-2",
      kind: "incoming",
      event_on: "2026-12-05",
      starts_on: "2026-12-04",
      returns_on: "2026-12-05",
      dress_name: "وردة المساء · تجريبي",
      customer_name: "عميلة تجريبية ٢",
      read_at: "2026-12-05T08:00:00Z",
    },
    {
      booking_id: "preview-3",
      kind: "overdue",
      event_on: "2026-12-05",
      starts_on: "2026-12-03",
      returns_on: "2026-12-04",
      dress_name: "ليلة مخمل · تجريبي",
      customer_name: "عميلة تجريبية ٣",
      read_at: null,
    },
  ].filter((i) => !filter || i.kind === filter) as OperationalNotification[];
  if ((await searchParams).returned === "1")
    for (const item of items)
      if (item.kind === "collision") item.actual_returned_on = "2026-12-05";
  return (
    <StaffFrame
      preview
      title="مركز الإشعارات"
      description="معاينة مصطنعة ليوم ٥ ديسمبر ٢٠٢٦. لا يتم حفظ حالة قراءة هنا. التعليم كمقروء لا يخفي السبب التشغيلي، ولا يغير حالة التسليم والعودة."
      name="أدمن تجريبي"
      role="admin"
      active="/workspace/notifications"
    >
      <NotificationTabs preview filter={filter} />
      <NotificationList items={items} total={items.length} preview />
    </StaffFrame>
  );
}
