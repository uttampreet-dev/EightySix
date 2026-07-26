import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnerContext } from "@/lib/owner";
import { formatINR, GST_RATE, type TodayOrder } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { MarkPaidButton } from "./mark-paid-button";

export const dynamic = "force-dynamic";

export default async function BillPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { supabase, restaurant } = await getOwnerContext(`/dashboard/bill/${orderId}`);

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, created_at, table_id, order_items(id, qty, dishes(name, price)), tables(label)"
    )
    .eq("id", orderId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle<TodayOrder>();
  if (!order) notFound();

  const lines = order.order_items
    .filter((i) => i.dishes)
    .map((i) => ({
      name: i.dishes!.name,
      qty: i.qty,
      price: i.dishes!.price,
      amount: i.qty * i.dishes!.price,
    }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const cgst = subtotal * (GST_RATE / 2);
  const sgst = subtotal * (GST_RATE / 2);
  const total = Math.round(subtotal + cgst + sgst);

  return (
    <div className="mx-auto w-full max-w-md">
      <header className="flex items-center justify-between py-6 print:hidden">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Bill</h1>
        <div className="flex items-center gap-2">
          {order.status === "served" && <MarkPaidButton orderId={order.id} />}
          <PrintButton />
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/orders">Back</Link>
          </Button>
        </div>
      </header>

      {/* the receipt — paper, like the thing you'd actually hand a diner */}
      <div className="mx-auto rounded-md bg-[#faf8f2] p-6 font-mono text-[13px] text-[#1c1a15] shadow-[0_24px_48px_-16px_rgba(0,0,0,0.6)] print:shadow-none">
        <div className="text-center">
          <p className="font-serif text-xl font-semibold">{restaurant.name}</p>
          {restaurant.tagline && (
            <p className="mt-0.5 text-[11px] text-[#1c1a15]/60">{restaurant.tagline}</p>
          )}
          <p className="mt-2 text-[11px] text-[#1c1a15]/60">
            Table {order.tables?.label ?? "—"} ·{" "}
            {new Date(order.created_at).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-[11px] text-[#1c1a15]/60">
            Bill #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        <div className="my-4 border-t border-dashed border-[#1c1a15]/30" />

        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="py-1 pr-2 align-top">
                  {line.name}
                  <span className="text-[#1c1a15]/50"> × {line.qty}</span>
                </td>
                <td className="py-1 text-right align-top tabular-nums">
                  {formatINR(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-[#1c1a15]/30" />

        <div className="space-y-1">
          <div className="flex justify-between text-[#1c1a15]/70">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#1c1a15]/70">
            <span>CGST @ 2.5%</span>
            <span className="tabular-nums">₹{cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[#1c1a15]/70">
            <span>SGST @ 2.5%</span>
            <span className="tabular-nums">₹{sgst.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-[#1c1a15]/20 pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(total)}</span>
          </div>
        </div>

        <div className="my-4 border-t border-dashed border-[#1c1a15]/30" />

        <p className="text-center text-[11px] text-[#1c1a15]/60">
          {order.status === "paid" ? "PAID — thank you, visit again!" : "Payable at counter · thank you!"}
        </p>
      </div>
    </div>
  );
}
