// Runs the Code nodes of the workflows added in 0.3.0 with fake inputs shaped like n8n's.
// No network, no money. Agent items carry intermediateSteps the way the AI Agent node returns them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCode } from "./harness.mjs";

const root = new URL("..", import.meta.url).pathname;
const src = (wf, node) => {
  const json = JSON.parse(readFileSync(`${root}workflows/${wf}/workflow.json`, "utf8"));
  const n = json.nodes.find((x) => x.name === node);
  if (!n) throw new Error(`${wf}: no node ${node}`);
  return n.parameters.jsCode;
};
const step = (tool, observation) => ({ action: { tool, toolInput: {} }, observation });
const steps = [
  step("looot", JSON.stringify([{ runId: "r1", status: "completed", actualCost: 0.001, result: {} }])),
  step("looot", JSON.stringify([{ runId: "r2", status: "completed", actualCost: 0.0002 }])),
];
const ok = (result, cost = 0.001) => ({ status: "completed", actualCost: cost, result });

test("apollo-outreach-agent: only valid emails reach Instantly, with the first line", async () => {
  const leads = [
    { first_name: "Ada", email: "Ada@Example.com", email_status: "valid", company: "Example", first_line: "Hi." }, // leak-scan:allow, mixed case on purpose
    { first_name: "Cat", email: "c@example.com", email_status: "catch_all" },
    { first_name: "None", email: "" },
  ];
  const rows = await runCode(src("apollo-outreach-agent", "Valid leads only"), { input: [{ output: { leads }, intermediateSteps: steps }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "ada@example.com");
  assert.equal(rows[0].company_name, "Example");
  assert.equal(rows[0].first_line, "Hi.");
  assert.equal(rows[0].run_cost_usd, 0.0012);
});

test("trial-signup-scoring-agent: free mail flagged, score routes to hot", async () => {
  const [free] = await runCode(src("trial-signup-scoring-agent", "Read the signup"), { input: [{ body: { email: "x@gmail.com" } }] }); // leak-scan:allow, a free-mail address the node must flag
  assert.equal(free.work_email, false);
  const [work] = await runCode(src("trial-signup-scoring-agent", "Read the signup"), { input: [{ body: { email: " Ada@Example.com ", name: "Ada" } }] }); // leak-scan:allow, mixed case on purpose
  assert.equal(work.domain, "example.com");
  assert.equal(work.work_email, true);
  const [hot] = await runCode(src("trial-signup-scoring-agent", "Score and route"), {
    input: [{ output: { fit_score: 82, company: "Example", reason: "Fits." }, intermediateSteps: steps }],
    nodes: { "Read the signup": [work] },
  });
  assert.equal(hot.tier, "hot");
  assert.equal(hot.hot, true);
  assert.match(hot.text, /New hot signup\* \(82\/100\)/);
  const [cold] = await runCode(src("trial-signup-scoring-agent", "Score and route"), { input: [{ output: { fit_score: "nope" } }], nodes: { "Read the signup": [work] } });
  assert.equal(cold.tier, "cold");
});

test("linkedin-sheet-outreach-agent: picks open rows, pairs answers with rows", async () => {
  const rows = [
    { row_number: 2, linkedin_url: "https://www.linkedin.com/in/ada?utm=x" },
    { row_number: 3, linkedin_url: "https://www.linkedin.com/in/done", status: "done" },
    { row_number: 4, linkedin_url: "https://example.com/not-linkedin" },
  ];
  const picked = await runCode(src("linkedin-sheet-outreach-agent", "Rows to enrich"), { input: rows });
  assert.deepEqual(picked.map((p) => p.row_number), [2]);
  assert.equal(picked[0].linkedin_url, "https://www.linkedin.com/in/ada");
  const [row] = await runCode(src("linkedin-sheet-outreach-agent", "Row to write"), {
    input: [{ output: { full_name: "Ada", email: "Ada@example.com", email_status: "valid", message: "Hello." }, intermediateSteps: steps }],
    nodes: { "Rows to enrich": picked },
  });
  assert.equal(row.row_number, 2);
  assert.equal(row.email, "ada@example.com");
  assert.equal(row.status, "done");
  assert.equal(row.looot_cost_usd, 0.0012);
});

test("job-postings-research-agent: one row per posting with a cost share", async () => {
  const rows = await runCode(src("job-postings-research-agent", "Postings to rows"), {
    input: [{ output: { postings: [{ job_title: "RevOps", company: "A" }, { job_title: "SDR", company: "B" }, { company: "no title" }] }, intermediateSteps: steps }],
    nodes: { "Job search form": [{ "Job title": "RevOps", Location: "US" }] },
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].search, "RevOps in US");
  assert.equal(rows[0].cost_usd, 0.0006);
});

test("maps-leads-outreach-agent: rows keep the opener, missing email is not_found", async () => {
  const rows = await runCode(src("maps-leads-outreach-agent", "Leads to rows"), {
    input: [{ output: { leads: [{ name: "Clinic", opener: "Two sentences." }, { address: "no name" }] } }],
    nodes: { "Lead search form": [{ "Business type": "clinics", "City or area": "Leeds" }] },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email_status, "not_found");
  assert.equal(rows[0].opener, "Two sentences.");
});

test("research-report-email-agent: markdown to escaped HTML with a cost line", async () => {
  const [mail] = await runCode(src("research-report-email-agent", "Build the email"), {
    input: [{ output: "# Title\n- **Point** <script>\n[Source](https://example.com/a)", intermediateSteps: steps }],
    nodes: { "Report form": [{ Topic: "Sales tools", "Send the report to": "you@example.com" }] },
  });
  assert.equal(mail.to, "you@example.com");
  assert.equal(mail.subject, "Research report: Sales tools");
  assert.match(mail.html, /<h2>Title<\/h2>/);
  assert.match(mail.html, /<li><b>Point<\/b> &lt;script&gt;<\/li>/);
  assert.match(mail.html, /<a href="https:\/\/example\.com\/a">Source<\/a>/);
  assert.match(mail.html, /2 looot calls, data cost \$0\.0012/);
});

test("youtube-channel-leads-agent: drops channels under the subscriber floor", async () => {
  const rows = await runCode(src("youtube-channel-leads-agent", "Channels to rows"), {
    input: [{ output: { channels: [{ channel_name: "Big", subscribers: 9000, email: "A@example.com", email_status: "valid" }, { channel_name: "Small", subscribers: 10 }] } }],
    nodes: { "Channel search form": [{ "Niche or keyword": "coffee", "Minimum subscribers": 5000 }] },
  });
  assert.deepEqual(rows.map((r) => r.channel_name), ["Big"]);
  assert.equal(rows[0].email, "a@example.com");
});

test("calendly-prep-brief-agent: reads the booking and builds the Slack message", async () => {
  const body = { event: "invitee.created", payload: { email: "Ada@Example.com", name: "Ada", scheduled_event: { name: "Demo", start_time: "2026-11-02T10:00:00.000000Z" }, questions_and_answers: [{ question: "Goal?", answer: "Fewer bounces" }] } }; // leak-scan:allow, mixed case on purpose
  const [b] = await runCode(src("calendly-prep-brief-agent", "Read the booking"), { input: [body] });
  assert.equal(b.domain, "example.com");
  assert.equal(b.work_email, true);
  assert.equal(b.answers, "Goal?: Fewer bounces");
  const [msg] = await runCode(src("calendly-prep-brief-agent", "Slack message"), { input: [{ output: "Brief.", intermediateSteps: steps }], nodes: { "Read the booking": [b] } });
  assert.match(msg.text, /^\*New booking:\* Ada \(ada@example\.com\), Demo, /);
  assert.match(msg.text, /Brief\./);
  assert.equal(msg.looot_cost_usd, 0.0012);
});

test("typeform-lead-qualifier: answers to lead, verdict, score", async () => {
  const [lead] = await runCode(src("typeform-lead-qualifier", "Lead from answers"), {
    input: [{ "What is your full name?": "Ada Lovelace", "Work email": "Ada@Example.com", "Company size": "50-200", "What are you looking for?": "Better data" }], // leak-scan:allow, mixed case on purpose
  });
  assert.equal(lead.email, "ada@example.com");
  assert.equal(lead.first_name, "Ada");
  assert.equal(lead.last_name, "Lovelace");
  assert.equal(lead.need, "Better data");
  const [v] = await runCode(src("typeform-lead-qualifier", "Read the verdict"), { input: [ok({ status: "valid" }, 0.00145)], nodes: { "Lead from answers": [lead] } });
  assert.equal(v.deliverable, true);
  const [refused] = await runCode(src("typeform-lead-qualifier", "Read the verdict"), { input: [{ error: "insufficient_balance: top up" }], nodes: { "Lead from answers": [lead] } });
  assert.equal(refused.deliverable, false);
  const [s] = await runCode(src("typeform-lead-qualifier", "Score the lead"), {
    input: [ok({ data: { name: "Example Inc", industry: "Software", employee_count: 120, country: "US" } }, 0.0019)],
    nodes: { "Read the verdict": [v] },
  });
  assert.equal(s.score, 100);
  assert.equal(s.hot, true);
  assert.equal(s.company, "Example Inc");
  assert.equal(s.looot_cost_usd, 0.00335);
});

test("seo-content-brief-agent: splits a long brief into three blocks", async () => {
  const long = Array.from({ length: 120 }, (_, i) => `Line ${i} with some words about the keyword.`).join("\n");
  const [page] = await runCode(src("seo-content-brief-agent", "Brief to page"), { input: [{ output: long, intermediateSteps: steps }], nodes: { "Brief form": [{ Keyword: "email api" }] } });
  assert.equal(page.title, "Brief: email api");
  for (const p of [page.part1, page.part2, page.part3]) assert.ok(p.length <= 1990);
  assert.ok(page.part2.length > 100);
  const [short] = await runCode(src("seo-content-brief-agent", "Brief to page"), { input: [{ output: "Short." }], nodes: { "Brief form": [{ Keyword: "x" }] } });
  assert.equal(short.part3, " ");
});

test("hubspot-contact-enrichment: picks work emails without a title, maps fields", async () => {
  const contacts = [
    { vid: 1, properties: { email: { value: "Ada@Example.com" } } }, // leak-scan:allow, mixed case on purpose
    { vid: 2, properties: { email: { value: "b@example.com" }, jobtitle: { value: "CEO" } } },
    { vid: 3, properties: { email: { value: "c@gmail.com" } } }, // leak-scan:allow, a free-mail address the node must skip
  ];
  const picked = await runCode(src("hubspot-contact-enrichment", "Contacts to enrich"), { input: contacts });
  assert.deepEqual(picked, [{ email: "ada@example.com", contact_id: "1" }]);
  const out = await runCode(src("hubspot-contact-enrichment", "Contact fields"), {
    input: [ok({ person: { first_name: "Ada", job_title: "VP Sales", company_name: "Example Inc", city: "Austin" } }, 0.0036)],
    nodes: { "Contacts to enrich": picked },
  });
  assert.equal(out[0].job_title, "VP Sales");
  assert.equal(out[0].company, "Example Inc");
  const none = await runCode(src("hubspot-contact-enrichment", "Contact fields"), { input: [ok({})], nodes: { "Contacts to enrich": picked } });
  assert.deepEqual(none, []);
});

test("account-brief-notion-agent: one page under Notion's block limit", async () => {
  const [page] = await runCode(src("account-brief-notion-agent", "Brief to page"), {
    input: [{ output: { name: "Example", domain: "example.com", tech_stack: ["HubSpot", "React"], talking_points: ["x".repeat(3000)] }, intermediateSteps: steps }],
  });
  assert.equal(page.title, "Example (example.com)");
  assert.match(page.body, /Tech stack: HubSpot, React/);
  assert.ok(page.body.length <= 1990);
});

test("instagram-content-ideas-agent and content-trends-agent: ideas to rows", async () => {
  const [acc] = await runCode(src("instagram-content-ideas-agent", "Accounts to watch"));
  assert.ok(acc.handles.length > 0);
  const ig = await runCode(src("instagram-content-ideas-agent", "Ideas to rows"), { input: [{ output: { ideas: [{ idea: "A", source_handle: "x" }, {}] }, intermediateSteps: steps }] });
  assert.equal(ig.length, 1);
  assert.equal(ig[0].cost_usd, 0.0012);
  const [topics] = await runCode(src("content-trends-agent", "Topics"));
  assert.ok(topics.topics.length > 0);
  const ct = await runCode(src("content-trends-agent", "Ideas to rows"), { input: [{ output: { ideas: [{ title: "T", keywords: ["a", "b"], sources: ["https://example.com"] }] } }] });
  assert.equal(ct[0].keywords, "a, b");
});

test("champion-job-change-alert: detects a move, ignores legal suffixes", async () => {
  const picked = await runCode(src("champion-job-change-alert", "Champions to check"), {
    input: [{ row_number: 2, full_name: "Ada", linkedin_url: "https://www.linkedin.com/in/ada", company: "Acme Inc" }, { row_number: 3, linkedin_url: "" }],
  });
  assert.equal(picked.length, 1);
  const out = await runCode(src("champion-job-change-alert", "Did they move?"), {
    input: [ok({ current_company: "Globex", headline: "VP Sales at Globex" }, 0.0012)],
    nodes: { "Champions to check": picked },
  });
  assert.equal(out[0].moved, "yes");
  assert.equal(out[0].is_moved, true);
  assert.match(out[0].text, /left Acme Inc and is now at \*Globex\*/);
  const same = await runCode(src("champion-job-change-alert", "Did they move?"), { input: [ok({ company: "ACME" })], nodes: { "Champions to check": picked } });
  assert.equal(same[0].moved, "no");
  const failed = await runCode(src("champion-job-change-alert", "Did they move?"), { input: [{ error: "validation_error" }], nodes: { "Champions to check": picked } });
  assert.equal(failed[0].moved, "check_failed");
});

test("funding-news-hubspot-task: one task per new funding headline", async () => {
  const accounts = await runCode(src("funding-news-hubspot-task", "Accounts"));
  assert.match(accounts[0].query, /^"Acme Corp" \(raises/);
  const runs = [
    ok({ news: [{ title: "Acme Corp raises $20M Series B", link: "https://news.example.com/1", source: "Wire" }, { title: "Acme Corp opens office", link: "https://news.example.com/2" }] }),
    ok({ news: [{ title: "Initech raises seed", link: "https://news.example.com/3" }] }),
  ];
  const tasks = await runCode(src("funding-news-hubspot-task", "New funding news"), { input: runs, nodes: { Accounts: accounts } });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].subject, "Funding news: Acme Corp raises $20M Series B");
  assert.equal(tasks[0].company_id, "YOUR_COMPANY_ID");
});

test("weekly-seo-rank-slack: position per keyword in one message", async () => {
  const kws = await runCode(src("weekly-seo-rank-slack", "Keywords"));
  const runs = kws.map((_, i) => (i === 0
    ? ok({ organic: [{ link: "https://other.example.org/a", position: 1 }, { link: "https://www.example.com/x", position: 2 }] })
    : i === 1 ? ok({ organic: [{ link: "https://other.example.org/b", position: 1 }] }) : { error: "upstream_error" }));
  const [msg] = await runCode(src("weekly-seo-rank-slack", "Rank report"), { input: runs, nodes: { Keywords: kws } });
  assert.match(msg.text, /• email finder api: #2/);
  assert.match(msg.text, /• b2b data enrichment: not in the results/);
  assert.match(msg.text, /check failed/);
});

test("ai-visibility-check: named, cited or missing per question", async () => {
  const qs = await runCode(src("ai-visibility-check", "Brand and questions"));
  const overview = (text) => ok({ ai_overview: { text: text + " ".repeat(220) } });
  const runs = [overview("Use Example (example.com) or Acme."), overview("Globex is popular."), { error: "upstream_error" }];
  const [msg] = await runCode(src("ai-visibility-check", "Visibility report"), { input: runs, nodes: { "Brand and questions": qs } });
  assert.equal(msg.named, 1);
  assert.match(msg.text, /best email finder api: AI Overview, you cited, competitors named: Acme/);
  assert.match(msg.text, /how to enrich b2b leads: AI Overview, you missing, competitors named: Globex/);
});

test("backlink-prospect-finder: link gaps sorted by competitor count", async () => {
  const doms = await runCode(src("backlink-prospect-finder", "Domains to check"), { input: [{ "Your domain": "https://www.example.com/", "Competitor domains": "example.org, example.net example.org" }] });
  assert.deepEqual(doms.map((d) => [d.domain, d.mine]), [["example.com", true], ["example.org", false], ["example.net", false]]);
  const runs = [
    ok({ items: [{ domain: "blog.example.io" }] }, 0.024),
    ok({ items: [{ domain: "blog.example.io" }, { domain: "news.example.io", rank: 300 }, { domain: "list.example.io", rank: 100 }] }, 0.024),
    ok({ items: [{ domain: "list.example.io", rank: 100 }] }, 0.024),
  ];
  const rows = await runCode(src("backlink-prospect-finder", "Link gaps"), { input: runs, nodes: { "Domains to check": doms } });
  assert.deepEqual(rows.map((r) => r.referring_domain), ["list.example.io", "news.example.io"]);
  assert.equal(rows[0].competitor_count, 2);
  assert.equal(rows[0].run_cost_usd, 0.072);
});

test("webinar-attendee-enrichment: person then company, free mail flagged", async () => {
  const picked = await runCode(src("webinar-attendee-enrichment", "Attendees to enrich"), {
    input: [{ row_number: 2, email: "Ada@Example.com" }, { row_number: 3, email: "x@gmail.com" }, { row_number: 4, email: "d@example.com", enriched_at: "2026-10-01" }], // leak-scan:allow, mixed case and free mail on purpose
  });
  assert.deepEqual(picked.map((p) => [p.row_number, p.work_email]), [[2, true], [3, false]]);
  const people = await runCode(src("webinar-attendee-enrichment", "Person fields"), {
    input: [ok({ full_name: "Ada Lovelace", job_title: "CTO", company_name: "Example" }, 0.0036), { error: "not_found" }],
    nodes: { "Attendees to enrich": picked },
  });
  assert.equal(people[0].job_title, "CTO");
  assert.equal(people[1].job_title, "");
  const [full] = await runCode(src("webinar-attendee-enrichment", "Company fields"), {
    input: [ok({ industry: "Software", employee_count: 120, country: "US" }, 0.0019)],
    nodes: { "Person fields": [people[0]] },
  });
  assert.equal(full.industry, "Software");
  assert.equal(full.company, "Example");
  assert.equal(full.looot_cost_usd, 0.0055);
});
