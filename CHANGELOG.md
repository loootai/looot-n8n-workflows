# Changelog

## 0.3.0

Twenty more workflows on the verified looot node:

- Twelve "one agent, one key" rebuilds of gallery templates that use several data providers: apollo-outreach-agent (139 nodes to 7), linkedin-sheet-outreach-agent, trial-signup-scoring-agent, content-trends-agent, research-report-email-agent, account-brief-notion-agent, maps-leads-outreach-agent, calendly-prep-brief-agent, job-postings-research-agent, seo-content-brief-agent, instagram-content-ideas-agent, youtube-channel-leads-agent.
- Two rebuilds with no agent: hubspot-contact-enrichment, typeform-lead-qualifier.
- Six plain GTM jobs: champion-job-change-alert, funding-news-hubspot-task, ai-visibility-check, weekly-seo-rank-slack, backlink-prospect-finder, webinar-attendee-enrichment.

Node helpers moved to scripts/node-kit.mjs; the new definitions live in scripts/build-node-more.mjs. The 13 existing JSON files are byte for byte unchanged. Typeform Trigger and Calendly Trigger added to the checked node versions. 235 tests. Not run end to end in n8n.

## 0.2.0

Thirteen workflows on the verified looot community node (n8n-nodes-looot 0.1.4):

- Six "one agent, one key" rebuilds of popular gallery templates that use several data providers: google-maps-leads-agent, deep-research-agent, competitor-research-agent, linkedin-lead-enrichment-agent, pre-call-social-brief, post-engagers-to-hubspot.
- Six plain workflows: form-lead-enrichment-hubspot, work-email-to-sheets, competitor-news-slack, hiring-signal-alert, verify-before-instantly, hubspot-company-tech-stack.
- looot-agent, a sub-workflow other workflows call with a task and a cost cap.

No credentials in any JSON. Sticky notes follow n8n's template guidelines. Node versions checked against n8n@2.44.3; parameter names checked with scripts/check-params.mjs. Not run end to end in n8n.

## 0.1.0

First release. Four workflows on core n8n nodes: work-email, company-research, signup-qualifier, google-rank-check. One Header Auth credential, fallback with a cost cap on every job run, idempotent retries. 36 tests.
