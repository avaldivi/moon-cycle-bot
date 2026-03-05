const { setupAgent, postThread, buildLinkFacet } = require("./atproto");
const { getMoonEmoji } = require("../tools/utils");
const { getMoonSign } = require("../tools/moon_sign");
const { getCurrentMoonPhase } = require("../tools/moon_phases");

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

    const validTemplates = templates.filter((t) => t.length < 300);
    if (validTemplates.length === 0) {
      throw new Error("No valid templates under 300 characters!");
    }

    const message =
      validTemplates[Math.floor(Math.random() * validTemplates.length)];

    const replyText =
      `✨ Don't know your rising sign? Find out here: https://ascendant.celestialdoses.com/`;

    const url = "https://ascendant.celestialdoses.com/";

    // build link facet safely
    const linkFacet = buildLinkFacet(replyText, url);

    await postThread(agent, [
      { text: message },
      {
        text: replyText,
        extraFacets: linkFacet ? [linkFacet] : [],
      },
    ]);

    console.log("✅ Posted moon phase thread");
    console.log(`📏 Character count: ${message.length}`);
  } catch (error) {
    console.error("❌ Error posting to Bluesky:", error);
  }
}

module.exports = { postMoonSignAndPhase };