import { bookingNumber, displayCustomerName } from "./presentation";
import type { WorkspaceBooking } from "@/components/atelier/workspace-overview";
type Relation<T> = T | T[] | null;
export type WorkspaceImage = { id: string; path: string; sort_order: number };
export type WorkspaceBookingRecord = {
  id: string;
  starts_on: string;
  returns_on: string;
  status: string;
  agreed_price_piasters: number | string;
  dresses: Relation<{ name: string; dress_images: WorkspaceImage[] }>;
  customers: Relation<{ full_name: string }>;
  payments: { amount_piasters: number | string }[];
  late_fees: { amount_piasters: number | string }[];
};
export function firstWorkspaceImage(
  images: WorkspaceImage[],
  urlFor: (path: string) => string,
) {
  const image = [...images].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  )[0];
  return image ? urlFor(image.path) : "/placeholder.svg";
}
export function bookingForWorkspace(
  b: WorkspaceBookingRecord,
  urlFor: (path: string) => string,
): WorkspaceBooking {
  const d = Array.isArray(b.dresses) ? b.dresses[0] : b.dresses;
  const c = Array.isArray(b.customers) ? b.customers[0] : b.customers;
  const total =
    BigInt(String(b.agreed_price_piasters)) +
    (b.late_fees ?? []).reduce(
      (s, p) => s + BigInt(String(p.amount_piasters)),
      BigInt(0),
    ) -
    (b.payments ?? []).reduce(
      (s, p) => s + BigInt(String(p.amount_piasters)),
      BigInt(0),
    );
  return {
    id: b.id,
    dressName: d?.name ?? "فستان غير متاح",
    image: firstWorkspaceImage(d?.dress_images ?? [], urlFor),
    customerName: bookingNumber(b.id)
      ? `عملية ${bookingNumber(b.id)}`
      : displayCustomerName(c?.full_name, "عميل غير متاح"),
    starts_on: b.starts_on,
    returns_on: b.returns_on,
    status: b.status,
    remaining:
      b.status === "cancelled" || total < BigInt(0) ? "0" : total.toString(),
  };
}
export const workspaceBookingColumns =
  "id,starts_on,returns_on,status,agreed_price_piasters,dresses(name,dress_images(id,path,sort_order)),customers(full_name),payments(amount_piasters),late_fees(amount_piasters)";
