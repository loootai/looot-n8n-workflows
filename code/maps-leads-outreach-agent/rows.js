// Code node "Leads to rows". One row per business, with the verified email and the drafted opener.
// @include agent-cost
const item = $input.first().json;
const form = $("Lead search form").first().json;
const leads = (item.output && Array.isArray(item.output.leads)) ? item.output.leads : [];
const cost = agentCost(item);
const foundAt = new Date().toISOString();
return leads.filter((l) => l && l.name).map((l) => ({
  json: {
    name: String(l.name),
    address: l.address || "",
    phone: l.phone || "",
    website: l.website || "",
    email: String(l.email || "").toLowerCase(),
    email_status: l.email ? (l.email_status || "unknown") : "not_found",
    website_notes: l.website_notes || "",
    opener: l.opener || "",
    search: `${form["Business type"] || ""} in ${form["City or area"] || ""}`.trim(),
    found_at: foundAt,
    run_cost_usd: cost.looot_cost_usd,
  },
}));
