# Daily Google rank check

Every morning at 7, checks where your domain ranks in Google's top 10 for a list of keywords.

## Set up

Open the "Keywords" Code node and edit:

```js
const DOMAIN = "example.com";
const KEYWORDS = ["example keyword one", "example keyword two"];
const GL = "us"; // country
const HL = "en"; // language
```

## What runs

One looot call per keyword: the pinned endpoint `serper-search` at $0.001 per call. It is one provider with a known answer shape (`organic[]` with `link` and `position`), so this workflow does not use fallback. 50 keywords a day is about $1.50 a month.

The idempotency key holds the date and keyword, so a retry the same day is free.

## Output

One item per keyword from "Find positions":

```json
{"keyword": "example keyword one", "domain": "example.com", "position": 2, "url": "https://blog.example.com/post", "top_result": "https://other.test/a", "status": "completed", "cost_usd": 0.001, "checked_at": "2026-10-08T07:00:03.000Z"}
```

`position` is `null` when the domain is not in the top 10. Subdomains count. Add a Google Sheets "Append row" node after "Find positions" to keep a history.
