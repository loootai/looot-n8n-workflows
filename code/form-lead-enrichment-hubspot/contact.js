// Code node "Contact fields". Picks the company fields HubSpot needs from the enrichment run.
// @include run-helpers
const run = $input.first().json;
const lead = $("Read the verdict").first().json;
const src = runFields(run);
const ok = !runProblem(run);
const pick = (keys) => (ok ? find(src, keys) : "");
return [{
  json: {
    ...lead,
    company: pick(["name", "company_name", "display_name", "organization_name"]),
    industry: pick(["industry", "category", "sector"]),
    employees: pick(["employees", "employee_count", "employeeCount", "headcount", "size"]),
    city: pick(["city", "hq_city", "locality"]),
    country: pick(["country", "country_code", "hq_country"]),
    linkedin_url: pick(["linkedin_url", "linkedinUrl", "linkedin"]),
    website: lead.domain ? `https://${lead.domain}` : "",
    looot_cost_usd: Number((lead.verify_cost_usd + runCost(run)).toFixed(6)),
  },
}];
