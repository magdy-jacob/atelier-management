import { StaffFrame } from "@/components/atelier/staff-frame";
import { TeamManager } from "@/components/atelier/team-manager";
export default function TeamPreview() {
  const actor = "11111111-1111-4111-8111-111111111111";
  return (
    <StaffFrame
      preview
      title="الفريق والصلاحيات"
      description="معاينة الحسابات المصطنعة. الإنشاء الفعلي للأدمن عبر مساحة العمل بعد إعداد Auth الإداري، دون إرسال بريد."
      name="أدمن تجريبي"
      role="admin"
      active="/workspace/team"
    >
      <TeamManager
        preview
        managementEnabled
        creationEnabled
        actorId={actor}
        profiles={[
          {
            id: actor,
            full_name: "أدمن تجريبي",
            role: "admin",
            active: true,
            version: 1,
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            full_name: "اختبار موظف التنسيق",
            role: "employee",
            active: true,
            version: 2,
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            full_name: "اختبار موظف سابق",
            role: "employee",
            active: false,
            version: 3,
          },
        ]}
        jobs={[
          {
            id: "44444444-4444-4444-8444-444444444444",
            request_id: "55555555-5555-4555-8555-555555555555",
            actor_id: actor,
            user_id: "66666666-6666-4666-8666-666666666666",
            full_name: "اختبار موظف محفوظ",
            email: "test-pending@example.invalid",
            status: "pending",
          },
        ]}
      />
    </StaffFrame>
  );
}
