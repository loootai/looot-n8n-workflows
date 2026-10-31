# Find YouTube channels in a niche and their verified contact emails with one AI agent and looot

A form takes a niche, a count and a subscriber floor. One AI agent searches YouTube, reads each channel's details and website, verifies the contact email, and the channels land in Google Sheets.

![Canvas](canvas.png)

_The picture is drawn from `workflow.json`, not taken in n8n._

## Before and after

This rebuilds [Automated YouTube channel lead generation & email outreach with Apify and ZeroBounce](https://n8n.io/workflows/4582) by Yaron Been (2,421 views on n8n.io on 2026-10-31) with one AI agent and looot as its only data tool. Counts come from each workflow's JSON; sticky notes are not counted.

| | Original | This version |
| --- | --- | --- |
| Nodes | 10 | 7 |
| Data API accounts | 2 (Apify, ZeroBounce) | 1 (looot) |
| Accounts to set up in total | 3 (Apify, Google, ZeroBounce) | 3 (looot API, OpenAI, Google Sheets) |
| Cost cap per data call | none set in the JSON | $0.03 (Max Cost on the looot node) |

The original scrapes one channel's email through Apify, verifies it with ZeroBounce and sends a Gmail. This rebuild finds many channels in a niche and saves them for review; it sends nothing and adds an LLM the original does not have, so the account count stays at 3.

## Cost

Prices are the cheapest listed in looot's public catalog on 2026-10-31 (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`, no token). looot shows the price of every endpoint before a run, and a failed call costs $0.

| looot call | Price | Calls per run |
| --- | --- | --- |
| `job:youtube.search` | $0.00188 | 1 to 2 |
| `job:youtube.channel` | $0.00188 | 1 per channel |
| `job:web.scrape.markdown` | from $0.0002 per page | 0 to 1 per channel |
| `job:people.email.verify` | $0.00145 | 1 per email found |

Typical: about $0.04 for 10 channels. Most it can spend in looot calls: $1.50 (50 agent steps x $0.03 cap). Model tokens are billed by your model provider.

## Set up

1. Install the community node [n8n-nodes-looot](https://www.npmjs.com/package/n8n-nodes-looot) 0.1.4, verified by n8n: Settings > Community nodes > Install, search `looot`. On self-hosted n8n with an AI agent, also set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.
2. Sign up at [looot.ai](https://looot.ai), top up (from $5) and create an agent token with `catalog.read`, `runs.read`, `runs.execute`, `usage.read`. In n8n add a **looot API** credential with it.
3. Import `workflow.json` (Workflows > Import from File) and pick your credentials: looot API, OpenAI, Google Sheets.
4. Create a sheet tab named Channels with the headers channel_name, channel_url, subscribers, country, website, email, email_status, about, niche, found_at, run_cost_usd, and set its ID in **Save channels**.

## What was checked

- `npm test`: node types and typeVersions against n8n's source at the n8n@2.44.3 tag and n8n-nodes-looot 0.1.4, connections, no credentials or ids in the JSON, sticky note rules, and every Code node run with fake inputs.
- `npm run check:params`: every parameter name exists in the node's source at that tag.
- Not run end to end in n8n. No live looot, model or destination calls were made.
