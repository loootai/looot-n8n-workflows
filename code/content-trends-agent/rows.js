// Code node "Ideas to rows". One row per idea with its sources and keywords.
// @include agent-cost
const item = $input.first().json;
const ideas = ((item.output && Array.isArray(item.output.ideas)) ? item.output.ideas : []).filter((x) => x && x.title);
const cost = agentCost(item);
const each = ideas.length ? cost.looot_cost_usd / ideas.length : 0;
const week = new Date().toISOString().slice(0, 10);
const join = (a) => (Array.isArray(a) ? a.filter(Boolean).join(", ") : String(a || ""));
return ideas.map((x) => ({
  json: {
    week,
    topic: x.topic || "",
    title: x.title,
    angle: x.angle || "",
    why_now: x.why_now || "",
    keywords: join(x.keywords),
    sources: join(x.sources),
    cost_usd: Number(each.toFixed(6)),
  },
}));
