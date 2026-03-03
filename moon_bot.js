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

    const templates = [
      `${moonEmoji} The Moon is in its ${moon.currentPhase} phase, transiting ${moonSign} today. Drop your rising sign below and I'll reveal which house it's activating in your chart! #astrology #astrosky`,
      `${moonEmoji} Moon in ${moonSign}, ${moon.currentPhase} phase. Which house is it lighting up for you? Reply with your rising sign to find out. #astrology #astrosky`,
      `${moonEmoji} The Moon is ${moon.currentPhase} in ${moonSign} today. Tell me your rising sign and I'll tell you exactly which house this energy is moving through for you. #astrology #astrosky`,
      `${moonEmoji} We've got a ${moon.currentPhase} Moon in ${moonSign} today! Curious which house this is activating for you? Drop your rising sign and let's explore your chart. #astrology #astrosky`,
    ];

    // Filter to only messages under 300 characters
    const validTemplates = templates.filter(t => t.length < 300);

    if (validTemplates.length === 0) {
      throw new Error("No valid templates under 300 characters!");
    }

    const message = validTemplates[Math.floor(Math.random() * validTemplates.length)];

    // Dynamically find all hashtags and build facets
    const facets = [];
    const hashtagRegex = /#[\w]+/g;
    let match;

    while ((match = hashtagRegex.exec(message)) !== null) {
      const hashtag = match[0];
      const byteStart = getByteIndex(message, hashtag);
      const byteEnd = byteStart + Buffer.byteLength(hashtag, 'utf8');

      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            "$type": "app.bsky.richtext.facet#tag",
            "tag": hashtag.slice(1)
          }
        ]
      });
    }

    await agent.post({
      text: message,
      createdAt: new Date().toISOString(),
      facets
    });

    console.log("✅ Just posted:", message);
    console.log(`📏 Character count: ${message.length}`);
  } catch (error) {
    console.error("❌ Error posting to Bluesky:", error);
  }
}

module.exports = {
  getMoonSign,
  postMoonSignAndPhase
}