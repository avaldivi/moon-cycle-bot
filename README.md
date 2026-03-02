# 🌙 Moon Cycle Bot

A Bluesky bot that posts daily moon phase and moon sign updates. Built with Node.js, deployed on Fly.io, and triggered via GitHub Actions.

## How It Works

Every day at 9:00 AM ET, a GitHub Actions cron job hits the `/daily` endpoint on the Fly.io server, which posts the current moon phase and moon sign to Bluesky.

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

## Setup

```bash
git clone https://github.com/avaldivi/moon-cycle-bot
cd moon-cycle-bot
touch .env
```

Add the following to your `.env`:

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

| Workflow | Trigger | What it does |
|---|---|---|
| `fly-deploy.yml` | Push to `main` | Deploys the app to Fly.io |
| `daily-moon-post.yml` | Daily at 13:00 UTC (9:00 AM ET) | Calls `/daily` to trigger a Bluesky post |

## Local Development

```bash
npm install
node server.js
```

Then trigger a post manually:

```bash
curl -X POST http://localhost:3000/daily
```