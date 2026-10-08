// Code node "Build verify request". Reads the find run; if it found an address, builds the
// verification run, otherwise answers right away (a miss or a failed call costs $0).
const MAX_COST_PER_CALL = 0.05;
const MAX_ATTEMPTS = 3;

const run = $input.first().json;
const lead = $("Build find request").first().json.lead;
const cost = typeof run.actualCost === "number" ? run.actualCost : 0;

function findEmail(r) {
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const norm = r.normalized && r.normalized.fields && r.normalized.fields.email;
  if (typeof norm === "string" && re.test(norm)) return norm.match(re)[0];
  const m = JSON.stringify(r.result ?? "").match(re);
  return m ? m[0] : null;
}

if (!run.status) {
  const err = run.error || {};
  return [{ json: { next: "respond", response: { ok: false, lead, error: `${err.code || "error"}: ${err.message || "looot refused the call"}`, top_up_url: run.topUpUrl || null, cost_usd: 0 } } }];
}
if (run.status !== "completed") {
  const terminal = ["failed", "blocked", "stopped"].includes(run.status);
  return [{ json: { next: "respond", response: { ok: terminal ? false : true, lead, email: null, status: run.status, run_id: run.runId, note: terminal ? (run.error && run.error.message) || run.status : "Still running. GET https://api.looot.ai/v1/runs/" + run.runId + " later; it is free to read.", cost_usd: cost } } }];
}
const email = findEmail(run);
if (!email) {
  return [{ json: { next: "respond", response: { ok: true, lead, email: null, note: "No provider found an address.", served_by: run.route && run.route.servedBy || null, cost_usd: cost } } }];
}
return [{
  json: {
    next: "verify",
    lead,
    email,
    find_cost: cost,
    find_served_by: (run.route && run.route.servedBy) || null,
    request: {
      endpointId: "job:people.email.verify",
      input: { email },
      idempotencyKey: ("n8n-email-verify:" + email).toLowerCase().slice(0, 180),
      fallback: { enabled: true, maxAttempts: MAX_ATTEMPTS, maxCostUsd: MAX_COST_PER_CALL },
    },
  },
}];
