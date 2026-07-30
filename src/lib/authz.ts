import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "kitchen" | "waiter";

export type StaffContext =
  | { ok: true; userId: string; role: StaffRole; restaurantId: string | null }
  | { ok: false; error: string };

// Server actions run with the service role, so RLS can't protect them —
// every privileged action must resolve the caller's session itself.
// Diner-facing actions (ordering, reserving, rating, calling a waiter)
// stay public by design; everything operational goes through this.
export async function requireStaff(
  roles: StaffRole[] = ["owner", "kitchen", "waiter"]
): Promise<StaffContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to do that." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, restaurant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !roles.includes(profile.role as StaffRole))
    return { ok: false, error: "Your role can't do that." };

  return {
    ok: true,
    userId: user.id,
    role: profile.role as StaffRole,
    restaurantId: profile.restaurant_id,
  };
}
