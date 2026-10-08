// Builds workflows/<name>/workflow.json from the definitions below and the Code node sources in
// code/<name>/*.js. Run `npm run build` after editing; the test fails if a JSON file is stale.
// Usage: node scripts/build.mjs [--check]
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const code = (wf, file) => readFileSync(`${root}code/${wf}/${file}.js`, "utf8");

function uuid(seed) {
  const h = createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const CREDENTIAL = { httpHeaderAuth: { id: "", name: "looot API" } };

const webhook = (wf, path, pos) => ({
  name: "Webhook",
  type: "n8n-nodes-base.webhook",
  typeVersion: 2,
  position: pos,
  webhookId: uuid(`${wf}:webhook`),
  parameters: { httpMethod: "POST", path, responseMode: "responseNode", options: {} },
});

const codeNode = (wf, name, file, pos) => ({
  name,
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: pos,
  parameters: { jsCode: code(wf, file) },
});

const ifNext = (name, value, pos) => ({
  name,
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  position: pos,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
      conditions: [{ id: uuid(`${name}:${value}`), leftValue: "={{ $json.next }}", rightValue: value, operator: { type: "string", operation: "equals" } }],
      combinator: "and",
    },
    options: {},
  },
});

/** POST /v1/runs with the request the previous Code node built. Never throws on 4xx, so a 402 reaches the next node. */
const runNode = (name, pos) => ({
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: pos,
  credentials: CREDENTIAL,
  parameters: {
    method: "POST",
    url: "https://api.looot.ai/v1/runs",
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth",
    sendQuery: true,
    queryParameters: { parameters: [{ name: "wait", value: "60" }] },
    sendBody: true,
    specifyBody: "json",
    jsonBody: "={{ JSON.stringify($json.request) }}",
    options: { timeout: 75000, response: { response: { neverError: true } } },
  },
});

const respond = (pos) => ({
  name: "Respond",
  type: "n8n-nodes-base.respondToWebhook",
  typeVersion: 1.1,
  position: pos,
  parameters: { respondWith: "json", responseBody: "={{ JSON.stringify($json.response) }}", options: {} },
});

const note = (wf, text, pos, width = 420, height = 300) => ({
  name: "Read me",
  type: "n8n-nodes-base.stickyNote",
  typeVersion: 1,
  position: pos,
  parameters: { content: text, width, height },
});

const link = (to, index = 0) => ({ node: to, type: "main", index });

