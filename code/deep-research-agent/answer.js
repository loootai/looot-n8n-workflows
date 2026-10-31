// Code node "Add cost line". Appends what the looot calls cost to the report the chat shows.
// @include agent-cost
const item = $input.first().json;
const cost = agentCost(item);
const report = typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "");
const line = `\n\n---\nlooot calls: ${cost.looot_calls}, data cost: $${cost.looot_cost_usd.toFixed(4)} (model tokens are billed by your model provider).`;
return [{ json: { output: report + line, ...cost } }];
