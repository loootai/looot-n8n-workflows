// Code node "Check email". Skips free-mail and malformed addresses at $0; otherwise asks looot
// for the person and the company behind a work email (two items, one HTTP node).
// Body: {"email": "jane@example.com"} plus anything else your app sends (kept in the answer).
const MAX_COST_PER_CALL = 0.05;
const MAX_ATTEMPTS = 3;
const FREE_MAIL = ["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "web.de", "mail.com", "yandex.com", "orange.fr", "free.fr"];

const body = $input.first().json.body ?? $input.first().json;
const email = String(body.email ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return [{ json: { next: "respond", response: { ok: false, tier: "skip", reason: "not an email address", cost_usd: 0 } } }];
}
const domain = email.split("@")[1];
if (FREE_MAIL.includes(domain)) {
  return [{ json: { next: "respond", response: { ok: true, email, tier: "skip", reason: "free mail domain, nothing to look up", cost_usd: 0 } } }];
}
const fallback = { enabled: true, maxAttempts: MAX_ATTEMPTS, maxCostUsd: MAX_COST_PER_CALL };
return [
  { json: { next: "run", job: "people.enrich.by-email", email, signup: body, request: { endpointId: "job:people.enrich.by-email", input: { email }, idempotencyKey: "n8n-signup-person:" + email, fallback } } },
  { json: { next: "run", job: "company.enrich", email, signup: body, request: { endpointId: "job:company.enrich", input: { domain }, idempotencyKey: "n8n-signup-company:" + domain, fallback } } },
];
