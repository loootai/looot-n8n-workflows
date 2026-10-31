// Shared helpers for reading a looot run item. The looot node returns the run as the item:
// {runId, status, result, normalized: {fields}, actualCost, route: {servedBy}, error, topUpUrl}.
// With "On Error: Continue", a refused call (402 empty balance, 400 bad input) arrives as {error: "..."}.
function runCost(run) {
  return run && typeof run.actualCost === "number" ? run.actualCost : 0;
}
function runProblem(run) {
  if (!run || typeof run !== "object") return "no answer";
  if (!run.status) {
    const e = run.error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object") return [e.code, e.message].filter(Boolean).join(": ") || "error";
    return "error";
  }
  if (run.status !== "completed") return (run.error && run.error.message) || run.status;
  return null;
}
function squash(k) {
  return String(k).toLowerCase().replace(/[\s_\-.]/g, "");
}
// First string or number under any of `keys`, searched a few levels deep.
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
// First array (a few levels deep) that has an element passing `test`.
function firstArray(src, test, depth = 0) {
  if (!src || typeof src !== "object" || depth > 4) return [];
  if (Array.isArray(src) && src.some(test)) return src;
  for (const v of Object.values(src)) { const r = firstArray(v, test, depth + 1); if (r.length) return r; }
  return [];
}
function runFields(run) {
  return { n: (run && run.normalized && run.normalized.fields) || {}, r: run && run.result };
}
function findEmail(run) {
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const norm = run && run.normalized && run.normalized.fields && run.normalized.fields.email;
  if (typeof norm === "string" && re.test(norm)) return norm.match(re)[0].toLowerCase();
  const m = JSON.stringify((run && run.result) ?? "").match(re);
  return m ? m[0].toLowerCase() : null;
}
// Maps the many verifier vocabularies onto valid / invalid / catch_all / risky / unknown.
function emailStatus(run) {
  const raw = find(runFields(run), ["status", "result", "verdict", "state", "deliverability", "email_status"]).toLowerCase();
  if (/catch.?all|accept.?all/.test(raw)) return "catch_all";
  if (/^(valid|deliverable|ok|safe|verified)$/.test(raw)) return "valid";
  if (/invalid|undeliverable|bounce|bad|disposable|not.?found/.test(raw)) return "invalid";
  if (/risky|unknown_risky|accept/.test(raw)) return "risky";
  return "unknown";
}
function cleanDomain(v) {
  const s = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : "";
}
