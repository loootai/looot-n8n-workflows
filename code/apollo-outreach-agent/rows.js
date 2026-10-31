// Code node "Valid leads only". One item per lead with a verified address, ready for Instantly.
// @include agent-cost
const item = $input.first().json;
const leads = (item.output && Array.isArray(item.output.leads)) ? item.output.leads : [];
const cost = agentCost(item);
const re = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
return leads
  .filter((l) => l && re.test(String(l.email || "").trim()) && String(l.email_status || "").toLowerCase() === "valid")
  .map((l) => ({
    json: {
      email: String(l.email).trim().toLowerCase(),
      first_name: l.first_name || "",
      last_name: l.last_name || "",
      company_name: l.company || "",
      title: l.title || "",
      linkedin_url: l.linkedin_url || "",
      first_line: String(l.first_line || "").slice(0, 300),
      run_cost_usd: cost.looot_cost_usd,
    },
  }));
