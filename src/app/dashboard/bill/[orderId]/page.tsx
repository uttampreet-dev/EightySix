import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getOwnerContext } from "@/lib/owner";
import { formatDateTime, formatINR, GST_RATE, type TodayOrder } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { MarkPaidButton } from "./mark-paid-button";
import { CollectPaymentButton } from "./collect-payment-button";

// Demo VPA — format-correct so any UPI app parses the QR; swap per restaurant.
const UPI_VPA = "tandoortales@upi";

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
      "id, status, created_at, table_id, order_items(id, qty, unit_price, dishes(name, price)), tables(label)"
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
      // frozen at order time — later price edits/specials can't rewrite bills
      price: Number(i.unit_price ?? i.dishes!.price),
      amount: i.qty * Number(i.unit_price ?? i.dishes!.price),
    }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  // paise-rounded so the printed lines reconcile exactly with the total
  const cgst = Math.round(subtotal * (GST_RATE / 2) * 100) / 100;
  const sgst = Math.round(subtotal * (GST_RATE / 2) * 100) / 100;
  const raw = subtotal + cgst + sgst;
  const total = Math.round(raw);
  const roundOff = Math.round((total - raw) * 100) / 100;

  const upiQr =
    order.status === "paid"
      ? null
      : await QRCode.toDataURL(
          `upi://pay?pa=${UPI_VPA}&pn=${encodeURIComponent(restaurant.name)}&am=${total}&cu=INR&tn=${encodeURIComponent(`Bill ${order.id.slice(0, 8).toUpperCase()}`)}`,
          { width: 320, margin: 1, color: { dark: "#1c1a15", light: "#faf8f2" } }
        );

  return (
    <div className="mx-auto w-full max-w-md">
      <header className="flex items-center justify-between py-6 print:hidden">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Bill</h1>
        <div className="flex items-center gap-2">
          {order.status === "served" && upiQr && (
            <CollectPaymentButton
              orderId={order.id}
              totalLabel={formatINR(total)}
              upiQr={upiQr}
              vpa={UPI_VPA}
            />
          )}
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
            {formatDateTime(order.created_at)}
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
          {roundOff !== 0 && (
            <div className="flex justify-between text-[#1c1a15]/70">
              <span>Round off</span>
              <span className="tabular-nums">
                {roundOff > 0 ? "+" : "−"}₹{Math.abs(roundOff).toFixed(2)}
              </span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-[#1c1a15]/20 pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(total)}</span>
          </div>
        </div>

        <div className="my-4 border-t border-dashed border-[#1c1a15]/30" />

        {upiQr ? (
          <div className="text-center">
            <p className="text-[11px] font-semibold tracking-wide text-[#1c1a15]/80">
              SCAN TO PAY {formatINR(total)} VIA UPI
            </p>
            <Image
              src={upiQr}
              alt={`UPI payment QR for ${formatINR(total)}`}
              width={132}
              height={132}
              unoptimized
              className="mx-auto mt-2 rounded-sm"
            />
            <p className="mt-1.5 text-[10px] text-[#1c1a15]/50">
              {UPI_VPA} · GPay · PhonePe · Paytm
            </p>
            <div className="my-4 border-t border-dashed border-[#1c1a15]/30" />
          </div>
        ) : null}

        <p className="text-center text-[11px] text-[#1c1a15]/60">
          {order.status === "paid" ? "PAID — thank you, visit again!" : "Pay by UPI above or at the counter · thank you!"}
        </p>
      </div>
    </div>
  );
}
