const { AtpAgent } = require("@atproto/api");
const { getByteIndex, getByteIndexedSlice } = require('../tools/utils');
const dotenv = require("dotenv");
dotenv.config();

// 🔹 Setup Bluesky Agent
async function setupAgent() {
  const agent = new AtpAgent({
    service: "https://bsky.social",
    persistSession: (evt, session) => {
      console.log("🔄 Session Updated:");
    },
  });

  await agent.login({
    identifier: process.env.BLUESKY_USERNAME,
    password: process.env.BLUESKY_PASSWORD,
  });

  return agent;
}

// 🔹 Build facets for hashtags in a message
function buildHashtagFacets(text) {
  const matches = [...text.matchAll(/(^|\s)(#[\p{L}\p{N}_]+)\b/gu)];
  const facets = [];

  for (const m of matches) {
    const tag = m[2]; // like "#astrology"
    const charIndex = m.index + m[1].length; // start of the hashtag
    const before = text.slice(0, charIndex);

    const byteStart = Buffer.byteLength(before, "utf8");
    const byteEnd = byteStart + Buffer.byteLength(tag, "utf8");

    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: tag.slice(1) }],
    });
  }

  return facets;
}

// 🔹 Build facet for a URL link
function buildLinkFacet(message, url) {
  const byteStart = getByteIndex(message, url);
  if (byteStart == null) return null;

  const byteEnd = byteStart + Buffer.byteLength(url, "utf8");
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
  };
}

// 🔹 Post a single message
async function post(agent, message, extraFacets = []) {
  const facets = [...buildHashtagFacets(message), ...extraFacets];

  return await agent.post({
    text: message,
    createdAt: new Date().toISOString(),
    facets
  });
}

// 🔹 Post a thread (array of messages)
async function postThread(agent, messages) {
  let rootPost = null;
  let parentPost = null;

  for (const msg of messages) {
    const text = typeof msg === "string" ? msg : msg.text;

    const facets = [
      ...buildHashtagFacets(text),
      ...((typeof msg === "object" && msg.extraFacets) ? msg.extraFacets : []),
    ];

    const postData = {
      text,
      createdAt: new Date().toISOString(),
      facets,
    };

    if (rootPost) {
      postData.reply = {
        root: { uri: rootPost.uri, cid: rootPost.cid },
        parent: { uri: parentPost.uri, cid: parentPost.cid },
      };
    }

    for (const f of facets) {
      const { byteStart, byteEnd } = f.index;
      console.log("FACET SLICE:", getByteIndexedSlice(text, byteStart, byteEnd));
    }

    const result = await agent.post(postData);
    if (!rootPost) rootPost = result;
    parentPost = result;
  }

  return rootPost;
}

module.exports = { setupAgent, buildHashtagFacets, buildLinkFacet, post, postThread };