// Code node "Build card". Pairs each run with its request and builds one company card.
const runs = $input.all().map((i) => i.json);
const reqs = $("Build requests").all().map((i) => i.json);

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
function firstArray(src, test, depth = 0) {
  if (!src || typeof src !== "object" || depth > 4) return [];
  if (Array.isArray(src) && src.some(test)) return src;
  for (const v of Object.values(src)) { const r = firstArray(v, test, depth + 1); if (r.length) return r; }
  return [];
}

const card = { ok: true, domain: reqs[0] && reqs[0].domain, company: {}, news: [], tech: [], runs: {}, cost_usd: 0 };
runs.forEach((run, i) => {
  const job = (reqs[i] && reqs[i].job) || "unknown";
  const cost = typeof run.actualCost === "number" ? run.actualCost : 0;
  card.cost_usd += cost;
  card.runs[job] = run.status || (run.error && run.error.code) || "error";
  if (run.status !== "completed") return;
  const src = { n: (run.normalized && run.normalized.fields) || {}, r: run.result };
  if (job === "company.enrich") {
    card.company = {
      name: find(src, ["name", "company_name", "display_name"]),
      industry: find(src, ["industry", "category", "sector"]),
      employees: find(src, ["employees", "employee_count", "employeeCount", "headcount", "size"]),
      country: find(src, ["country", "country_code", "hq_country"]),
      linkedin: find(src, ["linkedin_url", "linkedinUrl", "linkedin"]),
      description: find(src, ["description", "short_description", "summary", "about"]).slice(0, 400),
    };
  } else if (job === "company.news") {
    const items = firstArray(run.result, (x) => x && typeof x === "object" && (x.title || x.headline));
    card.news = items.slice(0, 5).map((x) => ({
      title: x.title || x.headline,
      url: x.url || x.link || null,
      date: x.date || x.published_at || x.publishedAt || null,
    }));
  } else if (job === "company.technographics") {
    const items = firstArray(run.result, (x) => typeof x === "string" || (x && typeof x === "object" && (x.name || x.technology)));
    card.tech = [...new Set(items.map((x) => (typeof x === "string" ? x : x.name || x.technology)).filter(Boolean))].slice(0, 25);
  }
});
card.cost_usd = Number(card.cost_usd.toFixed(6));
return [{ json: { response: card } }];
