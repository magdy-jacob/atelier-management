import {
  auditChanges,
  auditLabels,
  valueLabels,
  bookingNumber,
  recordedDay,
} from "@/lib/presentation";
import { aggregateMoney } from "@/lib/admin-dashboard";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/domain";
export type AuditRecord = {
  id: string | number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  old_data: unknown;
  new_data: unknown;
};
function AuditValue({ value, field }: { value: unknown; field: string }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">غير مسجل</span>;
  if (typeof value === "boolean") return <span>{value ? "نعم" : "لا"}</span>;
  if (field.endsWith("_piasters") && /^\d+$/.test(String(value)))
    return <span>{aggregateMoney(String(value))}</span>;
  if (
    field.endsWith("_at") &&
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value))
  )
    return <span>{recordedDay(value)}</span>;
  if (Array.isArray(value))
    return (
      <span>
        {value.map((v) => valueLabels[String(v)] ?? String(v)).join("، ")}
      </span>
    );
  if (typeof value === "object") return <span>بيانات مرتبطة</span>;
  return (
    <span className="break-words" dir="auto">
      {valueLabels[String(value)] ?? String(value)}
    </span>
  );
}
export function AuditTable({
  logs,
  names = {},
}: {
  logs: AuditRecord[];
  names?: Record<string, string>;
}) {
  return (
    <section className="studio-card divide-y">
      {logs.map((log) => (
        <article key={log.id} className="space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" dir="ltr">
                {log.action === "INSERT" ? "CREATE" : log.action}
              </Badge>
              <span className="text-xs">
                {auditLabels[log.entity] ?? "سجل مرتبط"}
              </span>
              <span className="text-xs text-muted-foreground">
                {log.actor_id ? (names[log.actor_id] ?? "حساب سابق") : "النظام"}
              </span>
            </div>
            <time
              dateTime={log.created_at}
              className="text-[10px] text-muted-foreground"
            >
              {new Intl.DateTimeFormat("ar-EG", {
                timeZone: "Africa/Cairo",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(log.created_at))}
            </time>
          </div>
          <details className="rounded-xl border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer">عرض التغييرات</summary>
            <div className="mt-4 space-y-3">
              {auditChanges(log.old_data, log.new_data).map((change) => (
                <div
                  key={change.key}
                  className="rounded-xl border bg-white p-4"
                >
                  <p className="mb-3 font-medium">{change.label}</p>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 leading-7">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">قبل</p>
                      <AuditValue value={change.before} field={change.key} />
                    </div>
                    <span aria-label="أصبح" className="pt-6 text-primary">
                      ←
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">بعد</p>
                      <AuditValue value={change.after} field={change.key} />
                    </div>
                  </div>
                </div>
              ))}
              {!auditChanges(log.old_data, log.new_data).length && (
                <p className="p-3 text-muted-foreground">
                  تحديث بيانات مرتبطة بالسجل.
                </p>
              )}
            </div>
          </details>
        </article>
      ))}
      {!logs.length && (
        <p className="p-10 text-center text-xs text-muted-foreground">
          لا توجد أحداث مطابقة.
        </p>
      )}
    </section>
  );
}
export type BookingSummary = {
  id: string;
  starts_on: string;
  returns_on: string;
  status: string;
  agreed_price_piasters: number;
  dressName: string;
};
const statusLabels: Record<string, string> = {
  confirmed: "مؤكد",
  out: "خارج الأتيليه",
  returned: "تم الاستلام",
  cancelled: "ملغي",
};
export function BookingList({
  bookings,
  preview = false,
}: {
  bookings: BookingSummary[];
  preview?: boolean;
}) {
  return (
    <div className="studio-card divide-y">
      {bookings.map((b) => (
        <Link
          key={b.id}
          href={preview ? "/demo" : `/workspace/bookings/${b.id}`}
          className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-muted/30"
        >
          <div>
            <h3 className="mb-2 text-sm">{b.dressName}</h3>
            <p
              dir="ltr"
              className="font-mono text-[10px] text-muted-foreground"
            >
              {bookingNumber(b.id) ? `حجز ${bookingNumber(b.id)}` : ""}
            </p>
          </div>
          <div className="space-y-2 text-xs">
            <p dir="ltr">
              {b.starts_on} → {b.returns_on}
            </p>
            <p className="text-muted-foreground">
              قيمة الحجز: {money(b.agreed_price_piasters)}
            </p>
          </div>
          <Badge variant="outline">{statusLabels[b.status] ?? b.status}</Badge>
        </Link>
      ))}
      {!bookings.length && (
        <p className="p-8 text-center text-xs text-muted-foreground">
          لا توجد حجوزات مرئية لهذا الحساب.
        </p>
      )}
    </div>
  );
}
export type LedgerRow = {
  id: string;
  amount_piasters: number;
  method: string | null;
  kind: string;
  recorded_at: string;
};
export function BookingLedger({
  price,
  fees,
  payments,
  cancelled = false,
}: {
  cancelled?: boolean;
  price: number;
  fees: number | string;
  payments: LedgerRow[];
}) {
  const paid = payments.reduce(
    (sum, p) => sum + BigInt(String(p.amount_piasters)),
    BigInt(0),
  );
  const priceValue = BigInt(String(price)),
    feesValue = BigInt(String(fees));
  const totals: [string, bigint][] = [
    [cancelled ? "قيمة الحجز قبل الإلغاء" : "قيمة الحجز", priceValue],
    ["غرامات مسجلة", feesValue],
    ["دفعات مسجلة", paid],
    ["المتبقي", cancelled ? BigInt(0) : priceValue + feesValue - paid],
  ];
  return (
    <div className="space-y-6">
      {cancelled && (
        <p className="rounded-xl border bg-secondary p-4 text-xs leading-8">
          الحجز ملغى؛ لا يُطالب بباقي قيمته. المقدم المسجل غير مسترد، والدفعات
          التاريخية محفوظة دون رد تلقائي.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {totals.map(([label, amount]) => (
          <div key={label} className="studio-card p-5">
            <p className="mb-4 text-[11px] text-muted-foreground">{label}</p>
            <p className="text-xl">
              {amount >= BigInt(0)
                ? aggregateMoney(amount.toString())
                : `-${aggregateMoney((-amount).toString())}`}
            </p>
          </div>
        ))}
      </div>
      <section className="studio-card p-6">
        <h2 className="mb-5 text-base">سجل الدفعات</h2>
        <div className="divide-y">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4 text-xs"
            >
              <div className="space-y-2">
                <p>
                  {p.kind === "deposit" ? "مقدم" : "دفعة"} ·{" "}
                  {p.method ?? "لم تسجل طريقة"}
                </p>
                <time
                  dateTime={p.recorded_at}
                  dir="ltr"
                  className="block text-[10px] text-muted-foreground"
                >
                  {recordedDay(p.recorded_at)}
                </time>
              </div>
              <p>{money(Number(p.amount_piasters))}</p>
            </div>
          ))}
          {!payments.length && (
            <p className="py-4 text-xs text-muted-foreground">
              لا توجد دفعات مسجلة.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
