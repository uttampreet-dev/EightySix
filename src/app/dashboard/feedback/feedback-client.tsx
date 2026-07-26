"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, getFeedback, type Feedback, type Restaurant } from "@/lib/engine";
import { getFeedbackSummary } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NumberTicker } from "@/components/number-ticker";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="shrink-0 font-mono text-sm tracking-tighter">
      <span className="text-brass">{"★".repeat(rating)}</span>
      <span className="text-muted-foreground/30">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function FeedbackClient({
  restaurant,
  initialFeedback,
}: {
  restaurant: Restaurant;
  initialFeedback: Feedback[];
}) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const refetch = useCallback(async () => {
    setFeedback(await getFeedback(createClient(), restaurant.id));
  }, [restaurant.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`feedback-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback", filter: `restaurant_id=eq.${restaurant.id}` },
        () => {
          toast.info("New diner feedback");
          refetch();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, refetch]);

  const stats = useMemo(() => {
    if (feedback.length === 0) return { avg: 0, counts: [0, 0, 0, 0, 0] };
    const counts = [0, 0, 0, 0, 0];
    let sum = 0;
    for (const f of feedback) {
      counts[f.rating - 1]++;
      sum += f.rating;
    }
    return { avg: sum / feedback.length, counts };
  }, [feedback]);

  async function loadSummary() {
    setSummaryLoading(true);
    const result = await getFeedbackSummary(restaurant.id);
    setSummaryLoading(false);
    if (result.ok && result.data) setSummary(result.data.summary);
    else if (!result.ok) toast.error(result.error);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mt-6">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Feedback</h1>
        <p className="text-xs text-muted-foreground">
          Diners rate served orders from the menu — one rating per order.
        </p>
      </div>

      {feedback.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No ratings yet.</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Place an order on the menu, mark it served in the kitchen, then tap{" "}
            <span className="font-medium text-foreground">Rate ★</span> on the
            diner&apos;s order strip.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <Card className="gap-2 py-4">
              <CardContent className="px-4 text-center">
                <p className="font-serif text-5xl font-medium tabular-nums">
                  <NumberTicker value={stats.avg} format={(n) => n.toFixed(1)} />
                </p>
                <Stars rating={Math.round(stats.avg)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {feedback.length} rating{feedback.length === 1 ? "" : "s"}
                </p>
                <div className="mt-3 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = stats.counts[star - 1];
                    const share = feedback.length > 0 ? count / feedback.length : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-3 font-mono text-muted-foreground">{star}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-brass"
                            style={{ width: `${share * 100}%` }}
                          />
                        </div>
                        <span className="w-5 text-right font-mono text-muted-foreground">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="gap-2 py-4">
              <CardContent className="px-4">
                {summary ? (
                  <div className="space-y-2 text-sm leading-relaxed">
                    {summary
                      .split("\n")
                      .filter((l) => l.trim())
                      .map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Gemini can pull the themes out of your reviews — what diners
                    love, what to fix.
                  </p>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={summaryLoading}
                  onClick={loadSummary}
                >
                  {summaryLoading ? "Reading reviews…" : summary ? "Refresh themes" : "Summarise themes"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {feedback.map((f) => (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Stars rating={f.rating} />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatDateTime(f.created_at)}
                    </span>
                  </div>
                  {f.comment && (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      &ldquo;{f.comment}&rdquo;
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
