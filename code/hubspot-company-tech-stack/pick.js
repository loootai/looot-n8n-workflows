// Code node "Companies without a stack". Recently created or updated companies that have a
// domain and no tech stack yet. Ids already done are remembered (active workflows only).
// @include run-helpers
const PROPERTY = "looot_tech_stack";
const store = typeof $getWorkflowStaticData === "function" ? $getWorkflowStaticData("global") : {};
const done = new Set(Array.isArray(store.doneIds) ? store.doneIds : []);
const val = (p) => (p && typeof p === "object" && "value" in p ? p.value : p);
const out = [];
for (const { json: c } of $input.all()) {
  const props = c.properties || {};
  const id = String(c.companyId ?? c.id ?? "");
  const domain = cleanDomain(val(props.domain) || val(props.website));
  if (!id || !domain || done.has(id) || String(val(props[PROPERTY]) || "").trim()) continue;
  out.push({ json: { companyId: id, domain, name: val(props.name) || "" } });
}
return out.slice(0, 25);
