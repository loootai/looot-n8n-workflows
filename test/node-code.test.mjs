// Runs the Code nodes of the looot-node workflows with fake inputs shaped like n8n's.
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
  step("calculator", JSON.stringify({ actualCost: 9 })),
];

test("agent cost: adds actualCost from looot steps only", async () => {
  const [out] = await runCode(src("deep-research-agent", "Add cost line"), { input: [{ output: "Report.", intermediateSteps: steps }] });
  assert.equal(out.looot_calls, 2);
  assert.equal(out.looot_cost_usd, 0.0012);
  assert.match(out.output, /^Report\.\n\n---\nlooot calls: 2, data cost: \$0\.0012/);
  const [none] = await runCode(src("deep-research-agent", "Add cost line"), { input: [{ output: "x" }] });
  assert.equal(none.looot_cost_usd, 0);
});

test("google-maps-leads-agent: one row per named lead, cost on each row", async () => {
  const output = { leads: [{ name: "Example Dental", phone: "1", website: "https://example.com", rating: 4.8 }, { phone: "no name" }] };
  const rows = await runCode(src("google-maps-leads-agent", "Leads to rows"), {
    input: [{ output, intermediateSteps: steps }],
    nodes: { "Lead search form": [{ "Business type": "dentists", "City or area": "Austin" }] },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].search, "dentists in Austin");
  assert.equal(rows[0].run_cost_usd, 0.0012);
  assert.equal(rows[0].email, "");
});

test("competitor-research-agent: input check and one page per competitor", async () => {
  const [inp] = await runCode(src("competitor-research-agent", "Your company"));
  assert.equal(inp.domain, "example.com");
  assert.deepEqual(inp.competitors, []);
  const pages = await runCode(src("competitor-research-agent", "One page per competitor"), {
    input: [{ output: { competitors: [{ name: "A", domain: "a.com", products: ["x"], sources: ["https://a.com"] }, { name: "B" }] }, intermediateSteps: steps }],
  });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].title, "A (a.com)");
  assert.match(pages[0].body, /Products:\n- x/);
  assert.ok(pages[0].body.length < 2000, "Notion text blocks stop at 2000 characters");
});

