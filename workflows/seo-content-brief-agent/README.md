# Write an SEO content brief from live Google results with one AI agent and looot into Notion

A form takes a keyword and a country. One AI agent reads Google's results and autocomplete suggestions for it, reads the top ranking pages, and writes a content brief as a Notion page.

![Canvas](canvas.png)

_The picture is drawn from `workflow.json`, not taken in n8n._

## Before and after

This rebuilds [Generate SEO content briefs with GPT-4o, DataForSEO keyword research & SERP analysis](https://n8n.io/workflows/10829) by Rahul Joshi (738 views on n8n.io on 2026-10-31) with one AI agent and looot as its only data tool. Counts come from each workflow's JSON; sticky notes are not counted.

| | Original | This version |
| --- | --- | --- |
| Nodes | 14 | 6 |
| Data API accounts | 2 (DataForSEO, SerpAPI) | 1 (looot) |
| Accounts to set up in total | 5 (DataForSEO, Google, OpenAI, SerpAPI, Slack) | 3 (looot API, OpenAI, Notion) |
| Cost cap per data call | none set in the JSON | $0.03 (Max Cost on the looot node) |

The original pulls search volume from DataForSEO and logs briefs to a sheet and Slack. looot's keyword volume job is above this template's $0.03 cap, so the brief has related keywords from autocomplete but no volume numbers.

## Cost

Prices are the cheapest listed in looot's public catalog on 2026-10-31 (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`, no token). looot shows the price of every endpoint before a run, and a failed call costs $0.

| looot call | Price | Calls per run |
| --- | --- | --- |
| `job:google.serp.organic` | $0.0009 to $0.001 | 1 |
| `job:google.keywords.suggestions` | $0.00099 | 1 |
| `job:web.scrape.markdown` | from $0.0002 per page | 3 to 5 |

Typical: about $0.004 per brief. Most it can spend in looot calls: $0.45 (15 agent steps x $0.03 cap). Model tokens are billed by your model provider.

## Set up

1. Install the community node [n8n-nodes-looot](https://www.npmjs.com/package/n8n-nodes-looot) 0.1.4, verified by n8n: Settings > Community nodes > Install, search `looot`. On self-hosted n8n with an AI agent, also set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.
2. Sign up at [looot.ai](https://looot.ai), top up (from $5) and create an agent token with `catalog.read`, `runs.read`, `runs.execute`, `usage.read`. In n8n add a **looot API** credential with it.
3. Import `workflow.json` (Workflows > Import from File) and pick your credentials: looot API, OpenAI, Notion.
4. Share a Notion database with your integration (it needs a Name title property) and set its ID in **Save to Notion**.

## What was checked

- `npm test`: node types and typeVersions against n8n's source at the n8n@2.44.3 tag and n8n-nodes-looot 0.1.4, connections, no credentials or ids in the JSON, sticky note rules, and every Code node run with fake inputs.
- `npm run check:params`: every parameter name exists in the node's source at that tag.
- Not run end to end in n8n. No live looot, model or destination calls were made.
