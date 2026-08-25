const store = require("../lib/redis_store");

// OAuth 2.0 user tokens expire (~2hrs) and X rotates the refresh token on every use, so the
// current pair has to be persisted somewhere durable and consistent across both Fly machines
// (iad + sjc) — whichever machine refreshes last must be the one every machine sees next,
// or the stale copy's refresh attempt gets rejected by X.
const KEY = "x_oauth_state";

async function loadTokens() {
  return store.loadJSON(KEY, null);
}

async function saveTokens({ accessToken, refreshToken, expiresAt }) {
  await store.saveJSON(KEY, { accessToken, refreshToken, expiresAt });
}

module.exports = { loadTokens, saveTokens };
