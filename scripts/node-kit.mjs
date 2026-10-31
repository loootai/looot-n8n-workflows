// Node builders shared by scripts/build-node.mjs and scripts/build-node-more.mjs.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const root = new URL("..", import.meta.url).pathname;

/** Reads a Code node source and inlines its `// @include` helpers. */
export function code(wf, file) {
  const src = readFileSync(`${root}code/${wf}/${file}.js`, "utf8");
  return src.replace(/^\/\/ @include ([a-z-]+)\n/m, (_, name) => readFileSync(`${root}code/_shared/${name}.js`, "utf8") + "\n");
}

export function uuid(seed) {
  const h = createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const LOOOT_NODE = "n8n-nodes-looot.looot";
export const LOOOT_TOOL = "n8n-nodes-looot.loootTool";
export const NODE_LINE = "Needs the verified community node **n8n-nodes-looot** (built against 0.1.4): Settings > Community nodes > Install, search `looot`. [Install guide](https://docs.n8n.io/integrations/community-nodes/installation/verified-install/)";
export const TOKEN_LINE = "looot: sign up at [looot.ai](https://looot.ai), top up (from $5), create an agent token under Settings > Agent tokens, then add a **looot API** credential in n8n.";

// ---------- node helpers ----------
export const sticky = (name, content, pos, width, height, color) => ({
  name, type: "n8n-nodes-base.stickyNote", typeVersion: 1, position: pos,
  parameters: color ? { content, width, height, color } : { content, width, height },
});
export const mainNote = (content, pos = [-620, -240], height = 640) => sticky("Overview", content, pos, 520, height);
export const section = (name, content, pos, width, height = 420) => sticky(name, content, pos, width, height, 7);
export const warning = (name, content, pos, width = 260, height = 300) => sticky(name, content, pos, width, height, 3);

export const codeNode = (wf, name, file, pos) => ({
  name, type: "n8n-nodes-base.code", typeVersion: 2, position: pos, parameters: { jsCode: code(wf, file) },
});

/** A looot Run node. Errors continue as an item, so one refused call does not stop a batch. */
export const loootRun = (name, endpointId, input, pos, { cap = 0.05, key = "", wait = 60 } = {}) => ({
  name, type: LOOOT_NODE, typeVersion: 1, position: pos, onError: "continueRegularOutput",
  parameters: { operation: "run", endpointId, input, idempotencyKey: key, fallback: true, maxCostUsd: cap, wait },
});

// The agent fills these. The same $fromAI call text must be used everywhere it appears.
export const EP = "$fromAI('endpointId', 'A looot job or endpoint id from the tool description', 'string')";
export const IN = "$fromAI('input', 'The input object, with the field names the tool description gives for that id', 'json')";
/** looot as the agent's one tool: Run, with a hard cost cap per call and a key per distinct call. */
export const loootTool = (name, description, pos, cap = 0.03) => ({
  name, type: LOOOT_TOOL, typeVersion: 1, position: pos,
  parameters: {
    descriptionType: "manual",
    toolDescription: description,
    operation: "run",
    endpointId: `={{ ${EP} }}`,
    input: `={{ ${IN} }}`,
    idempotencyKey: `={{ ('n8n-' + $execution.id + '-' + ${EP} + '-' + JSON.stringify(${IN})).slice(0, 200) }}`,
    fallback: true,
    maxCostUsd: cap,
    wait: 60,
  },
});
export const loootSearchTool = (name, pos) => ({
  name, type: LOOOT_TOOL, typeVersion: 1, position: pos,
  parameters: {
    descriptionType: "manual",
    toolDescription: "Free. Finds looot endpoints for a task described in plain words. Each row has an endpoint id, its price and whether it runs now.",
    operation: "searchCatalog",
    query: "={{ $fromAI('query', 'The task in plain words, for example find the work email of a person', 'string') }}",
    limit: 8,
    filters: { prefer: "balanced" },
  },
});
export const loootInspectTool = (name, pos) => ({
  name, type: LOOOT_TOOL, typeVersion: 1, position: pos,
  parameters: {
    descriptionType: "manual",
    toolDescription: "Free. Shows one endpoint's exact input fields, output and price before you run it. Also accepts job:<job id>.",
    operation: "inspect",
    endpointId: "={{ $fromAI('inspectId', 'The endpoint id or job:<job id> to inspect', 'string') }}",
  },
});

export const model = (pos, name = "OpenAI chat model") => ({
  name, type: "@n8n/n8n-nodes-langchain.lmChatOpenAi", typeVersion: 1.2, position: pos,
  parameters: { model: { __rl: true, mode: "list", value: "gpt-4.1-mini" }, options: {} },
});
export const parser = (name, example, pos) => ({
  name, type: "@n8n/n8n-nodes-langchain.outputParserStructured", typeVersion: 1.2, position: pos,
  parameters: { jsonSchemaExample: JSON.stringify(example, null, 2) },
});
export const agent = (name, { text, system, maxIterations, parser: hasParser = false }, pos) => ({
  name, type: "@n8n/n8n-nodes-langchain.agent", typeVersion: 2.2, position: pos,
  parameters: {
    promptType: text ? "define" : "auto",
    ...(text ? { text } : {}),
    hasOutputParser: hasParser,
    options: { systemMessage: system, maxIterations, returnIntermediateSteps: true },
  },
});
export const formTrigger = (wf, name, title, description, fields, pos) => ({
  name, type: "n8n-nodes-base.formTrigger", typeVersion: 2.2, position: pos, webhookId: uuid(`${wf}:form`),
  parameters: {
    formTitle: title,
    formDescription: description,
    formFields: { values: fields.map(([label, opts = {}]) => ({ fieldLabel: label, ...opts })) },
    options: {},
  },
});
export const manual = (pos, name = "Run it") => ({ name, type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: pos, parameters: {} });
export const schedule = (name, interval, pos) => ({ name, type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: pos, parameters: { rule: { interval: [interval] } } });
export const noOp = (name, pos) => ({ name, type: "n8n-nodes-base.noOp", typeVersion: 1, position: pos, parameters: {} });
export const ifTrue = (name, leftValue, pos) => ({
  name, type: "n8n-nodes-base.if", typeVersion: 2.2, position: pos,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
      conditions: [{ id: uuid(`${name}:cond`), leftValue, rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }],
      combinator: "and",
    },
    options: {},
  },
});

