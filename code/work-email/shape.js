// Code node "Shape answer". Combines the found email with its verification status.
const run = $input.first().json;
const prev = $("Build verify request").first().json;
const WORDS = {
  valid: "valid", deliverable: "valid", ok: "valid", safe: "valid", verified: "valid",
  invalid: "invalid", undeliverable: "invalid", bounce: "invalid",
  catchall: "catch_all", catch_all: "catch_all", accept_all: "catch_all", acceptall: "catch_all",
  risky: "risky", unknown: "unknown",
};
function status(r) {
  const f = (r.normalized && r.normalized.fields) || {};
  const res = r.result && typeof r.result === "object" ? r.result : {};
  const data = res.data && typeof res.data === "object" ? res.data : {};
  for (const v of [f.status, f.email_status, res.email_status, res.verdict, res.result, res.status, data.status, data.result]) {
    if (typeof v === "string" && v.trim()) return WORDS[v.trim().toLowerCase()] || "unknown";
  }
  return "unknown";
}
const verifyCost = typeof run.actualCost === "number" ? run.actualCost : 0;
return [{
  json: {
    response: {
      ok: true,
      lead: prev.lead,
      email: prev.email,
      email_status: run.status === "completed" ? status(run) : "unknown",
      verify_run_status: run.status || (run.error && run.error.code) || "error",
      served_by: prev.find_served_by,
      cost_usd: Number((prev.find_cost + verifyCost).toFixed(6)),
    },
  },
}];
