// Code node "Ideas to rows". One Google Sheets row per content idea.
// @include agent-cost
const item = $input.first().json;
const ideas = ((item.output && Array.isArray(item.output.ideas)) ? item.output.ideas : []).filter((x) => x && x.idea);
const cost = agentCost(item);
const each = ideas.length ? cost.looot_cost_usd / ideas.length : 0;
const week = new Date().toISOString().slice(0, 10);
return ideas.map((x) => ({
  json: {
    week,
    source_handle: x.source_handle || "",
    post_url: x.post_url || "",
    likes: x.likes ?? "",
    comments: x.comments ?? "",
    why_it_worked: x.why_it_worked || "",
    idea: x.idea,
    hook: x.hook || "",
    cost_usd: Number(each.toFixed(6)),
  },
}));
