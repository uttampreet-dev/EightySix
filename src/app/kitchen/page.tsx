import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getIngredients,
  getOpenOrders,
  getRestaurantBySlug,
} from "@/lib/engine";
import { KitchenClient } from "./kitchen-client";

export const dynamic = "force-dynamic";

// Single-restaurant demo for now; profiles scope this per restaurant.
const DEMO_SLUG = "demo";

export default async function KitchenPage() {
  const supabase = await createClient();
  const restaurant = await getRestaurantBySlug(supabase, DEMO_SLUG);
  if (!restaurant) notFound();

  const [orders, ingredients] = await Promise.all([
    getOpenOrders(supabase, restaurant.id),
    getIngredients(supabase, restaurant.id),
  ]);

  return (
    <KitchenClient
      restaurant={restaurant}
      initialOrders={orders}
      initialIngredients={ingredients}
    />
  );
}
