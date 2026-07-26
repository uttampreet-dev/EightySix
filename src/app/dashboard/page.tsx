import { getOwnerContext } from "@/lib/owner";
import {
  getDishRisk,
  getIngredients,
  getRecentEvents,
  getTodayOrders,
} from "@/lib/engine";
import { OverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, restaurant } = await getOwnerContext();

  const [orders, ingredients, risk, events] = await Promise.all([
    getTodayOrders(supabase, restaurant.id),
    getIngredients(supabase, restaurant.id),
    getDishRisk(supabase, restaurant.id),
    getRecentEvents(supabase, restaurant.id),
  ]);

  return (
    <OverviewClient
      restaurant={restaurant}
      initialOrders={orders}
      initialIngredients={ingredients}
      initialRisk={risk}
      initialEvents={events}
    />
  );
}
