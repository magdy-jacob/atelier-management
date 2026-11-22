export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  AdminOnly,
  Unavailable,
} from "@/components/atelier/staff-frame";
import { DashboardPeriodForm } from "@/components/atelier/dashboard-period";
import { ReceiptReport } from "@/components/atelier/receipt-report";
import { receiptReportSchema, reportPeriod } from "@/lib/receipt-report";
import { validDay } from "@/lib/domain";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return (
      <StaffFrame
        title="تقارير القبض"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/reports"
      >
        <AdminOnly />
      </StaffFrame>
    );
  const query = await searchParams,
    p = reportPeriod(query.from, query.to);
  const response = p.valid
    ? await db.rpc("admin_receipt_report", { p_from: p.from, p_to: p.to })
    : null;
  const parsed =
    response && !response.error
      ? receiptReportSchema.safeParse(response.data)
      : null;
  return (
    <StaffFrame
      title="دفتر القبض والتصدير"
      description="للأدمن فقط. قراءة الحركات المسجلة فعليًا خلال فترة محددة، بتوقيت مصر. لا تحصيل إلكتروني ولا إرسال الملف لأحد تلقائيًا."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/reports"
    >
      <DashboardPeriodForm
        from={validDay(p.from) ? p.from : ""}
        to={validDay(p.to) ? p.to : ""}
      />
      {!p.valid ? (
        <p role="alert" className="studio-card p-5">
          اختر فترة صحيحة حتى ٣٦٦ يومًا؛ لم تُستخدم فترة بديلة.
        </p>
      ) : response?.error?.message.includes(
          "report_too_large_narrow_period",
        ) ? (
        <p role="alert" className="studio-card p-5">
          الفترة تتجاوز ٥٠٠٠ حركة. ضيّق الفترة؛ لم يُنشأ تقرير ناقص.
        </p>
      ) : parsed?.success ? (
        <ReceiptReport
          data={parsed.data}
          downloadHref={`/workspace/reports/download?from=${p.from}&to=${p.to}`}
        />
      ) : (
        <Unavailable />
      )}
    </StaffFrame>
  );
}
