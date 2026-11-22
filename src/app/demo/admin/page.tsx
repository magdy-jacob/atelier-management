import { DashboardPeriodForm } from "@/components/atelier/dashboard-period";
import { StaffFrame } from "@/components/atelier/staff-frame";
import { AdminSummary } from "@/components/atelier/admin-summary";
export default function AdminPreview() {
  return (
    <StaffFrame
      preview
      title="لوحة الأدمن"
      description="معاينة بتواريخ وأرقام مصطنعة فقط. اللوحة الحقيقية للأدمن داخل مساحة العمل بعد الدخول، وهذه ليست بيانات الأتيليه."
      name="أدمن تجريبي"
      role="admin"
      active="/workspace/dashboard"
    >
      <DashboardPeriodForm preview from="2026-12-01" to="2026-12-05" />
      <AdminSummary
        preview
        data={{
          from: "2026-12-01",
          to: "2026-12-05",
          today: "2026-12-05",
          active_dresses: 6,
          public_available_dresses: 3,
          public_reserved_dresses: 2,
          public_unavailable_dresses: 1,
          archived_dresses: 0,
          active_employees: 2,
          confirmed_bookings: 1,
          outside_bookings: 2,
          returned_bookings: 0,
          overdue_bookings: 1,
          created_in_period: 3,
          receipt_count: 3,
          receipt_piasters: "750000",
          fee_count: 0,
          fee_piasters: "0",
          outstanding_piasters: "200000",
        }}
      />
    </StaffFrame>
  );
}
