export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  Unavailable,
} from "@/components/atelier/staff-frame";
import { BookingList } from "@/components/atelier/records";
import { displayCustomerName, displayCustomerPhone } from "@/lib/presentation";

export default async function CustomerHistory({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, profile } = await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("id,full_name,phone")
    .eq("id", id)
    .maybeSingle();
  if (customerError) throw new Error("تعذر تحميل العميل.");
  if (!customer) notFound();

  const cleanName = displayCustomerName(customer.full_name);

  // Find all customer entries sharing the same clean name
  const { data: allCustomers } = await db
    .from("customers")
    .select("id,full_name,phone");

  const matchingCustomers = (allCustomers ?? [customer]).filter(
    (c) =>
      displayCustomerName(c.full_name).toLowerCase() ===
      cleanName.toLowerCase(),
  );

  const matchingIds = [...new Set(matchingCustomers.map((c) => c.id))];
  if (!matchingIds.includes(id)) {
    matchingIds.push(id);
  }

  const uniquePhones = [
    ...new Set(
      matchingCustomers
        .map((c) => displayCustomerPhone(c.phone))
        .filter((p) => p && p !== "—"),
    ),
  ];

  const { data, error } = await db
    .from("bookings")
    .select(
      "id,starts_on,returns_on,status,agreed_price_piasters,dresses(name)",
    )
    .in("customer_id", matchingIds)
    .order("starts_on", { ascending: false })
    .limit(100);

  const bookings = (data ?? []).map((b) => ({
    ...b,
    dressName:
      (Array.isArray(b.dresses) ? b.dresses[0] : b.dresses)?.name ??
      "فستان غير متاح",
  }));

  const phoneDescription =
    uniquePhones.length > 0 ? `الهاتف: ${uniquePhones.join(" ، ")}` : "";
  const countDescription = `إجمالي الحجوزات: ${bookings.length}`;
  const description = [phoneDescription, countDescription]
    .filter(Boolean)
    .join(" · ");

  return (
    <StaffFrame
      title={cleanName}
      description={description}
      name={profile.full_name}
      role={profile.role}
      active="/workspace/customers"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/workspace/customers"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          → العودة لقائمة العملاء
        </Link>
      </div>
      {error ? <Unavailable /> : <BookingList bookings={bookings} />}
    </StaffFrame>
  );
}
