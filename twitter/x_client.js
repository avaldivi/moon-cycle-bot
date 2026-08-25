const { TwitterApi } = require("twitter-api-v2");
const dotenv = require("dotenv");
dotenv.config();
const { loadTokens, saveTokens } = require("./oauth_state");

// Refresh a bit before actual expiry so a poll never starts a request on a token
// that dies mid-flight.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// OAuth 2.0 user context: X issues a short-lived access token + a refresh token that
// itself rotates on every use. First call seeds from .env (the pair X originally gave you),
// forces an immediate refresh to establish real expiry and enter the rotation cycle, then
// persists to oauth_state.js from that point on — .env's X_ACCESS_TOKEN/X_REFRESH_TOKEN are
// only ever read once.
async function setupClient() {
  let tokens = await loadTokens();

  if (!tokens) {
    if (!process.env.X_ACCESS_TOKEN || !process.env.X_REFRESH_TOKEN) {
      throw new Error("Missing X_ACCESS_TOKEN/X_REFRESH_TOKEN in .env for first-time OAuth2 setup");
    }
    tokens = {
      accessToken: process.env.X_ACCESS_TOKEN,
      refreshToken: process.env.X_REFRESH_TOKEN,
      expiresAt: 0,
    };
  }

  if (Date.now() < tokens.expiresAt - REFRESH_MARGIN_MS) {
    return new TwitterApi(tokens.accessToken);
  }

  const refreshClient = new TwitterApi({
    clientId: process.env.X_CLIENT_ID,
    clientSecret: process.env.X_CLIENT_SECRET,
  });

  const { client, accessToken, refreshToken, expiresIn } = await refreshClient.refreshOAuth2Token(
    tokens.refreshToken
  );

  await saveTokens({
    accessToken,
    refreshToken: refreshToken || tokens.refreshToken, // X doesn't always rotate it
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return client;
}

async function post(client, message) {
  return await client.v2.tweet(message);
}

async function postThread(client, messages) {
  let previousId = null;
  const results = [];

  for (const msg of messages) {
    const text = typeof msg === "string" ? msg : msg.text;
    const payload = previousId
      ? { text, reply: { in_reply_to_tweet_id: previousId } }
      : { text };

    const result = await client.v2.tweet(payload);
    results.push(result);
    previousId = result.data.id;
  }

  return results;
}

async function replyToPost(client, { tweetId, text }) {
  return await client.v2.tweet({
    text,
    reply: { in_reply_to_tweet_id: tweetId },
  });
}

// GET /2/users/:id/mentions — bills as an "owned read" ($0.001/resource) instead of a
// standard read ($0.005/resource) because {id} is the authenticated app owner's own account.
// https://docs.x.com/x-api/getting-started/pricing
async function getMentions(client, userId, options = {}) {
  return await client.v2.userMentionTimeline(userId, options);
}

async function getAuthenticatedUserId(client) {
  const me = await client.v2.me();
  return me.data.id;
}

module.exports = { setupClient, post, postThread, replyToPost, getMentions, getAuthenticatedUserId };
