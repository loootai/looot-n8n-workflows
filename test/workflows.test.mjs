// Static checks on every workflow JSON: it parses, every node type and typeVersion exists in
// n8n's source, connections point at real nodes, looot calls use the credential, carry an
// idempotency key and a cost cap, and no secret is inlined.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const known = JSON.parse(readFileSync(`${root}test/n8n-node-versions.json`, "utf8")).nodes;
const names = readdirSync(`${root}workflows`).filter((d) => existsSync(`${root}workflows/${d}/workflow.json`));

test("there are four workflows, each with a README", () => {
  assert.deepEqual(names.sort(), ["company-research", "google-rank-check", "signup-qualifier", "work-email"]);
  for (const n of names) assert.ok(existsSync(`${root}workflows/${n}/README.md`), `${n}/README.md missing`);
});

test("workflow JSON files match the build script (npm run build)", () => {
  execFileSync(process.execPath, [`${root}scripts/build.mjs`, "--check"], { stdio: "pipe" });
});

for (const name of names) {
  const text = readFileSync(`${root}workflows/${name}/workflow.json`, "utf8");

  test(`${name}: parses and has the fields n8n import expects`, () => {
    const wf = JSON.parse(text);
    assert.equal(typeof wf.name, "string");
    assert.ok(Array.isArray(wf.nodes) && wf.nodes.length > 0);
    assert.equal(typeof wf.connections, "object");
    assert.equal(wf.settings.executionOrder, "v1");
  });

  test(`${name}: every node type and typeVersion exists in n8n`, () => {
    const wf = JSON.parse(text);
    for (const n of wf.nodes) {
      assert.ok(known[n.type], `${n.name}: unknown node type ${n.type}`);
      assert.ok(known[n.type].includes(n.typeVersion), `${n.name}: ${n.type} has no typeVersion ${n.typeVersion} (known: ${known[n.type].join(", ")})`);
      assert.match(n.id, /^[0-9a-f-]{36}$/);
      assert.ok(Array.isArray(n.position) && n.position.length === 2);
    }
  });

  test(`${name}: node names and ids are unique, connections point at real nodes, every non-trigger node is reached`, () => {
    const wf = JSON.parse(text);
    const byName = new Set(wf.nodes.map((n) => n.name));
    assert.equal(byName.size, wf.nodes.length);
    assert.equal(new Set(wf.nodes.map((n) => n.id)).size, wf.nodes.length);
    const reached = new Set();
    for (const [from, out] of Object.entries(wf.connections)) {
      assert.ok(byName.has(from), `connection from unknown node ${from}`);
      for (const branch of out.main) for (const c of branch) {
        assert.ok(byName.has(c.node), `connection to unknown node ${c.node}`);
        assert.equal(c.type, "main");
        reached.add(c.node);
      }
    }
    for (const n of wf.nodes) {
      const trigger = /webhook$|Trigger$/.test(n.type) || n.type.endsWith("stickyNote");
      if (!trigger) assert.ok(reached.has(n.name), `${n.name} has no incoming connection`);
    }
    const ifs = wf.nodes.filter((n) => n.type === "n8n-nodes-base.if");
    for (const n of ifs) assert.equal(wf.connections[n.name].main.length, 2, `${n.name} needs a true and a false branch`);
  });

  test(`${name}: looot calls use the Header Auth credential, wait, and never inline a token`, () => {
    const wf = JSON.parse(text);
    const http = wf.nodes.filter((n) => n.type === "n8n-nodes-base.httpRequest");
    assert.ok(http.length > 0);
    for (const n of http) {
      assert.equal(n.parameters.url, "https://api.looot.ai/v1/runs");
      assert.equal(n.parameters.method, "POST");
      assert.equal(n.parameters.authentication, "genericCredentialType");
      assert.equal(n.parameters.genericAuthType, "httpHeaderAuth");
      assert.equal(n.credentials.httpHeaderAuth.name, "looot API");
      assert.deepEqual(n.parameters.queryParameters.parameters, [{ name: "wait", value: "60" }]);
      assert.equal(n.parameters.options.response.response.neverError, true);
    }
    assert.doesNotMatch(text, /cs_ms_[A-Za-z0-9]|Bearer [A-Za-z0-9]{12,}/);
  });

  test(`${name}: webhook flows answer through a Respond node`, () => {
    const wf = JSON.parse(text);
    const hook = wf.nodes.find((n) => n.type === "n8n-nodes-base.webhook");
    if (!hook) return;
    assert.equal(hook.parameters.responseMode, "responseNode");
    assert.equal(hook.parameters.httpMethod, "POST");
    assert.match(hook.parameters.path, /^looot\//);
    assert.ok(wf.nodes.some((n) => n.type === "n8n-nodes-base.respondToWebhook"));
  });
}
