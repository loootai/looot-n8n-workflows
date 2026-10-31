// Code node "Champions to check". Rows with a LinkedIn URL, at most MAX per run.
const MAX = 100;
const out = [];
for (const { json: r } of $input.all()) {
  const url = String(r.linkedin_url || "").trim().split("?")[0];
  if (!/linkedin\.com\/in\//i.test(url)) continue;
  out.push({ json: { row_number: r.row_number, full_name: r.full_name || "", linkedin_url: url, company: String(r.company || "").trim() } });
  if (out.length >= MAX) break;
}
return out;
