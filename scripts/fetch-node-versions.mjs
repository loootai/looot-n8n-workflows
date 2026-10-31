// Refreshes test/n8n-node-versions.json from n8n's own source on GitHub, so the validation test
// checks every node type and typeVersion against what n8n actually ships.
// Usage: node scripts/fetch-node-versions.mjs [git ref, default master]
import { writeFileSync } from "node:fs";

const ref = process.argv[2] ?? "master";
const BASE = "packages/nodes-base/nodes/";
const LC = "packages/@n8n/nodes-langchain/nodes/";
const FILES = {
  "n8n-nodes-base.webhook": BASE + "Webhook/Webhook.node.ts",
  "n8n-nodes-base.httpRequest": BASE + "HttpRequest/HttpRequest.node.ts",
  "n8n-nodes-base.code": BASE + "Code/Code.node.ts",
  "n8n-nodes-base.if": BASE + "If/If.node.ts",
  "n8n-nodes-base.respondToWebhook": BASE + "RespondToWebhook/RespondToWebhook.node.ts",
  "n8n-nodes-base.scheduleTrigger": BASE + "Schedule/ScheduleTrigger.node.ts",
  "n8n-nodes-base.manualTrigger": BASE + "ManualTrigger/ManualTrigger.node.ts",
  "n8n-nodes-base.stickyNote": BASE + "StickyNote/StickyNote.node.ts",
  "n8n-nodes-base.noOp": BASE + "NoOp/NoOp.node.ts",
  "n8n-nodes-base.formTrigger": BASE + "Form/FormTrigger.node.ts",
  "n8n-nodes-base.executeWorkflowTrigger": BASE + "ExecuteWorkflow/ExecuteWorkflowTrigger/ExecuteWorkflowTrigger.node.ts",
  "n8n-nodes-base.googleSheets": BASE + "Google/Sheet/GoogleSheets.node.ts",
  "n8n-nodes-base.googleCalendar": BASE + "Google/Calendar/GoogleCalendar.node.ts",
  "n8n-nodes-base.gmail": BASE + "Google/Gmail/Gmail.node.ts",
  "n8n-nodes-base.hubspot": BASE + "Hubspot/Hubspot.node.ts",
  "n8n-nodes-base.notion": BASE + "Notion/Notion.node.ts",
  "n8n-nodes-base.slack": BASE + "Slack/Slack.node.ts",
  "@n8n/n8n-nodes-langchain.agent": LC + "agents/Agent/Agent.node.ts",
  "@n8n/n8n-nodes-langchain.chatTrigger": LC + "trigger/ChatTrigger/ChatTrigger.node.ts",
  "@n8n/n8n-nodes-langchain.lmChatOpenAi": LC + "llms/LMChatOpenAi/LmChatOpenAi.node.ts",
  "@n8n/n8n-nodes-langchain.memoryBufferWindow": LC + "memory/MemoryBufferWindow/MemoryBufferWindow.node.ts",
  "@n8n/n8n-nodes-langchain.outputParserStructured": LC + "output_parser/OutputParserStructured/OutputParserStructured.node.ts",
  "@n8n/n8n-nodes-langchain.mcpClientTool": LC + "mcp/McpClientTool/McpClientTool.node.ts",
};
// The looot community node is not in n8n's repo; its versions come from its own source.
const COMMUNITY = {
  "n8n-nodes-looot.looot": "https://raw.githubusercontent.com/loootai/n8n-nodes-looot/main/nodes/Looot/Looot.node.ts",
};

const sha = ref.length === 40 ? ref : (await (await fetch(`https://api.github.com/repos/n8n-io/n8n/commits/${ref}`)).json()).sha;
const out = { source: `https://github.com/n8n-io/n8n/tree/${sha}`, nodes: {} };
for (const [type, path] of Object.entries({ ...FILES, ...COMMUNITY })) {
  const res = await fetch(path.startsWith("https://") ? path : `https://raw.githubusercontent.com/n8n-io/n8n/${sha}/${path}`);
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
// n8n adds a <name>Tool variant of every node that sets usableAsTool, with the same versions.
out.nodes["n8n-nodes-looot.loootTool"] = out.nodes["n8n-nodes-looot.looot"];
writeFileSync(new URL("../test/n8n-node-versions.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
