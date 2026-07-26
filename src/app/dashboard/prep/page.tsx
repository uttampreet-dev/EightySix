import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestaurantBySlug, formatINR, type Restaurant } from "@/lib/engine";
import { geminiText } from "@/lib/gemini";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// This page is force-dynamic: rendered per request, so "now" is request time.
function tomorrowLabel(): string {
  return new Date(Date.now() + 86400000).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
}

type PrepRow = {
  ingredient_id: string;
  ingredient: string;
  unit: string;
  station: string | null;
  current_stock: number;
  avg_daily_usage: number;
  predicted_usage: number;
  reorder_qty: number;
  est_cost: number;
};

export default async function PrepSheetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/prep");

  const { data: profile } = await supabase
    .from("profiles")
    .select("restaurant_id")
    .eq("id", user.id)
    .maybeSingle();

  let restaurant: Restaurant | null = null;
  if (profile?.restaurant_id) {
    const { data } = await supabase
      .from("restaurants")
      .select("id, name, slug, tagline")
      .eq("id", profile.restaurant_id)
      .maybeSingle();
    restaurant = data;
  }
  if (!restaurant) restaurant = await getRestaurantBySlug(supabase, "demo");
  if (!restaurant) notFound();

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("prep_sheet", { rid: restaurant.id });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PrepRow[];

  const prepRows = rows.filter((r) => r.predicted_usage > 0);
  const orderRows = rows.filter((r) => r.reorder_qty > 0);
  const orderTotal = orderRows.reduce((s, r) => s + Number(r.est_cost), 0);

  const byStation = new Map<string, PrepRow[]>();
  for (const row of prepRows) {
    const station = row.station ?? "General";
    if (!byStation.has(station)) byStation.set(station, []);
    byStation.get(station)!.push(row);
  }

  const tomorrow = tomorrowLabel();

  let narrative: string | null = null;
  if (prepRows.length > 0) {
    try {
      narrative = await geminiText(
        `You are a head chef's planner. In 3 short bullet lines (plain text, no markdown), give prep notes for tomorrow (${tomorrow}) at a North Indian restaurant, based on predicted ingredient usage (from real order history):
${prepRows.slice(0, 12).map((r) => `${r.ingredient}: predicted ${r.predicted_usage}${r.unit}, in stock ${r.current_stock}${r.unit}`).join("\n")}
Purchase order needed: ${orderRows.map((r) => `${r.ingredient} ${r.reorder_qty}${r.unit}`).join(", ") || "nothing"}.
Be practical: soak/marinate/thaw lead times, what to buy first thing.`
      );
    } catch {
      narrative = null;
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
      <header className="flex items-center justify-between py-6 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Tomorrow&apos;s prep sheet
          </h1>
          <p className="text-xs text-muted-foreground">
            {restaurant.name} · {tomorrow} · predicted from order history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Back</Link>
          </Button>
        </div>
      </header>

      <div className="hidden print:block print:py-4">
        <h1 className="text-xl font-semibold">
          {restaurant.name} — prep sheet for {tomorrow}
        </h1>
      </div>

      {prepRows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No order history yet — predictions need at least a day of orders.
          Run a dinner rush and come back.
        </p>
      ) : (
        <div className="space-y-8">
          {narrative && (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Chef&apos;s notes
              </h2>
              <div className="space-y-1 text-sm leading-relaxed">
                {narrative
                  .split("\n")
                  .filter((l) => l.trim())
                  .map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
              </div>
            </section>
          )}

          {[...byStation.entries()].map(([station, stationRows]) => (
            <section key={station}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                {station}
              </h2>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Ingredient</th>
                      <th className="px-3 py-2 text-right font-medium">Prep for tomorrow</th>
                      <th className="px-3 py-2 text-right font-medium">In stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stationRows.map((row) => (
                      <tr key={row.ingredient_id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{row.ingredient}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.predicted_usage} {row.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {Number(row.current_stock).toFixed(1)} {row.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Draft purchase order
              </h2>
              {orderRows.length > 0 && (
                <Badge variant="outline">{formatINR(orderTotal)} est.</Badge>
              )}
            </div>
            {orderRows.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Stock covers tomorrow&apos;s predicted usage — nothing to buy.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Ingredient</th>
                      <th className="px-3 py-2 text-right font-medium">Buy</th>
                      <th className="px-3 py-2 text-right font-medium">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderRows.map((row) => (
                      <tr key={row.ingredient_id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{row.ingredient}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.reorder_qty} {row.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatINR(row.est_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
