const { setupAgent, post } = require('./atproto');
const { getMoonTransits } = require('../tools/moon_transits');
const { getMoonSign } = require('../tools/moon_sign');

async function postMoonTransits(dryRun = false) {
  try {
    const transits = await getMoonTransits();
    const moonSign = await getMoonSign();

    if (transits.length === 0) {
      console.log("⚪ No major aspects to post.");
      return;
    }

    const transitLines = transits.map(t => {
      const rx = t.rx ? " Rx" : "";
      const applying = t.applying ? "↑" : "↓";
      return `${applying} Moon ${t.aspect} ${t.planet}${rx}`;
    }).join("\n");

    const message = `🌙 Today's moon aspects:\n\n${transitLines}\n\n#astrology #astrosky`;

    console.log("📝 Message preview:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(message);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📏 Character count: ${message.length}/300`);

    if (message.length > 300) {
      console.warn(`⚠️ Message too long!`);
      return;
    }

    if (dryRun) {
      console.log("🧪 Dry run — skipping post to Bluesky");
      return;
    }

    const agent = await setupAgent(); // only login if actually posting
    await post(agent, message);
    console.log("✅ Posted moon transits");
  } catch (error) {
    console.error("❌ Error posting transits to Bluesky:", error);
  }
}

// 🧪 Change to false when ready to post for real
postMoonTransits(false);