import {
  AuditTable,
  BookingList,
  type AuditRecord,
  type BookingSummary,
} from "@/components/atelier/records";
export function DressHistory({
  admin,
  bookings,
  logs,
  names = {},
  preview = false,
}: {
  admin: boolean;
  bookings: BookingSummary[];
  logs: AuditRecord[];
  names?: Record<string, string>;
  preview?: boolean;
}) {
  if (!admin) return null;
  return (
    <section className="mt-10 space-y-6 border-t pt-8">
      <h2 className="text-xl">حجوزات الفستان وتاريخه، للأدمن</h2>
      <p className="text-xs leading-8 text-muted-foreground">
        آخر ١٠ حجز لهذا الفستان، بما فيها الملغاة والعائدة. افتح الحجز لسجل
        المبالغ والسبب والتسليم والعودة. لا تُحذف الحجوزات عند أرشفة الفستان.
      </p>
      <BookingList bookings={bookings} preview={preview} />
      <h3 className="text-base">تغييرات بيانات الفستان وصوره ومواعيد حجوزه</h3>
      <p className="text-xs leading-8 text-muted-foreground">
        آخر ١٠ حدث مرتبط مباشرة بمعرف الفستان أو بياناته السابقة/الجديدة.
        تفاصيل المبالغ وأسباب تعديل كل حجز داخل سجله؛ هذه القائمة ليست كل النشاط
        المالي. 
      </p>
      <AuditTable logs={logs} names={names} />
    </section>
  );
}
