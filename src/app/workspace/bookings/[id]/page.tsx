import { BookingEditPanel } from "@/components/atelier/booking-edit-panel";
import { CancellationPanel } from "@/components/atelier/cancellation-panel";
import { BookingWorkflow } from "@/components/atelier/booking-workflow";
import { workflowSchema } from "@/lib/workflow";
import { money } from "@/lib/domain";
import {
  getBookingConfig,
  bookingConfigReady,
  workflowReady,
} from "@/lib/booking-config";
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
      "id,version,dress_id,customer_id,starts_on,returns_on,status,agreed_price_piasters,dresses(name,code),customers(full_name,phone)",
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
  const { data: workflowRaw, error: workflowError } = await db.rpc(
    "get_booking_workflow",
    { p_booking_id: id },
  );
  const workflow = !workflowError
    ? workflowSchema.safeParse(workflowRaw)
    : null;
  const feeTotal = (fees ?? []).reduce(
    (sum, f) => sum + BigInt(String(f.amount_piasters)),
    BigInt(0),
  );
  const paidTotal = (payments ?? []).reduce(
    (sum, p) => sum + BigInt(String(p.amount_piasters)),
    BigInt(0),
  );
  const remaining =
    BigInt(String(b.agreed_price_piasters)) + feeTotal - paidTotal;
  const changeResult =
    profile.role === "admin" && config?.booking_edit_ready
      ? await db
          .from("booking_changes")
          .select(
            "id,reason,old_start,old_return,new_start,new_return,old_price_piasters,new_price_piasters,recorded_by,created_at,profiles(full_name)",
          )
          .eq("booking_id", id)
          .order("created_at", { ascending: false })
          .limit(100)
      : null;
  const changes = (changeResult?.data ?? []).map((h) => ({
    ...h,
    old_price_piasters: String(h.old_price_piasters),
    new_price_piasters: String(h.new_price_piasters),
    actor_name:
      (Array.isArray(h.profiles) ? h.profiles[0] : h.profiles)?.full_name ??
      null,
  }));
  const cancellationResult = config?.cancellation_ready
    ? await db
        .from("booking_cancellations")
        .select("reason,retained_deposit_piasters,created_at")
        .eq("booking_id", id)
        .maybeSingle()
    : null;
  const cancellation = cancellationResult?.data
    ? {
        ...cancellationResult.data,
        retained_deposit_piasters: String(
          cancellationResult.data.retained_deposit_piasters,
        ),
      }
    : null;
  const depositTotal = (payments ?? [])
    .filter((p) => p.kind === "deposit")
    .reduce((sum, p) => sum + BigInt(String(p.amount_piasters)), BigInt(0));
  const receiptContext =
    b.status === "confirmed" && paidTotal === BigInt(0)
      ? "deposit"
      : b.status === "out" && remaining > BigInt(0)
        ? "return_balance"
        : null;
  const capped =
    remaining > BigInt(9999999999) ? BigInt(9999999999) : remaining;
  const amountDefault =
    capped > BigInt(0)
      ? `${capped / BigInt(100)}.${String(capped % BigInt(100)).padStart(2, "0")}`
      : undefined;
  const dress = Array.isArray(b.dresses) ? b.dresses[0] : b.dresses;
  const customer = Array.isArray(b.customers) ? b.customers[0] : b.customers;
  return (
    <StaffFrame
      title={`حجز ${dress?.name ?? ""}`}
      description="تفاصيل الحجز وسجل مبالغه المستلمة والمستحقة ضمن صلاحيات الحساب. لا تحصيل إلكتروني. التسليم والعودة والفحص بحسب الصلاحيات. الإلغاء للأدمن قبل التسليم فقط، والمقدم غير مسترد. لا ردّ مبالغ تلقائي."
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
            cancelled={b.status === "cancelled"}
            price={Number(b.agreed_price_piasters)}
            fees={feeTotal.toString()}
            payments={payments ?? []}
          />
          {!!fees?.length && (
            <section className="studio-card p-6">
              <h2 className="mb-4 text-sm">تفاصيل الغرامات المسجلة</h2>
              {fees.map((f) => (
                <p key={f.id} className="py-2 text-xs leading-7">
                  {money(Number(f.amount_piasters))} · {f.reason}
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
          context={receiptContext}
          defaultAmount={
            receiptContext === "return_balance" ? amountDefault : undefined
          }
          enabled={
            bookingConfigReady(config) &&
            config?.receipt_timing_ready === true &&
            !!receiptContext
          }
        />
      )}
      {!paymentError &&
        !feeError &&
        (workflow?.success ? (
          <BookingWorkflow
            admin={profile.role === "admin"}
            key={b.id}
            bookingId={b.id}
            dressId={b.dress_id}
            status={b.status}
            startsOn={b.starts_on}
            returnsOn={b.returns_on}
            paid={paidTotal.toString()}
            remaining={remaining.toString()}
            data={workflow.data}
            enabled={workflowReady(config)}
          />
        ) : (
          <Unavailable />
        ))}
      {!paymentError &&
        !feeError &&
        (changeResult?.error ? (
          <Unavailable />
        ) : (
          <BookingEditPanel
            booking={{
              id: b.id,
              version: b.version,
              starts_on: b.starts_on,
              returns_on: b.returns_on,
              agreed_price_piasters: String(b.agreed_price_piasters),
              status: b.status,
            }}
            paid={paidTotal.toString()}
            admin={profile.role === "admin"}
            enabled={
              bookingConfigReady(config) && config?.booking_edit_ready === true
            }
            history={changes}
          />
        ))}
      {cancellationResult?.error ? (
        <Unavailable />
      ) : (
        <CancellationPanel
          bookingId={b.id}
          status={b.status}
          admin={profile.role === "admin"}
          enabled={
            bookingConfigReady(config) && config?.cancellation_ready === true
          }
          deposit={depositTotal.toString()}
          cancellation={cancellation}
        />
      )}
      <p className="rounded-xl border border-pink-200 bg-pink-50 p-5 text-xs leading-7">
        العمليات والتقويم يستخدمان أيام مصر. الحالة المسجلة هنا لا تتغير تلقائيًا
        مع مرور الموعد؛ يلزم إجراء تسليم أو عودة معتمد.
      </p>
    </StaffFrame>
  );
}
