import { getOwnerContext } from "@/lib/owner";
import { getTodayOrders } from "@/lib/engine";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { supabase, restaurant } = await getOwnerContext("/dashboard/orders");
  const orders = await getTodayOrders(supabase, restaurant.id);
  return <OrdersClient restaurant={restaurant} initialOrders={orders} />;
}
