# Work email waterfall with verification

Webhook in, work email and its deliverability out.

```
POST /webhook/looot/work-email
{"first_name": "Ada", "last_name": "Lovelace", "domain": "example.com"}
```

Also accepts `name` (full name) and `website` or `url` instead of `domain`.

## What runs

| Step | looot call | Cheapest listed price (2026-10-08) | Cap |
| --- | --- | --- | --- |
| Find | `job:people.email.find`, fallback over up to 3 of its 17 providers | $0.0036 | $0.05 |
| Verify | `job:people.email.verify`, fallback over up to 3 of its 13 providers | $0.00145 | $0.05 |

If no provider finds an address, the workflow answers right away and skips verification. A miss or a failed call costs $0. The most one execution can spend is $0.10.

The idempotency key is built from the domain and name, so the same lead sent twice (a retry, a double submit) returns the first answer and is not charged again.

## Answer

```json
{
  "ok": true,
  "lead": {"first_name": "Ada", "last_name": "Lovelace", "domain": "example.com"},
  "email": "ada@example.com",
  "email_status": "valid",
  "verify_run_status": "completed",
  "served_by": "<provider endpoint id>",
  "cost_usd": 0.0055
}
```

`email_status` is one of `valid`, `invalid`, `catch_all`, `risky`, `unknown`. On a miss, `email` is `null` and `note` says why. When the balance is empty, `error` starts with `insufficient_balance` and `top_up_url` is set.

## Change it

Edit `MAX_COST_PER_CALL` and `MAX_ATTEMPTS` at the top of the two "Build" Code nodes.
