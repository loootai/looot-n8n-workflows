// Code node "Rows to enrich". Rows with a LinkedIn URL and no status yet, at most MAX_ROWS per run.
const MAX_ROWS = 10;
const out = [];
for (const { json: r } of $input.all()) {
  const url = String(r.linkedin_url || "").trim();
  if (!/linkedin\.com\/in\//i.test(url) || String(r.status || "").trim()) continue;
  out.push({ json: { row_number: r.row_number, linkedin_url: url.split("?")[0], company_domain: String(r.company_domain || "").trim().toLowerCase() } });
  if (out.length >= MAX_ROWS) break;
}
return out;
