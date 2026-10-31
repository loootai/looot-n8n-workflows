// Code node "Answer and cost". What the calling workflow gets back.
// @include agent-cost
const item = $input.first().json;
const cost = agentCost(item);
return [{ json: { answer: item.output ?? null, ...cost } }];
