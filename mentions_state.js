const store = require("./lib/redis_store");

const KEY = "bluesky_mentions_state";
const LOCK_KEY = "bluesky_mentions_lock";

// Keep a small rolling window so state doesn’t grow forever
const MAX_PROCESSED = 500;

async function loadState() {
  return store.loadJSON(KEY, { lastSeenAt: null, processed: [], primed: false });
}

async function saveState(state) {
  // prune processed list
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
