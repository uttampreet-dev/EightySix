# 🚀 Setup & Deployment

Get EightySix running locally in ~10 minutes, or skip it all — the **[live demo](https://eightysix-two.vercel.app)** needs no setup and resets itself.

<p align="center">
  <a href="#1-clone--install">Install</a> •
  <a href="#2-provision-supabase">Supabase</a> •
  <a href="#3-environment-variables">Env Vars</a> •
  <a href="#4-migrations--run">Run</a> •
  <a href="#deploying-to-vercel">Deploy</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

**Prerequisites:** Node.js 18+ · a [Supabase](https://supabase.com) project (free tier fine) · a [Gemini API key](https://aistudio.google.com/apikey) (free tier fine)

## 1. Clone & Install

```bash
git clone https://github.com/uttampreet-dev/EightySix.git
cd EightySix
npm install
```

## 2. Provision Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. From **Project Settings → API**, note the **Project URL**, **anon** key, and **service_role** key.
3. *(Optional, for Google sign-in)* **Authentication → Providers → Google**: add your OAuth client, and register your site URL(s) under **Authentication → URL Configuration** so email links and OAuth redirects land on the right origin.

## 3. Environment Variables

```bash
cp .env.example .env.local
```

| Variable | Where to Get It | Used For |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Browser + server clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Read-only browser client (RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **Server-only** — all writes via server actions; never reaches the browser |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | **Server-only** — AI swaps, briefs, summaries |

## 4. Migrations & Run

Open the **SQL Editor** in Supabase and run the seven files from [`supabase/migrations/`](../supabase/migrations/) **in order** — `001_init.sql` through `007_history.sql`. Each file is idempotent (safe to re-run); `001` seeds the demo restaurant (*Tandoor Tales*: 32 ingredients, 28 dishes, the full recipe graph, 10 tables); `006` adds the waiter role, service calls, chef's specials and unit-price snapshots; `007` makes every reset seed six days of order history so analytics and forecasts are populated. What each file creates: [ARCHITECTURE.md](ARCHITECTURE.md#the-engine--pure-sql).

Then create the three one-click demo accounts (idempotent, uses `.env.local`):

```bash
node scripts/bootstrap-demo-accounts.mjs
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the diner menu is at [/r/demo](http://localhost:3000/r/demo), no login needed. Sign up at `/signup` choosing a role: **owner** lands on `/dashboard`, **kitchen** on `/kitchen`, **waiter** on `/waiter` (profiles are created automatically by a DB trigger; Google sign-ins default to owner).

## Deploying to Vercel

1. Push to GitHub and import the repo in the [Vercel dashboard](https://vercel.com) (framework preset **Next.js**, defaults are correct).
2. Add the four environment variables under **Project Settings → Environment Variables**.
3. **Deploy.**
4. Add your production URL to Supabase **Authentication → URL Configuration** (site URL + redirect URLs) so OAuth and email-verification links work in production — don't skip this.

## Resetting the Demo Data

Three ways, all safe — `reset_demo()` keeps every ID stable, so logins, printed QRs and open realtime channels survive:

- **UI:** the "Reset demo" button in the owner console.
- **SQL:** `select public.reset_demo();` in the SQL Editor.
- **Hosted demo:** resets itself.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `demo restaurant missing — run 001_init.sql first` | Migrations ran out of order — run `001`, then 002–007 |
| Screens don't update live | Realtime publication missing — re-run `001`, `005` and `006` (they add tables to `supabase_realtime`) |
| Demo login buttons fail | Demo accounts not provisioned — run `node scripts/bootstrap-demo-accounts.mjs` |
| OAuth/email link lands on `localhost` in prod | Add the production URL in Supabase Auth URL Configuration |
| AI features show fallbacks | `GEMINI_API_KEY` missing or over quota — every AI feature degrades gracefully by design |
| Writes fail from the browser | Expected — browsers are read-only by RLS; all writes go through server actions with the service-role key |
