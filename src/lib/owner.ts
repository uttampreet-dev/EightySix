import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantBySlug, type Restaurant } from "@/lib/engine";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type OwnerContext = {
  supabase: SupabaseClient;
  user: User;
  restaurant: Restaurant;
};

// Shared auth + restaurant resolution for every /dashboard page.
export async function getOwnerContext(next = "/dashboard"): Promise<OwnerContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "kitchen") redirect("/kitchen");
  if (profile?.role === "waiter") redirect("/waiter");

  let restaurant: Restaurant | null = null;
  if (profile?.restaurant_id) {
    const { data } = await supabase
      .from("restaurants")
      .select("id, name, slug, tagline")
      .eq("id", profile.restaurant_id)
      .maybeSingle();
    restaurant = data;
  }
  if (!restaurant) restaurant = await getRestaurantBySlug(supabase, "demo");
  if (!restaurant) redirect("/");

  return { supabase, user, restaurant };
}
