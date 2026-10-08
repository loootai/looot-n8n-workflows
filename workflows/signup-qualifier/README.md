# Signup qualifier

Call it from your app when someone signs up. It tells you who they are, what company they work for, and whether that company fits your ICP.

```
POST /webhook/looot/signup
{"email": "jane@example.com", "plan": "trial"}
```

Anything else you send (`plan` above) comes back under `signup`, so you can route on it.

## What runs

| Case | looot calls | Cost |
| --- | --- | --- |
| Not an email, or a free-mail domain (gmail.com, outlook.com and so on) | none | $0 |
| Work email | `job:people.enrich.by-email` (10 providers, from $0.0036) and `job:company.enrich` (21 providers, from $0.0019), fallback over 3 each, $0.05 cap each | usually under $0.01, never over $0.10 |

## Scoring

Edit the `ICP` block at the top of the "Score against ICP" node:

| Signal | Points |
| --- | --- |
| Employees between `minEmployees` and `maxEmployees` | 40 |
| Industry contains one of `industries` | 30 |
| Country in `countries` | 15 |
| Title contains one of `seniorTitles` | 15 |

`hot` at 70 or more, `warm` at 40 or more, otherwise `cold`. Every point comes with a line in `reasons`.

## Answer

```json
{
  "ok": true,
  "email": "jane@example.com",
  "tier": "hot",
  "score": 100,
  "reasons": ["150 employees, inside 20-2000", "industry: Computer Software", "country: US", "senior title: Head of Growth"],
  "person": {"name": "Jane Doe", "title": "Head of Growth", "linkedin": "..."},
  "company": {"name": "Example Inc", "industry": "Computer Software", "employees": "150", "country": "US"},
  "signup": {"email": "jane@example.com", "plan": "trial"},
  "cost_usd": 0.006
}
```

Add a Slack or CRM node after "Score against ICP" with an IF on `{{ $json.response.tier }}` to act on hot signups.
