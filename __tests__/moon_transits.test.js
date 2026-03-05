const sweph = require("swisseph");
const { getMoonTransits, getCurrentJulianDay } = require("../tools/moon_transits");
const { getMoonSign } = require("../tools/moon_sign");

// 🔹 CHANGE THIS to test any date — or leave null for today
const TEST_DATE = null;

// 🔹 Helper to convert decimal degrees to DMS
function toDMS(decimal) {
  const zodiacSigns = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];
  const signIndex = Math.floor(decimal / 30);
  const withinSign = decimal % 30;
  const degrees = Math.floor(withinSign);
  const minutesDecimal = (withinSign - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = Math.floor((minutesDecimal - minutes) * 60);
  return `${zodiacSigns[signIndex]} ${degrees}° ${minutes}' ${seconds}"`;
}

// 🔹 Simulate the Bluesky post format from moon_transits_bot.js
function previewPost(transits, moonSign) {
  const transitLines = transits.map(t => {
    const rx = t.rx ? " Rx" : "";
    const applying = t.applying ? "↑" : "↓";
    return `${applying} Moon ${t.aspect} ${t.planet}${rx} (${t.orb}°)`;
  }).join("\n");

  const message = `🌙 Today's ${moonSign} moon aspects:\n\n${transitLines}\n\n#astrology #astrosky`;

  console.log("📱 Bluesky Post Preview");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(message);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📏 Character count: ${message.length}/300 ${message.length > 300 ? "❌ TOO LONG" : "✅"}\n`);
}

async function runTest(date = null) {
  const targetDate = date || TEST_DATE || new Date();

  console.log("🌙 Moon Transit Test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📅 Date:     ${targetDate.toDateString()}`);
  console.log(`⏰ Time:     ${targetDate.toTimeString()}`);
  console.log(`🔢 Julian:   ${getCurrentJulianDay(targetDate)}`);
  console.log(`🌍 UTC:      ${targetDate.toUTCString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    const [transits, moonSign] = await Promise.all([
      getMoonTransits(targetDate),
      getMoonSign(targetDate),
    ]);

    if (transits.length === 0) {
      console.log("⚪ No major aspects to the Moon right now.\n");
      return;
    }

    console.log(`✅ Found ${transits.length} aspect(s):\n`);
    transits.forEach(t => {
      const rx = t.planetSpeed < 0 ? " Rx" : "";
      console.log(`  🌙 Moon ${t.aspect} ${t.planet}${rx}`);
      console.log(`     Orb: ${t.orb}°  ${t.applying ? "🔺 applying" : "🔻 separating"}`);
      console.log(`     Moon: ${toDMS(t.moonLongitude)} (${t.moonLongitude}°)`);
      console.log(`     ${t.planet}: ${toDMS(t.planetLongitude)} (${t.planetLongitude}°)`);
      console.log(`     ${t.planet} speed: ${t.planetSpeed}°/day`);
      console.log();
    });

    previewPost(transits, moonSign);

  } catch (err) {
    console.error("❌ Test failed:", err);
  }
}

// 🔹 Verify ephemeris source
function checkEphemerisSource(date = null) {
  const julianDay = getCurrentJulianDay(date);

  sweph.swe_calc_ut(julianDay, sweph.SE_MOON, sweph.SEFLG_SPEED | sweph.SEFLG_SWIEPH, (result) => {
    console.log("🔍 Ephemeris Check");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (result.rflag & sweph.SEFLG_SWIEPH) {
      console.log("✅ Using Swiss Ephemeris files (.se1)");
    } else if (result.rflag & sweph.SEFLG_JPLEPH) {
      console.log("🟡 Using JPL ephemeris");
    } else {
      console.log("❌ Falling back to Moshier approximation — .se1 files not found!");
    }

    console.log(`📁 rflag value: ${result.rflag}`);
    console.log(`🌙 Moon longitude: ${result.longitude}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  });
}

// Allow date to be passed as a CLI argument
// Usage: node moon_transits.test.js "2024-06-21T12:00:00"
const rawArg = process.argv[2];
const cliDate = rawArg ? new Date(rawArg.includes('T') && !rawArg.endsWith('Z') ? rawArg + 'Z' : rawArg) : null;

if (cliDate && isNaN(cliDate.getTime())) {
  console.error("❌ Invalid date format. Use ISO format: YYYY-MM-DDTHH:MM:SS");
  console.error('   Example: node moon_transits.test.js "2024-06-21T12:00:00"');
  process.exit(1);
}

checkEphemerisSource(cliDate);
runTest(cliDate);