const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = process.env.MOONBOT_DATA_DIR || "/data";
const STATE_PATH = path.join(DATA_DIR, "mentions_state.json");
const LOCK_PATH = path.join(DATA_DIR, "mentions.lock");

// Keep a small rolling window so state doesn’t grow forever
const MAX_PROCESSED = 500;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { lastSeenAt: null, processed: [] };
  }
}

function saveState(state) {
  ensureDataDir();
  // prune processed list
  if (Array.isArray(state.processed) && state.processed.length > MAX_PROCESSED) {
    state.processed = state.processed.slice(state.processed.length - MAX_PROCESSED);
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// Simple file lock to avoid overlapping cron runs
function acquireLock({ ttlMs = 2 * 60 * 1000 } = {}) {
  ensureDataDir();
  try {
    const now = Date.now();

    if (fs.existsSync(LOCK_PATH)) {
      const stat = fs.statSync(LOCK_PATH);
      const age = now - stat.mtimeMs;
      // stale lock
      if (age > ttlMs) fs.unlinkSync(LOCK_PATH);
      else return false;
    }

    fs.writeFileSync(LOCK_PATH, String(now));
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  } catch {
    // ignore
  }
}

module.exports = { loadState, saveState, acquireLock, releaseLock };