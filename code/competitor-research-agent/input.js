// Code node "Your company". Edit the three values below, then run the workflow.
const YOUR_COMPANY_DOMAIN = "example.com";
// Leave empty and the agent finds competitors itself, or list domains to research only those.
const COMPETITORS = [];
const MAX_COMPETITORS = 3;

const clean = (v) => String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
const domain = clean(YOUR_COMPANY_DOMAIN);
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("Set YOUR_COMPANY_DOMAIN in the Your company node, for example acme.com");
return [{
  json: {
    domain,
    competitors: COMPETITORS.map(clean).filter(Boolean).slice(0, MAX_COMPETITORS),
    max_competitors: Math.max(1, Math.min(5, MAX_COMPETITORS)),
  },
}];
