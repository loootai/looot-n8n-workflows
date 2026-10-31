# Find companies hiring for a role and research each one with one AI agent and looot into Google Sheets

A form takes a job title, a location, a count and your offer. One AI agent searches job postings, finds each hiring company's domain, pulls company data and reads the homepage, then each posting lands in Google Sheets with a reason to call.

![Canvas](canvas.png)

_The picture is drawn from `workflow.json`, not taken in n8n._

## Before and after

This rebuilds [Indeed job scraper with AI filtering & company research using Apify and Tavily](https://n8n.io/workflows/6076) by Adrian Bent (3,568 views on n8n.io on 2026-10-31) with one AI agent and looot as its only data tool. Counts come from each workflow's JSON; sticky notes are not counted.

| | Original | This version |
| --- | --- | --- |
| Nodes | 18 | 7 |
| Data API accounts | 2 (Apify, Tavily) | 1 (looot) |
| Accounts to set up in total | 4 (Apify, Google, OpenAI, Tavily) | 3 (looot API, OpenAI, Google Sheets) |
| Cost cap per data call | none set in the JSON | $0.03 (Max Cost on the looot node) |

The original scrapes Indeed through Apify and researches companies with Tavily. looot's job search covers LinkedIn and other boards, not Indeed, so the postings can differ.

## Cost

Prices are the cheapest listed in looot's public catalog on 2026-10-31 (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`, no token). looot shows the price of every endpoint before a run, and a failed call costs $0.

| looot call | Price | Calls per run |
| --- | --- | --- |
| `job:jobs.search` | from $0.0005 per call | 1 to 2 |
| `job:google.serp.organic` | $0.0009 to $0.001 | 1 per company |
| `job:company.enrich` | $0.0019 | 1 per company |
| `job:web.scrape.markdown` | from $0.0002 per page | 1 per company |

Typical: about $0.04 for 10 postings. Most it can spend in looot calls: $1.20 (40 agent steps x $0.03 cap). Model tokens are billed by your model provider.

## Set up

1. Install the community node [n8n-nodes-looot](https://www.npmjs.com/package/n8n-nodes-looot) 0.1.4, verified by n8n: Settings > Community nodes > Install, search `looot`. On self-hosted n8n with an AI agent, also set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.
2. Sign up at [looot.ai](https://looot.ai), top up (from $5) and create an agent token with `catalog.read`, `runs.read`, `runs.execute`, `usage.read`. In n8n add a **looot API** credential with it.
3. Import `workflow.json` (Workflows > Import from File) and pick your credentials: looot API, OpenAI, Google Sheets.
4. Create a sheet tab named Postings with the headers job_title, company, company_domain, location, job_url, company_size, industry, company_summary, why_relevant, search, found_at, cost_usd, and set its ID in **Save postings**.

## What was checked

- `npm test`: node types and typeVersions against n8n's source at the n8n@2.44.3 tag and n8n-nodes-looot 0.1.4, connections, no credentials or ids in the JSON, sticky note rules, and every Code node run with fake inputs.
- `npm run check:params`: every parameter name exists in the node's source at that tag.
- Not run end to end in n8n. No live looot, model or destination calls were made.
