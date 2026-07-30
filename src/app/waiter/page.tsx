import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDishRisk,
  getOpenOrders,
  getOpenServiceCalls,
  getReservations,
  getRestaurantBySlug,
  getTables,
} from "@/lib/engine";
import { WaiterClient } from "./waiter-client";

export const dynamic = "force-dynamic";

// Single-restaurant demo for now, same as the kitchen board.
const DEMO_SLUG = "demo";

export default async function WaiterPage() {
  const supabase = await createClient();
  const restaurant = await getRestaurantBySlug(supabase, DEMO_SLUG);
  if (!restaurant) notFound();

  const [tables, orders, risk, reservations, calls] = await Promise.all([
    getTables(supabase, restaurant.id),
    getOpenOrders(supabase, restaurant.id),
    getDishRisk(supabase, restaurant.id),
    getReservations(supabase, restaurant.id),
    getOpenServiceCalls(supabase, restaurant.id),
  ]);

  return (
    <WaiterClient
      restaurant={restaurant}
      initialTables={tables}
      initialOrders={orders}
      initialRisk={risk}
      initialReservations={reservations}
      initialCalls={calls}
    />
  );
}
