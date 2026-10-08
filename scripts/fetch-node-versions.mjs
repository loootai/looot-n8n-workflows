// Refreshes test/n8n-node-versions.json from n8n's own source on GitHub, so the validation test
// checks every node type and typeVersion against what n8n actually ships.
// Usage: node scripts/fetch-node-versions.mjs [git ref, default master]
import { writeFileSync } from "node:fs";

const ref = process.argv[2] ?? "master";
const FILES = {
  "n8n-nodes-base.webhook": "Webhook/Webhook.node.ts",
  "n8n-nodes-base.httpRequest": "HttpRequest/HttpRequest.node.ts",
  "n8n-nodes-base.code": "Code/Code.node.ts",
  "n8n-nodes-base.if": "If/If.node.ts",
  "n8n-nodes-base.respondToWebhook": "RespondToWebhook/RespondToWebhook.node.ts",
  "n8n-nodes-base.scheduleTrigger": "Schedule/ScheduleTrigger.node.ts",
  "n8n-nodes-base.manualTrigger": "ManualTrigger/ManualTrigger.node.ts",
  "n8n-nodes-base.stickyNote": "StickyNote/StickyNote.node.ts",
};

const sha = ref.length === 40 ? ref : (await (await fetch(`https://api.github.com/repos/n8n-io/n8n/commits/${ref}`)).json()).sha;
const out = { source: `https://github.com/n8n-io/n8n/tree/${sha}/packages/nodes-base/nodes`, nodes: {} };
for (const [type, path] of Object.entries(FILES)) {
  const res = await fetch(`https://raw.githubusercontent.com/n8n-io/n8n/${sha}/packages/nodes-base/nodes/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const src = await res.text();
  let versions = [];
  const list = src.match(/\bversion:\s*\[([^\]]+)\]/);
  const single = src.match(/\bversion:\s*([0-9.]+)\s*,/);
  if (list) versions = list[1].split(",").map((v) => Number(v.trim()));
  else if (single) versions = [Number(single[1])];
  for (const m of src.matchAll(/^\s+([0-9.]+):\s*new\s+\w+/gm)) versions.push(Number(m[1]));
  versions = [...new Set(versions)].filter(Number.isFinite).sort((a, b) => a - b);
  if (versions.length === 0) throw new Error(`${path}: no versions found`);
  out.nodes[type] = versions;
}
writeFileSync(new URL("../test/n8n-node-versions.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
