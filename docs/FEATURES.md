# ✨ Features, Routes & User Stories

Everything EightySix does, organized by surface, plus the complete route map, the full server-action reference, and the rubric tier mapping. For *how* it works underneath, see [ARCHITECTURE.md](ARCHITECTURE.md).

<p align="center">
  <a href="#the-four-surfaces">Surfaces</a> •
  <a href="#-the-prediction-suite">Prediction</a> •
  <a href="#%EF%B8%8F-route-map">Routes</a> •
  <a href="#-server-actions-reference">Actions</a> •
  <a href="#-user-stories--tier-mapping">User Stories</a>
</p>

## The Four Surfaces

### 📱 Diner Menu — `/r/[slug]`

Public, no login — exactly like scanning a table QR.

- **Live availability badges** — real portions-left per dish from the `dish_availability` view; "low" styling at ≤ 5 portions; counts tick down as *anyone* orders.
- **The strikethrough moment** — a dish hitting zero is struck through on every open menu in the same second: Eighty~~Six~~.
- **The Expeditor** — a chat assistant that runs the pass: prompted only with the live menu (availability, specials, prices), its picks validated against current stock before display, each one a single tap from the cart. It can tell you what's sold out — it can never recommend it.
- **AI swap on death** — tap a dead dish and Gemini names the real cause (*"kitchen ran out of paneer"*) and offers the closest available alternatives, validated against live stock.
- **Cart + ordering** — category-organized menu, veg/non-veg markers, dish photography, ordering against a table.
- **Live order tracking** — watch your order move `placed → cooking → served` as the kitchen bumps it; the *served* moment chimes and vibrates the phone.
- **Call the floor** — "Call waiter" and "Get bill" buttons page the waiter board in the same second (deduped server-side, so a nervous double-tap doesn't page twice).
- **Chef's specials** — a surplus intervention lands here as a brass-highlighted special: discounted price, struck-through original, one-line pitch.
- **Self-healing cart** — if a dish dies (or thins out) while it's in your cart, the cart adjusts itself with a toast instead of dead-ending your order.
- **Reservations & ratings** — book a table from the menu; rate the order (one per order, DB-enforced) after service.

### 👨‍🍳 Kitchen Board — `/kitchen`

- **Live order queue** — new tickets appear instantly over realtime, with a chime.
- **One-tap bumps** — advance items and orders; the diner's tracker updates in the same second.
- **The 86 board** — tap an ingredient to log a ledger event; the recipe graph instantly recomputes every affected dish everywhere.

### 🛎️ Waiter Floor View — `/waiter`

The fourth surface: what the person *between* the kitchen and the diner needs.

- **Diner pings** — "call waiter" / "get bill" requests land here with a chime and an age counter; one tap resolves them.
- **Live floor map** — every table with seats, status, its open order (status + age + items) and one-tap seat/free for walk-ins.
- **"Before they order"** — dead and dying dishes as at-a-glance chips (*"Butter Paneer · 86 in ~12 min"*), so the waiter warns the table before the kitchen has to.
- **Specials to push** — active chef's specials with prices, straight from the surplus radar.
- **Arriving soon** — reservations due in the next two hours, with party size and assigned table.

### 🖥️ Owner Console — `/dashboard`

Nine sections in a persistent sidebar:

| Section | What it does |
|---|---|
| **Overview** | The command center: 86-risk radar **and surplus radar**, red/amber/green status banner, live event feed, one-tap Prep and Run-special interventions, service planner, Dinner Rush controls, AI manager brief |
| **Orders** → **Billing** | Live orders board through the full lifecycle → GST invoice (5%), server-computed totals from frozen unit prices, **UPI payment window** (scan → gateway confirms in seconds → payment auto-recorded; sandbox gateway, cash fallback), reconciled round-off, printable |
| **Inventory** | Live stock with reorder thresholds and costs — plus the ledger **audit trail** (every stock event, with reason) |
| **Menu** | Dish CRUD with a **live recipe editor** — change a `qty_per_portion` and portions-left recomputes everywhere instantly |
| **Prep** | `prep_sheet()` forecaster: tomorrow's predicted usage per station + a priced draft purchase order, printable |
| **Reservations** | Book → seat (assign table) → complete; cancellations |
| **Tables** | Floor status, toggled live |
| **Staff** | Create owner / kitchen / waiter accounts |
| **Analytics** | 7-day revenue, orders, top dishes with sparklines · **CSV export** |
| **Feedback** | Every rating and comment + an AI theme summary grounded in the real comments |

## 🔮 The Prediction Suite

The features that don't exist elsewhere:

- **86-risk radar** — per-dish `minutes_to_86` = portions-left ÷ trailing-30-min velocity. Live, ranked, explainable to the minute, alerting inside 45 minutes.
- **Radar interventions** — press **Prep** on a dying dish and the engine computes the *exact* restock covering ~2 hours at current pace (e.g. *"+0.5 kg urad dal"*), prices it, and executes it as a ledger event. Not a suggestion — an action.
- **Surplus radar** — the same discipline at the other end: `ingredient_surplus` pairs live stock with trailing 24h usage; anything towering ≥4× over its reorder level surfaces with days-of-cover. Press **Run special** and the engine picks the available dish that moves the most of it, cuts the price (15%, rounded to ₹5), has Gemini write a one-line pitch from real data, and fans it out to every menu — diners see it, waiters push it, and it expires itself after 3 hours.
- **Service planner** — a deterministic what-if: "150 diners tonight?" → exactly which dishes die at which cover, the priced buy list to survive, projected vs lost revenue. Arithmetic, not a confidence score.
- **Status banner** — restaurant health computed from the radar. Deterministic, never generated.
- **Prep-sheet forecaster** — tomorrow's per-station kg from day-of-week usage history, with a 20% buffer, as a draft purchase order.

And the demo that proves it all: **Simulate Dinner Rush** floods the system with popularity-weighted orders through the *real* `placeOrder` path — kitchen fills with sound, badges count down, the banner degrades, the radar predicts, and a dish dies mid-demo on the diner's phone. One-click role entry and a stable-ID self-reset make it judge-proof.

## 🗺️ Route Map

| Path | Access | Description |
|---|---|---|
| `/` | Public | Product landing with animated dashboard mock |
| `/r/[slug]` | Public | Diner menu (`/r/demo`) — QR entry, no login |
| `/login` · `/signup` · `/auth/callback` | Public | Auth (email + password, one-time email codes, Google OAuth), one-click demo entry |
| `/kitchen` | kitchen | Order queue + 86 stock board |
| `/waiter` | waiter | Floor map, diner pings, 86 warnings, specials, arrivals |
| `/dashboard` | owner | Overview: both radars, banner, interventions, planner, rush |
| `/dashboard/orders` · `/dashboard/bill/[orderId]` | owner | Orders board → GST bill + printable receipt |
| `/dashboard/inventory` | owner | Stock + ledger audit trail |
| `/dashboard/menu` | owner | Menu CRUD + recipe editor |
| `/dashboard/prep` | owner | Prep sheet + purchase order |
| `/dashboard/reservations` · `/dashboard/tables` | owner | Reservation lifecycle · floor status |
| `/dashboard/staff` · `/dashboard/qr` | owner | Staff accounts · printable table QRs |
| `/dashboard/analytics` · `/dashboard/feedback` | owner | 7-day analytics + CSV · ratings + AI themes |

## ⚡ Server Actions Reference

All 24 writes live in [`src/app/actions.ts`](../src/app/actions.ts). Browsers are read-only by RLS — every one of these crosses the server; operational actions additionally resolve the caller's session and role (`requireStaff` in [`src/lib/authz.ts`](../src/lib/authz.ts)) before the service role writes. Diner-facing actions (order, reserve, rate, page the floor) stay public by design.

| Action | Called From | What It Does |
|---|---|---|
| `placeOrder` | Diner menu | Validates the cart against **live** `dish_availability`, inserts order + items (triggers deplete stock) — totals computed server-side |
| `bumpOrderStatus` | Kitchen / console | Advances `placed → cooking → served → paid` — forward-only, so racing surfaces can't revert a paid order |
| `adjustStock` | Kitchen 86 board / inventory | Writes a `stock_events` ledger row — never edits stock in place |
| `updateIngredient` · `createIngredient` | Inventory | Ingredient metadata / new ingredient into the graph |
| `upsertDish` · `setDishActive` | Menu manage | Dish CRUD **including its recipe** / manual on-off independent of derived availability |
| `interveneOnDish` | Radar | Computes + executes the exact restock covering ~2 h at current velocity |
| `planService` | Console | Deterministic what-if for N covers → death points, priced buy list, revenue projection |
| `rushTick` · `resetDemo` | Demo controls | One rush tick through the real order path · stable-ID SQL reset |
| `createReservation` · `updateReservation` | Menu / console | Book (validated) · seat / complete / cancel |
| `toggleTableStatus` | Console / waiter | Flip `free`/`occupied` (seat a walk-in from the floor map) |
| `callWaiter` | Diner menu | Pages the floor ("waiter" / "bill") — table validated, deduped against open calls |
| `resolveServiceCall` | Waiter board | One-tap "on it" — closes the ping everywhere |
| `runSpecial` | Surplus radar | Picks the dish that moves the most of an overstocked ingredient, discounts it, pitches it, fans it out |
| `endSpecial` · `clearExpiredSpecials` | Console | Restore the original price; lazy 3-hour expiry on console loads |
| `submitFeedback` | Diner tracking | One rating per order (DB-enforced unique) |
| `createStaff` | Console | Provision owner/kitchen/waiter accounts (owner-only) |
| `suggestSwap` · `getMorningBrief` · `getFeedbackSummary` | Menu / console / feedback | 🤖 Gemini features — grounded, validated, 8s-timeboxed with fallbacks, see [ARCHITECTURE.md](ARCHITECTURE.md#ai-with-guardrails) |

## 🏆 User Stories — Tier Mapping

```text
[x] 🥉 BRONZE    Landing · auth-gated console shell
[x] 🥈 SILVER    Auth + roles · live digital menu · order lifecycle · realtime notifications
[x] 🥇 GOLD      Orders · tables · inventory · sales · analytics — one engine, many views
[x] 💎 PLATINUM  Predictive 86ing · risk radar · AI features · prep forecasting
[x] ⭐ BONUS     Simulate Dinner Rush across four screens · surplus → specials · waiter floor view · UPI billing
```

| Tier | Story | Delivered As |
|---|---|---|
| 🥉 | Landing + console | Animated dashboard mock on the landing page · 9-section owner console behind auth |
| 🥈 | Real authentication | Supabase Auth, three methods: email + password with verification, one-time email codes (OTP), Google OAuth — cross-environment redirects, roles via DB trigger + RLS |
| 🥈 | Digital menu | Public QR-entry menu with **real availability** — derived from the recipe graph, not a manual toggle |
| 🥈 | Order lifecycle + realtime | Cart → `placed → cooking → served → paid`, live diner tracking, kitchen chime, zero polling |
| 🥇 | Operations suite | Orders → GST billing, tables, ledger-audited inventory, menu + recipe editor, reservations, feedback — all live views of one engine |
| 🥇 | Sales & analytics | 7-day revenue / top dishes / sparklines + CSV export |
| 💎 | Predictive 86ing | `dish_risk`: live time-of-death per dish, 45-min alerts, ranked radar, deterministic status banner |
| 💎 | Computed interventions | One-tap restock covering ~2h · surplus → discounted chef's special on every menu · service planner with death points, buy list, revenue projection |
| 💎 | AI with guardrails | Swaps (validated, with real cause), manager brief, prep notes, feedback themes — all grounded, all with non-AI fallbacks |
| 💎 | Prep forecasting | Day-of-week usage → tomorrow's per-station kg + priced purchase order |
| ⭐ | Dinner Rush | Popularity-weighted flood through the real order path — the demo *is* the proof nothing is staged |

Each tier is the same engine exposed further: Bronze renders it, Silver secures it, Gold manages it, Platinum **predicts and acts** with it, and the Bonus floods it to prove nothing is staged.
