export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireStaff } from "@/lib/supabase/auth";
import { getBookingConfig, bookingConfigReady } from "@/lib/booking-config";
import { functionalPortfolioEnabled } from "@/lib/portfolio-mode";
import {
  StaffFrame,
  AdminOnly,
  Unavailable,
} from "@/components/atelier/staff-frame";
import { PortfolioScenarioForm } from "@/components/atelier/portfolio-scenario-form";
import { formatDay, dateInZone } from "@/lib/domain";
const labels: Record<string, string> = {
  handover: "تسليم",
  return: "عودة",
  overdue: "تأخير",
};
export default async function Portfolio() {
  const { db, profile } = await requireStaff();
  const frame = {
    title: "تجربة المشروع",
    name: profile.full_name,
    role: profile.role,
    active: "/workspace/portfolio",
  };
  if (profile.role !== "admin")
    return (
      <StaffFrame {...frame}>
        <AdminOnly />
      </StaffFrame>
    );
  const [config, staff, scenarios] = await Promise.all([
    getBookingConfig(db),
    db
      .from("profiles")
      .select("id,full_name")
      .eq("active", true)
      .order("full_name"),
    db
      .from("portfolio_scenarios")
      .select("booking_id,kind,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const enabled =
    functionalPortfolioEnabled() &&
    config?.synthetic_test_enabled === true &&
    bookingConfigReady(config);
  return (
    <StaffFrame
      {...frame}
      description="اختبار وظيفي محفوظ في Supabase على بيانات مصطنعة. لا عملاء أو التزامات حقيقية، ولا تغيير لجمهور الموقع أو صلاحيات الحسابات."
    >
      {staff.error || scenarios.error ? (
        <Unavailable />
      ) : (
        <>
          <PortfolioScenarioForm enabled={enabled} staff={staff.data ?? []} />
          <section className="studio-card space-y-4 p-6">
            <h2 className="text-lg">آخر السيناريوهات المحفوظة</h2>
            <p className="text-xs leading-7 text-muted-foreground">
              بعد الإنشاء افتح الحجز وجرب عملياته. الموظف المسند له يفتحه من
              حسابه وصلاحياته المعتادة. الفستان الجديد بلا صور؛ يمكن للأدمن رفع
              صور مولدة له من المخزون. لا تُرفع هويات أو بيانات حقيقية. تظهر هنا
              آخر ٢٠ نتيجة فقط.
            </p>
            {!scenarios.data?.length && (
              <p className="text-xs text-muted-foreground">
                لم تُنشأ سيناريوهات بعد.
              </p>
            )}
            {scenarios.data?.map((s) => (
              <Link
                key={s.booking_id}
                href={`/workspace/bookings/${s.booking_id}`}
                className="flex flex-wrap justify-between gap-3 rounded-xl border bg-white p-4 text-xs leading-7"
              >
                <span>اختبار {labels[s.kind] ?? s.kind}</span>
                <span>
                  {formatDay(
                    dateInZone(new Date(s.created_at), "Africa/Cairo"),
                  )}
                </span>
                <span className="text-primary underline">افتح الحجز</span>
              </Link>
            ))}
          </section>
        </>
      )}
    </StaffFrame>
  );
}
