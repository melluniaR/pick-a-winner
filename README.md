# Pick a Winner

A production-ready camp multi-round prediction game built with Next.js App Router, Supabase, and realtime updates. Optimized for 50-70 devices and 50-150 players sharing a live leaderboard and public display screen.

## Architecture (high level)
- **Next.js App Router + TypeScript + Tailwind** for UI and routing.
- **Supabase Auth** for persistent email/password sessions.
- **Supabase Postgres + RLS** for game data and per-alias voting permissions.
- **Realtime** subscriptions on `votes`, `rounds`, and `alias_scores` to update UI within ~1s.
- **Display token**: `/display/[token]` reads from a server-only API route, never exposing host credentials.
- **Rolling rounds**: players can only see the currently OPEN round or the leaderboard. Past rounds are host-only.

## Local development (Supabase Local)

### 1) Start Supabase
```bash
supabase start
```

### 2) Create `.env.local`
Use the values from `supabase status`:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3) Apply migrations + seed demo data
```bash
supabase db reset
```

### 4) Install deps + run the app
```bash
npm install
npm run dev
```

Open http://localhost:3000

## Seeded demo users
- **Host**: `host@camp.test` / `password123`
- **Player 1**: `player1@camp.test` / `password123`
- **Player 2**: `player2@camp.test` / `password123`

Seeded game join code: `CAMP24`

## Host runbook
1. **Create game** in `/games` and share the join code.
2. **Create a round** in Host Controls (`/game/[id]/host`) with a hint and options.
3. **Open round** when ready. Players see it instantly.
4. **Score** by selecting the correct option and confirming.
5. **Leaderboard updates** in real time; public display auto switches to standings.
6. **End game** by setting status to ENDED (optional).

## Rolling rounds behavior
- Players never see past rounds or a round counter.
- Player view only shows:
  - an OPEN round (if any), or
  - a waiting screen + leaderboard.
- Host view can see all rounds and history.

## Supabase schema + RLS
Migrations live in `supabase/migrations`. Highlights:
- Partial unique index: one OPEN round per game.
- RLS prevents voting for aliases you don't own.
- Host-only permissions for round management and scoring.
- `alias_scores` stores cumulative points for fast leaderboard queries.

## Display screen
- URL: `/display/[display_token]` (display token stored on the game row).
- Read-only, no auth required.
- Shows live vote distribution when OPEN, otherwise leaderboard.
- Shortcut: On the login page, enter a join code and open the public display without signing in.

## Deployment notes
- Deploy Next.js to Vercel.
- Create a Supabase project in the cloud.
- Run the migrations in `supabase/migrations`.
- Set environment variables in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
