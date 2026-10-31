// Code node "Contacts to enrich". Work emails with no job title yet, at most MAX per run. Contacts
// already tried are remembered in the workflow's static data (active workflows only).
const MAX = 25;
const FREE = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|gmx|mail|yandex|zoho)\./i;
const store = typeof $getWorkflowStaticData === "function" ? $getWorkflowStaticData("global") : {};
const done = new Set(Array.isArray(store.tried) ? store.tried : []);
const val = (c, k) => {
  const p = (c.properties || {})[k];
  return String((p && typeof p === "object" ? p.value : p) || c[k] || "").trim();
};
const out = [];
for (const { json: c } of $input.all()) {
  const email = val(c, "email").toLowerCase();
  const domain = email.split("@")[1] || "";
  if (!email.includes("@") || FREE.test(domain) || val(c, "jobtitle") || done.has(email)) continue;
  done.add(email);
  out.push({ json: { email, contact_id: String(c.vid || c.id || "") } });
  if (out.length >= MAX) break;
}
store.tried = [...done].slice(-5000);
return out;
