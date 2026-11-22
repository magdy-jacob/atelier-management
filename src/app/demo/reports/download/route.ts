import { demoReceiptReport } from "@/lib/demo-receipts";
import { receiptCSV, receiptDownloadHeaders } from "@/lib/receipt-report";
export function GET() {
  return new Response(receiptCSV(demoReceiptReport), {
    headers: receiptDownloadHeaders("lovely-DEMO-ONLY-receipts.csv"),
  });
}
