import { getOwnerContext } from "@/lib/owner";
import { getDishRisk, getIngredients } from "@/lib/engine";
import { MenuManageClient } from "./menu-manage-client";

export const dynamic = "force-dynamic";

export default async function MenuManagePage() {
  const { supabase, restaurant } = await getOwnerContext("/dashboard/menu");
  const [risk, ingredients] = await Promise.all([
    getDishRisk(supabase, restaurant.id),
    getIngredients(supabase, restaurant.id),
  ]);
  return (
    <MenuManageClient
      restaurant={restaurant}
      initialRisk={risk}
      initialIngredients={ingredients}
    />
  );
}
