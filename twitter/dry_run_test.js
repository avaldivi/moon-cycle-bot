// Safe to run with no X API credentials — never calls the network, never charges anything.
// node twitter/dry_run_test.js
const { postMoonSignAndPhaseToX } = require("./moon_bot");
const { estimateMonthlyCost } = require("../tools/x_cost_estimator");

(async () => {
  const result = await postMoonSignAndPhaseToX(true);
  console.log("\n---");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n💵 Projected monthly cost (phase-gated thread + mentions poll every 5 min):");
  console.log(JSON.stringify(estimateMonthlyCost(), null, 2));
})();
