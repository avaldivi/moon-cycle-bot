// Official pay-per-use rates from https://docs.x.com/x-api/getting-started/pricing
// (X retired the flat $200/mo Basic and $5,000/mo Pro tiers for new developers in Feb 2026)
const X_API_RATES = {
  standardPost: 0.015,   // text/media post, no URL
  postWithUrl: 0.200,    // post containing a URL
  summonedPost: 0.010,   // reply that @-mentions/summons another account's post
  standardRead: 0.005,   // reading someone else's post
  ownedRead: 0.001,      // reading your own account's data
};

function estimateThreadCost(posts) {
  return posts.reduce((total, p) => {
    const rate = p.hasLink ? X_API_RATES.postWithUrl : X_API_RATES.standardPost;
    return total + rate;
  }, 0);
}

// Models this bot's actual cadence:
// - moon_bot.js: a thread posted only on important phases (X_POST_PHASES gate — New Moon,
//   Full Moon, First Quarter, ~3 occurrences per ~29.53-day lunar cycle ≈ 3.09/month)
// - moon_transits_bot.js: a single no-link post, skipped only when the Moon has zero major
//   aspects that day. Empirically measured against tools/moon_transits.js: 29/30 days had at
//   least one aspect (96.7%) — this is NOT rare, it posts almost every day.
// - mentions.js: a poll every N minutes via GitHub Actions (the poll itself runs daily
//   regardless of the above — only posting is gated). Uses GET /2/users/:id/mentions on the
//   bot's own account, which bills as an "owned read" ($0.001) rather than a standard read
//   ($0.005) — see x_client.js#getMentions.
// Note: same-day repeat reads of an already-seen resource are deduplicated by X and not
// re-charged (a "soft guarantee" per their docs), so the read line is still a worst-case estimate.
function estimateMonthlyCost({
  threadHasLink = true,
  threadsPerMonth = 3.09,       // New Moon + Full Moon + First Quarter, once per lunar cycle
  transitPostRate = 29 / 30,    // measured: days per month with at least one Moon aspect
  pollsPerDay = 288,            // every 5 minutes
  avgMentionReadsPerPoll = 1,   // posts returned/charged per poll, on average
  avgRepliesPerDay = 5,
} = {}) {
  const threadCost =
    X_API_RATES.standardPost + (threadHasLink ? X_API_RATES.postWithUrl : X_API_RATES.standardPost);
  const monthlyThreadCost = threadCost * threadsPerMonth;

  const monthlyTransitCost = X_API_RATES.standardPost * transitPostRate * 30;

  const monthlyReplyCost = avgRepliesPerDay * X_API_RATES.standardPost * 30;
  const monthlyReadCost = pollsPerDay * avgMentionReadsPerPoll * X_API_RATES.ownedRead * 30;

  return {
    monthlyThreadCost: round(monthlyThreadCost),
    monthlyTransitCost: round(monthlyTransitCost),
    monthlyReplyCost: round(monthlyReplyCost),
    monthlyReadCost: round(monthlyReadCost),
    total: round(monthlyThreadCost + monthlyTransitCost + monthlyReplyCost + monthlyReadCost),
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { X_API_RATES, estimateThreadCost, estimateMonthlyCost };
