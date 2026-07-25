import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAvailability, getRestaurantBySlug, getTables } from "@/lib/engine";
import { MenuClient } from "./menu-client";

export const dynamic = "force-dynamic";

export default async function RestaurantMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const restaurant = await getRestaurantBySlug(supabase, slug);
  if (!restaurant) notFound();

  const [dishes, tables] = await Promise.all([
    getAvailability(supabase, restaurant.id),
    getTables(supabase, restaurant.id),
  ]);

  return <MenuClient restaurant={restaurant} initialDishes={dishes} tables={tables} />;
}
