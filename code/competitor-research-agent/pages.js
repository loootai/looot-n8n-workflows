// Code node "One page per competitor". Turns the agent's answer into one Notion page each.
// @include agent-cost
const item = $input.first().json;
const list = (item.output && Array.isArray(item.output.competitors)) ? item.output.competitors : [];
const cost = agentCost(item);
const each = list.length ? cost.looot_cost_usd / list.length : 0;
const bullets = (arr) => (Array.isArray(arr) ? arr : []).filter(Boolean).map((x) => `- ${x}`).join("\n");
return list.filter((c) => c && c.name).map((c) => ({
  json: {
    title: `${c.name} (${c.domain || "no domain"})`,
    body: [
      `Overview: ${c.overview || "n/a"}`,
      `Size and funding: ${c.size_and_funding || "n/a"}`,
      `Pricing: ${c.pricing || "n/a"}`,
      `Products:\n${bullets(c.products) || "n/a"}`,
      `Recent news:\n${bullets(c.recent_news) || "n/a"}`,
      `What customers say:\n${bullets(c.reviews) || "n/a"}`,
      `Sources:\n${bullets(c.sources) || "n/a"}`,
      `Data cost for this page: about $${each.toFixed(4)}`,
    ].join("\n\n").slice(0, 1990),
  },
}));
