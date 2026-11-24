export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/supabase/auth";
import { getBookingConfig, bookingConfigReady } from "@/lib/booking-config";
import { StaffFrame, Unavailable } from "@/components/atelier/staff-frame";
import { LiveBookingForm } from "@/components/atelier/live-booking-forms";
import { addDays, dateInZone } from "@/lib/domain";

export default async function NewBooking() {
  const { db, profile } = await requireStaff();
  const [config, { data: dresses, error }] = await Promise.all([
    getBookingConfig(db),
    db
      .from("dresses")
      .select("id,name,code")
      .eq("archived", false)
      .order("name"),
  ]);

  const tz = config?.business_timezone || "Africa/Cairo";
  const today = dateInZone(new Date(), tz);
  // Strictly prevent same-day bookings: earliest start is tomorrow
  const minDay = addDays(today, 1);

  // Fetch active/non-cancelled bookings to know occupied dates for each dress
  const { data: existingBookings } = await db
    .from("bookings")
    .select("dress_id,starts_on,returns_on")
    .neq("status", "cancelled");

  return (
    <StaffFrame
      title="حجز جديد"
      description="حجز داخلي بواسطة الفريق فقط. نتحقق من التعارض ويوم التجهيز في قاعدة البيانات قبل حفظ الحجز والمقدم في معاملة واحدة."
      name={profile.full_name}
      role={profile.role}
      active="/workspace/bookings"
    >
      {error ? (
        <Unavailable />
      ) : (
        <LiveBookingForm
          dresses={dresses ?? []}
          methods={config?.payment_methods ?? []}
          enabled={bookingConfigReady(config) && !!minDay}
          requestId={crypto.randomUUID()}
          minDay={minDay}
          synthetic={config?.synthetic_test_enabled === true}
          existingBookings={existingBookings ?? []}
        />
      )}
    </StaffFrame>
  );
}
