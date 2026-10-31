# Changelog

## 0.2.0

Thirteen workflows on the verified looot community node (n8n-nodes-looot 0.1.4):

- Six "one agent, one key" rebuilds of popular gallery templates that use several data providers: google-maps-leads-agent, deep-research-agent, competitor-research-agent, linkedin-lead-enrichment-agent, pre-call-social-brief, post-engagers-to-hubspot.
- Six plain workflows: form-lead-enrichment-hubspot, work-email-to-sheets, competitor-news-slack, hiring-signal-alert, verify-before-instantly, hubspot-company-tech-stack.
- looot-agent, a sub-workflow other workflows call with a task and a cost cap.

No credentials in any JSON. Sticky notes follow n8n's template guidelines. Node versions checked against n8n@2.44.3; parameter names checked with scripts/check-params.mjs. Not run end to end in n8n.

## 0.1.0

First release. Four workflows on core n8n nodes: work-email, company-research, signup-qualifier, google-rank-check. One Header Auth credential, fallback with a cost cap on every job run, idempotent retries. 36 tests.
