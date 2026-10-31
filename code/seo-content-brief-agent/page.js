// Code node "Brief to page". Splits the brief into three Notion text blocks of up to 1,990 characters.
// @include agent-cost
const item = $input.first().json;
const form = $("Brief form").first().json;
const cost = agentCost(item);
const text = (typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? ""))
  + `\n\nData cost: $${cost.looot_cost_usd.toFixed(4)} in ${cost.looot_calls} looot calls.`;
const parts = [];
let rest = text;
while (rest.length && parts.length < 3) {
  let cut = rest.length <= 1990 ? rest.length : rest.lastIndexOf("\n", 1990);
  if (cut < 500) cut = 1990;
  parts.push(rest.slice(0, cut));
  rest = rest.slice(cut).replace(/^\n+/, "");
}
while (parts.length < 3) parts.push(" ");
return [{ json: { title: `Brief: ${form["Keyword"] || "keyword"}`, part1: parts[0], part2: parts[1], part3: parts[2], ...cost } }];
