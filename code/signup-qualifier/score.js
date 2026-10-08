// Code node "Score against ICP". Edit the ICP block to match who you sell to.
const ICP = {
  minEmployees: 20,
  maxEmployees: 2000,
  industries: ["software", "saas", "internet", "information technology", "marketing", "financial services"],
  countries: ["us", "united states", "gb", "united kingdom", "fr", "france", "de", "germany"],
  seniorTitles: ["founder", "ceo", "cto", "coo", "chief", "head", "vp", "vice president", "director", "owner", "partner"],
  hot: 70,
  warm: 40,
};

const runs = $input.all().map((i) => i.json);
const reqs = $("Check email").all().map((i) => i.json);
function squash(k) { return String(k).toLowerCase().replace(/[\s_\-.]/g, ""); }
function find(src, keys, depth = 0) {
  if (!src || typeof src !== "object" || depth > 4) return "";
  if (Array.isArray(src)) {
    for (const x of src.slice(0, 5)) { const v = find(x, keys, depth + 1); if (v) return v; }
    return "";
  }
  for (const key of keys) {
    for (const [k, v] of Object.entries(src)) {
      if (squash(k) === squash(key) && (typeof v === "string" || typeof v === "number") && String(v).trim()) return String(v).trim();
    }
  }
  for (const v of Object.values(src)) { const r = find(v, keys, depth + 1); if (r) return r; }
  return "";
}

const person = {};
const company = {};
let cost = 0;
runs.forEach((run, i) => {
  cost += typeof run.actualCost === "number" ? run.actualCost : 0;
  if (run.status !== "completed") return;
  const src = { n: (run.normalized && run.normalized.fields) || {}, r: run.result };
  if (reqs[i].job === "people.enrich.by-email") {
    person.name = find(src, ["full_name", "name"]);
    person.title = find(src, ["title", "job_title", "jobTitle", "headline", "position"]);
    person.linkedin = find(src, ["linkedin_url", "linkedinUrl", "linkedin"]);
  } else {
    company.name = find(src, ["name", "company_name", "display_name"]);
    company.industry = find(src, ["industry", "category", "sector"]);
    company.employees = find(src, ["employees", "employee_count", "employeeCount", "headcount", "size"]);
    company.country = find(src, ["country", "country_code", "hq_country"]);
  }
});

let score = 0;
const reasons = [];
const employees = parseInt(String(company.employees || "").replace(/[^0-9]/g, ""), 10);
if (Number.isFinite(employees)) {
  if (employees >= ICP.minEmployees && employees <= ICP.maxEmployees) { score += 40; reasons.push(`${employees} employees, inside ${ICP.minEmployees}-${ICP.maxEmployees}`); }
  else reasons.push(`${employees} employees, outside ${ICP.minEmployees}-${ICP.maxEmployees}`);
} else reasons.push("company size unknown");
const industry = String(company.industry || "").toLowerCase();
if (industry && ICP.industries.some((x) => industry.includes(x))) { score += 30; reasons.push(`industry: ${company.industry}`); }
else if (industry) reasons.push(`industry not in ICP: ${company.industry}`);
const country = String(company.country || "").toLowerCase();
if (country && ICP.countries.includes(country)) { score += 15; reasons.push(`country: ${company.country}`); }
const title = String(person.title || "").toLowerCase();
if (title && ICP.seniorTitles.some((x) => title.includes(x))) { score += 15; reasons.push(`senior title: ${person.title}`); }
else if (title) reasons.push(`title: ${person.title}`);

const tier = score >= ICP.hot ? "hot" : score >= ICP.warm ? "warm" : "cold";
return [{ json: { response: { ok: true, email: reqs[0].email, tier, score, reasons, person, company, signup: reqs[0].signup, cost_usd: Number(cost.toFixed(6)) } } }];
