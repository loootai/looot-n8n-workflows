// Checks that every parameter name the workflows set exists in the node's source, at a fixed n8n
// commit (from test/n8n-node-versions.json) and in n8n-nodes-looot's source. It reads GitHub, so it
// is not part of `npm test`. A name it cannot find is a typo or a parameter of another version.
// Usage: node scripts/check-params.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const source = JSON.parse(readFileSync(`${root}test/n8n-node-versions.json`, "utf8")).source;
const sha = source.split("/tree/")[1];
const DIRS = {
  "n8n-nodes-base.": "packages/nodes-base/nodes/",
  "@n8n/n8n-nodes-langchain.": "packages/@n8n/nodes-langchain/nodes/",
};
const NODE_DIR = {
  "n8n-nodes-base.code": "Code", "n8n-nodes-base.if": "If", "n8n-nodes-base.scheduleTrigger": "Schedule",
  "n8n-nodes-base.manualTrigger": "ManualTrigger", "n8n-nodes-base.noOp": "NoOp", "n8n-nodes-base.formTrigger": "Form",
  "n8n-nodes-base.executeWorkflowTrigger": "ExecuteWorkflow/ExecuteWorkflowTrigger", "n8n-nodes-base.googleSheets": "Google/Sheet",
  "n8n-nodes-base.googleCalendar": "Google/Calendar", "n8n-nodes-base.gmail": "Google/Gmail", "n8n-nodes-base.hubspot": "Hubspot",
  "n8n-nodes-base.notion": "Notion", "n8n-nodes-base.slack": "Slack", "n8n-nodes-base.httpRequest": "HttpRequest",
  "n8n-nodes-base.webhook": "Webhook", "n8n-nodes-base.respondToWebhook": "RespondToWebhook",
  "@n8n/n8n-nodes-langchain.agent": "agents/Agent", "@n8n/n8n-nodes-langchain.chatTrigger": "trigger/ChatTrigger",
  "@n8n/n8n-nodes-langchain.lmChatOpenAi": "llms/LMChatOpenAi", "@n8n/n8n-nodes-langchain.memoryBufferWindow": "memory/MemoryBufferWindow",
  "@n8n/n8n-nodes-langchain.outputParserStructured": "output_parser/OutputParserStructured",
};
// Parameters n8n itself adds: to every node used as an AI tool, and shared form/agent helpers.
const ADDED = ["descriptionType", "toolDescription"];
const COLLECTIONS = new Set(["options", "additionalFields", "updateFields", "otherOptions", "filters"]);

const tree = (await (await fetch(`https://api.github.com/repos/n8n-io/n8n/git/trees/${sha}?recursive=1`)).json()).tree.map((t) => t.path);
const cache = new Map();
async function namesFor(type) {
  if (cache.has(type)) return cache.get(type);
  let urls;
  if (type.startsWith("n8n-nodes-looot.")) {
    urls = ["https://raw.githubusercontent.com/loootai/n8n-nodes-looot/main/nodes/Looot/Looot.node.ts"];
  } else {
    const prefix = Object.entries(DIRS).find(([p]) => type.startsWith(p));
    const dir = prefix[1] + NODE_DIR[type] + "/";
    // Shared descriptions (prompt type, memory window, workflow inputs, attribution) live in utils/.
    const shared = type.startsWith("@n8n/") ? "packages/@n8n/nodes-langchain/utils/" : "packages/nodes-base/utils/";
    const parentDescriptions = dir.replace(/[^/]+\/$/, "") + "descriptions.ts";
    urls = tree.filter((p) => (p.startsWith(dir) || p.startsWith(shared) || p === parentDescriptions) && p.endsWith(".ts") && !p.includes("/test") && !p.includes("__"))
      .map((p) => `https://raw.githubusercontent.com/n8n-io/n8n/${sha}/${p}`);
  }
  const names = new Set(ADDED);
  for (const u of urls) {
    const src = await (await fetch(u)).text();
    for (const m of src.matchAll(/\bname:\s*['"]([A-Za-z0-9_]+)['"]/g)) names.add(m[1]);
    // Names held in constants, for example export const INPUT_SOURCE = 'inputSource'.
    for (const m of src.matchAll(/export const [A-Z_]+ = ['"]([A-Za-z0-9_]+)['"]/g)) names.add(m[1]);
  }
  cache.set(type, names);
  return names;
}

let problems = 0;
let checked = 0;
const names = readdirSync(`${root}workflows`).filter((d) => existsSync(`${root}workflows/${d}/workflow.json`));
for (const wf of names) {
  const json = JSON.parse(readFileSync(`${root}workflows/${wf}/workflow.json`, "utf8"));
  for (const node of json.nodes) {
    if (node.type.endsWith("stickyNote")) continue;
    const known = await namesFor(node.type === "n8n-nodes-looot.loootTool" ? "n8n-nodes-looot.looot" : node.type);
    const keys = [];
    for (const [k, v] of Object.entries(node.parameters)) {
      keys.push(k);
      if (COLLECTIONS.has(k) && v && typeof v === "object") keys.push(...Object.keys(v));
    }
    for (const k of keys) {
      checked++;
      if (!known.has(k)) { console.log(`${wf} / ${node.name} (${node.type}): unknown parameter ${k}`); problems++; }
    }
  }
}
console.log(`${checked} parameter names checked in ${names.length} workflows against n8n ${sha.slice(0, 10)} and n8n-nodes-looot: ${problems} unknown`);
process.exit(problems ? 1 : 0);
