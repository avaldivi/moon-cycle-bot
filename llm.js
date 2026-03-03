const { generateText } = require("ai");
const { openai } = require("@ai-sdk/openai");

async function generateReply({ risingSign, moonContext, house, userText }) {
  const prompt = `
You are a concise astrologer.
You must be careful with certainty. Avoid “will” language. No medical/mental health claims.

User text: ${userText}

Context:
- Rising: ${risingSign}
- Moon sign: ${moonContext.sign}
- Moon phase: ${moonContext.phase}
- Moon house (whole sign): ${house}

Begin with:
Line 1: "The moon transits your <house>H (<topic>)"

Write a reply with:
- Line 1
- 1 sentence about how the moon might affect them.
- 1 sentence of recommended activities.
- Total <= 300 characters.
No hashtags.
`.trim();

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt,
    // optional safety-ish constraint:
    maxTokens: 120,
  });

  return (text || "").trim();
}

module.exports = { generateReply };