# Turn people who engage with a LinkedIn post into HubSpot contacts with one AI agent and looot

Paste a LinkedIn post URL. One AI agent reads the comments and reactions, keeps people who match your buyer, finds and verifies their work emails and creates HubSpot contacts.

![Canvas](canvas.png)

_The picture is drawn from `workflow.json`, not taken in n8n._

## Before and after

This rebuilds [Create HubSpot contacts from LinkedIn post interactions](https://n8n.io/workflows/1323) by Pauline (7,387 views on n8n.io on 2026-10-31) with one AI agent and looot as its only data tool. Counts come from each workflow's JSON; sticky notes are not counted.

| | Original | This version |
| --- | --- | --- |
| Nodes | 16 | 7 |
| Data API accounts | 2 (Dropcontact, PhantomBuster) | 1 (looot) |
| Accounts to set up in total | 5 (Airtable, Dropcontact, HubSpot, PhantomBuster, lemlist) | 3 (looot API, OpenAI, HubSpot) |
| Cost cap per data call | none set in the JSON | $0.03 (Max Cost on the looot node) |

Smaller than the original. The original also stores contacts in Airtable, starts a lemlist sequence and runs on a schedule. This rebuild covers the data part (engagers to verified emails) and the HubSpot write. It adds an LLM, which the original does not use.

## Cost

Prices are the cheapest listed in looot's public catalog on 2026-10-31 (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`, no token). looot shows the price of every endpoint before a run, and a failed call costs $0.

| looot call | Price | Calls per run |
| --- | --- | --- |
| `fetchin-post-comments` | $0.0015 per page | 1 |
| `fetchin-post-reactions` | $0.0015 per page | 1 |
| `job:linkedin.person.profile` | $0.0012 | 0 to 1 per person |
| `job:people.email.find` | from $0.0036 | 1 per person |
| `job:people.email.verify` | $0.00145 | 1 per email found |

Typical: about $0.13 for 25 people. Most one run can spend in looot calls: $2.40 (80 agent steps x $0.03 cap). Model tokens are billed by your model provider.

## Set up

1. Install the community node [n8n-nodes-looot](https://www.npmjs.com/package/n8n-nodes-looot) 0.1.4, verified by n8n: Settings > Community nodes > Install, search `looot`. On self-hosted n8n with an AI agent, also set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.
2. Sign up at [looot.ai](https://looot.ai), top up (from $5) and create an agent token with `catalog.read`, `runs.read`, `runs.execute`, `usage.read`. In n8n add a **looot API** credential with it.
3. Import `workflow.json` (Workflows > Import from File) and pick your credentials: looot API, OpenAI, HubSpot (private app token).
4. Edit the ICP line in the agent's system message.

## What was checked

- `npm test`: node types and typeVersions against n8n's source at the n8n@2.44.3 tag and n8n-nodes-looot 0.1.4, connections, no credentials or ids in the JSON, sticky note rules, and every Code node run with fake inputs.
- `npm run check:params`: every parameter name exists in the node's source at that tag.
- Not run end to end in n8n. No live looot, model or destination calls were made.
