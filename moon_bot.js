const { AtpAgent } = require("@atproto/api");
const dotenv = require("dotenv");
const sweph = require("swisseph");
const { CronJob } = require("cron");
const process = require("process");
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

function getByteIndex(message, substring) {
  const charIndex = message.indexOf(substring);
  const before = message.slice(0, charIndex);
  return Buffer.byteLength(before, 'utf8');
}

function getByteIndexedSlice(str, byteStart, byteEnd) {
  const buf = Buffer.from(str, 'utf8');
  const sliced = buf.slice(byteStart, byteEnd);
  return sliced.toString('utf8');
}


// 🔹 Post to Bluesky
async function postMoonSignAndPhase() {
  try {
    const agent = await setupAgent();
    const moon = await getCurrentMoonPhase();

    const moonSign = await getMoonSign();
    const hashtag = "#astrology";
    const message = `🌙 The Moon is currently in its ${moon.currentPhase} phase and transiting ${moonSign} today! What energy are you feeling? ${hashtag}`;


    const byteStart = getByteIndex(message, hashtag);
    const byteEnd = byteStart + Buffer.byteLength(hashtag, 'utf8');

    console.log('hashtag', getByteIndexedSlice(message, byteStart, byteEnd))

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