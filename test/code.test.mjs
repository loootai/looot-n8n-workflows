// Runs every Code node's JavaScript with fake inputs shaped like n8n's, so the logic is tested
// the way n8n will run it. No network, no money.
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
const hook = (body) => [{ headers: {}, params: {}, query: {}, body }];

// work-email
test("work-email: builds a capped fallback run from first/last/domain", async () => {
  const [out] = await runCode(src("work-email", "Build find request"), { input: hook({ first_name: "Ada", last_name: "Lovelace", domain: "https://www.Example.com/team" }) });
  assert.equal(out.next, "find");
  assert.deepEqual(out.request.input, { first_name: "Ada", last_name: "Lovelace", domain: "example.com" });
  assert.equal(out.request.endpointId, "job:people.email.find");
  assert.deepEqual(out.request.fallback, { enabled: true, maxAttempts: 3, maxCostUsd: 0.05 });
  assert.equal(out.request.idempotencyKey, "n8n-email-find:example.com:ada:lovelace");
});

test("work-email: accepts a full name and website, refuses missing parts at $0", async () => {
  const [ok] = await runCode(src("work-email", "Build find request"), { input: hook({ name: "Grace Brewster Hopper", website: "example.org" }) });
  assert.deepEqual(ok.request.input, { first_name: "Grace", last_name: "Brewster Hopper", domain: "example.org" });
  const [bad] = await runCode(src("work-email", "Build find request"), { input: hook({ first_name: "Ada" }) });
  assert.equal(bad.next, "respond");
  assert.equal(bad.response.ok, false);
  assert.equal(bad.response.cost_usd, 0);
});

const lead = { first_name: "Ada", last_name: "Lovelace", domain: "example.com" };

test("work-email: a found address goes on to verification", async () => {
  const run = { runId: "r1", status: "completed", actualCost: 0.004, route: { servedBy: "provider-a" }, normalized: { fields: { email: "ada@example.com" } } };
  const [out] = await runCode(src("work-email", "Build verify request"), { input: [run], nodes: { "Build find request": [{ lead }] } });
  assert.equal(out.next, "verify");
  assert.equal(out.email, "ada@example.com");
  assert.deepEqual(out.request.input, { email: "ada@example.com" });
  assert.equal(out.request.endpointId, "job:people.email.verify");
  assert.equal(out.find_cost, 0.004);
});

test("work-email: a miss, a failure, a pending run and a 402 all answer without verifying", async () => {
  const nodes = { "Build find request": [{ lead }] };
  const [miss] = await runCode(src("work-email", "Build verify request"), { input: [{ runId: "r", status: "completed", actualCost: 0, result: { data: null } }], nodes });
  assert.equal(miss.next, "respond");
  assert.equal(miss.response.email, null);
  const [failed] = await runCode(src("work-email", "Build verify request"), { input: [{ runId: "r", status: "failed", actualCost: 0, error: { message: "all providers failed" } }], nodes });
  assert.equal(failed.response.ok, false);
  assert.equal(failed.response.note, "all providers failed");
  const [pending] = await runCode(src("work-email", "Build verify request"), { input: [{ runId: "r9", status: "running" }], nodes });
  assert.match(pending.response.note, /v1\/runs\/r9/);
  const [broke] = await runCode(src("work-email", "Build verify request"), { input: [{ error: { code: "insufficient_balance", message: "top up" }, topUpUrl: "https://looot.ai/top-up" }], nodes });
  assert.equal(broke.response.error, "insufficient_balance: top up");
  assert.equal(broke.response.top_up_url, "https://looot.ai/top-up");
});

test("work-email: final answer maps the verifier's word and adds both costs", async () => {
  const prev = { lead, email: "ada@example.com", find_cost: 0.004, find_served_by: "provider-a" };
  const [out] = await runCode(src("work-email", "Shape answer"), { input: [{ status: "completed", actualCost: 0.0015, result: { result: "deliverable" } }], nodes: { "Build verify request": [prev] } });
  assert.equal(out.response.email_status, "valid");
  assert.equal(out.response.cost_usd, 0.0055);
  const [catchAll] = await runCode(src("work-email", "Shape answer"), { input: [{ status: "completed", actualCost: 0.0015, normalized: { fields: { status: "catch_all" } } }], nodes: { "Build verify request": [prev] } });
  assert.equal(catchAll.response.email_status, "catch_all");
});

// company-research
test("company-research: one domain becomes three job runs", async () => {
  const out = await runCode(src("company-research", "Build requests"), { input: hook({ domain: "www.example.com" }) });
  assert.deepEqual(out.map((o) => o.request.endpointId), ["job:company.enrich", "job:company.news", "job:company.technographics"]);
  for (const o of out) {
    assert.deepEqual(o.request.input, { domain: "example.com" });
    assert.match(o.request.idempotencyKey, /^n8n-research:company\.[a-z]+:example\.com:\d{4}-\d{2}-\d{2}$/);
    assert.equal(o.request.fallback.maxCostUsd, 0.05);
  }
  const [bad] = await runCode(src("company-research", "Build requests"), { input: hook({ domain: "nope" }) });
  assert.equal(bad.next, "respond");
});

