// Code node "New funding news". One HubSpot task per new funding article. Links already turned into
// a task are remembered in the workflow's static data (active workflows only).
// @include run-helpers
const FUNDING = /rais(es|ed|ing)|funding|series [a-f]\b|seed round|pre-seed|investment round|\$\s?\d+(\.\d+)?\s?(m|million|bn|billion)/i;
const accounts = $("Accounts").all().map((i) => i.json);
const store = typeof $getWorkflowStaticData === "function" ? $getWorkflowStaticData("global") : {};
const seen = new Set(Array.isArray(store.seenFunding) ? store.seenFunding : []);
const out = [];
$input.all().forEach(({ json: run }, i) => {
  const a = accounts[i] || {};
  if (runProblem(run)) return;
  const items = firstArray(run.result, (x) => x && typeof x === "object" && (x.title || x.headline));
  for (const n of items.slice(0, 10)) {
    const title = String(n.title || n.headline || "");
    const link = n.link || n.url || "";
    const first = String(a.company || "").toLowerCase().split(" ")[0];
    if (!FUNDING.test(title) || !title.toLowerCase().includes(first) || !link || seen.has(link)) continue;
    seen.add(link);
    out.push({
      json: {
        company_id: a.hubspot_company_id || "",
        subject: `Funding news: ${title}`.slice(0, 250),
        body: `${a.company} in the news: ${title}\n${link}\n${n.source ? `Source: ${typeof n.source === "object" ? n.source.name || "" : n.source}` : ""}\nReach out while the budget is fresh.`,
        link,
        looot_cost_usd: runCost(run),
      },
    });
    break;
  }
});
store.seenFunding = [...seen].slice(-1000);
return out;
