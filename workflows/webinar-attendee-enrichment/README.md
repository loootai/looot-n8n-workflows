# Enrich a webinar or event attendee list in Google Sheets with title, company and LinkedIn using looot

Paste an attendee export into a sheet and run it. looot looks up the person behind each email (name, title, company, LinkedIn) and, for work emails, the company (industry, size, country), then writes each row back.

![Canvas](canvas.png)

_The picture is drawn from `workflow.json`, not taken in n8n._

## Cost

Prices are the cheapest listed in looot's public catalog on 2026-10-31 (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`, no token). looot shows the price of every endpoint before a run, and a failed call costs $0.

| looot call | Price | Calls per run |
| --- | --- | --- |
| `job:people.enrich.by-email` | from $0.0036 | 1 per attendee |
| `job:company.enrich` | $0.0019 | 1 per work email |

Typical: about $0.0055 per work email attendee. Most it can spend in looot calls: $0.10 per attendee (2 calls x $0.05 cap).

## Set up

1. Install the community node [n8n-nodes-looot](https://www.npmjs.com/package/n8n-nodes-looot) 0.1.4, verified by n8n: Settings > Community nodes > Install, search `looot`.
2. Sign up at [looot.ai](https://looot.ai), top up (from $5) and create an agent token with `catalog.read`, `runs.read`, `runs.execute`, `usage.read`. In n8n add a **looot API** credential with it.
3. Import `workflow.json` (Workflows > Import from File) and pick your credentials: looot API, Google Sheets.
4. Create a sheet tab named Attendees with the headers email, full_name, job_title, company, linkedin_url, industry, employees, country, looot_cost_usd, enriched_at, and set the spreadsheet ID in **Read attendees** and **Write back**.

## What was checked

- `npm test`: node types and typeVersions against n8n's source at the n8n@2.44.3 tag and n8n-nodes-looot 0.1.4, connections, no credentials or ids in the JSON, sticky note rules, and every Code node run with fake inputs.
- `npm run check:params`: every parameter name exists in the node's source at that tag.
- Not run end to end in n8n. No live looot, model or destination calls were made.
