import Link from "next/link";
import { StaffFrame } from "@/components/atelier/staff-frame";
import { PortfolioScenarioForm } from "@/components/atelier/portfolio-scenario-form";
import { LiveBookingForm } from "@/components/atelier/live-booking-forms";
export default async function PortfolioPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const booking = (await searchParams).view === "booking";
  return (
    <StaffFrame
      preview
      title={booking ? "حجز مصطنع، معاينة النموذج" : "تجربة المشروع"}
      description="هذه معاينة لا تحفظ. الاختبار الوظيفي الفعلي داخل مساحة العمل المحمية، ببيانات Supabase منفصلة عن هذه الصفحة."
      name="أدمن تجريبي"
      role="admin"
      active="/workspace/portfolio"
    >
      <nav
        aria-label="معاينة الاختبار الوظيفي"
        className="flex flex-wrap gap-3 text-xs"
      >
        <Link
          href="/demo/portfolio"
          className="rounded-full border bg-white px-4 py-3"
        >
          سيناريوهات اليوم
        </Link>
        <Link
          href="/demo/portfolio?view=booking"
          className="rounded-full border bg-white px-4 py-3"
        >
          نموذج حجز مصطنع
        </Link>
        <Link
          href="/workspace/portfolio"
          className="rounded-full border bg-secondary px-4 py-3"
        >
          فتح التجربة المحفوظة، بدخول الأدمن
        </Link>
      </nav>
      {booking ? (
        <LiveBookingForm
          preview
          synthetic
          enabled
          dresses={[
            {
              id: "d0000000-0000-4000-8000-000000000001",
              name: "اختبار همسة زيتون",
              code: "DEMO-001",
            },
          ]}
          methods={[]}
          requestId="a0000000-0000-4000-8000-000000000001"
          minDay="2026-12-06"
        />
      ) : (
        <PortfolioScenarioForm
          preview
          enabled
          staff={[
            {
              id: "22222222-2222-4222-8222-222222222222",
              full_name: "موظف تجريبي",
            },
          ]}
        />
      )}
    </StaffFrame>
  );
}
