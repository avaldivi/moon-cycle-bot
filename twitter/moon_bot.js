const { setupClient, postThread } = require("./x_client");
const { getMoonEmoji } = require("../tools/utils");
const { getMoonSign } = require("../tools/moon_sign");
const { getCurrentMoonPhase } = require("../tools/moon_phases");
const { estimateThreadCost } = require("../tools/x_cost_estimator");

// X-only gate: unlike Bluesky (free), every post here costs money, so we only post on the
// phases worth calling out. Separate from tools/moon_phases.js's own IMPORTANT_PHASES, which
// drives Bluesky's "next important phase" copy and isn't a posting gate.
const X_POST_PHASES = ["New Moon", "Full Moon", "First Quarter"];

// Mirrors bluesky/moon_bot.js's templates/thread shape so the two platforms stay in sync.
// `date` exists only to preview a future/past day's copy in dry-run — the live /daily-x route
// never passes one, so production always evaluates the real "today". Enforced below: a custom
// date can only be combined with dryRun, never a real post.
async function postMoonSignAndPhaseToX(dryRun = true, date = new Date()) {
  try {
    const isToday = date.toDateString() === new Date().toDateString();
    if (!dryRun && !isToday) {
      throw new Error("Refusing to post live content for a non-today date — use dryRun to preview a future/past date instead.");
    }

    const moon = await getCurrentMoonPhase(date);

    if (!X_POST_PHASES.includes(moon.currentPhase)) {
      console.log(`⚪ Skipping — ${date.toDateString()}'s phase (${moon.currentPhase}) isn't one of: ${X_POST_PHASES.join(", ")}`);
      return { skipped: true, currentPhase: moon.currentPhase };
    }

    const moonSign = await getMoonSign(date);
    const moonEmoji = getMoonEmoji(moon.currentPhase);

    const templates = [
      `${moonEmoji} The Moon is in its ${moon.currentPhase} phase, transiting ${moonSign} today. Drop your rising sign below and I'll reveal which house it's activating in your chart! #astrology`,
      `${moonEmoji} Moon in ${moonSign}, ${moon.currentPhase} phase. Which house is it lighting up for you? Reply with your rising sign to find out. #astrology`,
      `${moonEmoji} The Moon is ${moon.currentPhase} in ${moonSign} today. Tell me your rising sign and I'll tell you exactly which house this energy is moving through for you. #astrology`,
      `${moonEmoji} We've got a ${moon.currentPhase} Moon in ${moonSign} today! Curious which house this is activating for you? Drop your rising sign and let's explore your chart. #astrology`,
    ];

    const validTemplates = templates.filter((t) => t.length <= 280);
    if (validTemplates.length === 0) {
      throw new Error("No valid templates under 280 characters!");
    }

    const message = validTemplates[Math.floor(Math.random() * validTemplates.length)];
    const replyText = `✨ Don't know your rising sign? Find out here: https://ascendant.celestialdoses.com/`;

    const estimatedCost = estimateThreadCost([
      { text: message, hasLink: false },
      { text: replyText, hasLink: true },
    ]);

    console.log("📝 Thread preview:");
    console.log(message);
    console.log(replyText);
    console.log(`📏 Character counts: ${message.length} / ${replyText.length}`);
    console.log(`💰 Estimated X API cost for this thread: $${estimatedCost.toFixed(3)}`);

    if (dryRun) {
      console.log("🧪 Dry run — not posting to X (this would be a real charge on the pay-per-use API)");
      return { dryRun: true, message, replyText, estimatedCost };
    }

    const client = await setupClient();
    await postThread(client, [{ text: message }, { text: replyText }]);
    console.log("✅ Posted moon phase thread to X");
    return { dryRun: false, message, replyText, estimatedCost };
  } catch (error) {
    console.error("❌ Error posting to X:", error);
    throw error;
  }
}

module.exports = { postMoonSignAndPhaseToX };
