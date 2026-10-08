<p align="center"><img src="assets/hero.png" alt="looot-n8n-workflows: n8n workflows for GTM data, no community node" width="100%"></p>

# looot-n8n-workflows

[![License](https://img.shields.io/github/license/loootai/looot-n8n-workflows)](LICENSE) [![Release](https://img.shields.io/github/v/release/loootai/looot-n8n-workflows)](https://github.com/loootai/looot-n8n-workflows/releases) [![Docs](https://img.shields.io/badge/docs-docs.looot.ai-12A06A)](https://docs.looot.ai)

Four n8n workflows for GTM data. Import the JSON, create one credential, done. They use only n8n's built-in nodes (Webhook, HTTP Request, Code, IF, Respond to Webhook, Schedule), so they run on n8n Cloud and on any self-hosted n8n without installing a community node.

Every data call goes to [looot](https://looot.ai): one token and one prepaid balance for 2,500+ data API endpoints from 90+ providers. A looot job run tries the next provider for the same job when one misses, inside a cost cap you set, and charges only for attempts that ran. A failed call costs $0.

| Workflow | In | Out | Usual cost | Most it can cost |
| --- | --- | --- | --- | --- |
| [work-email](workflows/work-email) | first name, last name, domain | work email + valid / invalid / catch_all / risky | about half a cent | $0.10 |
| [company-research](workflows/company-research) | domain | company card: size, industry, country, news, tech stack | under a cent | $0.15 |
| [signup-qualifier](workflows/signup-qualifier) | a new signup's email | person, company, ICP score, hot / warm / cold | under a cent, $0 for free mail | $0.10 |
| [google-rank-check](workflows/google-rank-check) | your domain + keywords, daily | position in Google's top 10 per keyword | $0.001 per keyword | $0.001 per keyword |

Prices are the cheapest listed on 2026-10-08 in looot's public catalog: https://api.looot.ai/v1/catalog/overview?depth=jobs (free, no token).

## Set up (5 minutes)

1. Sign up at https://looot.ai, top up (from $5), and create an agent token with the scopes `catalog.read`, `runs.read`, `runs.execute` and `usage.read`.
2. In n8n: **Credentials > Add credential > Header Auth**. Name it `looot API`. Header name `Authorization`, value `Bearer <your token>`.
3. Download a `workflow.json` from [workflows/](workflows), then in n8n: **Workflows > Import from File**. Open each "HTTP Request" node that says looot and pick the `looot API` credential if n8n did not match it.
4. Activate the workflow and call the production webhook URL, for example:

```bash
curl -X POST https://<your-n8n>/webhook/looot/work-email \
  -H 'content-type: application/json' \
  -d '{"first_name":"Ada","last_name":"Lovelace","domain":"example.com"}'
```

## How each looot call looks

Every HTTP Request node sends the same shape, built by the Code node before it:

```
POST https://api.looot.ai/v1/runs?wait=60
Authorization: Bearer <token>            (from the Header Auth credential)
{
  "endpointId": "job:people.email.find",
  "input": {"first_name": "Ada", "last_name": "Lovelace", "domain": "example.com"},
  "idempotencyKey": "n8n-email-find:example.com:ada:lovelace",
  "fallback": {"enabled": true, "maxAttempts": 3, "maxCostUsd": 0.05}
}
```

- `fallback`: if the first provider misses or errors, looot tries the next one for the same job. `maxCostUsd` caps the whole walk.
- `idempotencyKey`: the same key with the same body returns the first run, so n8n retries and double submits are not charged twice.
- The node is set to never throw on a 4xx, so a 402 (balance empty) reaches the next Code node, which answers with the error and the top-up link instead of failing the execution.

## Why this is different

The usual DIY setup for these jobs in n8n is a chain of separate services: an email finder account, one or two verification services, a company data API, a SERP API. Each needs its own credential in n8n, has its own credit system and free-tier limit, and when one runs dry you rewire the workflow to the next one by hand. A run's cost shows up afterwards in several dashboards.

Here:

- One credential for every workflow. Each job has 4 to 21 providers behind it today.
- The fallback between providers happens inside one looot call, so the workflow has no branch per vendor.
- Each call carries a cost cap, and each README states the most one execution can spend.
- Failed calls and misses are free, and retries with the same key are not charged twice.
- Only core nodes, so nothing to install and nothing to approve on n8n Cloud.

What it does not do: free tiers are $0 and looot is not, so a few hundred lookups a month on free tiers is cheaper if you do not mind juggling accounts. Calls go through looot's servers. If you prefer a dedicated node with operation menus, see [n8n-nodes-looot](https://github.com/loootai/n8n-nodes-looot).

## Edit and test

The Code node sources live in [code/](code) and the workflow graphs in [scripts/build.mjs](scripts/build.mjs). The JSON files are built from them:

```bash
npm run build   # writes workflows/*/workflow.json
npm test        # 36 tests: node types and versions checked against n8n's source,
                # connections, credentials, and every Code node run with fake inputs
npm run scan    # leak scan, also a pre-commit hook: git config core.hooksPath .githooks
```

`test/n8n-node-versions.json` lists the node types and typeVersions n8n ships, read from n8n's source at a fixed commit. Refresh it with `node scripts/fetch-node-versions.mjs`. Node versions used: Webhook 2, HTTP Request 4.2, Code 2, IF 2, Respond to Webhook 1.1, Schedule Trigger 1.2, Manual Trigger 1.

No dependencies. Node 20 or newer for the tests.

## Related

- [n8n-nodes-looot](https://github.com/loootai/n8n-nodes-looot): looot as an n8n community node.
- [looot-csv-enrich](https://github.com/loootai/looot-csv-enrich): the same jobs over a whole CSV from the terminal, quote first.
- [awesome-gtm](https://github.com/loootai/awesome-gtm): open-source GTM tools.

## License

MIT, copyright looot.
