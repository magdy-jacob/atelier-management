import { getBookingConfig, bookingConfigReady } from "@/lib/booking-config";
import { LivePaymentForm } from "@/components/atelier/live-booking-forms";
export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/auth";
import { StaffFrame, Unavailable } from "@/components/atelier/staff-frame";
import { BookingLedger } from "@/components/atelier/records";
export default async function BookingDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, profile } = await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: b, error } = await db
    .from("bookings")
    .select(
      "id,dress_id,customer_id,starts_on,returns_on,status,agreed_price_piasters,dresses(name,code),customers(full_name,phone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("تعذر تحميل الحجز.");
  if (!b) notFound();
  const [
    { data: payments, error: paymentError },
    { data: fees, error: feeError },
  ] = await Promise.all([
    db
      .from("payments")
      .select("id,amount_piasters,method,kind,recorded_at")
      .eq("booking_id", id)
      .order("recorded_at"),
    db
      .from("late_fees")
      .select("id,amount_piasters,reason")
      .eq("booking_id", id),
  ]);
  const config = await getBookingConfig(db);
  const dress = Array.isArray(b.dresses) ? b.dresses[0] : b.dresses;
  const customer = Array.isArray(b.customers) ? b.customers[0] : b.customers;
  return (
    <StaffFrame
      title={`حجز ${dress?.name ?? ""}`}
      description="عرض للبيانات المسجلة فقط. التعديل والتحصيل والتسليم والعودة والاسترداد لا تزال معطلة حتى استكمال السياسات والربط."
      name={profile.full_name}
      role={profile.role}
      active="/workspace"
    >
      <section className="studio-card grid gap-6 p-6 text-xs md:grid-cols-3">
        <div>
          <p className="mb-3 text-muted-foreground">العميل</p>
          {profile.role === "admin" ? (
            <Link
              href={`/workspace/customers/${b.customer_id}`}
              className="underline underline-offset-4"
            >
              {customer?.full_name ?? "غير متاح"}
            </Link>
          ) : (
            <p>{customer?.full_name ?? "غير متاح"}</p>
          )}
          <p dir="ltr" className="mt-3 text-right">
            {customer?.phone}
          </p>
        </div>
        <div>
          <p className="mb-3 text-muted-foreground">الموعد المخطط بالأيام</p>
          <p dir="ltr" className="text-right">
            {b.starts_on} → {b.returns_on}
          </p>
          <p className="mt-3">الحالة المسجلة: {b.status}</p>
        </div>
        <div>
          <p className="mb-3 text-muted-foreground">مرجع الحجز</p>
          <p dir="ltr" className="break-all font-mono text-[10px]">
            {b.id}
          </p>
          <Link
            className="mt-3 inline-block underline underline-offset-4"
            href={`/workspace/dresses/${b.dress_id}`}
          >
            بيانات الفستان · {dress?.code}
          </Link>
        </div>
      </section>
      {paymentError || feeError ? (
        <Unavailable />
      ) : (
        <>
          <BookingLedger
            price={Number(b.agreed_price_piasters)}
            fees={(fees ?? []).reduce(
              (sum, f) => sum + Number(f.amount_piasters),
              0,
            )}
            payments={payments ?? []}
          />
          {!!fees?.length && (
            <section className="studio-card p-6">
              <h2 className="mb-4 text-sm">تفاصيل الغرامات المسجلة</h2>
              {fees.map((f) => (
                <p key={f.id} className="py-2 text-xs leading-7">
                  {f.reason}
                </p>
              ))}
            </section>
          )}
        </>
      )}
      {!paymentError && !feeError && (
        <LivePaymentForm
          bookingId={b.id}
          requestId={crypto.randomUUID()}
          methods={config?.payment_methods ?? []}
          enabled={
            !!(
              bookingConfigReady(config) &&
              ["confirmed", "out"].includes(b.status)
            )
          }
        />
      )}
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-xs leading-7">
        العمليات والتقويم يستخدمان أيام مصر. الحالة المسجلة هنا لا تتغير تلقائيًا
        مع مرور الموعد؛ يلزم إجراء تسليم أو عودة معتمد.
      </p>
    </StaffFrame>
  );
}
