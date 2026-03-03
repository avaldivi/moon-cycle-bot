# 🌙 Moon Cycle Bot

A Bluesky bot that 
- Posts daily moon phase and moon sign updates. 
- Responds to mentions and replies with personalized moon house interpretations.
- Built with Node.js, deployed on Fly.io, and triggered via GitHub Actions.

## How It Works

Every day at 9:00 AM ET, a GitHub Actions cron job hits the `/daily` endpoint on the Fly.io server, which posts the current moon phase and moon sign to Bluesky.

### 💬 Mentions & Replies (Conversational Mode)

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
7. Saves state to disk (volume)

This ensures:

- No historical spam  
- No duplicate replies  
- Clean threading  
- Safe cron execution

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
- Constrained to ≤ 280 characters (Bluesky-safe)
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
- Fly.io's autostop/autostart feature means the machine only runs when requests come in, keeping costs at zero on the free tier
- Deployment is handled automatically on push to `main` via the `fly-deploy.yml` GitHub Action

### 💾 State & Volume Persistence

The bot uses a Fly.io volume mounted at:

```
/data
```

State file:

```
/data/mentions_state.json
```

Stored data example:

```json
{
  "lastSeenAt": "...",
  "processed": ["uri::cid", "..."]
}
```

#### Why this matters

- Prevents replying twice  
- Prevents historical backfill  
- Survives Fly autostop  
- Survives deploys  
- Survives machine restarts  

A file-based lock (`mentions.lock`) prevents overlapping cron runs.

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
```

Set Fly.io endpoint url as a Github repo secret for Github Actions

```
FLY_APY_URL=        # Fly.io API URL
```

### Getting Your API Keys

- **Bluesky app password** — Settings → Privacy and Security → App Passwords in the Bluesky app
- **ipgeolocation.io** — Sign up at [ipgeolocation.io](https://ipgeolocation.io), free tier includes 1,000 requests/day
- **Fly.io deploy token** — Run `fly tokens create deploy -a your-app-name` and store the output as a GitHub secret named `FLY_API_TOKEN`

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
```

## GitHub Actions

| Workflow            | Trigger         | Purpose           |
| ------------------- | --------------- | ----------------- |
| fly-deploy.yml      | Push to main    | Deploy to Fly.io    |
| daily-moon-post.yml | Daily           | Calls `/daily`    |
| check-mentions.yml  | Every 5 minutes | Calls `/mentions` |

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



