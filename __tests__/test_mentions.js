const { generateReply } = require("../llm");
const { getHouseForRising } = require("../house_calc");

async function run() {
  const risingSign = "Virgo";
  const moonContext = {
    sign: "Sagittarius",
    phase: "Waxing Gibbous",
    timezone: "America/New_York",
    dateISO: new Date().toISOString(),
  };

  const house = getHouseForRising(moonContext.sign, risingSign);

  const reply = await generateReply({
    risingSign,
    moonContext,
    house,
    userText: "Virgo rising 🌙",
  });

  console.log("House:", house);
  console.log("Reply:");
  console.log(reply);
  console.log("Length:", reply.length);
}

run();