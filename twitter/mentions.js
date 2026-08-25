const { setupClient, getMentions, getAuthenticatedUserId, replyToPost } = require("./x_client");
const { loadState, saveState, acquireLock, releaseLock } = require("./mentions_state");
const { generateReply } = require("../llm");
const { getCurrentMoonPhase } = require("../tools/moon_phases");
const { getMoonSign } = require("../tools/moon_sign");
const { getHouseForRising } = require("../tools/house_calc");
const { X_API_RATES } = require("../tools/x_cost_estimator");

const RISING_SIGN_RE =
  /\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b\s*(rising|ascendant)/i;

// Mirrors bluesky/mentions.js, but polling is driven by since_id (native to the X mentions
// endpoint) instead of a local timestamp/processed-set — X only returns tweets newer than
// since_id, so there's nothing to re-fetch or re-charge on repeat polls once caught up.
// Uses GET /2/users/:id/mentions (owned read, $0.001/resource) — see x_client.js#getMentions.
async function processMentions({ maxResults = 10, dryRun = true } = {}) {
  if (!(await acquireLock())) return { ok: true, skipped: true };

  try {
    const client = await setupClient();
    const state = await loadState();

    const userId = state.userId || (await getAuthenticatedUserId(client));
    if (!state.userId) state.userId = userId;

    const processed = new Set(state.processed || []);

    const options = {
      max_results: maxResults,
      expansions: ["author_id"],
      "tweet.fields": ["author_id", "created_at"],
    };
    if (state.sinceId) options.since_id = state.sinceId;

    const result = await getMentions(client, userId, options);
    const tweets = result.tweets || [];

    console.log(`💰 Poll cost: $${(tweets.length * X_API_RATES.ownedRead).toFixed(3)} (${tweets.length} tweet(s) read)`);

    if (!state.sinceId) {
      // First run: prime sinceId from the newest mention seen so far, don't reply to backlog.
      if (tweets.length) state.sinceId = tweets[0].id;
      await saveState(state);
      return { ok: true, skipped: true, reason: "primed" };
    }

    if (!tweets.length) {
      return { ok: true, replied: 0 };
    }

    // API returns newest-first; reply in chronological order.
    const ordered = [...tweets].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const moonContext = {
      phase: (await getCurrentMoonPhase())?.currentPhase,
      sign: await getMoonSign(),
      timezone: process.env.TIMEZONE || "America/New_York",
      dateISO: new Date().toISOString(),
    };

    let replied = 0;
    let newestId = state.sinceId;

    for (const tweet of ordered) {
      if (tweet.author_id === userId) continue;
      if (processed.has(tweet.id)) continue;

      const userText = tweet.text || "";
      const risingMatch = userText.match(RISING_SIGN_RE);

      let replyText;
      if (!risingMatch) {
        replyText = `🌙 Reply with your rising sign like "Virgo rising" and I'll interpret today's moon transit for you.`;
      } else {
        const risingSign = risingMatch[1][0].toUpperCase() + risingMatch[1].slice(1).toLowerCase();
        const house = getHouseForRising(moonContext.sign, risingSign);
        replyText = await generateReply({ risingSign, moonContext, house, userText });
      }

      if (dryRun) {
        console.log(`🧪 Dry run — would reply to tweet ${tweet.id}: "${replyText}"`);
      } else {
        await replyToPost(client, { tweetId: tweet.id, text: replyText });
      }

      processed.add(tweet.id);
      replied++;

      if (BigInt(tweet.id) > BigInt(newestId)) newestId = tweet.id;
    }

    state.sinceId = newestId;
    state.processed = Array.from(processed);
    await saveState(state);

    return { ok: true, replied };
  } finally {
    await releaseLock();
  }
}

module.exports = { processMentions };
