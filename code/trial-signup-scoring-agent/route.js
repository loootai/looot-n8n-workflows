// Code node "Score and route". Turns the agent's verdict into a tier and a Slack line.
// @include agent-cost
const HOT = 70;
const WARM = 40;
const item = $input.first().json;
const signup = $("Read the signup").first().json;
const v = (item.output && typeof item.output === "object") ? item.output : {};
const score = Math.max(0, Math.min(100, Math.round(Number(v.fit_score) || 0)));
const tier = score >= HOT ? "hot" : score >= WARM ? "warm" : "cold";
const cost = agentCost(item);
const who = [v.full_name || signup.name || signup.email, v.title, v.company].filter(Boolean).join(", ");
const text = `*New ${tier} signup* (${score}/100): ${who}\n${signup.email}${v.company_size ? ` · ${v.company_size}` : ""}${v.industry ? ` · ${v.industry}` : ""}\n${v.reason || ""}\n_data cost $${cost.looot_cost_usd.toFixed(4)}_`;
return [{ json: { ...signup, ...v, fit_score: score, tier, hot: tier === "hot", text, ...cost } }];
