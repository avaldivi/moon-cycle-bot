const { AtpAgent } = require("@atproto/api");
const dotenv = require("dotenv");
const sweph = require("swisseph");
const { CronJob } = require("cron");
const process = require("process");

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

// 🔹 Get Moon’s Tropical Zodiac Sign
async function getMoonSign() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const julianDay = sweph.swe_julday(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
      now.getHours() + now.getMinutes() / 60,
      sweph.SE_GREG_CAL
    );

    sweph.swe_calc_ut(julianDay, sweph.SE_MOON, sweph.SEFLG_SPEED, (result) => {
      if (!result || result.rc !== sweph.OK) {
        return reject("❌ Error calculating Moon position");
      }

      const longitude = result.longitude % 360;
      const zodiacSigns = [
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
        "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
      ];
      const signIndex = Math.floor(longitude / 30);
      resolve(zodiacSigns[signIndex]);
    });
  });
}

// 🔹 Post to Bluesky
async function postMoonPhase() {
  try {
    const agent = await setupAgent();

    const moonSign = await getMoonSign();
    const hashtag = "#MoonPhases";
    const message = `🌙 The Moon is in ${moonSign} today! What energy are you feeling? ${hashtag}`;

    await agent.post({
      text: message,
      createdAt: new Date().toISOString(),
      facets: [
        {
          index: {
            byteStart: message.indexOf(hashtag),
            byteEnd: message.indexOf(hashtag) + hashtag.length + 2
          },
          features: [
            {
              "$type": "app.bsky.richtext.facet#tag",
              "tag": hashtag.substring(1) // Remove '#' for API compatibility
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

postMoonPhase();