import type { ReceiptReportData } from "./receipt-report";
export const demoReceiptReport: ReceiptReportData = {
  from: "2026-12-01",
  to: "2026-12-05",
  generated_at: "2026-12-05T10:00:00Z",
  count: 2,
  amount_piasters: "300050",
  rows: [
    {
      receipt_id: "10000000-0000-4000-8000-000000000001",
      booking_id: "20000000-0000-4000-8000-000000000001",
      recorded_at: "2026-12-04T09:00:00Z",
      amount_piasters: "100025",
      method: null,
      dress_code: "DEMO-01",
      dress_name: "فستان عرض أول",
      customer_name: "عميلة مصطنعة أ",
      customer_phone: "DEMO-NO-PHONE-01",
      recorded_by_name: "موظف مصطنع",
    },
    {
      receipt_id: "10000000-0000-4000-8000-000000000002",
      booking_id: "20000000-0000-4000-8000-000000000002",
      recorded_at: "2026-12-05T08:30:00Z",
      amount_piasters: "200025",
      method: "استلام مصطنع",
      dress_code: "DEMO-02",
      dress_name: "فستان عرض ثانٍ",
      customer_name: "عميلة مصطنعة ب",
      customer_phone: "DEMO-NO-PHONE-02",
      recorded_by_name: "أدمن مصطنع",
    },
  ],
};
