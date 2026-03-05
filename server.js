const express = require("express");
const { runMoonGraph } = require("./graph/moonGraph");
const { postMoonSignAndPhase } = require("./bluesky/moon_bot");
const { processMentions } = require("./bluesky/mentions");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * 🔎 Request logger (helps identify who/what is hitting /daily)
 */
app.use((req, res, next) => {
  const ip =
    req.get("fly-client-ip") ||
    (req.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
    req.ip;

  console.log("REQ", req.method, req.originalUrl, {
    ua: req.get("user-agent"),
    ip,
  });

  next();
});

/**
 * 🔐 Simple shared-secret protection for cron endpoints
 * Set CRON_SECRET in Fly secrets + GitHub secrets.
 * GitHub should send: Authorization: Bearer <CRON_SECRET>
 */
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;

  // If you haven't set CRON_SECRET yet, allow requests but warn loudly.
  // (Flip this to "return 500" if you prefer hard-fail until configured.)
  if (!secret) {
    console.warn("⚠️ CRON_SECRET is not set; /daily and /mentions are unprotected");
    return next();
  }

  const auth = req.get("authorization") || "";
  const expected = `Bearer ${secret}`;

  if (auth !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  return next();
}

app.get("/", (req, res) => {
  res.send("🌙 Moon Cycle Bot is alive");
});

app.post("/interpret", async (req, res) => {
  try {
    const { risingSign } = req.body;

    if (!risingSign) {
      return res.status(400).json({
        error: "Missing required field: risingSign",
      });
    }

    console.log("rising sign", risingSign);

    const result = await runMoonGraph({ risingSign });

    console.log("results", result);

    if (!result) {
      return res.status(500).json({
        error: "LangGraph returned no output",
      });
    }

    return res.json({ message: result });
  } catch (err) {
    console.error("[/interpret] Error invoking moonGraph:", err);

    return res.status(500).json({
      error: "Internal server error during interpretation",
    });
  }
});

// 🔹 Daily posting route (protected)
app.post("/daily", requireCronSecret, async (req, res) => {
  try {
    await postMoonSignAndPhase();
    return res.status(200).json({ message: "Daily moon post sent to Bluesky!" });
  } catch (err) {
    console.error("❌ [/daily] Error in daily post:", err);
    return res.status(500).json({ error: "Failed to post daily moon update" });
  }
});

// 🔹 Mentions processing route (protected)
app.post("/mentions", requireCronSecret, async (req, res) => {
  try {
    const out = await processMentions({ limit: 50 });
    return res.status(200).json(out);
  } catch (err) {
    console.error("[/mentions] error", err);
    return res.status(500).json({ ok: false, error: "failed to process mentions" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});