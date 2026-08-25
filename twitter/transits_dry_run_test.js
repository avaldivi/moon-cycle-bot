// Safe to run with no X API credentials — never calls the network, never charges anything.
// node twitter/transits_dry_run_test.js
const { postMoonTransitsToX } = require("./moon_transits_bot");

(async () => {
  const result = await postMoonTransitsToX(true);
  console.log("\n---");
  console.log(JSON.stringify(result, null, 2));
})();
