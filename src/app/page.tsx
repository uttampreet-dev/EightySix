import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { DemoEntryButton } from "@/components/demo-entry";

const FEATURES = [
  {
    n: "01",
    title: "Live availability",
    body: "Every dish shows real portions-remaining, computed from its scarcest ingredient through the recipe graph. Kitchen marks paneer out — every menu greys the paneer dishes in the same second.",
  },
  {
    n: "02",
    title: "Predictive 86ing",
    body: "Rolling order velocity gives every dish an estimated time of death: “Dal Makhani dies in ~40 min at this pace.” The manager hears about it while there's still time to act.",
  },
  {
    n: "03",
    title: "Acts, not answers",
    body: "Dying dishes get scarcity badges, dead ones are struck off everywhere at once, and diners get an AI-picked swap — grounded in what's actually still in the kitchen.",
  },
  {
    n: "04",
    title: "Tomorrow, on one sheet",
    body: "Order history becomes a per-station prep sheet in kilograms and a draft purchase order — a forecast you tape to the kitchen wall, not a line chart.",
  },
];

const STEPS = [
  { k: "Open the menu", v: "in one tab — no login, like a diner scanning a QR." },
  { k: "Enter as owner", v: "in a second tab, and press Simulate dinner rush." },
  { k: "Watch", v: "badges count down, dishes die live, and the radar call the 86 before it lands." },
];

function DemoDishCard({
  state,
  name,
  detail,
}: {
  state: "ok" | "low" | "dead";
  name: string;
  detail: string;
}) {
  return (
    <div
      className={`w-44 shrink-0 rounded-lg border bg-card p-3 text-left transition-all ${
        state === "dead" ? "opacity-50 saturate-0" : ""
      }`}
    >
      <p className={`font-serif text-sm ${state === "dead" ? "line-through decoration-brass/70" : ""}`}>
        {name}
      </p>
      {state === "ok" && (
        <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
      )}
      {state === "low" && (
        <Badge className="mt-1.5 border-amber-500/40 bg-amber-500/15 text-amber-400">
          {detail}
        </Badge>
      )}
      {state === "dead" && (
        <Badge variant="destructive" className="mt-1.5 font-mono">
          {detail}
        </Badge>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* warm spotlight behind the hero — brass, not purple */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-130"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 0%, oklch(0.8 0.1 84 / 0.09), transparent 70%)",
        }}
      />

      <nav className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Brand />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Staff sign in</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/r/demo">Live menu</Link>
          </Button>
        </div>
      </nav>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-24">
        <section className="flex flex-col items-center gap-7 pt-16 text-center sm:pt-24">
          <p
            className="animate-fade-up font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground"
            style={{ animationDelay: "0ms" }}
          >
            Smart Restaurant OS · Vibeathon 6.0
          </p>

          <h1
            className="animate-fade-up max-w-3xl font-serif text-5xl font-medium leading-[1.05] tracking-tight sm:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            See the <span className="strike-brass">86</span> coming.
          </h1>

          <p
            className="animate-fade-up mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "160ms" }}
          >
            <span className="text-foreground">&ldquo;86&rdquo;</span> — kitchen
            slang for a dish that ran out and got struck off the menu. EightySix
            is the restaurant OS that predicts it, announces it, and acts before
            it happens.
          </p>

          <div
            className="animate-fade-up flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <Button asChild size="lg">
              <Link href="/r/demo">Open the live menu</Link>
            </Button>
            <DemoEntryButton role="owner" label="Enter as owner" />
            <DemoEntryButton role="kitchen" label="Enter as kitchen" />
          </div>
        </section>

        {/* the lifecycle every dish lives through — shown, not told */}
        <section
          className="animate-fade-up mt-16 w-full max-w-3xl"
          style={{ animationDelay: "320ms" }}
        >
          <div className="flex items-center justify-center gap-3 overflow-x-auto px-2 py-1">
            <DemoDishCard state="ok" name="Butter Paneer" detail="42 portions" />
            <span className="shrink-0 text-muted-foreground/50">→</span>
            <DemoDishCard state="low" name="Butter Paneer" detail="Only 3 left" />
            <span className="shrink-0 text-muted-foreground/50">→</span>
            <DemoDishCard state="dead" name="Butter Paneer" detail="86'd" />
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground/70">
            Live on every diner menu, kitchen board and dashboard — the same
            second the stock moves.
          </p>
        </section>

        <section className="mt-24 grid w-full max-w-4xl gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className="group bg-background p-6 transition-colors hover:bg-card"
            >
              <p className="font-mono text-xs text-brass/80">{f.n}</p>
              <h2 className="mt-2 font-serif text-xl">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-20 w-full max-w-4xl">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            The sixty-second demo
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={i} className="rounded-lg border bg-card/50 p-4">
                <p className="font-mono text-xs text-brass/80">{i + 1}</p>
                <p className="mt-1 text-sm">
                  <span className="font-medium">{s.k}</span>{" "}
                  <span className="text-muted-foreground">{s.v}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-20 max-w-lg text-center text-xs leading-relaxed text-muted-foreground/60">
          One engine: ingredients → recipes → dishes. Availability, velocity and
          time-of-death are computed from live rows — nothing on this site is
          faked.
        </footer>
      </main>
    </div>
  );
}
