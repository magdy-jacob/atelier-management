import "server-only";
import { z } from "zod";
import type { supabaseServer } from "./supabase/server";
const schema = z.object({
  live_bookings_enabled: z.boolean(),
  date_precision: z.string().nullable(),
  business_timezone: z.string().nullable(),
  same_day_allowed: z.boolean().nullable(),
  payment_methods: z.array(z.string()),
  payment_method_optional: z.boolean().default(false),
});
export type BookingConfig = z.infer<typeof schema>;
export async function getBookingConfig(
  db: Awaited<ReturnType<typeof supabaseServer>>,
): Promise<BookingConfig | null> {
  const { data, error } = await db.rpc("get_staff_booking_config");
  if (error) return null;
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
export function bookingConfigReady(c: BookingConfig | null) {
  return !!(
    c?.live_bookings_enabled &&
    c.date_precision === "day" &&
    c.business_timezone === "Africa/Cairo" &&
    c.same_day_allowed === false &&
    c.payment_method_optional
  );
}
