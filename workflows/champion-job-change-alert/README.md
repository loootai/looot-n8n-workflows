# Alert Slack when a customer champion changes jobs, with weekly LinkedIn checks through looot

Every Monday, looot reads the LinkedIn profile of each champion in your sheet. When the current company differs from the sheet, the row is marked moved and Slack gets the new company and profile link.

![Canvas](canvas.png)

_The picture is drawn from `workflow.json`, not taken in n8n._

## Cost

Prices are the cheapest listed in looot's public catalog on 2026-10-31 (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`, no token). looot shows the price of every endpoint before a run, and a failed call costs $0.

| looot call | Price | Calls per run |
| --- | --- | --- |
| `job:linkedin.person.profile` | $0.0012 | 1 per champion |

Typical: about $0.12 a week for 100 champions. Most it can spend in looot calls: $0.05 per champion per week.

## Set up

1. Install the community node [n8n-nodes-looot](https://www.npmjs.com/package/n8n-nodes-looot) 0.1.4, verified by n8n: Settings > Community nodes > Install, search `looot`.
2. Sign up at [looot.ai](https://looot.ai), top up (from $5) and create an agent token with `catalog.read`, `runs.read`, `runs.execute`, `usage.read`. In n8n add a **looot API** credential with it.
3. Import `workflow.json` (Workflows > Import from File) and pick your credentials: looot API, Google Sheets, Slack.
4. Create a sheet tab named Champions with the headers full_name, linkedin_url, company, company_now, title_now, moved, looot_cost_usd, checked_at, and set the channel ID in **Post to Slack**.

## What was checked

- `npm test`: node types and typeVersions against n8n's source at the n8n@2.44.3 tag and n8n-nodes-looot 0.1.4, connections, no credentials or ids in the JSON, sticky note rules, and every Code node run with fake inputs.
- `npm run check:params`: every parameter name exists in the node's source at that tag.
- Not run end to end in n8n. No live looot, model or destination calls were made.
