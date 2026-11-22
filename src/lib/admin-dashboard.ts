import { z } from "zod";
const count = z.number().int().nonnegative();
const piasters = z.string().regex(/^\d+$/);
export const dashboardSchema = z.object({
  from: z.string(),
  to: z.string(),
  today: z.string(),
  active_dresses: count,
  archived_dresses: count,
  active_employees: count,
  confirmed_bookings: count,
  outside_bookings: count,
  returned_bookings: count,
  overdue_bookings: count,
  created_in_period: count,
  receipt_count: count,
  receipt_piasters: piasters,
  fee_count: count,
  fee_piasters: piasters,
  outstanding_piasters: piasters,
});
export type AdminDashboardData = z.infer<typeof dashboardSchema>;
export function aggregateMoney(value: string) {
  if (!/^\d+$/.test(value)) throw new Error("Invalid aggregate amount");
  const amount = BigInt(value),
    whole = amount / BigInt(100),
    cents = amount % BigInt(100);
  const fraction = new Intl.NumberFormat("ar-EG", {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(cents);
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(whole)
    .map((p) => (p.type === "fraction" ? fraction : p.value))
    .join("");
}
