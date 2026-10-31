// Code node "Rank report". One Slack message with this week's Google position per keyword and the
// change since last week (kept in the workflow's static data, active workflows only).
// @include run-helpers
const reqs = $("Keywords").all().map((i) => i.json);
const store = typeof $getWorkflowStaticData === "function" ? $getWorkflowStaticData("global") : {};
const last = (store.lastPositions && typeof store.lastPositions === "object") ? store.lastPositions : {};
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
let cost = 0;
const now = {};
const lines = $input.all().map(({ json: run }, i) => {
  const req = reqs[i] || {};
  cost += runCost(run);
  if (runProblem(run)) return `• ${req.keyword}: check failed (${runProblem(run)})`;
  const organic = firstArray(run.result, (x) => x && typeof x === "object" && (x.link || x.url));
  const idx = organic.findIndex((o) => { const h = host(o.link || o.url); return h === req.domain || h.endsWith("." + req.domain); });
  const pos = idx >= 0 ? Number(organic[idx].position) || idx + 1 : null;
  now[req.keyword] = pos;
  const before = last[req.keyword];
  let change = "";
  if (pos && before) change = pos < before ? ` (up ${before - pos})` : pos > before ? ` (down ${pos - before})` : " (same)";
  else if (pos && before === null) change = " (new)";
  else if (!pos && before) change = ` (was ${before})`;
  return `• ${req.keyword}: ${pos ? `#${pos}` : "not in the results"}${change}`;
});
store.lastPositions = now;
if (!lines.length) return [];
return [{ json: { text: `*Weekly Google ranks for ${reqs[0].domain}* (${reqs[0].location})\n${lines.join("\n")}\n_${lines.length} searches, $${cost.toFixed(4)} in looot calls_`, looot_cost_usd: Number(cost.toFixed(6)) } }];
