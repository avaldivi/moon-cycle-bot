const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { ChatOpenAI } = require('@langchain/openai');
const { isAIMessage } = require("@langchain/core/messages");
const { tool } = require("@langchain/core/tools");
const { getMoonSign } = require("../moon_sign");
const { getHouseForRising } = require("../house_calc");
const { z } = require("zod");
require("dotenv").config();

// 🌙 Tool: Get current moon sign
const moonSignTool = tool(async () => {
    const moonSign = await getMoonSign();
    return moonSign;
  }, {
    name: "get_moon_sign",
    description: "Returns the current Moon sign.",
    schema: z.object({}) // no input needed
  });

// 🏠 Tool: Get moon house based on rising + moon sign
const houseCalcTool = tool(async ({ risingSign }) => {
    const moonSign = await getMoonSign();
    const house = getHouseForRising(moonSign, risingSign);
    return `The Moon is in your ${house} house.`;
  }, {
    name: "get_moon_house",
    description: "Determines what house the Moon is in based on the user's rising sign and current Moon sign.",
    schema: z.object({
      risingSign: z.string().describe("The user's rising sign, like 'Virgo'")
    })
  });

// 🤖 LLM setup
const llm = new ChatOpenAI({
  modelName: "gpt-4", // or 'gpt-3.5-turbo'
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});


// 🧠 Agent
const agent = createReactAgent({
    llm,
    tools: [moonSignTool, houseCalcTool],
  });

// 🛰 Handler to invoke agent
async function runMoonGraph({ risingSign }) {
  const result = await agent.invoke({
    messages: [
      {
        role: "system",
        content: `You are a concise astrologer. Respond in this exact format and under 300 characters total:
          "As a [rising sign], the Moon transits your [#] house of [theme]. [One sentence on what this means.] Good day for: [2-3 activities]."
          Never exceed 300 characters. Be practical.`,
        },
        {
          role: "user",
          content: `What does today's Moon in [moon sign] mean for someone with ${risingSign} rising? Use the tools to get the current moon sign and calculate which house it falls in for ${risingSign} rising.`,
        },
    ],
  });

  const finalMessage = result.messages
    .reverse()
    .find(msg => isAIMessage(msg) && msg.content);

  return finalMessage?.content || "No interpretation was returned.";
}

module.exports = { runMoonGraph };