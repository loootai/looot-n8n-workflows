// Code node "Visibility report". For each question: is there an AI Overview, does it name or cite you,
// and which competitors it names. One Slack message.
// @include run-helpers
const reqs = $("Brand and questions").all().map((i) => i.json);
let cost = 0;
let named = 0;
const lines = $input.all().map(({ json: run }, i) => {
  const q = reqs[i] || {};
  cost += runCost(run);
  if (runProblem(run)) return `• ${q.query}: check failed (${runProblem(run)})`;
  const text = JSON.stringify(run.result ?? run.normalized ?? "").toLowerCase();
  const hasOverview = /ai.?overview|aioverview|ai_overview/.test(text) && text.length > 200;
  const youNamed = text.includes(String(q.name).toLowerCase());
  const youCited = text.includes(String(q.domain).toLowerCase());
  const rivals = (q.competitors || []).filter((c) => text.includes(String(c).toLowerCase()));
  if (youNamed || youCited) named += 1;
  const you = youCited ? "cited" : youNamed ? "named" : "missing";
  return `• ${q.query}: ${hasOverview ? "AI Overview" : "no AI Overview found"}, you ${you}${rivals.length ? `, competitors named: ${rivals.join(", ")}` : ""}`;
});
if (!lines.length) return [];
const b = reqs[0];
return [{ json: { text: `*AI visibility for ${b.name}*: in ${named} of ${lines.length} answers\n${lines.join("\n")}\n_$${cost.toFixed(4)} in looot calls_`, named, questions: lines.length, looot_cost_usd: Number(cost.toFixed(6)) } }];