test("company-research: builds the card from three different answer shapes and survives a failure", async () => {
  const reqs = await runCode(src("company-research", "Build requests"), { input: hook({ domain: "example.com" }) });
  const runs = [
    { status: "completed", actualCost: 0.002, result: { data: { name: "Example Inc", industry: "Software", employee_count: 120, country: "US", description: "Makes examples." } } },
    { status: "completed", actualCost: 0.0001, result: { articles: [{ title: "Example raises a round", url: "https://news.example.com/a", published_at: "2026-10-01" }] } },
    { status: "failed", actualCost: 0, error: { message: "no provider answered" } },
  ];
  const [out] = await runCode(src("company-research", "Build card"), { input: runs, nodes: { "Build requests": reqs } });
  const c = out.response;
  assert.equal(c.company.name, "Example Inc");
  assert.equal(c.company.employees, "120");
  assert.deepEqual(c.news, [{ title: "Example raises a round", url: "https://news.example.com/a", date: "2026-10-01" }]);
  assert.deepEqual(c.tech, []);
  assert.equal(c.runs["company.technographics"], "failed");
  assert.equal(c.cost_usd, 0.0021);
});

test("company-research: reads tech stacks given as strings or objects", async () => {
  const reqs = await runCode(src("company-research", "Build requests"), { input: hook({ domain: "example.com" }) });
  const runs = [
    { status: "failed" }, { status: "failed" },
    { status: "completed", actualCost: 0, result: { technologies: [{ name: "Next.js" }, { name: "Stripe" }, { name: "Next.js" }] } },
  ];
  const [out] = await runCode(src("company-research", "Build card"), { input: runs, nodes: { "Build requests": reqs } });
  assert.deepEqual(out.response.tech, ["Next.js", "Stripe"]);
});

// signup-qualifier
test("signup-qualifier: free mail and bad addresses are skipped at $0", async () => {
  const [free] = await runCode(src("signup-qualifier", "Check email"), { input: hook({ email: "Someone@Gmail.com" }) }); // leak-scan:allow
  assert.equal(free.response.tier, "skip");
  assert.equal(free.response.cost_usd, 0);
  const [bad] = await runCode(src("signup-qualifier", "Check email"), { input: hook({ email: "not-an-email" }) });
  assert.equal(bad.response.ok, false);
});

test("signup-qualifier: a work email becomes a person run and a company run", async () => {
  const out = await runCode(src("signup-qualifier", "Check email"), { input: hook({ email: "jane@example.com", plan: "trial" }) });
  assert.deepEqual(out.map((o) => [o.request.endpointId, o.request.input]), [
    ["job:people.enrich.by-email", { email: "jane@example.com" }],
    ["job:company.enrich", { domain: "example.com" }],
  ]);
  assert.equal(out[0].signup.plan, "trial");
});

test("signup-qualifier: scores a senior person at an in-ICP company as hot", async () => {
  const reqs = await runCode(src("signup-qualifier", "Check email"), { input: hook({ email: "jane@example.com" }) });
  const runs = [
    { status: "completed", actualCost: 0.004, result: { person: { full_name: "Jane Doe", job_title: "Head of Growth" } } },
    { status: "completed", actualCost: 0.002, normalized: { fields: { name: "Example Inc", industry: "Computer Software", employees: "150", country: "US" } } },
  ];
  const [out] = await runCode(src("signup-qualifier", "Score against ICP"), { input: runs, nodes: { "Check email": reqs } });
  assert.equal(out.response.tier, "hot");
  assert.equal(out.response.score, 100);
  assert.equal(out.response.person.title, "Head of Growth");
  assert.equal(out.response.cost_usd, 0.006);
});

test("signup-qualifier: unknown size and a junior title stay cold", async () => {
  const reqs = await runCode(src("signup-qualifier", "Check email"), { input: hook({ email: "sam@example.com" }) });
  const runs = [{ status: "completed", actualCost: 0.004, result: { title: "Intern" } }, { status: "failed", actualCost: 0 }];
  const [out] = await runCode(src("signup-qualifier", "Score against ICP"), { input: runs, nodes: { "Check email": reqs } });
  assert.equal(out.response.tier, "cold");
  assert.ok(out.response.reasons.includes("company size unknown"));
});

// google-rank-check
test("google-rank-check: one pinned serper-search run per keyword with a per-day key", async () => {
  const out = await runCode(src("google-rank-check", "Keywords"));
  assert.equal(out.length, 2);
  assert.equal(out[0].request.endpointId, "serper-search");
  assert.deepEqual(out[0].request.input, { q: "example keyword one", gl: "us", hl: "en", num: 10 });
  assert.match(out[0].request.idempotencyKey, /^n8n-rank:\d{4}-\d{2}-\d{2}:us:example keyword one$/);
});

test("google-rank-check: finds the domain's position, including subdomains, and null when absent", async () => {
  const reqs = await runCode(src("google-rank-check", "Keywords"));
  const runs = [
    { status: "completed", actualCost: 0.001, result: { organic: [{ link: "https://other.test/a", position: 1 }, { link: "https://blog.example.com/post", position: 2 }] } },
    { status: "completed", actualCost: 0.001, result: { organic: [{ link: "https://other.test/b", position: 1 }] } },
  ];
  const out = await runCode(src("google-rank-check", "Find positions"), { input: runs, nodes: { Keywords: reqs } });
  assert.equal(out[0].position, 2);
  assert.equal(out[0].url, "https://blog.example.com/post");
  assert.equal(out[1].position, null);
  assert.equal(out[1].top_result, "https://other.test/b");
});
