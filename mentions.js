const { AtpAgent } = require("@atproto/api");
const { loadState, saveState, acquireLock, releaseLock } = require("./mentions_state");
const { generateReply } = require("./llm");
const { getCurrentMoonPhase } = require("./moon_phases");
const { getMoonSign } = require("./moon_sign");
const { getHouseForRising } = require("./house_calc");


async function getMoonContext() {
  return { 
    phase: (await getCurrentMoonPhase())?.currentPhase, 
    sign: await getMoonSign(),
    timezone: process.env.TIMEZONE || "America/New_York",
    dateISO: new Date().toISOString(),
  };
}

const SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

function extractRisingSign(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  for (const sign of SIGNS) {
    const re = new RegExp(
      `\\b(${sign})\\b\\s*(rising|ascendant)\\b|\\b(rising|ascendant)\\b\\s*[:\\-]?\\s*\\b(${sign})\\b`,
      "i"
    );
    if (re.test(t)) return sign[0].toUpperCase() + sign.slice(1);
  }
  return null;
}

async function setupAgent() {
  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({
    identifier: process.env.BLUESKY_USERNAME,
    password: process.env.BLUESKY_PASSWORD,
  });
  return agent;
}

async function getPostText(agent, uri) {
  // Fetch the post record text reliably
  const threadRes = await agent.api.app.bsky.feed.getPostThread({
    uri,
    depth: 0,
    parentHeight: 0,
  });

  const post = threadRes?.data?.thread?.post;
  return post?.record?.text || "";
}

function notificationKey(n) {
  // Unique enough for de-dupe
  // Prefer uri+cid because indexedAt can collide
  return `${n.uri || "no-uri"}::${n.cid || "no-cid"}`;
}

async function replyToPost(agent, { uri, cid, text }) {
  // Keep under Bluesky limit (300 chars historically; can vary).
  // Safer to clamp.
  const safe = (text || "").trim().slice(0, 300);

  await agent.post({
    text: safe,
    createdAt: new Date().toISOString(),
    reply: {
      root: { uri, cid },
      parent: { uri, cid },
    },
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processMentions({ limit = 50 } = {}) {
  // Prevent overlapping runs
  if (!acquireLock()) {
    return { ok: true, skipped: true, reason: "lock-held" };
  }

  try {
    const agent = await setupAgent();
    const state = loadState();

    const lastSeenAt = state.lastSeenAt ? new Date(state.lastSeenAt) : null;
    const processedSet = new Set(state.processed || []);

    const notifRes = await agent.listNotifications({ limit });
    const notifs = notifRes?.data?.notifications || [];

    // Oldest -> newest
    notifs.sort((a, b) => new Date(a.indexedAt) - new Date(b.indexedAt));

    let newestSeen = lastSeenAt;

    const moonContext = await getMoonContext();

    let replied = 0;
    let examined = 0;

    for (const n of notifs) {
      examined++;
      const indexedAt = new Date(n.indexedAt);

      if (lastSeenAt && indexedAt <= lastSeenAt) continue;
      if (!newestSeen || indexedAt > newestSeen) newestSeen = indexedAt;

      // Only mentions (you can add "reply" later)
      if (n.reason !== "mention" && n.reason !== "reply") continue;
      if (!n.uri || !n.cid) continue;

      const key = notificationKey(n);
      if (processedSet.has(key)) continue; // idempotent

      const userText = await getPostText(agent, n.uri);
      const risingSign = extractRisingSign(userText);

      if (!risingSign) {
        // gentle nudge; also mark processed so we don’t spam
        await replyToPost(agent, {
          uri: n.uri,
          cid: n.cid,
          text: `🌙 Reply with your rising sign like “Virgo rising” and I’ll interpret today’s moon transit for you.`,
        });
      } else {
        const moonSign = moonContext.sign; // should be "Aries"..."Pisces"
        const house = getHouseForRising(moonSign, risingSign);

        const draft = await generateReply({
                                risingSign,
                                moonContext,
                                house,
                                userText,
                            });

        const fallback = `🌙 ${risingSign} rising — what theme feels loud for you today?`;
        await replyToPost(agent, {
          uri: n.uri,
          cid: n.cid,
          text: draft || fallback,
        });
      }

      replied++;
      processedSet.add(key);

      // tiny pacing to avoid hammering APIs
      await sleep(350);
    }

    state.lastSeenAt = newestSeen ? newestSeen.toISOString() : state.lastSeenAt;
    state.processed = Array.from(processedSet);
    saveState(state);

    return {
      ok: true,
      skipped: false,
      examined,
      replied,
      processedThrough: state.lastSeenAt,
    };
  } finally {
    releaseLock();
  }
}

module.exports = { processMentions };