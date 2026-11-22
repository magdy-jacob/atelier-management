import { z } from "zod";
export const notificationKinds = ["outgoing", "incoming", "overdue"] as const;
export type NotificationKind = (typeof notificationKinds)[number];
export const notificationLabels: Record<NotificationKind, string> = {
  outgoing: "تجهيز وخروج",
  incoming: "عودة اليوم",
  overdue: "متأخر عن العودة",
};
export const notificationSchema = z.object({
  booking_id: z.string(),
  kind: z.enum(notificationKinds),
  event_on: z.string(),
  starts_on: z.string(),
  returns_on: z.string(),
  dress_name: z.string(),
  customer_name: z.string(),
  read_at: z.string().nullable(),
});
export const notificationResultSchema = z.object({
  today: z.string(),
  total: z.number().int().nonnegative(),
  items: z.array(notificationSchema),
});
export type OperationalNotification = z.infer<typeof notificationSchema>;
