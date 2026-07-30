import { getOwnerContext } from "@/lib/owner";
import {
  getDishRisk,
  getIngredients,
  getRecentEvents,
  getSurplus,
  getTodayOrders,
} from "@/lib/engine";
import { clearExpiredSpecials } from "@/app/actions";
import { OverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, restaurant } = await getOwnerContext();

  // lazy expiry — a special never outlives its window past a console visit
  await clearExpiredSpecials(restaurant.id);

  const [orders, ingredients, risk, events, surplus] = await Promise.all([
    getTodayOrders(supabase, restaurant.id),
    getIngredients(supabase, restaurant.id),
    getDishRisk(supabase, restaurant.id),
    getRecentEvents(supabase, restaurant.id),
    getSurplus(supabase, restaurant.id),
  ]);

  return (
    <OverviewClient
      restaurant={restaurant}
      initialOrders={orders}
      initialIngredients={ingredients}
      initialRisk={risk}
      initialEvents={events}
      initialSurplus={surplus}
    />
  );
}
