"use client";
import { LateFeeForm } from "./late-fee-form";
import Link from "next/link";
import { useActionState } from "react";
import {
  markNotificationRead,
  unmarkNotificationRead,
  type ActionState,
} from "@/app/actions";
import { formatDay, dateInZone } from "@/lib/domain";
import {
  notificationLabels,
  type OperationalNotification,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
function NotificationItem({
  item,
  preview,
  mutationsEnabled,
  isRead = false,
}: {
  item: OperationalNotification;
  preview: boolean;
  mutationsEnabled: boolean;
  isRead?: boolean;
}) {
  const [state, action, pending] = useActionState(
    markNotificationRead,
    {} as ActionState,
  );
  const [unmarkState, unmarkAction, unmarkPending] = useActionState(
    unmarkNotificationRead,
    {} as ActionState,
  );
  const read = isRead || !!item.read_at;
  return (
    <article
      className={`rounded-2xl border p-5 md:p-6 transition-all ${
        read
          ? "border-slate-200 bg-slate-50/70 text-slate-600 opacity-80"
          : item.kind === "collision"
            ? "border-2 border-red-700 bg-red-50"
            : item.kind === "overdue"
              ? "border-red-200 bg-red-50"
              : "bg-white"
      }`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`rounded-full px-3 py-1 text-[11px] ${
            read
              ? "bg-slate-200/80 text-slate-700"
              : ["collision", "overdue"].includes(item.kind)
                ? "bg-red-100 text-red-900"
                : "bg-secondary text-primary"
          }`}
        >
          {notificationLabels[item.kind]}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {item.read_at ? "تمت قراءته" : "غير مقروء"}
        </span>
      </div>
      <h2 className="mb-2 text-base font-semibold">
        <Link
          className="underline underline-offset-4"
          href={
            preview ? "/demo/records" : `/workspace/bookings/${item.booking_id}`
          }
        >
          {item.dress_name}
        </Link>
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">{item.customer_name}</p>
      <dl className="mb-5 grid gap-3 text-xs leading-7 sm:grid-cols-3">
        {[
          ["بداية التنبيه", item.event_on],
          ["التسليم", item.starts_on],
          ["الاستلام", item.returns_on],
        ].map(([label, day]) => (
          <div key={label}>
            <dt className="text-[10px] text-muted-foreground">{label}</dt>
            <dd>{formatDay(day)}</dd>
          </div>
        ))}
      </dl>
      {item.read_at && (
        <p className="mb-4 text-[11px] text-muted-foreground">
          تمت القراءة في {formatDay(dateInZone(item.read_at, "Africa/Cairo"))}.
        </p>
      )}
      {item.kind === "collision" && (
        <div className="mb-5 space-y-3 rounded-xl border border-red-200 bg-white p-4 text-xs leading-7 text-red-950">
          <h3 className="font-semibold">تنبيه مهم للأدمن: راجع الحجز التالي</h3>
          <p>
            {item.actual_returned_on
              ? `سُجلت العودة في ${formatDay(item.actual_returned_on)} بعد الموعد المخطط. ما زال الحجز التالي يتأثر بيوم التجهيز المسجل.`
              : "الفستان ما زال مسجلًا خارج الأتيليه بعد موعد العودة، وأقرب حجز تالٍ اقترب أو بدأ موعده."}{" "}
            راجع أثر التأخير ويوم التجهيز مع المسؤول عن الحجز.
          </p>
          {item.related_starts_on && (
            <p>بداية الحجز المتأثر: {formatDay(item.related_starts_on)}</p>
          )}
          {item.related_booking_id && (
            <Link
              className="inline-block underline underline-offset-4"
              href={
                preview
                  ? "/demo/records"
                  : `/workspace/bookings/${item.related_booking_id}`
              }
            >
              فتح الحجز المتأثر
            </Link>
          )}
        </div>
      )}
      {!read && (
        <form
          action={preview ? undefined : action}
          onSubmit={preview ? (e) => e.preventDefault() : undefined}
          className="space-y-4"
        >
          <input type="hidden" name="booking_id" value={item.booking_id} />
          <input type="hidden" name="kind" value={item.kind} />
          <input type="hidden" name="event_on" value={item.event_on} />
          {state.error && (
            <p role="alert" className="text-xs leading-7 text-red-800">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="text-xs leading-7 text-pink-900">
              {state.success}
            </p>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={pending || !!item.read_at || preview}
          >
            {pending ? "جارٍ الحفظ…" : "تعليم كمقروء"}
          </Button>
        </form>
      )}
      {read && (
        <form
          action={preview ? undefined : unmarkAction}
          onSubmit={preview ? (e) => e.preventDefault() : undefined}
          className="mt-3 space-y-2"
        >
          <input type="hidden" name="booking_id" value={item.booking_id} />
          <input type="hidden" name="kind" value={item.kind} />
          <input type="hidden" name="event_on" value={item.event_on} />
          {unmarkState.error && (
            <p role="alert" className="text-xs leading-7 text-red-800">
              {unmarkState.error}
            </p>
          )}
          {unmarkState.success && (
            <p role="status" className="text-xs leading-7 text-emerald-800">
              {unmarkState.success}
            </p>
          )}
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={unmarkPending || preview}
            className="text-xs text-slate-700 hover:text-foreground"
          >
            <RotateCcw className="ml-1.5 h-3.5 w-3.5" />
            {unmarkPending ? "جارٍ الإعادة…" : "إعادة إلى التنبيهات النشطة"}
          </Button>
        </form>
      )}
      {item.kind === "overdue" && (
        <LateFeeForm
          bookingId={item.booking_id}
          enabled={mutationsEnabled}
          preview={preview}
        />
      )}
    </article>
  );
}
export function NotificationList({
  items,
  total,
  preview = false,
  mutationsEnabled = false,
}: {
  items: OperationalNotification[];
  total: number;
  preview?: boolean;
  mutationsEnabled?: boolean;
}) {
  const unreadItems = items.filter((item) => !item.read_at);
  const readItems = items.filter((item) => !!item.read_at);

  return (
    <div className="space-y-6">
      {total > items.length && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-7"
        >
          النتيجة تعرض أول ١٠٠٠ تنبيه فقط. هناك تنبيهات أخرى غير معروضة؛ لا
          تعتبرها حصرًا كاملًا.
        </p>
      )}

      {unreadItems.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            التنبيهات النشطة ({unreadItems.length})
          </h2>
          {unreadItems.map((item) => (
            <NotificationItem
              key={`${item.kind}:${item.booking_id}:${item.event_on}`}
              item={item}
              preview={preview}
              mutationsEnabled={mutationsEnabled}
            />
          ))}
        </div>
      ) : (
        <p className="studio-card p-6 text-sm leading-8 text-muted-foreground">
          لا توجد تنبيهات نشطة غير مقروءة حاليًا.
        </p>
      )}

      {readItems.length > 0 && (
        <details className="studio-card group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition-all">
          <summary className="flex cursor-pointer items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground">
            <span className="flex items-center gap-2">
              <span>الإشعارات المقروءة والمنتهية</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                {readItems.length}
              </span>
            </span>
            <span className="text-[11px] underline">
              عرض / إخفاء الإشعارات السابقة
            </span>
          </summary>
          <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
            {readItems.map((item) => (
              <NotificationItem
                key={`read:${item.kind}:${item.booking_id}:${item.event_on}`}
                item={item}
                preview={preview}
                mutationsEnabled={mutationsEnabled}
                isRead
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
