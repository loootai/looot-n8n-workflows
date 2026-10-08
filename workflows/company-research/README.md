# Company research card

Webhook in, one JSON card about a company out: firmographics, recent news, tech stack.

```
POST /webhook/looot/company-research
{"domain": "example.com"}
```

## What runs

One HTTP Request node runs three looot jobs (one item each):

| Job | Providers behind it | Cheapest listed price (2026-10-08) | Cap |
| --- | --- | --- | --- |
| `company.enrich` | 21 | $0.0019 | $0.05 |
| `company.news` | 4 | $0.000033 | $0.05 |
| `company.technographics` | 5 | $0 on some providers | $0.05 |

Each job falls back over up to 3 providers. The most one card can cost is $0.15; the usual cost is well under a cent. A job that fails costs $0 and the card still comes back with the other two parts.

The idempotency key holds the job, the domain and the date, so asking twice on the same day is free and tomorrow is a fresh lookup.

## Answer

```json
{
  "ok": true,
  "domain": "example.com",
  "company": {"name": "...", "industry": "...", "employees": "120", "country": "US", "linkedin": "...", "description": "..."},
  "news": [{"title": "...", "url": "...", "date": "2026-10-01"}],
  "tech": ["Next.js", "Stripe"],
  "runs": {"company.enrich": "completed", "company.news": "completed", "company.technographics": "failed"},
  "cost_usd": 0.0021
}
```

Providers answer in their own shapes. The "Build card" node searches each answer for common key names; if a field you need is empty, open the run in the execution log and add its key name to the list in that node.
