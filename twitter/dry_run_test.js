// Safe to run with no X API credentials — never calls the network, never charges anything.
// node twitter/dry_run_test.js
// node twitter/dry_run_test.js 2026-08-28   (preview a specific date's copy — dry-run only)
const { postMoonSignAndPhaseToX } = require("./moon_bot");
const { estimateMonthlyCost } = require("../tools/x_cost_estimator");

// A bare "YYYY-MM-DD" arg parses as UTC midnight — converting that to America/New_York (UTC-4/5)
// rolls it back to the previous evening. Anchoring to local noon avoids the boundary entirely.
const rawArg = process.argv[2];
const previewDate = rawArg ? new Date(rawArg.includes("T") ? rawArg : `${rawArg}T12:00:00`) : new Date();

(async () => {
  const result = await postMoonSignAndPhaseToX(true, previewDate);
  console.log("\n---");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n💵 Projected monthly cost (phase-gated thread + mentions poll every 5 min):");
  console.log(JSON.stringify(estimateMonthlyCost(), null, 2));
})();