const WORKFLOWS = {
  "work-email": {
    title: "looot: work email waterfall with verification",
    nodes: (wf) => [
      note(wf, "## Work email waterfall\nPOST {first_name, last_name, domain} to the webhook.\nlooot tries up to 3 email finders for the same job, then checks the address.\nCap: $0.05 per lookup. A miss or a failed call costs $0.\nCredential: Header Auth named \"looot API\", Authorization = Bearer <your looot token>.", [-60, -260]),
      webhook(wf, "looot/work-email", [0, 100]),
      codeNode(wf, "Build find request", "build-find", [220, 100]),
      ifNext("Inputs ok?", "find", [440, 100]),
      runNode("Find email (looot)", [660, 0]),
      codeNode(wf, "Build verify request", "build-verify", [880, 0]),
      ifNext("Email found?", "verify", [1100, 0]),
      runNode("Verify email (looot)", [1320, -100]),
      codeNode(wf, "Shape answer", "shape", [1540, -100]),
      respond([1760, 100]),
    ],
    connections: {
      Webhook: [[link("Build find request")]],
      "Build find request": [[link("Inputs ok?")]],
      "Inputs ok?": [[link("Find email (looot)")], [link("Respond")]],
      "Find email (looot)": [[link("Build verify request")]],
      "Build verify request": [[link("Email found?")]],
      "Email found?": [[link("Verify email (looot)")], [link("Respond")]],
      "Verify email (looot)": [[link("Shape answer")]],
      "Shape answer": [[link("Respond")]],
    },
  },
  "company-research": {
    title: "looot: company research card",
    nodes: (wf) => [
      note(wf, "## Company research card\nPOST {domain} to the webhook.\nThree looot jobs run in one HTTP node: company.enrich, company.news, company.technographics.\nCap: $0.05 per job, $0.15 per card at most. Failed calls cost $0.\nCredential: Header Auth named \"looot API\".", [-60, -260]),
      webhook(wf, "looot/company-research", [0, 100]),
      codeNode(wf, "Build requests", "build", [220, 100]),
      ifNext("Domain ok?", "run", [440, 100]),
      runNode("Run jobs (looot)", [660, 0]),
      codeNode(wf, "Build card", "card", [880, 0]),
      respond([1100, 100]),
    ],
    connections: {
      Webhook: [[link("Build requests")]],
      "Build requests": [[link("Domain ok?")]],
      "Domain ok?": [[link("Run jobs (looot)")], [link("Respond")]],
      "Run jobs (looot)": [[link("Build card")]],
      "Build card": [[link("Respond")]],
    },
  },
  "signup-qualifier": {
    title: "looot: score new signups against your ICP",
    nodes: (wf) => [
      note(wf, "## Signup qualifier\nPOST {email} from your app's signup hook.\nFree-mail and bad addresses are skipped at $0.\nOtherwise looot enriches the person and the company, and the Score node rates them hot, warm or cold. Edit the ICP block in Score.\nCap: $0.05 per job, $0.10 per signup at most.", [-60, -260]),
      webhook(wf, "looot/signup", [0, 100]),
      codeNode(wf, "Check email", "build", [220, 100]),
      ifNext("Work email?", "run", [440, 100]),
      runNode("Enrich (looot)", [660, 0]),
      codeNode(wf, "Score against ICP", "score", [880, 0]),
      respond([1100, 100]),
    ],
    connections: {
      Webhook: [[link("Check email")]],
      "Check email": [[link("Work email?")]],
      "Work email?": [[link("Enrich (looot)")], [link("Respond")]],
      "Enrich (looot)": [[link("Score against ICP")]],
      "Score against ICP": [[link("Respond")]],
    },
  },
  "google-rank-check": {
    title: "looot: daily Google rank check",
    nodes: (wf) => [
      note(wf, "## Daily Google rank check\nEdit DOMAIN and KEYWORDS in the Keywords node.\nEach keyword is one Google results page through looot's serper-search endpoint, $0.001 per keyword.\nAdd a Google Sheets or Slack node after Find positions to keep the results.", [-60, -280]),
      { name: "Every day at 7", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [0, 0], parameters: { rule: { interval: [{ field: "days", triggerAtHour: 7 }] } } },
      { name: "Run now", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [0, 200], parameters: {} },
      codeNode(wf, "Keywords", "build", [220, 100]),
      runNode("Google results (looot)", [440, 100]),
      codeNode(wf, "Find positions", "positions", [660, 100]),
    ],
    connections: {
      "Every day at 7": [[link("Keywords")]],
      "Run now": [[link("Keywords")]],
      Keywords: [[link("Google results (looot)")]],
      "Google results (looot)": [[link("Find positions")]],
    },
  },
};

export function buildAll() {
  const out = {};
  for (const [wf, def] of Object.entries(WORKFLOWS)) {
    const nodes = def.nodes(wf).map((n) => {
      const { name, type, typeVersion, position, parameters, ...rest } = n;
      return { parameters, id: uuid(`${wf}:${name}`), name, type, typeVersion, position, ...rest };
    });
    out[wf] = {
      name: def.title,
      nodes,
      connections: Object.fromEntries(Object.entries(def.connections).map(([from, outs]) => [from, { main: outs }])),
      settings: { executionOrder: "v1" },
      pinData: {},
      meta: { templateCredsSetupCompleted: false },
    };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const [wf, json] of Object.entries(buildAll())) {
    const path = `${root}workflows/${wf}/workflow.json`;
    const text = JSON.stringify(json, null, 2) + "\n";
    if (check) {
      if (!existsSync(path) || readFileSync(path, "utf8") !== text) { console.log(`stale: ${path}`); stale++; }
      continue;
    }
    mkdirSync(`${root}workflows/${wf}`, { recursive: true });
    writeFileSync(path, text);
    console.log(`wrote workflows/${wf}/workflow.json (${json.nodes.length} nodes)`);
  }
  process.exit(stale ? 1 : 0);
}
