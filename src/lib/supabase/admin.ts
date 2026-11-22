import "server-only";
import { createClient } from "@supabase/supabase-js";
export function staffAuthConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  );
}
export function staffAuthAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("staff_auth_not_configured");
  // No cookie jar, incoming Authorization header, or persisted user session.
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
