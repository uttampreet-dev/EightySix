"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bumpOrderStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function MarkPaidButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markPaid() {
    setBusy(true);
    const result = await bumpOrderStatus(orderId, "paid");
    setBusy(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Payment recorded");
      router.refresh();
    }
  }

  return (
    <Button size="sm" disabled={busy} onClick={markPaid}>
      {busy ? "Recording…" : "Mark paid"}
    </Button>
  );
}
