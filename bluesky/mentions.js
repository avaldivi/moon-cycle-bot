const { AtpAgent } = require("@atproto/api");
const { loadState, saveState, acquireLock, releaseLock } = require("../mentions_state");
const { generateReply } = require("../llm");
const { getCurrentMoonPhase } = require("../tools/moon_phases");
const { getMoonSign } = require("../tools/moon_sign");
const { getHouseForRising } = require("../tools/house_calc");

const BOT_HANDLE = process.env.BLUESKY_USERNAME;

function startOfToday(timezone = "America/New_York") {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  const day = parts.find(p => p.type === "day").value;

  return new Date(`${year}-${month}-${day}T00:00:00`);
}

async function setupAgent() {
  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({
    identifier: process.env.BLUESKY_USERNAME,
    password: process.env.BLUESKY_PASSWORD,
  });
  return agent;
}

async function getReplyRefs(agent, uri) {
  const threadRes = await agent.api.app.bsky.feed.getPostThread({
    uri,
    depth: 0,
    parentHeight: 20,
  });

  let node = threadRes?.data?.thread;
  if (!node?.post?.uri || !node?.post?.cid) return null;

  const parent = { uri: node.post.uri, cid: node.post.cid };

  while (node.parent && node.parent.post?.uri && node.parent.post?.cid) {
    node = node.parent;
  }

  const root = { uri: node.post.uri, cid: node.post.cid };

  return { root, parent };
}

async function replyToPost(agent, { uri, text }) {
  const MAX = 300;
  const safe = (text || "").trim().slice(0, MAX);

  const refs = await getReplyRefs(agent, uri);
  if (!refs) return;

  await agent.post({
    text: safe,
    createdAt: new Date().toISOString(),
    reply: refs,
  });
}

async function processMentions({ limit = 50 } = {}) {
  if (!acquireLock()) return { ok: true, skipped: true };

  try {
    const agent = await setupAgent();
    const state = loadState();
    const processed = new Set(state.processed || []);
    const lastSeenAt = state.lastSeenAt ? new Date(state.lastSeenAt) : null;

    const notifRes = await agent.listNotifications({ limit });
    const notifs = notifRes?.data?.notifications || [];

    // Sort oldest → newest
    notifs.sort((a, b) => new Date(a.indexedAt) - new Date(b.indexedAt));

    const todayStart = startOfToday(process.env.TIMEZONE || "America/New_York");

    // 🔹 Prime cursor on first run (no backfill)
    if (!lastSeenAt && notifs.length) {
      state.lastSeenAt = notifs[notifs.length - 1].indexedAt;
      saveState(state);
      return { ok: true, skipped: true, reason: "primed" };
    }

    let newestSeen = lastSeenAt;
    let replied = 0;

    const moonContext = {
      phase: (await getCurrentMoonPhase())?.currentPhase,
      sign: await getMoonSign(),
      timezone: process.env.TIMEZONE || "America/New_York",
      dateISO: new Date().toISOString(),
    };

    for (const n of notifs) {
      const indexedAt = new Date(n.indexedAt);

      // ⛔ Ignore anything before today
      if (indexedAt < todayStart) continue;

      if (lastSeenAt && indexedAt <= lastSeenAt) continue;

      if (n.reason !== "mention" && n.reason !== "reply") continue;
      if (!n.uri || !n.cid) continue;

      // ⛔ Never reply to yourself
      if (n.author?.handle === BOT_HANDLE) continue;

      const key = `${n.uri}::${n.cid}`;
      if (processed.has(key)) continue;

      const threadRes = await agent.api.app.bsky.feed.getPostThread({
        uri: n.uri,
        depth: 0,
        parentHeight: 0,
      });

      const userText = threadRes?.data?.thread?.post?.record?.text || "";

      const risingMatch = userText.match(
        /\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b\s*(rising|ascendant)/i
      );

      let replyText;

      if (!risingMatch) {
        replyText =
          `🌙 Reply with your rising sign like “Virgo rising” and I’ll interpret today’s moon transit for you.`;
      } else {
        const risingSign =
          risingMatch[1][0].toUpperCase() + risingMatch[1].slice(1).toLowerCase();

        const house = getHouseForRising(moonContext.sign, risingSign);

        replyText = await generateReply({
          risingSign,
          moonContext,
          house,
          userText,
        });
      }

      await replyToPost(agent, { uri: n.uri, text: replyText });

      processed.add(key);
      replied++;

      if (!newestSeen || indexedAt > newestSeen) newestSeen = indexedAt;
    }

    state.lastSeenAt = newestSeen ? newestSeen.toISOString() : state.lastSeenAt;
    state.processed = Array.from(processed);
    saveState(state);

    return { ok: true, replied };
  } finally {
    releaseLock();
  }
}

module.exports = { processMentions };