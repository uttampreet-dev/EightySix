import { getOwnerContext } from "@/lib/owner";
import { getTables } from "@/lib/engine";
import { TablesClient } from "./tables-client";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { supabase, restaurant } = await getOwnerContext("/dashboard/tables");
  const tables = await getTables(supabase, restaurant.id);
  return <TablesClient restaurant={restaurant} initialTables={tables} />;
}
