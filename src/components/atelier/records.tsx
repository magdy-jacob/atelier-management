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
                {log.action}
              </Badge>
              <span dir="ltr" className="font-mono text-xs">
                {log.entity}
              </span>
              <span className="text-xs text-muted-foreground">
                {log.actor_id
                  ? (names[log.actor_id] ?? log.actor_id.slice(0, 8))
                  : "النظام"}
              </span>
            </div>
            <time
              dateTime={log.created_at}
              dir="ltr"
              className="text-[10px] text-muted-foreground"
            >
              {new Date(log.created_at)
                .toISOString()
                .replace("T", " ")
                .replace(".000Z", " UTC")}
            </time>
          </div>
          <p
            dir="ltr"
            className="break-all text-left font-mono text-[10px] text-muted-foreground"
          >
            {log.entity_id ?? "بدون معرف كيان"}
          </p>
          <details className="rounded-xl border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer">
              عرض القيم السابقة والجديدة
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ["قبل", log.old_data],
                ["بعد", log.new_data],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="mb-2 text-muted-foreground">{String(label)}</p>
                  <pre
                    dir="ltr"
                    className="max-h-72 overflow-auto rounded-lg bg-white p-3 text-left text-[10px] leading-6 whitespace-pre-wrap break-all"
                  >
                    {JSON.stringify(value, null, 2) ?? "null"}
                  </pre>
                </div>
              ))}
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
              {b.id.slice(0, 12)}
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
                  {new Date(p.recorded_at).toISOString().replace("T", " ")}
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
        <p className="mt-5 text-[10px] leading-7 text-muted-foreground">
          هذه مبالغ مسجلة في النظام، وليست إثباتًا مستقلًا لوصول تحويل بنكي أو
          تحصيل إلكتروني. الأوقات المعروضة UTC. لا توجد أزرار دفع أو استرداد
          هنا.
        </p>
      </section>
    </div>
  );
}
