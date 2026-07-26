"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resetDemo, rushTick } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

export function RushControls({ restaurantId }: { restaurantId: string }) {
  const [rushActive, setRushActive] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!rushActive) return;
    let cancelled = false;
    const startedAt = Date.now();
    toast.info("Dinner rush started", {
      description: "Synthetic orders for 90 seconds — watch every screen react.",
    });

    async function tick() {
      if (cancelled) return;
      if (Date.now() - startedAt > 90000) {
        setRushActive(false);
        toast.info("Dinner rush over");
        return;
      }
      const result = await rushTick(restaurantId);
      if (!cancelled && !result.ok) {
        toast.error(result.error);
        setRushActive(false);
      }
    }

    tick();
    const interval = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rushActive, restaurantId]);

  async function handleReset() {
    setResetting(true);
    const result = await resetDemo();
    setResetting(false);
    if (!result.ok) toast.error(result.error);
    else
      toast.success("Demo reset", {
        description: "Stock, orders, tables and reservations restored.",
      });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant={rushActive ? "destructive" : "default"}
        onClick={() => setRushActive((v) => !v)}
      >
        {rushActive ? "■ Stop rush" : "Simulate dinner rush"}
      </Button>
      <Button size="sm" variant="outline" disabled={resetting} onClick={handleReset}>
        {resetting ? "Resetting…" : "Reset demo"}
      </Button>
      <SignOutButton />
    </div>
  );
}
