// Code node "Emails to check". Rows with an email and no email_status yet.
const MAX_ROWS = 200;
const re = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const out = [];
for (const { json: row } of $input.all()) {
  const email = String(row.email || "").trim().toLowerCase();
  if (!email || String(row.email_status || "").trim() || !re.test(email)) continue;
  out.push({ json: { row_number: row.row_number, email, first_name: row.first_name || "", last_name: row.last_name || "", company_name: row.company_name || row.company || "" } });
  if (out.length >= MAX_ROWS) break;
}
return out;
