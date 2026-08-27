const store = require("../lib/redis_store");

// Separate keys from mentions_state.js (Bluesky's) so the two platforms never share state.
const KEY = "twitter_mentions_state";
const LOCK_KEY = "twitter_mentions_lock";

const MAX_PROCESSED = 500;

async function loadState() {
  return store.loadJSON(KEY, { sinceId: null, userId: null, processed: [] });
}

async function saveState(state) {
  if (Array.isArray(state.processed) && state.processed.length > MAX_PROCESSED) {
    state.processed = state.processed.slice(state.processed.length - MAX_PROCESSED);
  }
  await store.saveJSON(KEY, state);
}

// Cross-machine lock (iad + sjc both poll on the same cron) to avoid overlapping runs.
async function acquireLock(opts) {
  return store.acquireLock(LOCK_KEY, opts);
}

async function releaseLock() {
  return store.releaseLock(LOCK_KEY);
}

module.exports = { loadState, saveState, acquireLock, releaseLock };
