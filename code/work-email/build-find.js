// Code node "Build find request". Reads the webhook body and builds one looot job run.
// Body: {"first_name": "Ada", "last_name": "Lovelace", "domain": "example.com"}
// Also accepts "name" (full name) and "website" or "url" for the domain.
const MAX_COST_PER_CALL = 0.05; // USD cap for this lookup across every provider tried
const MAX_ATTEMPTS = 3;          // providers to try before giving up

const body = $input.first().json.body ?? $input.first().json;
const clean = (v) => (typeof v === "string" ? v.trim() : "");
let first = clean(body.first_name ?? body.firstName);
let last = clean(body.last_name ?? body.lastName);
const full = clean(body.name ?? body.full_name);
if (!first && full) {
  const parts = full.split(/\s+/);
  first = parts[0];
  last = last || parts.slice(1).join(" ");
}
let domain = clean(body.domain ?? body.website ?? body.url).toLowerCase();
domain = domain.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];

if (!first || !last || !domain.includes(".") || /[\s@]/.test(domain)) {
  return [{ json: { next: "respond", response: { ok: false, error: "Send first_name, last_name and domain (or name and website).", cost_usd: 0 } } }];
}

const input = { first_name: first, last_name: last, domain };
const key = ["n8n-email-find", domain, first, last].join(":").toLowerCase().replace(/[^a-z0-9:._-]/g, "-").slice(0, 180);
return [{
  json: {
    next: "find",
    lead: input,
    request: {
      endpointId: "job:people.email.find",
      input,
      idempotencyKey: key,
      fallback: { enabled: true, maxAttempts: MAX_ATTEMPTS, maxCostUsd: MAX_COST_PER_CALL },
    },
  },
}];
