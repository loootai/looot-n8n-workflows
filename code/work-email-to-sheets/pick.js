// Code node "Rows to look up". Keeps rows that have a name and a domain but no email yet.
// @include run-helpers
const MAX_ROWS = 50; // per execution, so one run never surprises you
const out = [];
for (const { json: row } of $input.all()) {
  if (String(row.email || "").trim() || String(row.email_status || "").trim()) continue;
  let first = String(row.first_name || "").trim();
  let last = String(row.last_name || "").trim();
  if ((!first || !last) && row.full_name) {
    const parts = String(row.full_name).trim().split(/\s+/);
    first = first || parts[0] || "";
    last = last || parts.slice(1).join(" ");
  }
  const domain = cleanDomain(row.domain || row.website || row.company_domain);
  if (!first || !last || !domain) continue;
  out.push({
    json: {
      row_number: row.row_number,
      first_name: first,
      last_name: last,
      domain,
      key: `n8n-email-find:${domain}:${first}:${last}`.toLowerCase().slice(0, 180),
    },
  });
  if (out.length >= MAX_ROWS) break;
}
return out;
