export type Dress = {
  id: string;
  code: string;
  name: string;
  color: string;
  size: string;
  category: string;
  availability: "available" | "reserved" | "unavailable";
  image: string;
  images?: string[];
};
export const availabilityLabels = {
  available: "متاح",
  reserved: "محجوز",
  unavailable: "غير متاح",
};
export const sampleDresses: Dress[] = [
  {
    id: "sage",
    code: "AT-001",
    name: "همسة زيتون",
    color: "أخضر مريمي",
    size: "M",
    category: "سهرة",
    availability: "available",
    image: "/dresses/sage.svg",
  },
  {
    id: "rose",
    code: "AT-002",
    name: "وردة المساء",
    color: "وردي معتّق",
    size: "S",
    category: "خطوبة",
    availability: "reserved",
    image: "/dresses/rose.svg",
  },
  {
    id: "ivory",
    code: "AT-003",
    name: "لؤلؤة",
    color: "عاجي",
    size: "M",
    category: "أفراح",
    availability: "available",
    image: "/dresses/ivory.svg",
  },
  {
    id: "midnight",
    code: "AT-004",
    name: "ليلة مخمل",
    color: "أزرق ليلي",
    size: "L",
    category: "سهرة",
    availability: "available",
    image: "/dresses/midnight.svg",
  },
  {
    id: "plum",
    code: "AT-005",
    name: "لمسة ليلك",
    color: "موف",
    size: "S",
    category: "خطوبة",
    availability: "unavailable",
    image: "/dresses/plum.svg",
  },
  {
    id: "gold",
    code: "AT-006",
    name: "خيط دهب",
    color: "ذهبي",
    size: "L",
    category: "سهرة",
    availability: "available",
    image: "/dresses/gold.svg",
  },
];
export type Booking = {
  id: string;
  dressId: string;
  customer: string;
  phone: string;
  start: string;
  end: string;
  total: number;
  paid: number;
  status: "confirmed" | "out" | "returned" | "cancelled";
};
export const sampleBookings: Booking[] = [
  {
    id: "BK-1024",
    dressId: "sage",
    customer: "عميلة تجريبية ١",
    phone: "01X XXX 0001",
    start: "2026-12-05",
    end: "2026-12-06",
    total: 300000,
    paid: 100000,
    status: "confirmed",
  },
  {
    id: "BK-1023",
    dressId: "rose",
    customer: "عميلة تجريبية ٢",
    phone: "01X XXX 0002",
    start: "2026-12-04",
    end: "2026-12-05",
    total: 400000,
    paid: 400000,
    status: "out",
  },
  {
    id: "BK-1022",
    dressId: "midnight",
    customer: "عميلة تجريبية ٣",
    phone: "01X XXX 0003",
    start: "2026-12-03",
    end: "2026-12-04",
    total: 250000,
    paid: 250000,
    status: "out",
  },
];
export function addDays(day: string, n: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day)) &&
    new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day
  );
}
// Inclusive return date + one complete preparation day. Half-open [start, return+2).
export function overlaps(
  a: Pick<Booking, "start" | "end">,
  b: Pick<Booking, "start" | "end">,
) {
  return a.start < addDays(b.end, 2) && b.start < addDays(a.end, 2);
}
export function firstAvailable(
  start: string,
  duration: number,
  bookings: Booking[],
  dressId: string,
): string {
  let candidate = start;
  for (let i = 0; i <= bookings.length; i++) {
    const conflict = bookings.find(
      (b) =>
        b.dressId === dressId &&
        b.status !== "cancelled" &&
        overlaps({ start: candidate, end: addDays(candidate, duration) }, b),
    );
    if (!conflict) return candidate;
    candidate = addDays(conflict.end, 2);
  }
  throw new Error("Could not find availability");
}
export const formatDay = (day: string) =>
  new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));

export const money = (piasters: number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(piasters / 100);
export function toPiasters(value: string): number {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Error("اكتب مبلغًا صحيحًا بحد أقصى خانتين عشريتين");
  const [pounds, cents = ""] = value.split(".");
  return Number(pounds) * 100 + Number(cents.padEnd(2, "0"));
}
