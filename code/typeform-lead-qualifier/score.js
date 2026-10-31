// Code node "Score the lead". Edit ICP to match who you sell to. hot leads also go to Slack.
// @include run-helpers
const ICP = {
  minEmployees: 20,
  maxEmployees: 2000,
  industries: /software|saas|internet|information technology|marketing|financial/i,
  countries: /^(us|usa|united states|gb|uk|united kingdom|fr|france|de|germany)$/i,
  hot: 70,
};
const run = $input.first().json;
const lead = $("Read the verdict").first().json;
const { n, r } = runFields(run);
const src = { n, r };
const company = find(src, ["name", "company_name", "companyName"]);
const industry = find(src, ["industry", "sector", "category"]);
const country = find(src, ["country", "country_code", "countryCode"]);
const employees = Number(String(find(src, ["employee_count", "employees", "employeeCount", "headcount", "size"])).replace(/[^0-9]/g, "")) || 0;
let score = 20;
const why = [];
if (employees >= ICP.minEmployees && employees <= ICP.maxEmployees) { score += 35; why.push(`${employees} employees`); }
if (industry && ICP.industries.test(industry)) { score += 25; why.push(industry); }
if (country && ICP.countries.test(country)) { score += 10; why.push(country); }
if (lead.email_status === "valid") score += 10;
score = Math.min(100, score);
const cost = Number((lead.looot_cost_usd + runCost(run)).toFixed(6));
const hot = score >= ICP.hot;
return [{
  json: {
    ...lead,
    company,
    industry,
    country,
    employees: employees || "",
    score,
    hot,
    looot_cost_usd: cost,
    text: `*Hot Typeform lead* (${score}/100): ${[lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email} at ${company || lead.domain}\n${lead.email}${why.length ? ` · ${why.join(" · ")}` : ""}${lead.need ? `\n> ${lead.need.slice(0, 200)}` : ""}`,
  },
}];
