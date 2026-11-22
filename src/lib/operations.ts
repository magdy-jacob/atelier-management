import { addDays, validDay } from "./domain";

export type OperationBooking = {
  id: string;
  dressName: string;
  starts_on: string;
  returns_on: string;
  status: "confirmed" | "out" | "returned" | "cancelled";
};
export function monthWindow(value: string | undefined, today: string) {
  const month =
    value &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    validDay(`${value}-01`) &&
    Number(value.slice(0, 4)) > 0 &&
    Number(value.slice(0, 4)) < 9999
      ? value
      : today.slice(0, 7);
  const start = `${month}-01`;
  const nextDate = new Date(`${start}T12:00:00Z`);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
  const next = nextDate.toISOString().slice(0, 10);
  const previousDate = new Date(`${start}T12:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previous = previousDate.toISOString().slice(0, 7);
  const end = addDays(next, -1);
  // Arabic week begins on Saturday. Use date arithmetic, not a weekday guess.
  const offset = (new Date(`${start}T12:00:00Z`).getUTCDay() + 1) % 7;
  const days = Array.from({ length: Number(end.slice(8)) }, (_, i) =>
    addDays(start, i),
  );
  return { month, start, end, previous, next: next.slice(0, 7), offset, days };
}
export function operationalAlerts(bookings: OperationBooking[], today: string) {
  const active = bookings.filter((b) => b.status !== "cancelled");
  return {
    outgoing: active.filter(
      (b) => b.status === "confirmed" && b.starts_on === addDays(today, 1),
    ),
    outgoingToday: active.filter(
      (b) => b.status === "confirmed" && b.starts_on === today,
    ),
    incoming: active.filter(
      (b) => b.status === "out" && b.returns_on === today,
    ),
    overdue: active.filter((b) => b.status === "out" && b.returns_on < today),
    unrecorded: active.filter(
      (b) => b.status === "confirmed" && b.starts_on < today,
    ),
  };
}
export function plannedDayBookings(bookings: OperationBooking[], day: string) {
  return bookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        b.starts_on <= day &&
        addDays(b.returns_on, 1) >= day,
    )
    .map((b) => ({ ...b, preparation: day === addDays(b.returns_on, 1) }));
}
