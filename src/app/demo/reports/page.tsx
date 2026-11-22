import { StaffFrame } from "@/components/atelier/staff-frame";
import { ReceiptReport } from "@/components/atelier/receipt-report";
import { DashboardPeriodForm } from "@/components/atelier/dashboard-period";
import { demoReceiptReport } from "@/lib/demo-receipts";
export default function DemoReports() {
  return (
    <StaffFrame
      preview
      title="دفتر القبض والتصدير"
      description="بيانات مصطنعة للمعاينة فقط، ليست أرقام الأتيليه أو العملاء. ملف التجربة مصطنع بالكامل؛ التقرير الحقيقي داخل مساحة العمل للأدمن فقط."
      name="أدمن مصطنع"
      role="admin"
      active="/workspace/reports"
    >
      <DashboardPeriodForm
        preview
        from={demoReceiptReport.from}
        to={demoReceiptReport.to}
      />
      <ReceiptReport
        preview
        data={demoReceiptReport}
        downloadHref="/demo/reports/download"
      />
    </StaffFrame>
  );
}
