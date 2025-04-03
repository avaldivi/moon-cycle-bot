const { AtpAgent } = require("@atproto/api");
const dotenv = require("dotenv");
const sweph = require("swisseph");
const { CronJob } = require("cron");
const process = require("process");
const { getByteIndex, getMoonEmoji } = require('./utils')
const { getMoonSign } = require('./moon_sign')
const { getCurrentMoonPhase } = require('./moon_phases');

dotenv.config();

// 🔹 Set Swiss Ephemeris Data Path
// sweph.swe_set_ephe_path('./ephemeris/');

// 🔹 Setup Bluesky Agent with AtpAgent
async function setupAgent() {
  const agent = new AtpAgent({
    service: "https://bsky.social",
    persistSession: (evt, session) => {
      console.log("🔄 Session Updated:", session);
    },
  });

  await agent.login({
    identifier: process.env.BLUESKY_USERNAME,
    password: process.env.BLUESKY_PASSWORD,
  });

  return agent;
}

// 🔹 Post to Bluesky
async function postMoonSignAndPhase() {
  try {
    const agent = await setupAgent();
    const moon = await getCurrentMoonPhase();
    const moonSign = await getMoonSign();
    const moonEmoji = getMoonEmoji(moon.currentPhase);
    const hashtag = "#astrology";
    const message = `${moonEmoji} The Moon is currently in its ${moon.currentPhase} phase and transiting ${moonSign} today! What energy are you feeling? ${hashtag}`;

    const byteStart = getByteIndex(message, hashtag);
    const byteEnd = byteStart + Buffer.byteLength(hashtag, 'utf8');

    await agent.post({   
      text: message,
      createdAt: new Date().toISOString(),
      facets: [
        {
          index: {
            byteStart,
            byteEnd
          },
          features: [
            {
              "$type": "app.bsky.richtext.facet#tag",
              "tag": hashtag.slice(1) // removes the #
            }
          ]
        }
      ]
    });

    console.log("✅ Just posted:", message);
  } catch (error) {
    console.error("❌ Error posting to Bluesky:", error);
  }
}

// 🔹 Schedule to Run Daily at Midnight UTC
// const job = new CronJob("0 0 * * *", postMoonPhase);
// job.start();

postMoonSignAndPhase();

module.exports = {
  getMoonSign,
  postMoonSignAndPhase
}