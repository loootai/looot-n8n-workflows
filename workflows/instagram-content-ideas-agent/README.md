# Turn the best recent posts of Instagram accounts into content ideas with one AI agent and looot

Every Monday, one AI agent reads the recent posts of the Instagram accounts you list, picks the ones with the most engagement, searches the web for context and writes adapted ideas into Google Sheets.

![Canvas](canvas.png)

_The picture is drawn from `workflow.json`, not taken in n8n._

## Before and after

This rebuilds [Automate Instagram content discovery & repurposing w/ Apify, GPT-4o & Perplexity](https://n8n.io/workflows/4658) by Nick Saraev (12,836 views on n8n.io on 2026-10-31) with one AI agent and looot as its only data tool. Counts come from each workflow's JSON; sticky notes are not counted.

| | Original | This version |
| --- | --- | --- |
| Nodes | 12 | 8 |
| Data API accounts | 2 (Apify, Perplexity) | 1 (looot) |
| Accounts to set up in total | 4 (Apify, Google, OpenAI, Perplexity) | 3 (looot API, OpenAI, Google Sheets) |
| Cost cap per data call | none set in the JSON | $0.03 (Max Cost on the looot node) |

The original reads handles from a sheet, scrapes them through Apify and researches with Perplexity. This rebuild keeps the handles in a Code node and writes ideas, not full scripts.

## Cost

Prices are the cheapest listed in looot's public catalog on 2026-10-31 (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`, no token). looot shows the price of every endpoint before a run, and a failed call costs $0.

| looot call | Price | Calls per run |
| --- | --- | --- |
| `job:instagram.user.posts` | $0.00188 | 1 per account |
| `job:web.search` | from $0 per result | up to 5 |

Typical: about $0.01 for 3 accounts. Most it can spend in looot calls: $0.60 (20 agent steps x $0.03 cap). Model tokens are billed by your model provider.

## Set up

1. Install the community node [n8n-nodes-looot](https://www.npmjs.com/package/n8n-nodes-looot) 0.1.4, verified by n8n: Settings > Community nodes > Install, search `looot`. On self-hosted n8n with an AI agent, also set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.
2. Sign up at [looot.ai](https://looot.ai), top up (from $5) and create an agent token with `catalog.read`, `runs.read`, `runs.execute`, `usage.read`. In n8n add a **looot API** credential with it.
3. Import `workflow.json` (Workflows > Import from File) and pick your credentials: looot API, OpenAI, Google Sheets.
4. Create a sheet tab named Ideas with the headers week, source_handle, post_url, likes, comments, why_it_worked, idea, hook, cost_usd, set its ID in **Save ideas**, and edit the handles in **Accounts to watch**.

## What was checked

- `npm test`: node types and typeVersions against n8n's source at the n8n@2.44.3 tag and n8n-nodes-looot 0.1.4, connections, no credentials or ids in the JSON, sticky note rules, and every Code node run with fake inputs.
- `npm run check:params`: every parameter name exists in the node's source at that tag.
- Not run end to end in n8n. No live looot, model or destination calls were made.
