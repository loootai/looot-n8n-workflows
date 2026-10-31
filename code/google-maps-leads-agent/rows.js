// Code node "Leads to rows". One Google Sheets row per business the agent returned.
// @include agent-cost
const item = $input.first().json;
const form = $("Lead search form").first().json;
const leads = (item.output && Array.isArray(item.output.leads)) ? item.output.leads : [];
const cost = agentCost(item);
const foundAt = new Date().toISOString();
const query = `${form["Business type"] || ""} in ${form["City or area"] || ""}`.trim();
return leads
  .filter((l) => l && l.name)
  .map((l) => ({
    json: {
      name: String(l.name),
      address: l.address || "",
      phone: l.phone || "",
      website: l.website || "",
      rating: l.rating ?? "",
      reviews: l.reviews ?? "",
      email: l.email || "",
      search: query,
      found_at: foundAt,
      run_cost_usd: cost.looot_cost_usd,
    },
  }));
