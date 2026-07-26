"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getTables, type Restaurant, type RestaurantTable } from "@/lib/engine";
import { toggleTableStatus } from "@/app/actions";
import { Badge } from "@/components/ui/badge";

export function TablesClient({
  restaurant,
  initialTables,
}: {
  restaurant: Restaurant;
  initialTables: RestaurantTable[];
}) {
  const [tables, setTables] = useState(initialTables);

  const refetch = useCallback(async () => {
    setTables(await getTables(createClient(), restaurant.id));
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tables-page-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurant.id}` },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch]);

  async function toggle(table: RestaurantTable) {
    const result = await toggleTableStatus(table.id);
    if (!result.ok) toast.error(result.error);
    refetch();
  }

  const occupied = tables.filter((t) => t.status === "occupied").length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mt-6">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Tables</h1>
        <p className="text-xs text-muted-foreground">
          {occupied} of {tables.length} occupied · orders and seated reservations
          update these automatically
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tables.map((table) => (
          <button
            key={table.id}
            onClick={() => toggle(table)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              table.status === "occupied"
                ? "border-amber-800/50 bg-amber-950/20"
                : "bg-card hover:bg-accent"
            }`}
          >
            <p className="font-medium">Table {table.label}</p>
            <p className="text-xs text-muted-foreground">{table.seats} seats</p>
            <Badge
              variant={table.status === "occupied" ? "default" : "outline"}
              className="mt-2"
            >
              {table.status}
            </Badge>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Tap a table to toggle free / occupied.</p>
    </div>
  );
}
