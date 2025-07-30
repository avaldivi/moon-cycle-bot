const express = require('express');
const { runMoonGraph } = require('./graph/moonGraph');
const { postMoonSignAndPhase } = require('./moon_bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('🌙 Moon Cycle Bot is alive');
});

app.post('/interpret', async (req, res) => {
  try {
    const { risingSign } = req.body;

    if (!risingSign) {
      return res.status(400).json({
        error: "Missing required field: risingSign",
      });
    }

		console.log('rising sign', risingSign)

    const result = await runMoonGraph({ risingSign });

		console.log('results', result)

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

// 🔹 Daily posting route
app.post('/daily', async (req, res) => {
  try {
    await postMoonSignAndPhase();
    res.status(200).json({ message: 'Daily moon post sent to Bluesky!' });
  } catch (err) {
    console.error("❌ [/daily] Error in daily post:", err);
    res.status(500).json({ error: "Failed to post daily moon update" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});