export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/auth";
import {
  StaffFrame,
  Unavailable,
  AdminOnly,
} from "@/components/atelier/staff-frame";
import { BookingList } from "@/components/atelier/records";
export default async function CustomerHistory({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db, profile } = await requireStaff();
  if (profile.role !== "admin")
    return (
      <StaffFrame
        title="سجل العميل"
        name={profile.full_name}
        role={profile.role}
        active="/workspace/customers"
      >
        <AdminOnly />
      </StaffFrame>
    );
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("id,full_name,phone")
    .eq("id", id)
    .maybeSingle();
  if (customerError) throw new Error("تعذر تحميل العميل.");
  if (!customer) notFound();
  const { data, error } = await db
    .from("bookings")
    .select(
      "id,starts_on,returns_on,status,agreed_price_piasters,dresses(name)",
    )
    .eq("customer_id", id)
    .order("starts_on", { ascending: false })
    .limit(100);
  const bookings = (data ?? []).map((b) => ({
    ...b,
    dressName:
      (Array.isArray(b.dresses) ? b.dresses[0] : b.dresses)?.name ??
      "فستان غير متاح",
  }));
  return (
    <StaffFrame
      title={customer.full_name}
      description={`الهاتف: ${customer.phone}. آخر ١٠٠ حجز مرئي لهذا الحساب، وليس بالضرورة كل تاريخ العميل.`}
      name={profile.full_name}
      role={profile.role}
      active="/workspace/customers"
    >
      {error ? <Unavailable /> : <BookingList bookings={bookings} />}
    </StaffFrame>
  );
}
