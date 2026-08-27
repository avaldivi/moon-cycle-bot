# 🌙 Moon Cycle Bot

A bot that posts moon phase, moon sign, and moon transit updates to **Bluesky** and (as a cost-gated POC) **X (Twitter)**, and replies to mentions with personalized moon house interpretations based on the user's rising sign.

- Built with Node.js, deployed on Fly.io across two regions, and triggered via GitHub Actions.
- Bluesky posting/replying is free (AT Protocol) and runs at full cadence.
- X posting/replying uses X's pay-per-use API, so it's gated behind an explicit dry-run kill switch and only posts on the moon phases worth the cost.

## How It Works

### 🌘 Bluesky (full cadence, free)

Every day at 9:00 AM ET, a GitHub Actions cron job hits the `/daily` endpoint on the Fly.io server, which posts the current moon phase and moon sign to Bluesky.

#### 💬 Mentions & Replies (Conversational Mode)

Every 5 minutes:

**GitHub Actions → `curl /mentions`**

The bot:

1. Fetches notifications from Bluesky
2. Filters:
   - Only `mention` or `reply`
   - Only notifications from today (TIMEZONE-aware)
   - Only notifications newer than `lastSeenAt`
   - Never responds to itself
3. Extracts the rising sign from user text
4. Calculates which house the Moon is transiting
5. Generates a response using the Vercel AI SDK
6. Replies threaded correctly to the user
7. Saves state to Redis (shared across both Fly machines — see [State & Persistence](#-state--persistence-redis))

This ensures:

- No historical spam
- No duplicate replies
- Clean threading
- Safe cron execution, even with two machines polling on the same schedule

### 🐦 X (Twitter) — cost-gated POC

Lives in [`twitter/`](twitter/) and mirrors the Bluesky bot's structure and templates, with two differences forced by X's pricing model (pay-per-use, no free tier — see [`tools/x_cost_estimator.js`](tools/x_cost_estimator.js)):

- **`X_DRY_RUN`** — a single kill switch (env var, defaults to `true`) covering all X routes. Nothing posts or replies for real until it's explicitly set to `false` as a Fly secret. In dry-run, `/daily-x` and `/transits-x` log what *would* post instead of calling the API; `/mentions-x` still reads mentions for real (reads are cheap — see below) but skips the reply/write.
- **Phase-gated daily post** — unlike Bluesky (posts every phase), `twitter/moon_bot.js` only posts on New Moon, Full Moon, and First Quarter (`X_POST_PHASES`), since every post is a billed API call.

Routes (all protected by `CRON_SECRET`, same as the Bluesky ones):

| Route          | Mirrors          |
| -------------- | ----------------- |
| `POST /daily-x`    | `/daily` (phase-gated) |
| `POST /transits-x` | daily transits post |
| `POST /mentions-x` | `/mentions` |

Scheduled via `daily-x.yml`, `transits-x.yml`, and `mentions-x.yml` — see [GitHub Actions](#github-actions) below.

X's mentions endpoint (`GET /2/users/:id/mentions`) is billed **per resource returned, not per call** — an empty poll costs $0, and returns from your own account are billed as "owned reads" ($0.001/tweet) rather than standard reads ($0.005/tweet). So polling frequency itself is free; only actual mentions and posts cost money. Run `npm run x:dry-run` to see a projected monthly cost breakdown.

### 🧠 LLM Integration

The bot uses:

- **Vercel AI SDK (`ai`)**
- **`@ai-sdk/openai`**
- Model: **`gpt-4o-mini`**

Example:

```js
const { generateText } = require("ai");
const { openai } = require("@ai-sdk/openai");

const model = openai("gpt-4o-mini", {
  apiKey: process.env.OPENAI_API_KEY,
});
```

Responses are:

- House-aware (Moon sign + Rising sign logic)
- Constrained to ≤ 280 characters (safe for both Bluesky and X)
- Generated using a strict prompt template
- Clamped before posting to prevent API rejection

## Moon Phase Calculation

Moon phase data is fetched from the [ipgeolocation.io Astronomy API](https://ipgeolocation.io/). Rather than trusting the API's own phase label directly, we derive the phase ourselves for accuracy using two data points from the response:

- `moon_illumination_percentage` — how much of the moon's surface is lit
- `moon_angle` — the ecliptic angle, which tells us whether the moon is waxing or waning

The derivation logic:

| Illumination | Angle | Phase |
|---|---|---|
| < 2% | any | New Moon |
| 2–48% | ≤ 180° | Waxing Crescent |
| 2–48% | > 180° | Waning Crescent |
| 48–52% | ≤ 180° | First Quarter |
| 48–52% | > 180° | Last Quarter |
| 52–99.5% | ≤ 180° | Waxing Gibbous |
| 52–99.5% | > 180° | Waning Gibbous |
| ≥ 99.5% and within 5° of 180° | — | Full Moon |

This approach is more precise than relying solely on the API's label, which can bucket high-illumination days (e.g. 97–99%) as Full Moon prematurely.

Timezone offset is derived dynamically from the `TIMEZONE` environment variable using the `Intl` API, so DST transitions are handled automatically without any manual config changes.

## Why Fly.io

The bot runs as a persistent Node.js server on [Fly.io](https://fly.io) rather than as a standalone script because:

- It needs to be reachable via HTTP so GitHub Actions can trigger it on a schedule with a simple `curl` call
- Deployment is handled automatically on push to `main` via the `fly-deploy.yml` GitHub Action

### Two machines, two regions

The app runs **2 machines simultaneously — `iad` and `sjc`** (`min_machines_running = 1` per region, `auto_stop_machines = off` in [`fly.toml`](fly.toml)) — not for scale, but so that a regional outage doesn't take the bot down. This is a real scenario that's happened before: a Fly `dfw` resource-exhaustion event once blocked all deploys for hours. With two machines in different regions, Fly's proxy routes around a dead region automatically.

The tradeoff: any state written to a local Fly volume is **not shared** between machines in different regions — each gets its own separate volume instance under the same mount name. That's what [State & Persistence](#-state--persistence-redis) below solves.

## 💾 State & Persistence (Redis)

Persisted bot state — Bluesky's mentions checkpoint, X's mentions checkpoint, and X's rotating OAuth2 refresh token — lives in a small shared **Redis** instance (Fly-managed Upstash, `moonbot-redis`), not on the local `/data` volume. This is required, not just nice-to-have: with two machines in different regions each holding its own volume, file-based state silently diverges between them — most seriously for X's OAuth token, which X invalidates on every refresh, so a machine working off a stale local copy would start failing outright.

All state access goes through [`lib/redis_store.js`](lib/redis_store.js):

- `loadJSON(key, fallback)` / `saveJSON(key, value)` — reads/writes a JSON blob by key
- `acquireLock(key, { ttlMs })` / `releaseLock(key)` — a real cross-machine lock via Redis `SET NX PX`, so overlapping cron runs are blocked even when they land on different machines (a plain file lock only ever protected against overlaps on the *same* machine)

Three thin wrappers sit on top of it, each owning its own Redis key so the platforms never collide:

| Module | Redis key(s) | Holds |
|---|---|---|
| [`mentions_state.js`](mentions_state.js) | `bluesky_mentions_state`, `bluesky_mentions_lock` | Bluesky `lastSeenAt` + processed URI/CID set |
| [`twitter/mentions_state.js`](twitter/mentions_state.js) | `twitter_mentions_state`, `twitter_mentions_lock` | X `since_id` + processed tweet ID set |
| [`twitter/oauth_state.js`](twitter/oauth_state.js) | `x_oauth_state` | X's rotating access/refresh token pair |

If `REDIS_URL` isn't set, all three fall back to local files under `MOONBOT_DATA_DIR` (default `/data`) — this is what keeps local dev and the dry-run scripts working without provisioning Redis.

At this bot's usage volume (5-minute mention polling on both platforms, a handful of replies/day), Redis usage sits comfortably inside Upstash's free tier (500k commands/month, 1GB storage) — see [`tools/x_cost_estimator.js`](tools/x_cost_estimator.js) for the reasoning.

## Setup

```bash
git clone https://github.com/avaldivi/moon-cycle-bot
cd moon-cycle-bot
touch .env
```

Add the following to your `.env` for local testing:

```
BLUESKY_USERNAME=        # your Bluesky handle, e.g. yourbot.bsky.social
BLUESKY_PASSWORD=        # Bluesky app password (not your account password)
LAT_COORDINATE=          # latitude of your location, e.g. 34.12
LONG_COORDINATE=         # longitude of your location, e.g. -83.99
TIMEZONE=                # IANA timezone name, e.g. America/New_York
IPGEO_API_KEY=           # API key from ipgeolocation.io (free tier: 1,000 req/day)
OPENAI_API_KEY=          # OpenAI API key for LLM-generated post content
FLY_API_TOKEN=           # Fly.io deploy token for GitHub Actions CI/CD
CRON_SECRET=             # shared secret GitHub Actions sends as a Bearer token to /daily, /mentions, etc.
MOONBOT_DATA_DIR=        # local state dir, e.g. ./data — used only when REDIS_URL is unset
REDIS_URL=               # optional locally; leave unset to use the file fallback under MOONBOT_DATA_DIR

# X (Twitter) — pay-per-use, no free tier. Leave blank to keep twitter/*.js in dry-run only.
X_ACCESS_TOKEN=          # from your X developer app's initial OAuth2 grant
X_REFRESH_TOKEN=         # from the same initial OAuth2 grant — rotates automatically after first use
X_CLIENT_ID=              # X developer app client ID
X_CLIENT_SECRET=          # X developer app client secret
```

Set Fly.io endpoint url as a Github repo secret for Github Actions

```
FLY_APP_URL=        # Fly.io app URL, e.g. https://moon-cycle-bot.fly.dev
```

### Getting Your API Keys

- **Bluesky app password** — Settings → Privacy and Security → App Passwords in the Bluesky app
- **ipgeolocation.io** — Sign up at [ipgeolocation.io](https://ipgeolocation.io), free tier includes 1,000 requests/day
- **Fly.io deploy token** — Run `fly tokens create deploy -a your-app-name` and store the output as a GitHub secret named `FLY_API_TOKEN`
- **X developer app** — Create an app at [developer.x.com](https://developer.x.com) with OAuth 2.0 user context enabled, generate the initial access/refresh token pair from that app's settings

### Fly.io Secrets

Set your environment variables on Fly.io directly rather than relying on `.env` in production:

```bash
fly secrets set BLUESKY_USERNAME=yourbot.bsky.social
fly secrets set BLUESKY_PASSWORD=your-app-password
fly secrets set LAT_COORDINATE=34.12
fly secrets set LONG_COORDINATE=-83.99
fly secrets set TIMEZONE="America/New_York"
fly secrets set IPGEO_API_KEY=your-key
fly secrets set OPENAI_API_KEY=your-key
fly secrets set CRON_SECRET=your-shared-secret
fly secrets set REDIS_URL=your-fly-redis-connection-string   # from `fly redis status <name>`

# X — omit these (or leave X_DRY_RUN unset/true) to keep X routes dry-run only
fly secrets set X_ACCESS_TOKEN=your-token
fly secrets set X_REFRESH_TOKEN=your-token
fly secrets set X_CLIENT_ID=your-client-id
fly secrets set X_CLIENT_SECRET=your-client-secret
fly secrets set X_DRY_RUN=false   # only once you're ready for real posts/replies/charges
```

Provisioning the Redis instance itself (one-time):

```bash
fly redis create --name moonbot-redis --org personal --region iad --replica-regions sjc --disable-eviction --enable-prodpack=false
```

## GitHub Actions

| Workflow                  | Trigger                     | Purpose                                   |
| -------------------------- | ---------------------------- | ------------------------------------------ |
| `fly-deploy.yml`           | Push to `main`               | Deploy to Fly.io                           |
| `moon-cycle-bot.yml`       | Daily, 13:00 UTC (9am ET)    | Calls `/daily` (Bluesky)                   |
| `mentions.yml`             | Every 5 minutes              | Calls `/mentions` (Bluesky), pinned to `iad` |
| `moon-transits-bot.yml`    | Daily, 13:00 UTC             | Runs `bluesky/moon_transits_bot.js` directly (not via the Fly app) |
| `daily-x.yml`              | Daily, 13:00 UTC (9am ET)    | Calls `/daily-x` (X, phase-gated)          |
| `transits-x.yml`           | Daily, 13:00 UTC             | Calls `/transits-x` (X)                    |
| `mentions-x.yml`           | Every 5 minutes              | Calls `/mentions-x` (X)                    |

The X workflows don't pin `fly-prefer-region` the way `mentions.yml` does — that header was only needed to work around per-machine state divergence, which the move to Redis (see [State & Persistence](#-state--persistence-redis)) already fixes for both platforms. It's now harmless-but-unnecessary on `mentions.yml` too.

**Heads up:** enabling `mentions-x.yml` starts polling X's mentions endpoint every 5 minutes in production immediately — reads are billed even with `X_DRY_RUN=true` (only the reply/write is skipped in dry-run). Cost is small at this volume (see [`tools/x_cost_estimator.js`](tools/x_cost_estimator.js)), but it's a real, ongoing charge from the moment this workflow is live, not a no-op.

## Local Development

```bash
npm install
node server.js
```

Then trigger a post manually:

```bash
curl -X POST http://localhost:3000/daily
```

Test mentions:

```bash
curl -X POST http://localhost:3000/mentions
```

### X (Twitter) dry runs

These never touch the network or a real API key — safe to run any time:

```bash
npm run x:dry-run             # daily phase-gated post preview + monthly cost projection
npm run x:transits-dry-run    # transits post preview
```

To actually exercise the live X endpoints locally (reads real mentions even in dry-run — see [State & Persistence](#-state--persistence-redis)), make sure `X_DRY_RUN` is unset or `true` in `.env`, then:

```bash
curl -X POST http://localhost:3000/mentions-x
```
