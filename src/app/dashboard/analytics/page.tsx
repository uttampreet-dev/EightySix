import { getOwnerContext } from "@/lib/owner";
import { getOrdersSince } from "@/lib/engine";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { supabase, restaurant } = await getOwnerContext("/dashboard/analytics");
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);
  const orders = await getOrdersSince(supabase, restaurant.id, since.toISOString());
  return <AnalyticsClient restaurant={restaurant} initialOrders={orders} />;
}
