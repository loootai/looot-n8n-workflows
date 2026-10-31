// Structure checks for the workflows that use the verified looot community node (scripts/build-node.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { WORKFLOWS, LOOOT_NODE, LOOOT_TOOL } from "../scripts/build-node.mjs";

const root = new URL("..", import.meta.url).pathname;
const known = JSON.parse(readFileSync(`${root}test/n8n-node-versions.json`, "utf8")).nodes;
const names = Object.keys(WORKFLOWS);
const STICKY = "n8n-nodes-base.stickyNote";
const words = (s) => s.replace(/[#*`\[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
const DEFAULT_NAMES = new Set(["Code", "HTTP Request", "Set", "If", "Edit Fields", "AI Agent", "Google Sheets", "Slack", "HubSpot", "looot1"]);

test("thirteen looot-node workflows, each with a README", () => {
  assert.equal(names.length, 13);
  for (const n of names) assert.ok(existsSync(`${root}workflows/${n}/README.md`), `${n}/README.md missing`);
});

test("workflow JSON files match the build script (npm run build)", () => {
  execFileSync(process.execPath, [`${root}scripts/build-node.mjs`, "--check"], { stdio: "pipe" });
});

for (const name of names) {
  const text = readFileSync(`${root}workflows/${name}/workflow.json`, "utf8");
  const wf = JSON.parse(text);
  const byName = new Map(wf.nodes.map((n) => [n.name, n]));

  test(`${name}: parses, every node type and typeVersion exists, ids unique`, () => {
    assert.equal(typeof wf.name, "string");
    assert.ok(wf.name.length <= 110, "title too long for the gallery");
    assert.equal(wf.settings.executionOrder, "v1");
    assert.deepEqual(wf.pinData, {});
    for (const n of wf.nodes) {
      assert.ok(known[n.type], `${n.name}: unknown node type ${n.type}`);
      assert.ok(known[n.type].includes(n.typeVersion), `${n.name}: ${n.type} has no typeVersion ${n.typeVersion}`);
      assert.match(n.id, /^[0-9a-f-]{36}$/);
      assert.ok(!DEFAULT_NAMES.has(n.name), `${n.name}: default node name, rename it`);
    }
    assert.equal(new Set(wf.nodes.map((n) => n.id)).size, wf.nodes.length);
    assert.equal(byName.size, wf.nodes.length);
  });

  test(`${name}: connections point at real nodes and every node is wired`, () => {
    const reached = new Set();
    const sources = new Set();
    for (const [from, outs] of Object.entries(wf.connections)) {
      assert.ok(byName.has(from), `connection from unknown node ${from}`);
      sources.add(from);
      for (const [type, branches] of Object.entries(outs)) {
        for (const branch of branches) for (const c of branch) {
          assert.ok(byName.has(c.node), `connection to unknown node ${c.node}`);
          assert.equal(c.type, type);
          if (type !== "main") assert.equal(byName.get(c.node).type, "@n8n/n8n-nodes-langchain.agent", `${from} feeds ${type} into a non-agent`);
          reached.add(c.node);
        }
      }
    }
    for (const n of wf.nodes) {
      if (n.type === STICKY) continue;
      const trigger = /Trigger$|webhook$/.test(n.type);
      const subNode = Object.keys(wf.connections[n.name] || {}).some((t) => t.startsWith("ai_"));
      if (!trigger && !subNode) assert.ok(reached.has(n.name), `${n.name} has no incoming connection`);
      if (trigger) assert.ok(sources.has(n.name), `${n.name} triggers nothing`);
    }
    for (const n of wf.nodes.filter((x) => x.type === "n8n-nodes-base.if")) {
      assert.equal(wf.connections[n.name].main.length, 2, `${n.name} needs a true and a false branch`);
    }
  });

  test(`${name}: no credentials, tokens or private ids in the JSON`, () => {
    for (const n of wf.nodes) assert.equal(n.credentials, undefined, `${n.name} carries a credentials block`);
    assert.doesNotMatch(text, /cs_ms_[A-Za-z0-9]|Bearer [A-Za-z0-9]{12,}|sk-[A-Za-z0-9]{20,}|api_key=|apiKey=/);
    assert.doesNotMatch(text, /docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}/);
    const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    for (const e of emails) assert.match(e, /@example\.com$/, `real looking address ${e}`);
  });

  test(`${name}: every looot call is capped and the agent's $fromAI keys are consistent`, () => {
    const loootNodes = wf.nodes.filter((n) => n.type === LOOOT_NODE || n.type === LOOOT_TOOL);
    assert.ok(loootNodes.length > 0, "no looot node");
    for (const n of loootNodes) {
      const p = n.parameters;
      if (p.operation !== "run") continue;
      assert.ok(typeof p.maxCostUsd === "string" ? p.maxCostUsd.startsWith("=") : p.maxCostUsd > 0 && p.maxCostUsd <= 0.05, `${n.name}: cap missing or above $0.05`);
      assert.equal(p.fallback, true);
      assert.ok(p.wait > 0);
      if (n.type === LOOOT_NODE) {
        assert.match(p.endpointId, /^job:[a-z.]+$/);
        assert.equal(n.onError, "continueRegularOutput", `${n.name}: a refused call should not stop the batch`);
      }
    }
    for (const n of wf.nodes.filter((x) => x.type === LOOOT_TOOL)) {
      assert.ok(n.parameters.toolDescription && n.parameters.descriptionType === "manual", `${n.name}: needs a tool description`);
      const calls = new Map();
      for (const v of Object.values(n.parameters)) {
        if (typeof v !== "string") continue;
        for (const m of v.matchAll(/\$fromAI\('([^']+)'[^)]*\)/g)) {
          const prev = calls.get(m[1]);
          assert.ok(!prev || prev === m[0], `${n.name}: $fromAI('${m[1]}') written two ways, n8n refuses that`);
          calls.set(m[1], m[0]);
        }
      }
      assert.ok(calls.size > 0, `${n.name}: the agent fills nothing`);
    }
  });

  test(`${name}: sticky notes follow n8n's template guidelines`, () => {
    const notes = wf.nodes.filter((n) => n.type === STICKY);
    const main = notes.filter((n) => !n.parameters.color);
    assert.equal(main.length, 1, "exactly one yellow overview note");
    const c = main[0].parameters.content;
    for (const h of ["### How it works", "### Setup", "### Customization"]) assert.ok(c.includes(h), `overview lacks ${h}`);
    const w = words(c);
    assert.ok(w >= 100 && w <= 330, `overview has ${w} words, aim for 100 to 300`);
    assert.match(c, /n8n-nodes-looot/, "overview must name the community node package");
    assert.match(c, /\$[0-9]/, "overview must state the cost");
    const real = wf.nodes.filter((n) => n.type !== STICKY).length;
    if (real >= 4) assert.ok(notes.some((n) => n.parameters.color === 7), "4+ nodes need white section notes");
    for (const n of notes.filter((x) => x.parameters.color === 7)) {
      assert.ok(words(n.parameters.content) < 50, `${n.name}: section notes stay under 50 words`);
      assert.match(n.parameters.content, /^## /);
    }
    const dash = /—|–/;
    for (const n of notes) assert.doesNotMatch(n.parameters.content, dash, `${n.name}: no em or en dashes`);
  });
}
