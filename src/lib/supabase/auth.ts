import "server-only";
import { redirect } from "next/navigation";
import { configured, supabaseServer } from "./server";
export async function requireStaff() {
  if (!configured()) redirect("/login");
  const db = await supabaseServer();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile } = await db
    .from("profiles")
    .select("id,full_name,role,active")
    .eq("id", user.id)
    .single();
  if (!profile?.active)
    throw new Error("الحساب غير نشط أو لم يمنح صلاحيات من الأدمن.");
  return { db, user, profile };
}
