import { getOwnerContext } from "@/lib/owner";
import { getIngredients } from "@/lib/engine";
import { InventoryClient } from "./inventory-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { supabase, restaurant } = await getOwnerContext("/dashboard/inventory");
  const ingredients = await getIngredients(supabase, restaurant.id);
  return <InventoryClient restaurant={restaurant} initialIngredients={ingredients} />;
}
