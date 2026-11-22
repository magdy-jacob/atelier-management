import { StaffFrame } from "@/components/atelier/staff-frame";
import {
  LiveBookingForm,
  LivePaymentForm,
} from "@/components/atelier/live-booking-forms";
export default function BookingFormPreview() {
  return (
    <StaffFrame
      preview
      title="نماذج الحجز والدفعات"
      description="معاينة للحقول الحقيقية؛ لا يتم إرسال أو حفظ أي بيانات. التوقيت اليومي والحجز المسبق مؤكدان، وباقي إعدادات التشغيل لا تُفترض."
      name="موظف تجريبي"
      role="employee"
      active="/workspace/bookings"
    >
      <LiveBookingForm
        preview
        dresses={[{ id: "demo", name: "همسة زيتون", code: "AT-001" }]}
        methods={["كاش", "إنستاباي", "أورانج كاش", "فودافون كاش"]}
        enabled={false}
        requestId="demo-request"
      />
      <LivePaymentForm
        preview
        bookingId="demo-booking"
        methods={["كاش", "إنستاباي", "أورانج كاش", "فودافون كاش"]}
        enabled={false}
        requestId="demo-payment"
      />
    </StaffFrame>
  );
}
