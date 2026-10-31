// Code node "Postings to rows". One Google Sheets row per job posting, with its company research.
// @include agent-cost
const item = $input.first().json;
const form = $("Job search form").first().json;
const list = ((item.output && Array.isArray(item.output.postings)) ? item.output.postings : []).filter((p) => p && p.job_title && p.company);
const cost = agentCost(item);
const each = list.length ? cost.looot_cost_usd / list.length : 0;
const foundAt = new Date().toISOString();
return list.map((p) => ({
  json: {
    job_title: String(p.job_title),
    company: String(p.company),
    company_domain: p.company_domain || "",
    location: p.location || "",
    job_url: p.job_url || "",
    company_size: p.company_size || "",
    industry: p.industry || "",
    company_summary: p.company_summary || "",
    why_relevant: p.why_relevant || "",
    search: `${form["Job title"] || ""} in ${form["Location"] || ""}`.trim(),
    found_at: foundAt,
    cost_usd: Number(each.toFixed(6)),
  },
}));
