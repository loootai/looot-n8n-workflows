// Code node "Build requests". One webhook call in, three looot job runs out (one item each),
// so the single HTTP Request node after this runs all three.
// Body: {"domain": "example.com"} (a URL works too)
const MAX_COST_PER_CALL = 0.05;
const MAX_ATTEMPTS = 3;
const JOBS = ["company.enrich", "company.news", "company.technographics"];

const body = $input.first().json.body ?? $input.first().json;
let domain = String(body.domain ?? body.website ?? body.url ?? "").trim().toLowerCase();
domain = domain.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
if (!domain.includes(".") || /[\s@]/.test(domain)) {
  return [{ json: { next: "respond", response: { ok: false, error: "Send a domain such as example.com.", cost_usd: 0 } } }];
}
// One key per job, domain and day: a retry the same day is free, tomorrow is a fresh lookup.
const day = new Date().toISOString().slice(0, 10);
return JOBS.map((job) => ({
  json: {
    next: "run",
    job,
    domain,
    request: {
      endpointId: "job:" + job,
      input: { domain },
      idempotencyKey: ["n8n-research", job, domain, day].join(":"),
      fallback: { enabled: true, maxAttempts: MAX_ATTEMPTS, maxCostUsd: MAX_COST_PER_CALL },
    },
  },
}));