test("linkedin-lead-enrichment-agent: drops people without a LinkedIn URL", async () => {
  const rows = await runCode(src("linkedin-lead-enrichment-agent", "Leads to rows"), {
    input: [{ output: { leads: [{ full_name: "Ada", linkedin_url: "https://www.linkedin.com/in/example", recent_post_topics: ["a", "b"] }, { full_name: "No URL" }] } }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email_status, "not_found");
  assert.equal(rows[0].recent_post_topics, "a; b");
});

test("pre-call-social-brief: companies from attendees, skips own domain and free mail", async () => {
  const events = [
    { summary: "Intro", start: { dateTime: "2026-11-02T10:00:00Z" }, attendees: [{ email: "me@example.com" }, { email: "ada@example.org" }, { email: "x@gmail.com" }, { email: "bob@example.org" }] }, // leak-scan:allow, a free-mail address the node must skip
    { summary: "Demo", start: { dateTime: "2026-11-02T14:00:00Z" }, attendees: [{ email: "c@example.net" }] },
    { summary: "Focus time" },
  ];
  const out = await runCode(src("pre-call-social-brief", "Companies to research"), { input: events });
  assert.deepEqual(out.map((o) => o.domain), ["example.org", "example.net"]);
  assert.deepEqual(out[0].people, ["ada@example.org", "bob@example.org"]);
  const [mail] = await runCode(src("pre-call-social-brief", "Build the email"), {
    input: [{ output: "Acme <b>news</b>", intermediateSteps: steps }, { output: "Globex", intermediateSteps: [] }],
    nodes: { "Companies to research": out },
  });
  assert.match(mail.subject, /2 companies/);
  assert.match(mail.html, /Acme &lt;b&gt;news/);
  assert.equal(mail.looot_cost_usd, 0.0012);
  const empty = await runCode(src("pre-call-social-brief", "Build the email"), { input: [], nodes: { "Companies to research": [] } });
  assert.deepEqual(empty, []);
});

test("post-engagers-to-hubspot: keeps usable emails only", async () => {
  const people = [
    { first_name: "Ada", email: "Ada@Example.com", email_status: "valid", headline: "VP" }, // leak-scan:allow, mixed case on purpose
    { first_name: "Bad", email: "bad@example.com", email_status: "invalid" },
    { first_name: "None", email: "" },
  ];
  const rows = await runCode(src("post-engagers-to-hubspot", "Contacts with an email"), {
    input: [{ output: { people } }],
    nodes: { "Post URL form": [{ "LinkedIn post URL": "https://www.linkedin.com/posts/x" }] },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "ada@example.com");
  assert.equal(rows[0].job_title, "VP");
});

test("form-lead-enrichment-hubspot: verdict and contact fields", async () => {
  const form = [{ "First name": "Ada", "Last name": "Lovelace", "Business email": " Ada@Example.com " }]; // leak-scan:allow, mixed case on purpose
  const [ok] = await runCode(src("form-lead-enrichment-hubspot", "Read the verdict"), { input: [{ status: "completed", actualCost: 0.00145, result: { result: "deliverable" } }], nodes: { "Lead form": form } });
  assert.equal(ok.deliverable, true);
  assert.equal(ok.domain, "example.com");
  const [catchAll] = await runCode(src("form-lead-enrichment-hubspot", "Read the verdict"), { input: [{ status: "completed", normalized: { fields: { status: "accept_all" } } }], nodes: { "Lead form": form } });
  assert.equal(catchAll.email_status, "catch_all");
  assert.equal(catchAll.deliverable, true);
  const [refused] = await runCode(src("form-lead-enrichment-hubspot", "Read the verdict"), { input: [{ error: "insufficient_balance: top up" }], nodes: { "Lead form": form } });
  assert.equal(refused.deliverable, false);
  assert.equal(refused.verify_problem, "insufficient_balance: top up");
  const [contact] = await runCode(src("form-lead-enrichment-hubspot", "Contact fields"), {
    input: [{ status: "completed", actualCost: 0.0019, result: { data: { name: "Example Inc", industry: "Software", employee_count: 120, city: "Austin", country: "US" } } }],
    nodes: { "Read the verdict": [ok] },
  });
  assert.equal(contact.company, "Example Inc");
  assert.equal(contact.employees, "120");
  assert.equal(contact.website, "https://example.com");
  assert.equal(contact.looot_cost_usd, 0.00335);
});

test("work-email-to-sheets: picks rows, then writes found, verified and missing rows", async () => {
  const rows = [
    { row_number: 2, first_name: "Ada", last_name: "Lovelace", domain: "https://www.Example.com/about" },
    { row_number: 3, full_name: "Grace Brewster Hopper", website: "example.org" },
    { row_number: 4, first_name: "Done", last_name: "Already", domain: "example.com", email: "d@example.com" },
    { row_number: 5, first_name: "No", last_name: "Domain" },
  ];
  const picked = await runCode(src("work-email-to-sheets", "Rows to look up"), { input: rows });
  assert.deepEqual(picked.map((p) => p.row_number), [2, 3]);
  assert.equal(picked[0].domain, "example.com");
  assert.equal(picked[1].last_name, "Brewster Hopper");
  assert.equal(picked[0].key, "n8n-email-find:example.com:ada:lovelace");
  const found = await runCode(src("work-email-to-sheets", "Found an email?"), {
    input: [{ status: "completed", actualCost: 0.004, normalized: { fields: { email: "ada@example.com" } } }, { status: "completed", actualCost: 0, result: {} }],
    nodes: { "Rows to look up": picked },
  });
  assert.equal(found[0].found, true);
  assert.equal(found[1].email_status, "not_found");
  const [verified] = await runCode(src("work-email-to-sheets", "Verified row"), {
    input: [{ status: "completed", actualCost: 0.00145, result: { status: "valid" } }],
    nodes: { "Found an email?": [found[0]] },
  });
  assert.equal(verified.email_status, "valid");
  assert.equal(verified.looot_cost_usd, 0.00545);
  const [missing] = await runCode(src("work-email-to-sheets", "Not found row"), { input: [found[1]] });
  assert.equal(missing.row_number, 3);
  assert.equal(missing.email, "");
});

test("competitor-news-slack: one message, new links only, nothing when empty", async () => {
  const comps = await runCode(src("competitor-news-slack", "Competitors"));
  assert.equal(comps[0].query, "\"Acme Corp\"");
  const runs = [
    { status: "completed", actualCost: 0.001, result: { news: [{ title: "Acme raises", link: "https://news.example.com/1", source: "Wire", date: "1 hour ago" }, { title: "Acme raises", link: "https://news.example.com/1" }] } },
    { error: "validation_error: bad input" },
    { status: "completed", actualCost: 0.001, result: { news: [] } },
  ];
  const [msg] = await runCode(src("competitor-news-slack", "Build the digest"), { input: runs, nodes: { Competitors: comps } });
  assert.match(msg.text, /\*Acme Corp\*\n• <https:\/\/news\.example\.com\/1\|Acme raises> \(Wire\), 1 hour ago/);
  assert.doesNotMatch(msg.text, /Globex/);
  assert.equal(msg.looot_cost_usd, 0.002);
  const none = await runCode(src("competitor-news-slack", "Build the digest"), { input: [runs[2]], nodes: { Competitors: comps } });
  assert.deepEqual(none, []);
});

test("hiring-signal-alert: keeps signal roles at the right company", async () => {
  const accounts = await runCode(src("hiring-signal-alert", "Accounts and roles"));
  const runs = [
    { status: "completed", actualCost: 0.0005, result: { jobs: [
      { title: "RevOps Manager", company: "Acme Corp", url: "https://jobs.example.com/1", location: "Remote" },
      { title: "Backend Engineer", company: "Acme Corp", url: "https://jobs.example.com/2" },
      { title: "SDR", company: "Other Co", url: "https://jobs.example.com/3" },
    ] } },
  ];
  const [msg] = await runCode(src("hiring-signal-alert", "New matching jobs"), { input: runs, nodes: { "Accounts and roles": accounts } });
  assert.match(msg.text, /\*Acme Corp\* is hiring: <https:\/\/jobs\.example\.com\/1\|RevOps Manager> \(Remote\)/);
  assert.doesNotMatch(msg.text, /Backend|Other Co/);
});

test("verify-before-instantly: only valid addresses are sent", async () => {
  const rows = [
    { row_number: 2, email: "Ada@Example.com", first_name: "Ada" }, // leak-scan:allow, mixed case on purpose
    { row_number: 3, email: "not-an-email" },
    { row_number: 4, email: "b@example.com", email_status: "valid" },
    { row_number: 5, email: "c@example.com" },
  ];
  const picked = await runCode(src("verify-before-instantly", "Emails to check"), { input: rows });
  assert.deepEqual(picked.map((p) => p.email), ["ada@example.com", "c@example.com"]);
  const out = await runCode(src("verify-before-instantly", "Verdict"), {
    input: [{ status: "completed", actualCost: 0.00145, result: { status: "valid" } }, { status: "completed", actualCost: 0.00145, result: { status: "catch_all" } }],
    nodes: { "Emails to check": picked },
  });
  assert.deepEqual(out.map((o) => [o.email_status, o.send]), [["valid", true], ["catch_all", false]]);
});

test("hubspot-company-tech-stack: picks new companies and writes a list", async () => {
  const companies = [
    { companyId: 11, properties: { domain: { value: "example.com" }, name: { value: "Example" } } },
    { companyId: 12, properties: { domain: { value: "example.org" }, looot_tech_stack: { value: "React" } } },
    { companyId: 13, properties: { name: { value: "No domain" } } },
  ];
  const picked = await runCode(src("hubspot-company-tech-stack", "Companies without a stack"), { input: companies });
  assert.deepEqual(picked, [{ companyId: "11", domain: "example.com", name: "Example" }]);
  const [row] = await runCode(src("hubspot-company-tech-stack", "Stack as text"), {
    input: [{ status: "completed", actualCost: 0.0089, result: { technologies: [{ name: "HubSpot" }, { name: "React" }, { name: "React" }] } }],
    nodes: { "Companies without a stack": picked },
  });
  assert.equal(row.tech_stack, "HubSpot, React");
  const [failed] = await runCode(src("hubspot-company-tech-stack", "Stack as text"), { input: [{ error: "insufficient_balance: top up" }], nodes: { "Companies without a stack": picked } });
  assert.match(failed.tech_stack, /^lookup failed: insufficient_balance/);
});

test("looot-agent: returns the answer with the call count and cost", async () => {
  const [out] = await runCode(src("looot-agent", "Answer and cost"), { input: [{ output: "{\"email\":\"ada@example.com\"}", intermediateSteps: [step("looot run", "[{\"actualCost\":0.004}]"), step("looot search", "[]")] }] });
  assert.equal(out.looot_calls, 2);
  assert.equal(out.looot_cost_usd, 0.004);
});
