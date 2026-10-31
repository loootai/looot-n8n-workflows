// Code node "Build the email". One email with a short brief per company, plus what it cost.
// @include agent-cost
const companies = $("Companies to research").all().map((i) => i.json);
const briefs = $input.all().map((i) => i.json);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let total = 0;
const sections = briefs.map((b, i) => {
  const c = companies[i] || {};
  const cost = agentCost(b);
  total += cost.looot_cost_usd;
  const when = (c.meetings || []).map((m) => `${esc(m.title)} (${esc(m.start)})`).join(", ");
  const text = typeof b.output === "string" ? b.output : JSON.stringify(b.output ?? "");
  return `<h3>${esc(c.domain)}</h3><p><i>${when}</i></p><div>${esc(text).replace(/\n/g, "<br>")}</div>`;
});
if (!sections.length) return [];
const html = `<p>Briefs for today's calls.</p>${sections.join("<hr>")}<p style="color:#666">Data cost: $${total.toFixed(4)} in looot calls.</p>`;
return [{ json: { subject: `Call prep: ${companies.length} compan${companies.length === 1 ? "y" : "ies"} today`, html, looot_cost_usd: Number(total.toFixed(6)) } }];
