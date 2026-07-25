import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDishRisk,
  getIngredients,
  getRestaurantBySlug,
  getTables,
  getTodayOrders,
  type Restaurant,
} from "@/lib/engine";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "kitchen") redirect("/kitchen");

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
  if (!restaurant) notFound();

  const [orders, ingredients, tables, risk] = await Promise.all([
    getTodayOrders(supabase, restaurant.id),
    getIngredients(supabase, restaurant.id),
    getTables(supabase, restaurant.id),
    getDishRisk(supabase, restaurant.id),
  ]);

  return (
    <DashboardClient
      restaurant={restaurant}
      initialOrders={orders}
      initialIngredients={ingredients}
      initialTables={tables}
      initialRisk={risk}
      userEmail={user.email ?? ""}
    />
  );
}
