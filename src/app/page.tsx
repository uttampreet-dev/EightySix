import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DemoEntryButton } from "@/components/demo-entry";

const FEATURES = [
  {
    title: "Live availability",
    body: "Every dish shows real portions-remaining, computed from its scarcest ingredient through the recipe graph. Kitchen marks paneer out — every menu greys the paneer dishes in the same second.",
  },
  {
    title: "Predictive 86ing",
    body: "Rolling order velocity gives every dish an estimated time of death: “Dal Makhani dies in ~40 min at this pace.” The manager hears about it while there's still time to prep more.",
  },
  {
    title: "It acts, not just answers",
    body: "Dying dishes get scarcity badges, dead ones get struck off everywhere at once, and diners get an AI swap — grounded in what's actually still in the kitchen.",
  },
  {
    title: "Tomorrow on one sheet",
    body: "Order history becomes a per-station prep sheet in kilograms and a draft purchase order — a forecast you tape to the kitchen wall, not a line chart.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 pb-24">
      <section className="flex flex-col items-center gap-8 pt-24 text-center sm:pt-32">
        <Badge variant="outline" className="text-muted-foreground">
          Smart Restaurant Management · Vibeathon 6.0
        </Badge>

        <div className="space-y-4">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
            Eighty<span className="text-destructive">Six</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground sm:text-xl">
            The restaurant OS that sees the 86 coming — and acts before it
            happens.
          </p>
        </div>

        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          <span className="font-medium text-foreground">&ldquo;86&rdquo;</span>{" "}
          is kitchen slang for a dish that just ran out and got struck off the
          menu.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/r/demo">Open the live menu</Link>
          </Button>
          <DemoEntryButton role="owner" label="Enter as owner" />
          <DemoEntryButton role="kitchen" label="Enter as kitchen" />
        </div>

        <p className="max-w-md text-xs text-muted-foreground/70">
          Best demo: open the menu in one tab, enter as owner in another, hit{" "}
          <span className="text-muted-foreground">Simulate dinner rush</span> —
          and watch dishes die on the menu in real time.
        </p>
      </section>

      <section className="mt-20 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title} className="gap-2 py-5">
            <CardContent className="px-5">
              <h2 className="font-medium">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="mt-16 text-xs text-muted-foreground/60">
        One engine: ingredients → recipes → dishes. Everything above is computed
        from live rows — nothing is faked.{" "}
        <Link href="/login" className="underline underline-offset-4">
          Staff sign in
        </Link>
      </footer>
    </main>
  );
}
