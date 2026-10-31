// Code node "Brief to page". One Notion page per account, cut to Notion's 2,000 character block.
// @include agent-cost
const item = $input.first().json;
const b = (item.output && typeof item.output === "object") ? item.output : {};
const cost = agentCost(item);
const list = (arr) => (Array.isArray(arr) ? arr : []).filter(Boolean).map((x) => `- ${x}`).join("\n") || "n/a";
const body = [
  `${b.one_liner || "n/a"}`,
  `Size: ${b.size || "n/a"}. Funding: ${b.funding || "n/a"}. HQ: ${b.hq || "n/a"}.`,
  `Pricing: ${b.pricing || "n/a"}`,
  `Tech stack: ${(Array.isArray(b.tech_stack) ? b.tech_stack : []).slice(0, 15).join(", ") || "n/a"}`,
  `Hiring:\n${list(b.hiring)}`,
  `Recent news:\n${list(b.recent_news)}`,
  `Pains we can solve:\n${list(b.pains_we_solve)}`,
  `Talking points:\n${list(b.talking_points)}`,
  `Sources:\n${list(b.sources)}`,
  `Data cost: $${cost.looot_cost_usd.toFixed(4)} in ${cost.looot_calls} looot calls.`,
].join("\n\n");
return [{ json: { title: `${b.name || "Account"} (${b.domain || "no domain"})`, body: body.slice(0, 1990), ...cost } }];