export const SHEET_ID = { __rl: true, mode: "id", value: "YOUR_SPREADSHEET_ID" };
export const sheetTab = (name) => ({ __rl: true, mode: "name", value: name });
export const sheetsRead = (name, tab, pos) => ({
  name, type: "n8n-nodes-base.googleSheets", typeVersion: 4.6, position: pos,
  parameters: { operation: "read", documentId: SHEET_ID, sheetName: sheetTab(tab), options: {} },
});
export const sheetsAppend = (name, tab, pos) => ({
  name, type: "n8n-nodes-base.googleSheets", typeVersion: 4.6, position: pos,
  parameters: {
    operation: "append", documentId: SHEET_ID, sheetName: sheetTab(tab),
    columns: { mappingMode: "autoMapInputData", value: {}, matchingColumns: [], schema: [] },
    options: {},
  },
});
/** Updates the row the item came from (matched on row_number), writing only `cols`. */
export const sheetsUpdate = (name, tab, cols, pos) => ({
  name, type: "n8n-nodes-base.googleSheets", typeVersion: 4.6, position: pos,
  parameters: {
    operation: "update", documentId: SHEET_ID, sheetName: sheetTab(tab),
    columns: {
      mappingMode: "defineBelow",
      value: Object.fromEntries(["row_number", ...cols].map((c) => [c, `={{ $json.${c} }}`])),
      matchingColumns: ["row_number"],
      schema: ["row_number", ...cols].map((c) => ({
        id: c, displayName: c, required: false, defaultMatch: false, display: true, type: c === "row_number" ? "number" : "string",
        canBeUsedToMatch: true, ...(c === "row_number" ? { readOnly: true, removed: false } : {}),
      })),
      attemptToConvertTypes: false,
      convertFieldsToString: false,
    },
    options: {},
  },
});
export const slack = (name, pos) => ({
  name, type: "n8n-nodes-base.slack", typeVersion: 2.3, position: pos,
  parameters: { select: "channel", channelId: { __rl: true, mode: "id", value: "YOUR_CHANNEL_ID" }, text: "={{ $json.text }}", otherOptions: { mrkdwn: true } },
});
export const hubspotUpsert = (name, fields, pos) => ({
  name, type: "n8n-nodes-base.hubspot", typeVersion: 2.1, position: pos,
  parameters: { authentication: "appToken", resource: "contact", operation: "upsert", email: "={{ $json.email }}", additionalFields: fields, options: {} },
});

export const L = (node, type = "main", index = 0) => ({ node, type, index });

// ---------- shared copy ----------
export const RUN_TOOL_HEAD = "Runs one looot data call and returns the run: status, result and actualCost. Every call is capped. Use only these ids and inputs:";
