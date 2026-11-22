export const SYNTHETIC_PHONE_PATTERN = "TEST-[A-Za-z0-9_\\-]{1,18}";
export function validBookingPhone(value: string, synthetic: boolean) {
  if (synthetic) return /^TEST-[A-Za-z0-9_-]{1,18}$/.test(value);
  return /^[+0-9 ()-]+$/.test(value) && value.replace(/\D/g, "").length >= 5;
}
export function validSyntheticName(value: string) {
  return value.startsWith("اختبار ") && value.slice(7).trim().length > 0;
}
