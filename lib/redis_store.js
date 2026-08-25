const fs = require("node:fs");
const path = require("node:path");
const Redis = require("ioredis");

// Shared backing store for all persisted bot state (OAuth tokens, mentions checkpoints/locks).
// The app runs on 2 Fly machines in different regions (iad + sjc) for DFW-outage-style
// resilience, but each machine has its own local volume — so state written to disk on one
// machine is invisible to the other. Redis gives both machines a consistent view.
//
// Falls back to a local file under MOONBOT_DATA_DIR when REDIS_URL isn't set, so local dev
// and the dry-run scripts keep working without provisioning Redis.
let client = null;
function getClient() {
  if (!process.env.REDIS_URL) return null;
  if (!client) client = new Redis(process.env.REDIS_URL);
  return client;
}

const DATA_DIR = process.env.MOONBOT_DATA_DIR || "/data";

function localPath(key, ext) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  return path.join(DATA_DIR, `${key}${ext}`);
}

async function loadJSON(key, fallback) {
  const redis = getClient();
  if (redis) {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(localPath(key, ".json"), "utf8"));
  } catch {
    return fallback;
  }
}

async function saveJSON(key, value) {
  const redis = getClient();
  if (redis) {
    await redis.set(key, JSON.stringify(value));
    return;
  }
  fs.writeFileSync(localPath(key, ".json"), JSON.stringify(value, null, 2));
}

// SET NX PX gives real cross-machine mutual exclusion — the old per-volume lock file only
// ever protected against overlapping runs on the same machine.
async function acquireLock(key, { ttlMs = 2 * 60 * 1000 } = {}) {
  const redis = getClient();
  if (redis) {
    const ok = await redis.set(key, String(Date.now()), "PX", ttlMs, "NX");
    return ok === "OK";
  }
  try {
    const lockPath = localPath(key, ".lock");
    const now = Date.now();
    if (fs.existsSync(lockPath)) {
      const age = now - fs.statSync(lockPath).mtimeMs;
      if (age > ttlMs) fs.unlinkSync(lockPath);
      else return false;
    }
    fs.writeFileSync(lockPath, String(now));
    return true;
  } catch {
    return false;
  }
}

async function releaseLock(key) {
  const redis = getClient();
  if (redis) {
    await redis.del(key);
    return;
  }
  try {
    const lockPath = localPath(key, ".lock");
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {
    // ignore
  }
}

module.exports = { loadJSON, saveJSON, acquireLock, releaseLock };
