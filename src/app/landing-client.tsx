"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { DemoEntryButton } from "@/components/demo-entry";
import { NumberTicker } from "@/components/number-ticker";

/* ---------------------------------- hero mock ---------------------------------- */

// One looping story: Butter Paneer sells down, goes low, dies, and the
// system intervenes. Phases advance every 2.4s.
const PHASES = [
  { paneer: 24, eta: null as number | null, revenue: 41260, orders: 43 },
  { paneer: 11, eta: 96, revenue: 43180, orders: 47 },
  { paneer: 3, eta: 34, revenue: 45420, orders: 52 },
  { paneer: 0, eta: 0, revenue: 46890, orders: 56 },
] as const;

function MockRiskRow({
  name,
  left,
  eta,
  velocity,
}: {
  name: string;
  left: number;
  eta: number | null;
  velocity: string;
}) {
  const dead = left <= 0;
  const critical = !dead && eta !== null && eta <= 45;
  const warm = !dead && !critical && eta !== null;
  return (
    <motion.div
      layout
      className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-colors duration-700 ${
        dead
          ? "border-red-900/60 bg-red-950/25"
          : critical
            ? "border-red-900/60 bg-red-950/25"
            : warm
              ? "border-amber-800/50 bg-amber-950/15"
              : "border-border bg-white/[0.02]"
      }`}
    >
      <div className="min-w-0">
        <p
          className={`truncate font-serif text-[15px] transition-all duration-700 ${
            dead ? "text-muted-foreground line-through decoration-brass/70" : ""
          }`}
        >
          {name}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {dead ? "struck from every menu" : `${left} left · ${velocity}`}
        </p>
      </div>
      {dead ? (
        <Badge variant="destructive" className="shrink-0 font-mono text-[10px]">
          86&apos;d
        </Badge>
      ) : eta !== null ? (
        <Badge
          variant={critical ? "destructive" : "outline"}
          className={`shrink-0 font-mono text-[10px] tabular-nums ${
            warm ? "border-amber-500/40 text-amber-400" : ""
          }`}
        >
          86 in ~{eta}m
        </Badge>
      ) : (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          healthy
        </span>
      )}
    </motion.div>
  );
}

function HeroMock() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 2400);
    return () => clearInterval(t);
  }, []);
  const s = PHASES[phase];
  const dead = s.paneer <= 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[oklch(0.155_0.006_78)] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 truncate font-mono text-[10px] text-muted-foreground">
          tandoortales.eightysix.app/dashboard
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-green-500" />
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">live</span>
        </span>
      </div>

      <div className="space-y-4 p-5">
        {/* stat strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Revenue tonight
            </p>
            <p className="mt-1 font-serif text-xl tabular-nums">
              <NumberTicker value={s.revenue} format={(n) => `₹${Math.round(n).toLocaleString("en-IN")}`} />
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Orders
            </p>
            <p className="mt-1 font-serif text-xl tabular-nums">
              <NumberTicker value={s.orders} />
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              At risk
            </p>
            <p className="mt-1 font-serif text-xl tabular-nums">
              <NumberTicker value={dead ? 1 : s.eta !== null ? 2 : 0} />
            </p>
          </div>
        </div>

        {/* alert banner slides in when the prediction crosses the line */}
        <motion.div
          initial={false}
          animate={{
            height: s.eta !== null && s.eta <= 45 ? "auto" : 0,
            opacity: s.eta !== null && s.eta <= 45 ? 1 : 0,
          }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3.5 py-2.5">
            <p className="font-mono text-[11px] text-red-400">
              {dead
                ? "Butter Paneer 86'd — diners now offered Kadhai Paneer instead"
                : "Butter Paneer predicted to 86 in ~34 min — prep more or push alternatives"}
            </p>
          </div>
        </motion.div>

        {/* radar */}
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            86-risk radar
          </p>
          <div className="space-y-1.5">
            <MockRiskRow
              name="Butter Paneer"
              left={s.paneer}
              eta={s.eta}
              velocity="7/30min pace"
            />
            <MockRiskRow
              name="Dal Makhani"
              left={38}
              eta={phase >= 1 ? 118 : null}
              velocity="4/30min pace"
            />
            <MockRiskRow
              name="Tandoori Chicken"
              left={26}
              eta={null}
              velocity="2/30min pace"
            />
          </div>
        </div>
      </div>

      {/* brass sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 85% -10%, oklch(0.8 0.1 84 / 0.08), transparent 60%)",
        }}
      />
    </div>
  );
}

/* -------------------------------- tilt wrapper -------------------------------- */

function useTilt(): {
  ref: React.RefObject<HTMLDivElement | null>;
  rx: MotionValue<number>;
  ry: MotionValue<number>;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [5, -5]), { stiffness: 140, damping: 22 });
  const ry = useSpring(useTransform(mx, [0, 1], [-7, 7]), { stiffness: 140, damping: 22 });
  return {
    ref,
    rx,
    ry,
    onMove: (e: React.MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      mx.set((e.clientX - rect.left) / rect.width);
      my.set((e.clientY - rect.top) / rect.height);
    },
    onLeave: () => {
      mx.set(0.5);
      my.set(0.5);
    },
  };
}

/* ---------------------------------- ticker ---------------------------------- */

const TICKER: { text: string; tone: "ok" | "low" | "dead" | "act" }[] = [
  { text: "BUTTER PANEER · ONLY 3 LEFT", tone: "low" },
  { text: "DAL MAKHANI · 86 IN ~38 MIN", tone: "low" },
  { text: "MUTTON SEEKH KEBAB · 86'D", tone: "dead" },
  { text: "SWAP PUSHED → KADHAI PANEER", tone: "act" },
  { text: "TANDOORI CHICKEN · 29 PORTIONS", tone: "ok" },
  { text: "PANEER · RESTOCKED +4 KG", tone: "act" },
  { text: "GARLIC NAAN · 116 PORTIONS", tone: "ok" },
  { text: "PREP SHEET · SOAK URAD DAL 2.9 KG", tone: "act" },
  { text: "CHICKEN BIRYANI · 86 IN ~2H", tone: "ok" },
  { text: "KHEER · 69 PORTIONS", tone: "ok" },
];

function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="relative overflow-hidden border-y border-border/70 bg-white/[0.015] py-3">
      <div className="animate-marquee flex w-max items-center gap-10">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2.5 font-mono text-[11px] tracking-wider">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                item.tone === "ok"
                  ? "bg-green-500"
                  : item.tone === "low"
                    ? "bg-amber-400"
                    : item.tone === "dead"
                      ? "bg-red-500"
                      : "bg-brass"
              }`}
            />
            <span
              className={
                item.tone === "dead"
                  ? "text-muted-foreground line-through decoration-brass/70"
                  : item.tone === "act"
                    ? "text-brass"
                    : "text-muted-foreground"
              }
            >
              {item.text}
            </span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

/* ------------------------------ feature visuals ------------------------------ */

function LifecycleMock() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 2000);
    return () => clearInterval(t);
  }, []);
  const states = [
    { label: "42 portions", cls: "", badge: null },
    { label: "", cls: "", badge: "Only 3 left" },
    { label: "", cls: "opacity-50 saturate-0", badge: "86'd" },
  ];
  return (
    <div className="flex items-center justify-center gap-4">
      {states.map((s, i) => (
        <div key={i} className="flex items-center gap-4">
          <motion.div
            animate={{
              scale: step === i ? 1.05 : 1,
              opacity: step === i ? 1 : 0.45,
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`w-40 rounded-lg border bg-card p-3.5 ${s.cls}`}
          >
            <p
              className={`font-serif text-sm ${i === 2 ? "line-through decoration-brass/70" : ""}`}
            >
              Butter Paneer
            </p>
            {s.label && (
              <p className="mt-1.5 text-xs text-muted-foreground">{s.label}</p>
            )}
            {s.badge && i === 1 && (
              <Badge className="mt-1.5 border-amber-500/40 bg-amber-500/15 text-amber-400">
                {s.badge}
              </Badge>
            )}
            {s.badge && i === 2 && (
              <Badge variant="destructive" className="mt-1.5 font-mono">
                {s.badge}
              </Badge>
            )}
          </motion.div>
          {i < 2 && <span className="text-muted-foreground/40">→</span>}
        </div>
      ))}
    </div>
  );
}

