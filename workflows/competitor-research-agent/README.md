# Research your competitors with one AI agent and looot and save a page per competitor in Notion

Set your domain. One AI agent finds your closest competitors (or takes your list), researches each one and writes a Notion page per competitor.

![Canvas](canvas.png)

_The picture is drawn from `workflow.json`, not taken in n8n._

## Before and after

This rebuilds [Automate competitor research with Exa.ai, Notion and AI agents](https://n8n.io/workflows/2354) by Jimleuk (29,279 views on n8n.io on 2026-10-31) with one AI agent and looot as its only data tool. Counts come from each workflow's JSON; sticky notes are not counted.

| | Original | This version |
| --- | --- | --- |
| Nodes | 30 | 8 |
| Data API accounts | 3 (Exa, Firecrawl, SerpAPI) | 1 (looot) |
| Accounts to set up in total | 5 (Exa, Firecrawl, Notion, OpenAI, SerpAPI) | 3 (looot API, OpenAI, Notion) |
| Cost cap per data call | none set in the JSON | $0.03 (Max Cost on the looot node) |

The original uses Exa's find-similar to discover competitors and three agents. This rebuild discovers them with a Google search from your homepage text, so the competitor list can differ.

## Cost

Prices are the cheapest listed in looot's public catalog on 2026-10-31 (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`, no token). looot shows the price of every endpoint before a run, and a failed call costs $0.

| looot call | Price | Calls per run |
| --- | --- | --- |
| `job:company.enrich` | $0.0019 | 1 per competitor |
| `job:web.scrape.markdown` | from $0.0002 per page | 2 to 3 per competitor |
| `job:news.search` | $0.001 | 1 per competitor |
| `job:google.serp.organic` | $0.0009 to $0.001 | 1 to 2 per competitor |

Typical: about $0.02 for 3 competitors. Most one run can spend in looot calls: $1.20 (40 agent steps x $0.03 cap). Model tokens are billed by your model provider.

## Set up

1. Install the community node [n8n-nodes-looot](https://www.npmjs.com/package/n8n-nodes-looot) 0.1.4, verified by n8n: Settings > Community nodes > Install, search `looot`. On self-hosted n8n with an AI agent, also set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.
2. Sign up at [looot.ai](https://looot.ai), top up (from $5) and create an agent token with `catalog.read`, `runs.read`, `runs.execute`, `usage.read`. In n8n add a **looot API** credential with it.
3. Import `workflow.json` (Workflows > Import from File) and pick your credentials: looot API, OpenAI, Notion.
4. Share a Notion database with your integration (it needs a Name title property) and set its ID in **Save to Notion**. Edit **Your company**.

## What was checked

- `npm test`: node types and typeVersions against n8n's source at the n8n@2.44.3 tag and n8n-nodes-looot 0.1.4, connections, no credentials or ids in the JSON, sticky note rules, and every Code node run with fake inputs.
- `npm run check:params`: every parameter name exists in the node's source at that tag.
- Not run end to end in n8n. No live looot, model or destination calls were made.
