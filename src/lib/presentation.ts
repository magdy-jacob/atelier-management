import { dateInZone, formatDay } from "./domain";
// Original fixture references keep their existing number, never truncate arbitrary UUIDs.
export function bookingNumber(id: string) {
  const match = /^b0000000-0000-4000-8000-(\d{12})$/.exec(id);
  return match ? String(BigInt(match[1])) : null;
}
export function recordedDay(instant: string) {
  return formatDay(dateInZone(instant, "Africa/Cairo"));
}
export function cairoMidnight(day: string) {
  // Find the first instant in the Cairo calendar day, including midnight DST gaps.
  let low = Date.parse(`${day}T00:00:00Z`) - 36 * 60 * 60 * 1000;
  let high = low + 72 * 60 * 60 * 1000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (dateInZone(new Date(mid), "Africa/Cairo") < day) low = mid + 1;
    else high = mid;
  }
  return new Date(low).toISOString();
}
export const auditLabels: Record<string, string> = {
  profiles: "الفريق",
  settings: "الإعدادات",
  categories: "التصنيفات",
  dresses: "الفساتين",
  dress_prices: "أسعار الفساتين",
  dress_operations: "حالة الفستان",
  dress_images: "صور الفساتين",
  customers: "العملاء",
  bookings: "الحجوزات",
  payments: "الدفعات",
  late_fees: "الغرامات",
  booking_changes: "تعديلات الحجوزات",
  booking_cancellations: "إلغاء الحجوزات",
  receipt_confirmations: "تأكيد القبض",
  employee_account_jobs: "إنشاء الموظفين",
  employee_profile_changes: "تعديلات الموظفين",
  name: "الاسم",
  full_name: "الاسم",
  code: "الكود",
  color: "اللون",
  size: "المقاس",
  active: "نشط",
  archived: "مؤرشف",
  public_availability: "حالة العرض",
  role: "الصلاحية",
  status: "الحالة",
  sort_order: "ترتيب الصورة",
  note: "ملاحظة",
  reason: "السبب",
  method: "طريقة الدفع",
  kind: "النوع",
  starts_on: "من يوم",
  returns_on: "إلى يوم",
  created_at: "تاريخ الإنشاء",
  recorded_at: "تاريخ التسجيل",
  amount_piasters: "المبلغ",
  agreed_price_piasters: "قيمة الحجز",
  advisory_price_piasters: "السعر الاسترشادي",
  minimum_price_piasters: "السعر من",
  maximum_price_piasters: "السعر إلى",
  old_start: "الموعد السابق",
  new_start: "الموعد الجديد",
  old_return: "العودة السابقة",
  new_return: "العودة الجديدة",
  old_price_piasters: "السعر السابق",
  new_price_piasters: "السعر الجديد",
  retained_deposit_piasters: "المقدم المحتفظ به",
  p_active: "نشط",
  p_name: "الاسم",
  p_reason: "السبب",
  action: "الإجراء",
};
export const valueLabels: Record<string, string> = {
  available: "متاح",
  reserved: "محجوز",
  unavailable: "غير متاح",
  confirmed: "مؤكد",
  out: "خارج الأتيليه",
  returned: "تمت العودة",
  cancelled: "ملغي",
  admin: "أدمن",
  employee: "موظف",
  deposit: "مقدم",
  payment: "دفعة",
  pending: "قيد الانتظار",
  completed: "مكتمل",
  in_atelier: "داخل الأتيليه",
  outside: "خارج الأتيليه",
  preparation: "تجهيز",
  maintenance: "صيانة",
};
export function auditChanges(oldData: unknown, newData: unknown) {
  const old =
    oldData && typeof oldData === "object"
      ? (oldData as Record<string, unknown>)
      : {};
  const next =
    newData && typeof newData === "object"
      ? (newData as Record<string, unknown>)
      : {};
  return [...new Set([...Object.keys(old), ...Object.keys(next)])]
    .filter(
      (key) =>
        auditLabels[key] &&
        JSON.stringify(old[key]) !== JSON.stringify(next[key]),
    )
    .map((key) => ({
      key,
      label: auditLabels[key],
      before: old[key],
      after: next[key],
    }));
}
