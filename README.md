<div align="center">

# 🍽️ Eighty~~Six~~ — see the 86 coming

### The Restaurant Operating System Built Around One Idea: **The Menu Should Never Lie**

**Predictive Stockouts · Recipe-Graph Availability · Four Live Surfaces · Interventions At Both Ends · AI With Guardrails**

<br />

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[![Gemini](https://img.shields.io/badge/Gemini-AI_with_guardrails-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-Live_Demo-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://eightysix-two.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)

<br />

> A single engine — **ingredients → recipes → dishes** — computes true availability for every dish, **predicts** which dish dies next from live order velocity, and **acts** before diners hit a dead end. Where existing tools offer manual on/off toggles, EightySix forecasts the stockout and intervenes on every screen at once.

**🚀 Live demo → [eightysix-two.vercel.app](https://eightysix-two.vercel.app)** · no setup, resets itself

<p align="center">
  <a href="#%EF%B8%8F-judge-mode-2-minutes">Judge Mode</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#%EF%B8%8F-architecture">Architecture</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-documentation">Docs</a> •
  <a href="#-running-locally">Setup</a>
</p>

</div>

---

## 🎯 The Problem

When an ingredient dies mid-service, the kitchen finds out first, waiters find out from angry cooks, and diners find out *after ordering*. Online menus stay stale for hours. Nothing on the market predicts the stockout — everything reports it after the damage is done.

**How EightySix solves it:**

| Legacy tools | EightySix |
|---|---|
| Manual "sold out" toggles a human must remember to flip | Availability **derived** from live stock through the recipe graph |
| Stockout discovered when a diner orders a dead dish | Stockout **predicted** — every dish gets a live time-of-death |
| Each screen polls its own stale copy of the menu | One row change fans out to diner, kitchen, floor and owner **in the same second** |
| Dashboards that report the damage | One-tap **interventions** computed from the recipe graph |
| Overstock quietly rots into waste | Surplus detected too — one tap turns it into a **discounted chef's special** on every menu |

## 🏷️ Why "EightySix"?

**"86"** is real kitchen slang: when a dish runs out, it gets *86'd* — struck off the menu. The product is named after the exact moment it exists to prevent, and the brand mark is the strikethrough itself: Eighty~~Six~~.

## 💡 What Makes It Unique

- **Predictive 86ing** — every dish gets a live *time of death*: `portions_left ÷ order velocity`. The manager is warned while there's still time to act.
- **A recipe graph, not a toggle** — availability is *derived*: a dish is as available as its scarcest ingredient. Edit a recipe quantity and portions-left recomputes everywhere, live.
- **Four surfaces, one truth** — diner menu, kitchen board, waiter floor view and owner console react to the same row change in the same second. No polling anywhere.
- **Interventions at both ends** — a dying dish gets a one-tap restock computed to cover ~2h at current pace; an *overstocked* ingredient gets a one-tap **chef's special** — the engine picks the dish that moves the most of it, cuts the price, and announces it on every menu live. The service planner answers "150 diners tonight?" with arithmetic, not a confidence score.
- **The floor is in the loop** — diners page the staff ("call waiter" / "get the bill") straight from their phone; the waiter board chimes, shows the table map, warns which dishes die next *before* a diner orders one, and knows which specials to push.
- **AI with guardrails** — Gemini suggests swaps, writes briefs and pitches specials, but only from engine data; its picks are validated against live stock before display.
- **A demo that proves it** — the Dinner Rush floods the system through the *real* order path, so judges watch the whole machine react, live.

## ⏱️ Judge Mode (2 Minutes)

1. **Open** the [live demo](https://eightysix-two.vercel.app) → **Open the owner console** (one-click login).
2. **Second tab:** the diner menu at [`/r/demo?table=T3`](https://eightysix-two.vercel.app/r/demo?table=T3) — no login, like scanning a table QR.
3. **Press "Simulate dinner rush."** Watch, in order: kitchen fills (with sound) → menu badges count down → status banner flips green → amber → red → the **86-risk radar** predicts each dish's death → a dish dies and is struck through on the diner menu *in the same second*.
4. **Press "Prep"** on a dying radar row — the engine computes the exact restock (e.g. *"+0.5 kg urad dal — covers ~2h at current pace"*) and executes it. Or try **"Plan a service"** to see what 150 diners would do to tonight's stock.
5. **Scroll to the Surplus radar** → press **"Run special"** on an overstocked ingredient — the engine picks the dish that moves the most of it, discounts it, and the **chef's special** appears on the diner menu with a struck-through price, live.
6. **Tap the dead dish** on the menu → the AI names the ingredient that ran out and offers the closest available swap.
7. **Third tab — the floor:** enter as **waiter**. On the diner tab press **"Call waiter"** or **"Get bill"** → the floor board chimes and shows the table instantly; it also lists which dishes to warn diners about *before they order*, and which specials to push.
8. **Bill it:** owner console → Orders → a served order → **Generate bill** — GST receipt with a scannable **UPI payment QR** for the exact total.
9. **Reset demo** restores the seed state anytime.

### 🔑 Demo Credentials

| Portal Role | Email | Password | Access URL |
|---|---|---|---|
| **Owner Console** | `owner@eightysix.demo` | `eightysix-owner-demo` | `/dashboard` |
| **Kitchen Board** | `kitchen@eightysix.demo` | `eightysix-kitchen-demo` | `/kitchen` |
| **Waiter Floor View** | `waiter@eightysix.demo` | `eightysix-waiter-demo` | `/waiter` |
| **Diner Menu** | *no login — public QR entry* | — | `/r/demo` |

*(All behind one-click buttons on the login page — you never have to type these.)*

## 📸 Screenshots

| Landing | Owner Console — 86-Risk Radar |
| :---: | :---: |
| ![Landing](screenshots/landing.png) | ![Owner console](screenshots/console-overview.png) |

| Kitchen Board | Orders → GST Billing |
| :---: | :---: |
| ![Kitchen board](screenshots/kitchen.png) | ![Orders board](screenshots/orders-board.png) |

| Menu CRUD + Live Recipe Editor | 7-Day Analytics + CSV Export |
| :---: | :---: |
| ![Menu management](screenshots/menu-manage.png) | ![Analytics](screenshots/analytics.png) |

<div align="center">

| Diner Menu (Mobile — QR Entry) |
| :---: |
| <img src="screenshots/menu-mobile.png" alt="Diner menu on mobile" width="360" /> |

</div>

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Screens["Four live surfaces"]
        DINER["📱 Diner menu<br/>/r/demo — no login<br/>QR entry · cart · order tracking<br/>call waiter / get bill<br/>reservations · ratings"]
        KITCHEN["👨‍🍳 Kitchen board<br/>/kitchen — kitchen role<br/>order queue · chime<br/>86 board (stock taps)"]
        WAITER["🛎️ Waiter floor view<br/>/waiter — waiter role<br/>table map · diner pings<br/>86 warnings · specials to push"]
        CONSOLE["🖥️ Owner console<br/>/dashboard — owner role<br/>9 sections: 86 + surplus radar<br/>orders · billing · inventory · menu<br/>reservations · analytics · feedback · staff"]
    end

    subgraph Next["Next.js 16 (Vercel)"]
        SA["Server actions<br/>(service role writes<br/>+ per-role auth guards)"]
        PROXY["proxy.ts<br/>session refresh + route guards"]
    end

    subgraph Supabase["Supabase (Postgres)"]
        ENGINE["⚙️ THE ENGINE (pure SQL)<br/>stock_events ledger + triggers<br/>unit-price snapshots<br/>dish_availability · dish_risk<br/>ingredient_surplus · service_calls<br/>prep_sheet() forecaster"]
        RT["Realtime<br/>(websockets)"]
        AUTH["Auth<br/>email + Google OAuth<br/>roles via RLS"]
    end

    GEMINI["✨ Gemini<br/>swap suggestions · manager brief<br/>special pitches · prep notes<br/>feedback themes"]

    DINER -->|order / reserve / rate / page the floor| SA
    KITCHEN -->|bump / stock taps| SA
    WAITER -->|resolve calls / seat tables| SA
    CONSOLE -->|manage everything| SA
    SA --> ENGINE
    SA -->|grounded prompts,<br/>validated picks| GEMINI
    ENGINE -->|row changes| RT
    RT -.->|live push, no polling| DINER & KITCHEN & WAITER & CONSOLE
    PROXY --> AUTH
```

### How a single order changes everything

```mermaid
flowchart LR
    A["🍛 Order placed<br/>Butter Paneer ×2"] -->|trigger| B["stock_events ledger<br/>one depletion event<br/>per recipe ingredient"]
    B -->|trigger| C["dish_availability<br/>floor(min(stock ÷<br/>qty_per_portion))"]
    C --> D["dish_risk<br/>ETA = portions × 30<br/>÷ 30-min velocity"]
    D --> E["🔴 Radar alert<br/>'86 in ~34 min'"]
    C --> F["⚡ Dish dies: struck from<br/>every menu · AI swap<br/>offered from live stock"]
    B --> G["prep_sheet()<br/>tomorrow's kg +<br/>purchase order"]
```

📖 Deep dive — request lifecycle, realtime fan-out, design decisions: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

## ⚙️ Core Engine Components

| Component | What it does |
|---|---|
| `stock_events` | Event-sourced inventory ledger — every stock change is an auditable row |
| Triggers | Order items auto-deplete every recipe ingredient; events fold into live stock; each order line freezes its `unit_price` so bills and analytics can't be rewritten by later price changes |
| `dish_availability` | `floor(min(stock ÷ qty_per_portion))` — scarcest ingredient wins |
| `dish_risk` | Trailing 30-min velocity → `minutes_to_86` per dish |
| `ingredient_surplus` | Live stock vs trailing 24h usage → days-of-cover; feeds the surplus radar |
| `service_calls` | Diner → floor pings ("call waiter" / "get bill"), pushed to the waiter board live |
| `prep_sheet()` | Day-of-week usage history → tomorrow's per-station kg + draft purchase order |
| Realtime + RLS | Row changes push to every screen; public reads, role-scoped writes |

Every number on screen derives from these rows — no mock data, no hardcoded countdowns. The math is verified against hand-computed values (Butter Paneer ×2 ordered → paneer 9 kg → 8.6 kg → 45 → 43 portions → at 6 portions/30 min velocity, 86 in exactly 215 min).

📖 Full schema, every trigger and view, RLS policies: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

## ✨ Key Features

### 🔮 Prediction Engine
Live per-dish availability · 86-risk radar with time-of-death · 45-min alerts · one-tap radar interventions (restock quantity *computed* from the recipe graph to cover ~2h at current pace) · **surplus radar**: overstock detected from stock vs reorder level + trailing usage, one tap launches a discounted **chef's special** on every menu · **service planner**: a deterministic what-if — "150 diners tonight?" → exactly which dishes die at which cover, a priced buy list, projected vs lost revenue · restaurant status banner · prep-sheet forecaster + purchase order

### 🏪 Restaurant Operations
QR table entry · cart + live order tracking with a served-order chime on the diner's phone · **call waiter / get bill** from the table · **waiter floor view**: live table map, diner pings with chime, arriving reservations, dishes-to-warn-about and specials-to-push · kitchen queue with chime + one-tap stock board · orders board → GST billing with a **UPI payment window** (scan → gateway confirms → auto-recorded; cash fallback) and reconciled round-off · ledger-audited inventory · menu CRUD with live recipe editor · reservations (book → seat → complete) · tables · staff accounts (owner / kitchen / waiter) · 7-day analytics with CSV export

### 🤖 AI Features
Dead-dish swap suggestions (with the real cause: *"kitchen ran out of paneer"*) · chef's-special one-line pitches · manager brief · chef's prep notes · feedback theme summaries — every AI call timeboxed with a deterministic fallback

### 🎬 Demo Experience
One-click role entry (all four surfaces) · Simulate Dinner Rush · self-resetting seed restaurant · diner ratings · printable QRs, receipts and prep sheets

📖 Every feature, every route, all 24 server actions: **[docs/FEATURES.md](docs/FEATURES.md)**

## 🆕 What's New

The engine recently grew a second edge, a fourth surface, and a hardening pass.

| Area | What's new |
|---|---|
| **Surplus interventions** | The radar now watches both ends: `ingredient_surplus` view spots overstock; one tap computes and launches a discounted chef's special that fans out to every menu (with a Gemini-written, engine-grounded pitch) |
| **Waiter floor view** | A 4th realtime surface (`/waiter`, new `waiter` role): live table map, diner service pings with chime, arriving reservations, "warn before they order" 86 alerts, specials to push |
| **Diner service loop** | "Call waiter" / "Get bill" from the table QR menu → floor board chimes in the same second; served orders now chime + vibrate on the diner's phone |
| **UPI billing** | A counter payment window: scannable UPI QR for the exact total, gateway confirmation auto-recorded (sandbox), cash fallback — plus paise-exact CGST/SGST with a reconciled round-off line |
| **Money integrity** | `order_items.unit_price` frozen at order time — running a special (or any price edit) can no longer rewrite historical bills or analytics |
| **Security hardening** | Every operational server action now resolves the caller's session + role before writing (`requireStaff`); client-supplied IDs validated against the restaurant; order statuses can only move forward (no reverting a paid order) |
| **Correctness sweep** | 27 defects found by an adversarial review and fixed — IST-pinned analytics bucketing (correct on UTC deploys, no hydration mismatches), carts self-heal when a dish dies mid-order, every surface reconciles after "Reset demo", radar keeps a fast-selling last portion visible, kitchen chime survives Chrome's autoplay policy, AI calls timeboxed at 8s with fallbacks, loading/error boundaries across the console |

## 🏆 User Stories Completed

| Tier | Delivered |
|---|---|
| 🥉 Bronze | Product landing with animated dashboard mock · 9-section owner console |
| 🥈 Silver | Three sign-in methods (email + password with verification, one-time email codes, Google OAuth) + RLS roles · live digital menu with **real availability** · order lifecycle · realtime notifications |
| 🥇 Gold | Orders, tables, inventory, sales and analytics — all live views of one engine |
| 💎 Platinum | Predictive 86ing · risk radar · AI swaps + briefs · prep-sheet + purchase-order generation |
| ⭐ Bonus | **Simulate Dinner Rush** across four live screens · surplus → chef's-special interventions · waiter floor view with diner pings · UPI billing |

📖 Story-by-story mapping with implementation notes: **[docs/FEATURES.md](docs/FEATURES.md)**

## 🛠️ Technology Stack

| Domain | Technology | Usage & Scope |
| :--- | :--- | :--- |
| **Core Framework** | **Next.js 16.2 (App Router)** | Server components, server actions for every write, Turbopack dev |
| **UI Runtime** | **React 19** | Client islands only where interactivity demands it |
| **Language** | **TypeScript 5** | End-to-end typed — engine rows to UI props |
| **Styling** | **Tailwind CSS v4 + shadcn/ui (Radix)** | Design system, dark aesthetics, `motion` micro-animations |
| **Database + Realtime** | **Supabase (Postgres)** | The engine itself: views, triggers, functions · websocket row-change push |
| **Auth** | **Supabase Auth** | Email + password (verified) · one-time email codes (OTP) · Google OAuth · roles enforced by RLS |
| **AI** | **Google Gemini (`gemini-flash-latest`)** | Grounded prompts over engine data, JSON mode, validated output |
| **Deployment** | **Vercel** | Production deployment + preview builds |

## 📁 Directory Structure

```text
eightysix/
├── src/
│   ├── app/
│   │   ├── (auth)/                # Login + signup with one-click demo entry
│   │   ├── auth/callback/         # OAuth + email-link redirect handler
│   │   ├── r/[slug]/              # 📱 Diner menu — public, QR entry, cart, tracking, floor pings
│   │   ├── kitchen/               # 👨‍🍳 Kitchen board — order queue + 86 stock board
│   │   ├── waiter/                # 🛎️ Waiter floor view — table map, pings, 86 warnings
│   │   ├── dashboard/             # 🖥️ Owner console (9 sections)
│   │   │   ├── analytics/         #   7-day analytics + CSV export
│   │   │   ├── bill/[orderId]/    #   GST billing + printable receipt
│   │   │   ├── feedback/          #   Diner ratings + AI theme summary
│   │   │   ├── inventory/         #   Ledger-audited stock management
│   │   │   ├── menu/              #   Menu CRUD + live recipe editor
│   │   │   ├── orders/            #   Orders board → billing
│   │   │   ├── prep/              #   Prep-sheet forecaster + purchase order
│   │   │   ├── qr/                #   Printable table QR codes
│   │   │   ├── reservations/      #   Book → seat → complete lifecycle
│   │   │   ├── staff/             #   Staff account management
│   │   │   └── tables/            #   Floor & table status
│   │   ├── actions.ts             # ALL writes — 24 server actions (service role + role guards)
│   │   └── page.tsx               # Product landing with animated dashboard mock
│   ├── components/                # Brand, sidebar, rush controls, shadcn/ui kit
│   ├── lib/
│   │   ├── engine.ts              # Typed client of the SQL engine — risk, surplus, health, analytics
│   │   ├── authz.ts               # requireStaff() — per-action session + role guard
│   │   ├── gemini.ts              # Gemini REST wrapper (text + strict JSON mode, 8s timebox)
│   │   ├── owner.ts               # Per-request auth context for the console
│   │   ├── demo.ts                # One-click evaluator accounts
│   │   └── supabase/              # Browser / server / admin (service-role) clients
│   └── proxy.ts                   # Session refresh + route guards
├── supabase/migrations/           # ⚙️ THE ENGINE — 001 → 006, pure SQL
├── scripts/                       # Demo-account bootstrap (idempotent)
├── screenshots/                   # README screenshots
├── docs/                          # 📚 Deep-dive documentation
└── PRD.md                         # Product requirements document
```

## 📚 Documentation

| Document | What's Inside |
| :--- | :--- |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | The deep dive — system design, full database engine (schema, triggers, views, RLS), security model, AI guardrails, design decisions |
| **[docs/FEATURES.md](docs/FEATURES.md)** | Every feature by surface, complete route map, all 24 server actions, user-story tier mapping |
| **[docs/SETUP.md](docs/SETUP.md)** | Local install, Supabase provisioning, env vars, Vercel deployment, troubleshooting |

## 🔩 Engineering Highlights

- **Event-sourced inventory** — stock is never edited in place; a ledger + trigger folds events into state, so the overview shows a live audit trail.
- **SQL-first engine** — availability, velocity, surplus and forecasting live in Postgres views/functions; the UI can't disagree with the database.
- **Zero polling** — every screen subscribes to Supabase Realtime; one row change fans out to four surfaces, and every channel re-syncs on reconnect so a sleeping laptop catches up.
- **Writes behind guarded server actions** — anon clients are read-only by RLS; every mutation crosses the server, and every operational action resolves the caller's session + role (`requireStaff`) and validates ownership of client-supplied IDs before the service role writes.
- **Server-trusted money** — prices, totals and GST always come from database rows on the server; each order line freezes its `unit_price` at placement, so later price edits and specials can't rewrite bills or analytics.
- **Defense in depth** — role-guarded routing (`proxy.ts`) + per-action auth checks + row-level security at the database, with orders re-validated against live availability at placement time and statuses moving forward-only.
- **Deterministic status** — the red/amber/green banner is computed from the radar, never generated.
- **Timezone-honest analytics** — day/hour buckets pin to IST on server and client alike, so a UTC deploy shows the same numbers a Delhi restaurant lives by.

## 🧗 Technical Challenges Solved

- **One order, ten reactions** — a single insert must correctly cascade through the ledger, stock, availability, predictions, kitchen queue, diner badges, analytics and prep forecast — in real time, on four screens. Getting that graph right (and provably right) was the core of the build.
- **Predicting from a sliding window** — velocity decays with time, not just events, so risk recomputes on both realtime triggers and a clock tick.
- **Demo integrity** — the rush simulator uses the identical code path as real orders; a stable-ID reset restores the seed without breaking logins, realtime channels, or QR links.
- **Prod-parity details** — UTC server rendering vs IST clients (hydration-safe timestamps), OAuth + email-link redirects across environments, RLS that stays strict while diners stay anonymous.

## 🤖 AI With Guardrails

AI never invents data here — **SQL is always the source of truth.** Gemini is prompted only with engine output (live availability, real ratings, real usage history), its swap picks are validated against current stock before display, and every AI feature has a non-AI fallback. In development: built with AI-assisted coding (Claude Code), with every feature verified against the live database via scripted end-to-end checks.

📖 Prompt-grounding and validation details: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#ai-with-guardrails)**

> Dish photography sourced from [Wikimedia Commons](https://commons.wikimedia.org) (Creative Commons licenses).

## 🚀 Running Locally

**Prerequisites:** Node.js 18+, a [Supabase](https://supabase.com) project, a [Gemini API key](https://aistudio.google.com/apikey) (free tier fine)

```bash
# 1. Clone the repo
git clone https://github.com/uttampreet-dev/EightySix.git
cd EightySix

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local   # Supabase URL, anon key, service-role key, Gemini key

# 4. Start the dev server
npm run dev
```

Run `supabase/migrations/` **001 → 006** in the Supabase SQL editor, in order. `001` creates the schema, engine and demo seed; `005` adds reservations + feedback; `006` adds the waiter role, service calls, chef's specials and price snapshots. Then `node scripts/bootstrap-demo-accounts.mjs` creates the three one-click demo accounts.

📖 Step-by-step provisioning + Vercel deployment: **[docs/SETUP.md](docs/SETUP.md)**

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE).

---

<div align="center">

*Next.js 16 · Tailwind v4 + shadcn/ui · Supabase · Gemini · Vercel*

**One engine, four surfaces, a menu that can't lie.**

⭐ **If EightySix caught the 86 before you did, star the repo!** ⭐

</div>
