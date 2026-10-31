// Code node "Attendees to enrich". Rows with an email and no enriched_at yet, at most MAX per run.
const MAX = 200;
const FREE = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|gmx|mail|yandex|zoho)\./i;
const out = [];
for (const { json: r } of $input.all()) {
  const email = String(r.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email) || String(r.enriched_at || "").trim()) continue;
  const domain = email.split("@")[1];
  out.push({ json: { row_number: r.row_number, email, domain, work_email: !FREE.test(domain) } });
  if (out.length >= MAX) break;
}
return out;