function SwapMock() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border bg-popover p-5 shadow-2xl">
      <p className="font-serif text-lg">
        Mutton Rogan Josh is{" "}
        <span className="line-through decoration-brass/70">86&apos;d</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Closest available alternatives, picked from live stock:
      </p>
      <div className="mt-3 rounded-lg border bg-card p-3">
        <div className="flex items-start justify-between">
          <p className="font-serif text-[15px]">Chicken Tikka Masala</p>
          <span className="font-mono text-xs text-muted-foreground">₹345</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          A rich, slow-spiced gravy — the closest thing to Rogan Josh still in
          the kitchen tonight.
        </p>
        <div className="mt-2.5 rounded-md bg-secondary py-1.5 text-center text-xs font-medium">
          Add instead
        </div>
      </div>
    </div>
  );
}

function PrepSheetMock() {
  return (
    <div className="mx-auto w-full max-w-sm -rotate-1 rounded-md bg-[#faf8f2] p-5 text-[#1c1a15] shadow-[0_24px_48px_-16px_rgba(0,0,0,0.6)]">
      <div className="flex items-baseline justify-between border-b border-[#1c1a15]/15 pb-2">
        <p className="font-serif text-sm font-semibold">Tandoor Tales — prep</p>
        <p className="font-mono text-[10px] text-[#1c1a15]/60">SATURDAY</p>
      </div>
      <table className="mt-2 w-full font-mono text-[11px]">
        <tbody>
          {[
            ["TANDOOR", "marinate chicken", "6.2 kg"],
            ["TANDOOR", "paneer tikka cubes", "2.4 kg"],
            ["CURRIES", "soak urad dal", "2.9 kg"],
            ["CURRIES", "tomato gravy base", "5.5 kg"],
            ["BREADS", "knead atta", "7.8 kg"],
            ["BUY", "cream (short 2.1 L)", "₹504"],
          ].map(([station, task, qty], i) => (
            <tr key={i} className="border-b border-[#1c1a15]/8 last:border-0">
              <td className="py-1.5 pr-2 text-[#1c1a15]/50">{station}</td>
              <td className="py-1.5 pr-2">{task}</td>
              <td className="py-1.5 text-right tabular-nums">{qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-[9px] text-[#1c1a15]/45">
        predicted from order history · printed 06:00
      </p>
    </div>
  );
}

/* ---------------------------------- sections ---------------------------------- */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const FEATURES = [
  {
    eyebrow: "Live availability",
    title: "The menu that can't lie",
    body: "Every order depletes ingredient stock through the recipe graph, so every dish shows true portions-remaining — computed from its scarcest ingredient. When the kitchen marks paneer out, every diner menu, kitchen board and dashboard greys the paneer dishes in the same second. No stale menus, no apologies at the table.",
    visual: <LifecycleMock />,
  },
  {
    eyebrow: "Predictive 86ing",
    title: "Know the death time of every dish",
    body: "A rolling 30-minute order-velocity window gives each dish an estimated time of death. The radar sorts your menu by how soon it dies, and fires an alert while there's still time to prep more, push alternatives, or raise the price — instead of finding out from an angry cook.",
    visual: (
      <div className="mx-auto w-full max-w-sm space-y-1.5">
        <MockRiskRow name="Butter Paneer" left={3} eta={34} velocity="7/30min pace" />
        <MockRiskRow name="Dal Makhani" left={21} eta={96} velocity="4/30min pace" />
        <MockRiskRow name="Seekh Kebab" left={0} eta={0} velocity="—" />
      </div>
    ),
  },
  {
    eyebrow: "Interventions",
    title: "It acts before you can",
    body: "Dying dishes get scarcity badges that sell them faster. Dead dishes are struck off everywhere at once. And when a diner taps something that just died, an AI suggests the closest match — chosen only from dishes the engine knows are actually still available. Every suggestion is validated against live stock before it's shown.",
    visual: <SwapMock />,
  },
  {
    eyebrow: "Forecasting",
    title: "Tomorrow, taped to the wall",
    body: "Order history becomes tomorrow's prep sheet: per-station quantities in kilograms, weighted by day of the week, with a draft purchase order for everything that won't last the shift. A forecast a chef can use at 6 a.m. — not a line chart in a boardroom.",
    visual: <PrepSheetMock />,
  },
];

const PROOF = [
  { k: "30 min", v: "rolling velocity window behind every prediction" },
  { k: "min()", v: "availability = the scarcest ingredient in the recipe" },
  { k: "45 min", v: "warning before a dish dies, while you can still act" },
  { k: "0", v: "numbers faked — everything computes from live rows" },
];

export function LandingClient() {
  const { ref: tiltRef, rx, ry, onMove, onLeave } = useTilt();

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* layered backdrop: grid + warm spotlight */}
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[46rem]"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, oklch(0.8 0.1 84 / 0.1), transparent 68%)",
        }}
      />

      <nav className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Brand />
          <div className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:flex">
            <a href="#product" className="transition-colors hover:text-foreground">
              Product
            </a>
            <a href="#numbers" className="transition-colors hover:text-foreground">
              Engine
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Staff sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/r/demo">Open live demo</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 flex flex-1 flex-col">
        {/* hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <p
              className="animate-fade-up font-mono text-[11px] uppercase tracking-[0.28em] text-brass"
              style={{ animationDelay: "0ms" }}
            >
              The restaurant operating system
            </p>
            <h1
              className="animate-fade-up mt-5 font-serif text-[3.4rem] font-medium leading-[1.02] tracking-tight sm:text-[4.6rem]"
              style={{ animationDelay: "90ms" }}
            >
              See the <span className="strike-brass">86</span>
              <br />
              coming.
            </h1>
            <p
              className="animate-fade-up mt-6 max-w-md text-lg leading-relaxed text-muted-foreground"
              style={{ animationDelay: "180ms" }}
            >
              <span className="text-foreground">&ldquo;86&rdquo;</span> — kitchen
              slang for a dish that ran out. EightySix predicts it from live
              order velocity, announces it on every screen at once, and acts
              before your diners ever hit a dead end.
            </p>
            <div
              className="animate-fade-up mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "270ms" }}
            >
              <Button asChild size="lg">
                <Link href="/r/demo">Open the live menu</Link>
              </Button>
              <DemoEntryButton role="owner" label="Enter as owner" />
              <DemoEntryButton role="kitchen" label="Enter as kitchen" />
            </div>
            <p
              className="animate-fade-up mt-5 font-mono text-[11px] tracking-wider text-muted-foreground/70"
              style={{ animationDelay: "360ms" }}
            >
              INSTANT DEMO — NO ACCOUNT NEEDED · SEEDED RESTAURANT · RESETS ITSELF
            </p>
          </div>

          <motion.div
            ref={tiltRef}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200 }}
            className="animate-fade-up will-change-transform"
          >
            <HeroMock />
          </motion.div>
        </section>

        <Ticker />

        {/* features */}
        <section id="product" className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="space-y-24">
            {FEATURES.map((f, i) => (
              <div
                key={f.eyebrow}
                className={`grid items-center gap-10 lg:grid-cols-2 ${
                  i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <Reveal>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brass">
                    {f.eyebrow}
                  </p>
                  <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
                    {f.title}
                  </h2>
                  <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </Reveal>
                <Reveal delay={0.12}>{f.visual}</Reveal>
              </div>
            ))}
          </div>
        </section>

        {/* engine numbers */}
        <section id="numbers" className="border-y border-border/70 bg-white/[0.015]">
          <div className="mx-auto grid w-full max-w-6xl gap-px overflow-hidden px-6 py-14 sm:grid-cols-4">
            {PROOF.map((p, i) => (
              <Reveal key={p.k} delay={i * 0.06} className="px-4 py-3 text-center">
                <p className="font-serif text-4xl font-medium tabular-nums text-foreground">
                  {p.k}
                </p>
                <p className="mx-auto mt-2 max-w-[180px] text-xs leading-relaxed text-muted-foreground">
                  {p.v}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* closing CTA */}
        <section className="relative mx-auto w-full max-w-6xl px-6 py-28 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-96"
            style={{
              background:
                "radial-gradient(ellipse 55% 70% at 50% 100%, oklch(0.8 0.1 84 / 0.08), transparent 70%)",
            }}
          />
          <Reveal>
            <h2 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
              Stop finding out from angry cooks.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              One engine — ingredients → recipes → dishes — driving the diner
              menu, the kitchen, and the numbers. Live in the demo right now.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/r/demo">Open the live menu</Link>
              </Button>
              <DemoEntryButton role="owner" label="Enter as owner" />
            </div>
          </Reveal>
        </section>

        <footer className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
            <Brand className="text-base" />
            <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Link href="/r/demo" className="transition-colors hover:text-foreground">
                Live menu
              </Link>
              <Link href="/login" className="transition-colors hover:text-foreground">
                Staff sign in
              </Link>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/60">
              NOTHING ON THIS SITE IS FAKED
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
