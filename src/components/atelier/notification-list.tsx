"use client";
import { LateFeeForm } from "./late-fee-form";
import Link from "next/link";
import { useActionState } from "react";
import { markNotificationRead, type ActionState } from "@/app/actions";
import { formatDay, dateInZone } from "@/lib/domain";
import {
  notificationLabels,
  type OperationalNotification,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
function NotificationItem({
  item,
  preview,
  mutationsEnabled,
}: {
  item: OperationalNotification;
  preview: boolean;
  mutationsEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    markNotificationRead,
    {} as ActionState,
  );
  return (
    <article
      className={`rounded-2xl border p-5 md:p-6 ${item.kind === "collision" ? "border-2 border-red-700 bg-red-50" : item.kind === "overdue" ? "border-red-200 bg-red-50" : "bg-white"}`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`rounded-full px-3 py-1 text-[11px] ${["collision", "overdue"].includes(item.kind) ? "bg-red-100 text-red-900" : "bg-secondary text-primary"}`}
        >
          {notificationLabels[item.kind]}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {item.read_at ? "مقروء، وما زال السبب قائمًا" : "غير مقروء"}
        </span>
      </div>
      <h2 className="mb-2 text-base">
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
          ["الخروج المخطط", item.starts_on],
          ["العودة المخططة", item.returns_on],
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
          التعليم كمقروء لا يؤكد تسليمًا أو عودة.
        </p>
      )}
      {item.kind === "collision" && (
        <div className="mb-5 space-y-3 rounded-xl border border-red-200 bg-white p-4 text-xs leading-7 text-red-950">
          <h3 className="font-semibold">تنبيه مهم للأدمن: راجع الحجز التالي</h3>
          <p>
            الفستان ما زال مسجلًا خارج الأتيليه بعد موعد العودة، وأقرب حجز تالٍ
            اقترب أو بدأ موعده. راجع تأثير التأخير ويوم التجهيز مع المسؤول عن
            الحجز.
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
          <p>
            هذا تنبيه فقط. لا يلغي أو يحرك حجزًا ولا يفرض حظر تسليم آليًا بسبب
            التعارض. قواعد إنشاء الحجوزات ويوم التجهيز لم تتغير.
          </p>
        </div>
      )}
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
          <p role="status" className="text-xs leading-7 text-green-900">
            {state.success}
          </p>
        )}
        <Button
          type="submit"
          variant="outline"
          disabled={pending || !!item.read_at || preview}
        >
          {pending
            ? "جارٍ الحفظ…"
            : item.read_at
              ? "تمت القراءة"
              : "تعليم كمقروء"}
        </Button>
      </form>
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
  return (
    <div className="space-y-5">
      {total > items.length && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-7"
        >
          النتيجة تعرض أول ١٠٠٠ تنبيه فقط. هناك تنبيهات أخرى غير معروضة؛ لا
          تعتبرها حصرًا كاملًا.
        </p>
      )}
      {items.length ? (
        items.map((item) => (
          <NotificationItem
            key={`${item.kind}:${item.booking_id}:${item.event_on}`}
            item={item}
            preview={preview}
            mutationsEnabled={mutationsEnabled}
          />
        ))
      ) : (
        <p className="studio-card p-8 text-sm leading-8">
          لا توجد تنبيهات نشطة في هذا النوع. هذا لا يثبت جاهزية كل فستان أو
          اكتمال تشغيل الأتيليه.
        </p>
      )}
    </div>
  );
}
