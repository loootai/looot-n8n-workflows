// Code node "Build the digest". Up to 3 new articles per competitor, one Slack message.
// Articles already sent are remembered in the workflow's static data (active workflows only).
// @include run-helpers
const PER_COMPETITOR = 3;
const names = $("Competitors").all().map((i) => i.json.name);
const store = typeof $getWorkflowStaticData === "function" ? $getWorkflowStaticData("global") : {};
const seen = new Set(Array.isArray(store.sentUrls) ? store.sentUrls : []);
let cost = 0;
const blocks = [];
$input.all().forEach(({ json: run }, i) => {
  cost += runCost(run);
  if (runProblem(run)) return;
  const items = firstArray(run.result, (x) => x && typeof x === "object" && (x.title || x.headline));
  const fresh = [];
  for (const a of items) {
    const url = a.link || a.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    fresh.push(`• <${url}|${String(a.title || a.headline).replace(/[<>|]/g, "")}>${a.source ? ` (${a.source})` : ""}${a.date ? `, ${a.date}` : ""}`);
    if (fresh.length >= PER_COMPETITOR) break;
  }
  if (fresh.length) blocks.push(`*${names[i] || "Competitor"}*\n${fresh.join("\n")}`);
});
store.sentUrls = [...seen].slice(-500);
if (!blocks.length) return [];
return [{ json: { text: `Competitor news\n\n${blocks.join("\n\n")}\n\n_${names.length} searches, $${cost.toFixed(4)} in looot calls_`, looot_cost_usd: Number(cost.toFixed(6)) } }];
