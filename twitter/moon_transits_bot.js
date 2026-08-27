const { setupClient, post } = require("./x_client");
const { getMoonTransits } = require("../tools/moon_transits");
const { X_API_RATES } = require("../tools/x_cost_estimator");

// Mirrors bluesky/moon_transits_bot.js: a single post (no link, no thread), skipped entirely
// on days with no major Moon aspects. Empirically that's rare — 29/30 days had at least one
// aspect when measured against tools/moon_transits.js — so this fires close to daily, unlike
// the phase-gated thread in moon_bot.js.
async function postMoonTransitsToX(dryRun = true) {
  try {
    const transits = await getMoonTransits();

    if (transits.length === 0) {
      console.log("⚪ No major aspects to post.");
      return { skipped: true, reason: "no-transits" };
    }

    const transitLines = transits
      .map((t) => {
        const rx = t.rx ? " Rx" : "";
        const applying = t.applying ? "↑" : "↓";
        return `${applying} Moon ${t.aspect} ${t.planet}${rx}`;
      })
      .join("\n");

    const message = `🌙 Today's moon aspects:\n\n${transitLines}\n\n#astrology`;

    console.log("📝 Message preview:");
    console.log(message);
    console.log(`📏 Character count: ${message.length}/280`);
    console.log(`💰 Estimated X API cost: $${X_API_RATES.standardPost.toFixed(3)}`);

    if (message.length > 280) {
      console.warn("⚠️ Message too long for X (280 limit)!");
      return { skipped: true, reason: "too-long", length: message.length };
    }

    if (dryRun) {
      console.log("🧪 Dry run — not posting to X (this would be a real charge on the pay-per-use API)");
      return { dryRun: true, message };
    }

    const client = await setupClient();
    await post(client, message);
    console.log("✅ Posted moon transits to X");
    return { dryRun: false, message };
  } catch (error) {
    console.error("❌ Error posting transits to X:", error);
    throw error;
  }
}

module.exports = { postMoonTransitsToX };
