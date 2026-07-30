"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { bumpOrderStatus } from "@/app/actions";
import { useChime } from "@/lib/use-chime";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// The counter payment window: diner scans, the gateway confirms, the window
// closes itself. Confirmation arrives within ~5s (sandbox gateway).
const CONFIRM_AFTER_MS = 5000;

export function CollectPaymentButton({
  orderId,
  totalLabel,
  upiQr,
  vpa,
}: {
  orderId: string;
  totalLabel: string;
  upiQr: string;
  vpa: string;
}) {
  const router = useRouter();
  const chime = useChime();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"waiting" | "confirmed">("waiting");

  useEffect(() => {
    if (!open) return;
    const confirm = setTimeout(async () => {
      setState("confirmed");
      chime([1046.5, 1318.51]);
      const result = await bumpOrderStatus(orderId, "paid");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTimeout(() => {
        setOpen(false);
        toast.success(`Payment received — ${totalLabel}`);
        router.refresh();
      }, 1400);
    }, CONFIRM_AFTER_MS);
    return () => clearTimeout(confirm);
  }, [open, orderId, totalLabel, chime, router]);

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setState("waiting");
          setOpen(true);
        }}
      >
        Collect via UPI
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {state === "confirmed" ? "Payment received" : `Collect ${totalLabel}`}
            </DialogTitle>
            <DialogDescription>
              {state === "confirmed"
                ? "Confirmed by the gateway — recording the payment."
                : "Ask the diner to scan with any UPI app. The window closes itself once the gateway confirms."}
            </DialogDescription>
          </DialogHeader>

          {state === "waiting" ? (
            <div className="flex flex-col items-center py-2">
              <div className="rounded-lg bg-[#faf8f2] p-3">
                <Image src={upiQr} alt={`UPI QR for ${totalLabel}`} width={190} height={190} unoptimized />
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{vpa}</p>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-brass opacity-60" />
                  <span className="relative h-2 w-2 rounded-full bg-brass" />
                </span>
                Waiting for UPI confirmation…
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                Sandbox gateway · confirms in a few seconds
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6">
              <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-500" />
              <p className="mt-3 font-serif text-xl">{totalLabel} received</p>
              <p className="mt-1 text-sm text-muted-foreground">UPI · {vpa}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
