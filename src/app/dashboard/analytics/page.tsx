import { getOwnerContext } from "@/lib/owner";
import { getOrdersSince, istMidnightIso } from "@/lib/engine";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { supabase, restaurant } = await getOwnerContext("/dashboard/analytics");
  const orders = await getOrdersSince(supabase, restaurant.id, istMidnightIso(6));
  return <AnalyticsClient restaurant={restaurant} initialOrders={orders} />;
}
