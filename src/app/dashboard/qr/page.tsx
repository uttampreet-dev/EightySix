import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantBySlug, getTables } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function TableQrPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/qr");

  const restaurant = await getRestaurantBySlug(supabase, "demo");
  if (!restaurant) notFound();
  const tables = await getTables(supabase, restaurant.id);

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const cards = await Promise.all(
    tables.map(async (table) => ({
      table,
      qr: await QRCode.toDataURL(
        `${origin}/r/${restaurant.slug}?table=${encodeURIComponent(table.label)}`,
        {
          width: 440,
          margin: 1,
          color: { dark: "#1c1a15", light: "#faf8f2" },
        }
      ),
    }))
  );

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16">
      <header className="flex items-center justify-between py-6 print:hidden">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            Table QR codes
          </h1>
          <p className="text-xs text-muted-foreground">
            {restaurant.name} · scan opens the live menu with the table
            pre-selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Back</Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {cards.map(({ table, qr }) => (
          <div
            key={table.id}
            className="flex flex-col items-center rounded-xl bg-[#faf8f2] p-5 text-center text-[#1c1a15] shadow-lg print:break-inside-avoid print:shadow-none"
          >
            <p className="font-serif text-lg font-semibold leading-none">
              {restaurant.name}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#1c1a15]/60">
              Scan for the live menu
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code for table ${table.label}`} className="mt-3 w-full max-w-[180px]" />
            <p className="mt-3 font-serif text-xl font-semibold">
              Table {table.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
