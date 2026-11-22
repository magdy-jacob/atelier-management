export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { z } from "zod";
import { notificationKinds } from "@/lib/notifications";
import { NotificationsPage } from "@/components/atelier/notification-page";
export default async function NotificationType({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const kind = z.enum(notificationKinds).safeParse((await params).kind);
  if (!kind.success) notFound();
  return <NotificationsPage filter={kind.data} />;
}
