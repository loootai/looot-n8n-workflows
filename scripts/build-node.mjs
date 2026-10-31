// Builds workflows/<name>/workflow.json for the workflows that use the verified looot community node
// (n8n-nodes-looot), from the definitions below and the Code node sources in code/<name>/*.js.
// A Code source can pull in a shared helper with a line `// @include <name>` (code/_shared/<name>.js).
// Run `npm run build` after editing; the tests fail if a JSON file is stale.
// Usage: node scripts/build-node.mjs [--check]
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;

/** Reads a Code node source and inlines its `// @include` helpers. */
function code(wf, file) {
  const src = readFileSync(`${root}code/${wf}/${file}.js`, "utf8");
  return src.replace(/^\/\/ @include ([a-z-]+)\n/m, (_, name) => readFileSync(`${root}code/_shared/${name}.js`, "utf8") + "\n");
}

function uuid(seed) {
  const h = createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const LOOOT_NODE = "n8n-nodes-looot.looot";
export const LOOOT_TOOL = "n8n-nodes-looot.loootTool";
const NODE_LINE = "Needs the verified community node **n8n-nodes-looot** (built against 0.1.4): Settings > Community nodes > Install, search `looot`. [Install guide](https://docs.n8n.io/integrations/community-nodes/installation/verified-install/)";
const TOKEN_LINE = "looot: sign up at [looot.ai](https://looot.ai), top up (from $5), create an agent token under Settings > Agent tokens, then add a **looot API** credential in n8n.";

// ---------- node helpers ----------
const sticky = (name, content, pos, width, height, color) => ({
  name, type: "n8n-nodes-base.stickyNote", typeVersion: 1, position: pos,
  parameters: color ? { content, width, height, color } : { content, width, height },
});
const mainNote = (content, pos = [-620, -240], height = 640) => sticky("Overview", content, pos, 520, height);
const section = (name, content, pos, width, height = 420) => sticky(name, content, pos, width, height, 7);
const warning = (name, content, pos, width = 260, height = 300) => sticky(name, content, pos, width, height, 3);

const codeNode = (wf, name, file, pos) => ({
  name, type: "n8n-nodes-base.code", typeVersion: 2, position: pos, parameters: { jsCode: code(wf, file) },
});

/** A looot Run node. Errors continue as an item, so one refused call does not stop a batch. */
const loootRun = (name, endpointId, input, pos, { cap = 0.05, key = "", wait = 60 } = {}) => ({
  name, type: LOOOT_NODE, typeVersion: 1, position: pos, onError: "continueRegularOutput",
  parameters: { operation: "run", endpointId, input, idempotencyKey: key, fallback: true, maxCostUsd: cap, wait },
});

// The agent fills these. The same $fromAI call text must be used everywhere it appears.
const EP = "$fromAI('endpointId', 'A looot job or endpoint id from the tool description', 'string')";
const IN = "$fromAI('input', 'The input object, with the field names the tool description gives for that id', 'json')";
/** looot as the agent's one tool: Run, with a hard cost cap per call and a key per distinct call. */
const loootTool = (name, description, pos, cap = 0.03) => ({
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
const loootSearchTool = (name, pos) => ({
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
const loootInspectTool = (name, pos) => ({
  name, type: LOOOT_TOOL, typeVersion: 1, position: pos,
  parameters: {
    descriptionType: "manual",
    toolDescription: "Free. Shows one endpoint's exact input fields, output and price before you run it. Also accepts job:<job id>.",
    operation: "inspect",
    endpointId: "={{ $fromAI('inspectId', 'The endpoint id or job:<job id> to inspect', 'string') }}",
  },
});

const model = (pos, name = "OpenAI chat model") => ({
  name, type: "@n8n/n8n-nodes-langchain.lmChatOpenAi", typeVersion: 1.2, position: pos,
  parameters: { model: { __rl: true, mode: "list", value: "gpt-4.1-mini" }, options: {} },
});
const parser = (name, example, pos) => ({
  name, type: "@n8n/n8n-nodes-langchain.outputParserStructured", typeVersion: 1.2, position: pos,
  parameters: { jsonSchemaExample: JSON.stringify(example, null, 2) },
});
const agent = (name, { text, system, maxIterations, parser: hasParser = false }, pos) => ({
  name, type: "@n8n/n8n-nodes-langchain.agent", typeVersion: 2.2, position: pos,
  parameters: {
    promptType: text ? "define" : "auto",
    ...(text ? { text } : {}),
    hasOutputParser: hasParser,
    options: { systemMessage: system, maxIterations, returnIntermediateSteps: true },
  },
});
const formTrigger = (wf, name, title, description, fields, pos) => ({
  name, type: "n8n-nodes-base.formTrigger", typeVersion: 2.2, position: pos, webhookId: uuid(`${wf}:form`),
  parameters: {
    formTitle: title,
    formDescription: description,
    formFields: { values: fields.map(([label, opts = {}]) => ({ fieldLabel: label, ...opts })) },
    options: {},
  },
});
const manual = (pos, name = "Run it") => ({ name, type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: pos, parameters: {} });
const schedule = (name, interval, pos) => ({ name, type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: pos, parameters: { rule: { interval: [interval] } } });
const noOp = (name, pos) => ({ name, type: "n8n-nodes-base.noOp", typeVersion: 1, position: pos, parameters: {} });
const ifTrue = (name, leftValue, pos) => ({
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

const SHEET_ID = { __rl: true, mode: "id", value: "YOUR_SPREADSHEET_ID" };
const sheetTab = (name) => ({ __rl: true, mode: "name", value: name });
const sheetsRead = (name, tab, pos) => ({
  name, type: "n8n-nodes-base.googleSheets", typeVersion: 4.6, position: pos,
  parameters: { operation: "read", documentId: SHEET_ID, sheetName: sheetTab(tab), options: {} },
});
const sheetsAppend = (name, tab, pos) => ({
  name, type: "n8n-nodes-base.googleSheets", typeVersion: 4.6, position: pos,
  parameters: {
    operation: "append", documentId: SHEET_ID, sheetName: sheetTab(tab),
    columns: { mappingMode: "autoMapInputData", value: {}, matchingColumns: [], schema: [] },
    options: {},
  },
});
/** Updates the row the item came from (matched on row_number), writing only `cols`. */
const sheetsUpdate = (name, tab, cols, pos) => ({
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
const slack = (name, pos) => ({
  name, type: "n8n-nodes-base.slack", typeVersion: 2.3, position: pos,
  parameters: { select: "channel", channelId: { __rl: true, mode: "id", value: "YOUR_CHANNEL_ID" }, text: "={{ $json.text }}", otherOptions: { mrkdwn: true } },
});
const hubspotUpsert = (name, fields, pos) => ({
  name, type: "n8n-nodes-base.hubspot", typeVersion: 2.1, position: pos,
  parameters: { authentication: "appToken", resource: "contact", operation: "upsert", email: "={{ $json.email }}", additionalFields: fields, options: {} },
});

const L = (node, type = "main", index = 0) => ({ node, type, index });

// ---------- shared copy ----------
const RUN_TOOL_HEAD = "Runs one looot data call and returns the run: status, result and actualCost. Every call is capped. Use only these ids and inputs:";

// ---------- workflows ----------
export const WORKFLOWS = {
  "google-maps-leads-agent": {
    title: "Find local business leads from Google Maps with an AI agent and looot into Google Sheets",
    rebuildOf: 3443,
    nodes: (wf) => [
      mainNote(`## Find local business leads from Google Maps into Google Sheets

### How it works
1. You fill in a short form: a business type, a place and how many leads you want.
2. An AI agent searches Google Maps through looot, then reads each business website through looot to find a contact email.
3. Each business lands as a row in Google Sheets with name, address, phone, website, rating, email and what the run cost.

One credential covers both the Maps search and the website reads, so there is no Apify or SerpAPI account to set up.

**Cost per run**, from looot's public catalog on 2026-10-31: Google Maps search $0.001 per call, website read from $0.0002 per page. 20 leads cost about $0.005 in data. Each call is capped at $0.03 and the agent at 25 steps, so one run can never spend more than $0.75. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- An OpenAI credential, or swap the model for any chat model.
- A Google Sheet with the headers: name, address, phone, website, rating, reviews, email, search, found_at, run_cost_usd. Set its ID in **Save leads**.
- Self-hosted n8n: set \`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true\` so the agent can use the looot node as a tool.

### Customization
Edit the agent's system message to ask for other fields, for example opening hours. Swap Google Sheets for your CRM node.`),
      formTrigger(wf, "Lead search form", "Find local business leads", "Searches Google Maps and each business website. Data is billed to your looot balance.", [
        ["Business type", { placeholder: "dentists", requiredField: true }],
        ["City or area", { placeholder: "Austin, Texas", requiredField: true }],
        ["How many leads", { fieldType: "number", placeholder: "20", requiredField: true }],
      ], [0, 0]),
      agent("Lead finder agent", {
        text: "=Find {{ Math.min(Number($json['How many leads']) || 10, 40) }} {{ $json['Business type'] }} in {{ $json['City or area'] }}.",
        system: "You build lead lists of local businesses. Steps:\n1. Call the looot tool once with job:maps.local.search and input {\"query\": \"<business type> in <place>\"}. If you need more results, call it again with \"page\": 2.\n2. For each business with a website, call the looot tool with job:web.scrape.markdown and input {\"url\": \"<website>\"} and look for a contact email on the page. Read at most one page per business. Skip businesses without a website.\n3. Never invent data. Leave a field empty when you did not find it.\nReturn every business in the leads array.",
        maxIterations: 25,
        parser: true,
      }, [260, 0]),
      model([180, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:maps.local.search, input {\"query\": \"dentists in Austin, Texas\", \"page\": 1}: Google Maps businesses with name, address, phone, website, rating.\n- job:web.scrape.markdown, input {\"url\": \"https://example.com\"}: one web page as text.`, [360, 260]),
      parser("Leads format", { leads: [{ name: "Example Dental", address: "1 Main St, Austin, TX", phone: "+1 512 555 0100", website: "https://example.com", rating: 4.8, reviews: 120, email: "hello@example.com" }] }, [540, 260]),
      codeNode(wf, "Leads to rows", "rows", [660, 0]),
      sheetsAppend("Save leads", "Leads", [900, 0]),
      section("Form section", "## Ask what to find\nBusiness type, place and count come from the form.", [-60, -180], 240, 380),
      section("Agent section", "## Search Maps, read websites\nThe agent's only data tool is looot: Maps search and website reads, each call capped at $0.03.", [200, -180], 440, 600),
      section("Save section", "## One row per business\nThe run's data cost is written on every row.", [650, -180], 440, 380),
    ],
    connections: {
      "Lead search form": { main: [[L("Lead finder agent")]] },
      "Lead finder agent": { main: [[L("Leads to rows")]] },
      "Leads to rows": { main: [[L("Save leads")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Lead finder agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Lead finder agent", "ai_tool")]] },
      "Leads format": { ai_outputParser: [[L("Lead finder agent", "ai_outputParser")]] },
    },
  },

  "deep-research-agent": {
    title: "Research any topic with one AI agent that searches Google, news and web pages through looot",
    rebuildOf: 2883,
    nodes: (wf) => [
      mainNote(`## Research any topic in chat with sources and a cost line

### How it works
1. You ask a question in n8n's chat.
2. One AI agent plans a few searches, runs them on Google, the web and Google News through looot, reads the best pages, then writes a report with links to its sources.
3. The last node adds how many data calls the answer took and what they cost.

The search, news and page reading all go through one looot credential, so there is no SerpAPI or Jina account to set up.

**Cost per run**, from looot's public catalog on 2026-10-31: Google results $0.0009 to $0.001 per search, news $0.001 per search, a page read from $0.0002. A report with 5 searches and 8 page reads costs about $0.007 in data. Each call is capped at $0.03 and the agent at 20 steps, so a run can never spend more than $0.60. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- An OpenAI credential, or swap the model for any chat model.
- Self-hosted n8n: set \`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true\` so the agent can use the looot node as a tool.

### Customization
Change the report format in the agent's system message. Raise Max Iterations for deeper reports. Add a Gmail or Notion node after **Add cost line** to keep the reports.`, [-620, -240], 600),
      { name: "Chat", type: "@n8n/n8n-nodes-langchain.chatTrigger", typeVersion: 1.3, position: [0, 0], webhookId: uuid(`${wf}:chat`), parameters: { options: {} } },
      agent("Research agent", {
        system: "You are a careful research assistant. For each question:\n1. Plan 3 to 6 search queries that cover the question from different sides.\n2. Run them with the looot tool: job:google.serp.organic for Google results, job:news.search for recent news, job:web.search when Google is thin.\n3. Pick the 5 to 8 most useful result URLs and read each with job:web.scrape.markdown.\n4. Write a report in markdown: a 3 line summary, then sections with findings, then a Sources list with every URL you used.\nOnly state what the pages say. Say when sources disagree or when you found nothing.",
        maxIterations: 20,
      }, [260, 0]),
      model([200, 260]),
      { name: "Chat memory", type: "@n8n/n8n-nodes-langchain.memoryBufferWindow", typeVersion: 1.3, position: [340, 260], parameters: { contextWindowLength: 6 } },
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:google.serp.organic, input {\"query\": \"...\", \"location\": \"United States\"}: Google organic results.\n- job:news.search, input {\"query\": \"...\"}: Google News articles.\n- job:web.search, input {\"query\": \"...\", \"limit\": 10}: web search results.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.`, [480, 260]),
      codeNode(wf, "Add cost line", "answer", [640, 0]),
      section("Agent section", "## Search, read, write\nThe agent's only data tool is looot. Every call is capped at $0.03.", [200, -180], 420, 600),
      section("Cost section", "## Show the cost\nAdds the number of looot calls and their cost under the report.", [600, -180], 240, 380),
    ],
    connections: {
      Chat: { main: [[L("Research agent")]] },
      "Research agent": { main: [[L("Add cost line")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Research agent", "ai_languageModel")]] },
      "Chat memory": { ai_memory: [[L("Research agent", "ai_memory")]] },
      looot: { ai_tool: [[L("Research agent", "ai_tool")]] },
    },
  },

  "competitor-research-agent": {
    title: "Research your competitors with one AI agent and looot and save a page per competitor in Notion",
    rebuildOf: 2354,
    nodes: (wf) => [
      mainNote(`## Research your competitors into Notion with one agent

### How it works
1. You set your company domain in **Your company**, and optionally the competitors to look at.
2. One AI agent finds competitors on Google if you listed none, then for each one pulls company data, reads its website and pricing page, checks recent news and review sites, all through looot.
3. Each competitor becomes a Notion page with overview, size and funding, pricing, products, news, what customers say and sources.

One looot credential replaces the Exa, Firecrawl and SerpAPI accounts this kind of workflow usually needs.

**Cost per run**, from looot's public catalog on 2026-10-31: company data $0.0019 per lookup, Google results $0.0009 to $0.001, news $0.001, a page read from $0.0002. Three competitors take about 20 calls, around $0.02 in data. Each call is capped at $0.03 and the agent at 40 steps, so a run can never spend more than $1.20. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- An OpenAI credential.
- A Notion integration with access to a database that has a Name title property. Set the database ID in **Save to Notion**.
- Self-hosted n8n: set \`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true\`.

### Customization
Change the fields in **Competitor format** and the agent's system message together. Swap the manual trigger for a weekly schedule.`, [-620, -240], 660),
      manual([0, 0]),
      codeNode(wf, "Your company", "input", [220, 0]),
      agent("Competitor research agent", {
        text: "=My company: {{ $json.domain }}.\n{{ $json.competitors.length ? 'Research these competitors: ' + $json.competitors.join(', ') : 'Find my ' + $json.max_competitors + ' closest competitors first, then research them.' }}",
        system: "You research competitors for a sales and marketing team.\nIf no competitors are given: read the company's homepage with job:web.scrape.markdown, then search Google with job:google.serp.organic for \"<product category> alternatives\" and pick the closest direct competitors.\nFor each competitor:\n- job:company.enrich with {\"domain\": \"...\"} for size, funding and industry.\n- job:web.scrape.markdown on the homepage and the pricing page.\n- job:news.search with {\"query\": \"\\\"<name>\\\"\"} for the last months.\n- job:google.serp.organic with {\"query\": \"<name> reviews g2 OR capterra\"} and read one review page.\nOnly report what the sources say and list every URL you used.",
        maxIterations: 40,
        parser: true,
      }, [440, 0]),
      model([380, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:company.enrich, input {\"domain\": \"example.com\"}: company size, industry, funding, location.\n- job:google.serp.organic, input {\"query\": \"...\"}: Google organic results.\n- job:news.search, input {\"query\": \"...\"}: Google News articles.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.`, [520, 260]),
      parser("Competitor format", { competitors: [{ name: "Example Inc", domain: "example.com", overview: "One line on what they sell and to whom.", size_and_funding: "120 people, Series A", pricing: "From $49 per seat per month", products: ["Product A"], recent_news: ["2026-10: raised a round"], reviews: ["Users like X, dislike Y"], sources: ["https://example.com/pricing"] }] }, [680, 260]),
      codeNode(wf, "One page per competitor", "pages", [860, 0]),
      {
        name: "Save to Notion", type: "n8n-nodes-base.notion", typeVersion: 2.2, position: [1080, 0],
        parameters: {
          resource: "databasePage",
          databaseId: { __rl: true, mode: "id", value: "YOUR_DATABASE_ID" },
          title: "={{ $json.title }}",
          blockUi: { blockValues: [{ textContent: "={{ $json.body }}" }] },
          options: {},
        },
      },
      section("Input section", "## Who to research\nYour domain and, if you want, a fixed list of competitors.", [-60, -180], 460, 380),
      section("Agent section", "## Find and research\nOne agent, one data tool. Company data, websites, news and reviews all come from looot.", [380, -180], 440, 600),
      section("Save section", "## One Notion page each\nEach page ends with its share of the data cost.", [820, -180], 440, 380),
    ],
    connections: {
      "Run it": { main: [[L("Your company")]] },
      "Your company": { main: [[L("Competitor research agent")]] },
      "Competitor research agent": { main: [[L("One page per competitor")]] },
      "One page per competitor": { main: [[L("Save to Notion")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Competitor research agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Competitor research agent", "ai_tool")]] },
      "Competitor format": { ai_outputParser: [[L("Competitor research agent", "ai_outputParser")]] },
    },
  },

  "linkedin-lead-enrichment-agent": {
    title: "Find and enrich LinkedIn leads with verified emails using one AI agent and looot",
    rebuildOf: 3791,
    nodes: (wf) => [
      mainNote(`## Find LinkedIn leads with verified emails into Google Sheets

### How it works
1. You fill in a form: job title, location, an optional company keyword and how many people.
2. One AI agent searches people through looot, reads each LinkedIn profile and recent posts, finds the work email and verifies it.
3. Each person lands in Google Sheets with title, company, email, email status, a short summary of their recent posts and a one line icebreaker.

This replaces a setup with separate Apollo, RapidAPI LinkedIn and email validation accounts. One looot credential covers search, profiles, posts, email finding and verification, and looot tries the next provider when one misses.

**Cost per lead**, from looot's public catalog on 2026-10-31: people search from $0.00036 per result, profile $0.0012, posts $0.0015, email find from $0.0036, verify $0.00145. About $0.008 per lead, $0.08 for 10. Each call is capped at $0.03 and the agent at 60 steps, so a run can never spend more than $1.80. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- An OpenAI credential.
- A Google Sheet with the headers: full_name, title, company, company_domain, linkedin_url, email, email_status, about, recent_post_topics, icebreaker, found_at, run_cost_usd. Set its ID in **Save leads**.
- Self-hosted n8n: set \`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true\`.

### Customization
Change the icebreaker rule in the system message. Drop the posts step to halve the cost.`, [-620, -240], 680),
      formTrigger(wf, "Lead search form", "Find LinkedIn leads", "Searches people, enriches each one and verifies the email. Data is billed to your looot balance.", [
        ["Job title", { placeholder: "Head of Marketing", requiredField: true }],
        ["Location", { placeholder: "Germany", requiredField: true }],
        ["Company keyword", { placeholder: "SaaS (optional)" }],
        ["How many people", { fieldType: "number", placeholder: "10", requiredField: true }],
      ], [0, 0]),
      agent("Lead research agent", {
        text: "=Find {{ Math.min(Number($json['How many people']) || 5, 10) }} people with the job title \"{{ $json['Job title'] }}\" in {{ $json['Location'] }}{{ $json['Company keyword'] ? ' at ' + $json['Company keyword'] + ' companies' : '' }}.",
        system: "You build enriched lead lists.\n1. Call job:people.search with {\"job_title\": \"...\", \"location\": \"...\", \"limit\": <count>} (add \"company\" when a keyword is given).\n2. For each person with a LinkedIn URL: job:linkedin.person.profile with {\"linkedin_url\": \"...\"}, then job:linkedin.person.posts with {\"linkedin_url\": \"...\"}.\n3. Find the work email with job:people.email.find using {\"first_name\", \"last_name\", \"domain\"} of their current company. If you get an address, check it with job:people.email.verify and {\"email\": \"...\"}.\n4. Write a one sentence icebreaker that refers to a real recent post or their role. Never invent facts; leave fields empty when unknown.\nemail_status is the verifier's word: valid, invalid, catch_all, risky or unknown.",
        maxIterations: 60,
        parser: true,
      }, [260, 0]),
      model([180, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:people.search, input {\"job_title\": \"...\", \"location\": \"...\", \"company\": \"...\", \"limit\": 10}: people with LinkedIn URLs.\n- job:linkedin.person.profile, input {\"linkedin_url\": \"...\"}: the profile.\n- job:linkedin.person.posts, input {\"linkedin_url\": \"...\"}: recent posts.\n- job:people.email.find, input {\"first_name\": \"...\", \"last_name\": \"...\", \"domain\": \"example.com\"}: work email.\n- job:people.email.verify, input {\"email\": \"...\"}: deliverability.`, [360, 260]),
      parser("Leads format", { leads: [{ full_name: "Ada Lovelace", title: "Head of Marketing", company: "Example GmbH", company_domain: "example.com", linkedin_url: "https://www.linkedin.com/in/example", email: "ada@example.com", email_status: "valid", about: "Two lines from the profile.", recent_post_topics: ["topic one"], icebreaker: "One sentence." }] }, [540, 260]),
      codeNode(wf, "Leads to rows", "rows", [660, 0]),
      sheetsAppend("Save leads", "Leads", [900, 0]),
      section("Form section", "## Who to find\nTitle, place, keyword and count.", [-60, -180], 240, 380),
      section("Agent section", "## Search, enrich, verify\nFive looot jobs behind one tool. looot tries the next provider on a miss.", [200, -180], 440, 600),
      section("Save section", "## One row per person\nPeople without a LinkedIn URL are dropped.", [650, -180], 440, 380),
    ],
    connections: {
      "Lead search form": { main: [[L("Lead research agent")]] },
      "Lead research agent": { main: [[L("Leads to rows")]] },
      "Leads to rows": { main: [[L("Save leads")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Lead research agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Lead research agent", "ai_tool")]] },
      "Leads format": { ai_outputParser: [[L("Lead research agent", "ai_outputParser")]] },
    },
  },

  "pre-call-social-brief": {
    title: "Email yourself a brief on every company you meet today with one AI agent and looot",
    rebuildOf: 2125,
    nodes: (wf) => [
      mainNote(`## Morning brief on every company on today's calendar

### How it works
1. Every weekday at 7, the workflow reads today's Google Calendar events.
2. It keeps outside companies from attendee email domains, skipping your own domain and free mail.
3. For each company, one AI agent pulls company data, recent LinkedIn company posts, recent posts on X and news through looot, and writes a short brief with talking points.
4. You get one email with a brief per company and what the data cost.

This replaces separate Clearbit and RapidAPI accounts for LinkedIn and X. One looot credential covers all four lookups.

**Cost per company**, from looot's public catalog on 2026-10-31: company data $0.0019, LinkedIn company posts $0.00188, X posts from $0.0005, news $0.001. About $0.006 per company. Each call is capped at $0.03 and each agent run at 8 steps, so a company can never cost more than $0.24, and the workflow handles at most 10 companies a day. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Google Calendar and Gmail credentials, and an OpenAI credential.
- Set YOUR_DOMAIN in **Companies to research** and your address in **Send the brief**.
- Self-hosted n8n: set \`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true\`.

### Customization
Send to Slack instead of Gmail. Change the brief format in the agent's prompt.`, [-620, -240], 680),
      schedule("Weekdays at 7", { field: "weeks", triggerAtDay: [1, 2, 3, 4, 5], triggerAtHour: 7 }, [0, 0]),
      {
        name: "Today's events", type: "n8n-nodes-base.googleCalendar", typeVersion: 1.3, position: [220, 0],
        parameters: {
          operation: "getAll",
          calendar: { __rl: true, mode: "id", value: "primary" },
          returnAll: true,
          timeMin: "={{ $now.startOf('day').toISO() }}",
          timeMax: "={{ $now.endOf('day').toISO() }}",
          options: {},
        },
      },
      codeNode(wf, "Companies to research", "companies", [440, 0]),
      agent("Brief agent", {
        text: "=Write a pre-call brief on the company at {{ $json.domain }}. Meetings today: {{ $json.meetings.map(m => m.title).join('; ') }}. People: {{ $json.people.join(', ') }}.",
        system: "You prepare sales reps for calls. For the company:\n1. job:company.enrich with {\"domain\": \"...\"}. It gives the name, size, industry and often LinkedIn and X links.\n2. If you have the LinkedIn company URL: job:linkedin.company.posts with {\"url\": \"...\"}.\n3. If you have the X handle: job:x.user.posts with {\"handle\": \"...\"}.\n4. job:news.search with {\"query\": \"\\\"<company name>\\\"\"}.\nWrite at most 150 words: who they are in one line, what they posted or announced lately, and 2 talking points. Only use what the data says.",
        maxIterations: 8,
      }, [660, 0]),
      model([600, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:company.enrich, input {\"domain\": \"example.com\"}: company data and social links.\n- job:linkedin.company.posts, input {\"url\": \"https://www.linkedin.com/company/example\"}: recent company posts.\n- job:x.user.posts, input {\"handle\": \"example\"}: recent posts on X.\n- job:news.search, input {\"query\": \"...\"}: Google News articles.`, [740, 260]),
      codeNode(wf, "Build the email", "email", [900, 0]),
      {
        name: "Send the brief", type: "n8n-nodes-base.gmail", typeVersion: 2.1, position: [1120, 0], webhookId: uuid(`${wf}:gmail`),
        parameters: { sendTo: "you@example.com", subject: "={{ $json.subject }}", message: "={{ $json.html }}", options: { appendAttribution: false } },
      },
      section("Calendar section", "## Who you meet today\nOutside companies from attendee domains, at most 10.", [-60, -180], 680, 380),
      section("Agent section", "## Research each company\nRuns once per company. Four looot jobs behind one tool.", [600, -180], 280, 600),
      warning("Set your address", "## Set your address\nReplace you@example.com with the inbox that should get the brief.", [1060, -180], 240, 380),
    ],
    connections: {
      "Weekdays at 7": { main: [[L("Today's events")]] },
      "Today's events": { main: [[L("Companies to research")]] },
      "Companies to research": { main: [[L("Brief agent")]] },
      "Brief agent": { main: [[L("Build the email")]] },
      "Build the email": { main: [[L("Send the brief")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Brief agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Brief agent", "ai_tool")]] },
    },
  },

  "post-engagers-to-hubspot": {
    title: "Turn people who engage with a LinkedIn post into HubSpot contacts with one AI agent and looot",
    rebuildOf: 1323,
    nodes: (wf) => [
      mainNote(`## LinkedIn post engagers to HubSpot contacts

### How it works
1. You paste a LinkedIn post URL into a form, for example a competitor's post or your own.
2. One AI agent reads the post's reactions and comments through looot, picks the people who match your buyer, finds each one's work email and verifies it.
3. People with a usable email are created or updated in HubSpot with name, title, company and their LinkedIn URL.

This replaces PhantomBuster for the scraping and Dropcontact for the emails. One looot credential covers reactions, comments, profiles, email finding and verification.

**Cost per post**, from looot's public catalog on 2026-10-31: reactions $0.0015 and comments $0.0015 per page, email find from $0.0036, verify $0.00145. 25 people cost about $0.13. Each call is capped at $0.03 and the agent at 80 steps, so a run can never spend more than $2.40. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A HubSpot private app token credential with contacts write access, and an OpenAI credential.
- Describe your buyer in the agent's system message (the ICP line).
- Self-hosted n8n: set \`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true\`.

### Customization
Add a lemlist or Instantly node after HubSpot to start a sequence. Lower the people count to spend less.`, [-620, -240], 660),
      formTrigger(wf, "Post URL form", "Import a LinkedIn post's engagers", "Reads reactions and comments, finds and verifies emails, then writes HubSpot contacts.", [
        ["LinkedIn post URL", { placeholder: "https://www.linkedin.com/posts/...", requiredField: true }],
        ["Max people", { fieldType: "number", placeholder: "25", requiredField: true }],
      ], [0, 0]),
      agent("Engager agent", {
        text: "=Post: {{ $json['LinkedIn post URL'] }}\nWork through at most {{ Math.min(Number($json['Max people']) || 10, 25) }} people.",
        system: "You turn LinkedIn post engagement into contacts.\nICP: people in sales, marketing or revenue roles at B2B companies. Edit this line for your buyer.\n1. fetchin-post-comments with {\"postUrlOrUrn\": \"<post url>\"}, then fetchin-post-reactions with the same input. Commenters come first.\n2. Keep people whose headline matches the ICP, up to the limit.\n3. For each, find the current company domain (job:linkedin.person.profile with {\"linkedin_url\": \"...\"} when the headline is not enough), then job:people.email.find with {\"first_name\", \"last_name\", \"domain\"}.\n4. Check every address with job:people.email.verify and {\"email\": \"...\"}.\nengagement is comment or reaction. Never invent an email.",
        maxIterations: 80,
        parser: true,
      }, [260, 0]),
      model([180, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- fetchin-post-comments, input {\"postUrlOrUrn\": \"https://www.linkedin.com/posts/...\", \"count\": 100}: commenters with names, headlines and profile URLs.\n- fetchin-post-reactions, input {\"postUrlOrUrn\": \"https://www.linkedin.com/posts/...\", \"count\": 100}: people who reacted.\n- job:linkedin.person.profile, input {\"linkedin_url\": \"...\"}: current company.\n- job:people.email.find, input {\"first_name\": \"...\", \"last_name\": \"...\", \"domain\": \"example.com\"}: work email.\n- job:people.email.verify, input {\"email\": \"...\"}: deliverability.`, [360, 260]),
      parser("People format", { people: [{ first_name: "Ada", last_name: "Lovelace", headline: "VP Marketing at Example", company: "Example", company_domain: "example.com", linkedin_url: "https://www.linkedin.com/in/example", engagement: "comment", email: "ada@example.com", email_status: "valid" }] }, [540, 260]),
      codeNode(wf, "Contacts with an email", "rows", [660, 0]),
      hubspotUpsert("Create or update contact", {
        firstName: "={{ $json.first_name }}",
        lastName: "={{ $json.last_name }}",
        jobTitle: "={{ $json.job_title }}",
        companyName: "={{ $json.company }}",
        websiteUrl: "={{ $json.company_domain ? 'https://' + $json.company_domain : '' }}",
      }, [900, 0]),
      section("Form section", "## Which post\nPaste the post URL and a people limit.", [-60, -180], 240, 380),
      section("Agent section", "## Engagers to verified emails\nComments, reactions, profiles, email find and verify, all through looot.", [200, -180], 440, 600),
      section("Save section", "## Write HubSpot contacts\nOnly people with a usable email. Invalid addresses are dropped.", [650, -180], 440, 380),
    ],
    connections: {
      "Post URL form": { main: [[L("Engager agent")]] },
      "Engager agent": { main: [[L("Contacts with an email")]] },
      "Contacts with an email": { main: [[L("Create or update contact")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Engager agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Engager agent", "ai_tool")]] },
      "People format": { ai_outputParser: [[L("Engager agent", "ai_outputParser")]] },
    },
  },

  "form-lead-enrichment-hubspot": {
    title: "Verify and enrich inbound form leads with looot before they reach HubSpot",
    rebuildOf: 2116,
    nodes: (wf) => [
      mainNote(`## Verify and enrich form leads, then save them to HubSpot

### How it works
1. Someone fills in your n8n form with name and business email.
2. looot checks the email. Invalid and unknown addresses stop at **Skip undeliverable**.
3. For deliverable addresses, looot enriches the company from the email domain: name, industry, size, city, country, LinkedIn.
4. The contact is created or updated in HubSpot with those fields.

No AI step: two looot calls and one HubSpot write. One looot credential replaces the Hunter and Clearbit accounts this flow usually needs, and both calls fall back to the next provider when one misses.

**Cost per lead**, from looot's public catalog on 2026-10-31: verify $0.00145, company data $0.0019. About $0.0034 per deliverable lead, $0.00145 for an undeliverable one. Each call is capped at $0.05, so a lead can never cost more than $0.10.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A HubSpot private app token credential with contacts write access.
- Activate the workflow and share the form's production URL, or call it from your site.

### Customization
Add fields to the form and map them in **Create or update contact**. Route deliverable leads to Slack as well.`, [-620, -240], 620),
      formTrigger(wf, "Lead form", "Talk to us", "We reply within one business day.", [
        ["First name", { requiredField: true }],
        ["Last name", { requiredField: true }],
        ["Business email", { fieldType: "email", requiredField: true }],
      ], [0, 0]),
      loootRun("Verify email", "job:people.email.verify", "={{ JSON.stringify({ email: String($json['Business email'] || '').trim().toLowerCase() }) }}", [220, 0],
        { key: "={{ 'n8n-form-verify:' + String($json['Business email'] || '').trim().toLowerCase() }}" }),
      codeNode(wf, "Read the verdict", "verdict", [440, 0]),
      ifTrue("Deliverable?", "={{ $json.deliverable }}", [660, 0]),
      loootRun("Enrich company", "job:company.enrich", "={{ JSON.stringify({ domain: $json.domain }) }}", [880, -100],
        { key: "={{ 'n8n-form-company:' + $json.domain }}" }),
      codeNode(wf, "Contact fields", "contact", [1100, -100]),
      hubspotUpsert("Create or update contact", {
        firstName: "={{ $json.first_name }}",
        lastName: "={{ $json.last_name }}",
        companyName: "={{ $json.company }}",
        industry: "={{ $json.industry }}",
        city: "={{ $json.city }}",
        country: "={{ $json.country }}",
        websiteUrl: "={{ $json.website }}",
      }, [1320, -100]),
      noOp("Skip undeliverable", [880, 140]),
      section("Verify section", "## Check the email first\nAn undeliverable address costs $0.00145 and goes no further.", [160, -180], 640, 400),
      section("Enrich section", "## Enrich and save\nCompany data from the email domain, then a HubSpot upsert.", [820, -240], 680, 300),
    ],
    connections: {
      "Lead form": { main: [[L("Verify email")]] },
      "Verify email": { main: [[L("Read the verdict")]] },
      "Read the verdict": { main: [[L("Deliverable?")]] },
      "Deliverable?": { main: [[L("Enrich company")], [L("Skip undeliverable")]] },
      "Enrich company": { main: [[L("Contact fields")]] },
      "Contact fields": { main: [[L("Create or update contact")]] },
    },
  },

  "work-email-to-sheets": {
    title: "Find and verify work emails for a Google Sheets lead list with a looot provider waterfall",
    nodes: (wf) => [
      mainNote(`## Work email waterfall for a Google Sheet

### How it works
1. Reads your lead sheet and keeps rows that have a name and a company domain but no email yet, up to 50 per run.
2. For each row, looot looks for the work email. With fallback on, looot tries the next email finder when one misses, inside the cap.
3. Found addresses are verified, then the row gets the email, its status (valid, invalid, catch_all, risky, unknown) and what it cost.
4. Rows where nothing was found are marked not_found so they are not paid for twice.

**Cost per row**, from looot's public catalog on 2026-10-31: email find from $0.0036, verify $0.00145. About $0.005 for a found and verified email. Each call is capped at $0.05, so 50 rows can never cost more than $5. A failed call costs $0, and the idempotency key stops a re-run from paying for the same lookup twice.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A Google Sheets credential.
- A sheet named Leads with the headers: first_name, last_name, domain, email, email_status, looot_cost_usd, checked_at. A full_name column works instead of the two name columns. Set the spreadsheet ID in the three Sheets nodes.

### Customization
Change MAX_ROWS in **Rows to look up**. Swap the manual trigger for a schedule to process new rows every hour.`, [-620, -240], 640),
      manual([0, 0]),
      sheetsRead("Read leads", "Leads", [220, 0]),
      codeNode(wf, "Rows to look up", "pick", [440, 0]),
      loootRun("Find work email", "job:people.email.find", "={{ JSON.stringify({ first_name: $json.first_name, last_name: $json.last_name, domain: $json.domain }) }}", [660, 0], { key: "={{ $json.key }}" }),
      codeNode(wf, "Found an email?", "found", [880, 0]),
      ifTrue("Email found?", "={{ $json.found }}", [1100, 0]),
      loootRun("Verify email", "job:people.email.verify", "={{ JSON.stringify({ email: $json.email }) }}", [1320, -100], { key: "={{ 'n8n-email-verify:' + $json.email }}" }),
      codeNode(wf, "Verified row", "verified", [1540, -100]),
      codeNode(wf, "Not found row", "notfound", [1320, 140]),
      sheetsUpdate("Write back", "Leads", ["email", "email_status", "looot_cost_usd", "checked_at"], [1760, 0]),
      section("Read section", "## Pick the rows\nOnly rows with a name and domain and no email yet.", [160, -180], 420, 400),
      section("Find section", "## Find, then verify\nThe finder walks several providers. Only found addresses are verified.", [600, -240], 1080, 520),
      section("Write section", "## Write the result back\nMatched on the sheet's row number.", [1700, -180], 240, 400),
    ],
    connections: {
      "Run it": { main: [[L("Read leads")]] },
      "Read leads": { main: [[L("Rows to look up")]] },
      "Rows to look up": { main: [[L("Find work email")]] },
      "Find work email": { main: [[L("Found an email?")]] },
      "Found an email?": { main: [[L("Email found?")]] },
      "Email found?": { main: [[L("Verify email")], [L("Not found row")]] },
      "Verify email": { main: [[L("Verified row")]] },
      "Verified row": { main: [[L("Write back")]] },
      "Not found row": { main: [[L("Write back")]] },
    },
  },

  "competitor-news-slack": {
    title: "Post a daily competitor news digest to Slack with looot Google News search",
    nodes: (wf) => [
      mainNote(`## Daily competitor news digest in Slack

### How it works
1. Every morning at 8, the workflow runs one Google News search per competitor through looot.
2. It keeps up to 3 articles per competitor that it has not sent before.
3. It posts one Slack message with the new articles and what the searches cost. No new articles, no message.

Sent links are remembered in the workflow's static data, which n8n keeps only for active workflows. Manual test runs do not remember them.

**Cost per day**, from looot's public catalog on 2026-10-31: news search $0.001 per call. Three competitors cost $0.003 a day, about $0.09 a month. Each call is capped at $0.05.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A Slack credential with chat:write, and the bot invited to the channel. Set the channel ID in **Post to Slack**.
- List your competitors in **Competitors**.

### Customization
Change PER_COMPETITOR in **Build the digest**. Add product names or founders to the list to catch more mentions.`, [-620, -240], 560),
      schedule("Every day at 8", { triggerAtHour: 8 }, [0, 0]),
      codeNode(wf, "Competitors", "competitors", [220, 0]),
      loootRun("Search news", "job:news.search", "={{ JSON.stringify({ query: $json.query }) }}", [440, 0]),
      codeNode(wf, "Build the digest", "digest", [660, 0]),
      slack("Post to Slack", [880, 0]),
      section("Search section", "## One news search per competitor\nEdit the list in Competitors.", [160, -180], 420, 380),
      section("Digest section", "## Only new articles\nLinks already posted are skipped.", [600, -180], 440, 380),
    ],
    connections: {
      "Every day at 8": { main: [[L("Competitors")]] },
      Competitors: { main: [[L("Search news")]] },
      "Search news": { main: [[L("Build the digest")]] },
      "Build the digest": { main: [[L("Post to Slack")]] },
    },
  },

  "hiring-signal-alert": {
    title: "Alert Slack when target accounts post sales and RevOps jobs using looot job search",
    nodes: (wf) => [
      mainNote(`## Hiring signal alerts for your target accounts

### How it works
1. Every weekday at 9, looot searches job postings for each account on your list.
2. Postings whose title matches a signal role (RevOps, sales ops, SDR, BDR, account executive, head of sales, growth) at that account are kept.
3. New postings go to Slack as one message. Postings already alerted are skipped.

A company hiring its first RevOps lead or a team of SDRs is usually about to buy sales tools. This puts that in front of the rep who owns the account.

Seen postings are remembered in the workflow's static data, which n8n keeps only for active workflows.

**Cost per day**, from looot's public catalog on 2026-10-31: job search from $0.0005 per call. 20 accounts cost about $0.01 a day. Each call is capped at $0.05.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A Slack credential with chat:write. Set the channel ID in **Post to Slack**.
- Put your accounts, search words and location in **Accounts and roles**.

### Customization
Edit the ROLE pattern in **New matching jobs** to watch other roles, for example data engineers for a data tool.`, [-620, -240], 600),
      schedule("Weekdays at 9", { field: "weeks", triggerAtDay: [1, 2, 3, 4, 5], triggerAtHour: 9 }, [0, 0]),
      codeNode(wf, "Accounts and roles", "accounts", [220, 0]),
      loootRun("Search jobs", "job:jobs.search", "={{ JSON.stringify({ query: $json.query, company: $json.company, location: $json.location }) }}", [440, 0]),
      codeNode(wf, "New matching jobs", "matches", [660, 0]),
      slack("Post to Slack", [880, 0]),
      section("Search section", "## Search each account\nOne job search per account on the list.", [160, -180], 420, 380),
      section("Match section", "## Keep real signals\nRole match, right company, not alerted before.", [600, -180], 440, 380),
    ],
    connections: {
      "Weekdays at 9": { main: [[L("Accounts and roles")]] },
      "Accounts and roles": { main: [[L("Search jobs")]] },
      "Search jobs": { main: [[L("New matching jobs")]] },
      "New matching jobs": { main: [[L("Post to Slack")]] },
    },
  },

  "verify-before-instantly": {
    title: "Verify a Google Sheets email list with looot before adding leads to an Instantly campaign",
    nodes: (wf) => [
      mainNote(`## Verify emails before they reach Instantly

### How it works
1. Reads your list from Google Sheets and keeps rows with an email and no email_status yet, up to 200 per run.
2. looot verifies each address, falling back to the next verifier when one cannot answer.
3. Every row gets its status written back: valid, invalid, catch_all, risky, unknown or unverified.
4. Only valid addresses are added to your Instantly campaign. Bounces hurt your sender reputation, so the rest stay out.

**Cost per row**, from looot's public catalog on 2026-10-31: verify $0.00145. 1,000 addresses cost about $1.45. Each call is capped at $0.05, and a failed call costs $0.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A Google Sheets credential. A sheet named List with the headers: email, first_name, last_name, company_name, email_status, looot_cost_usd, checked_at. Set the spreadsheet ID in both Sheets nodes.
- An Instantly API key with leads:create, saved as a **Bearer Auth** credential, and your campaign ID in **Add to Instantly**.

### Customization
Set SEND_CATCH_ALL to true in **Verdict** to also send catch-all addresses. Swap Instantly for lemlist or Smartlead with their n8n nodes.`, [-620, -240], 620),
      manual([0, 0]),
      sheetsRead("Read list", "List", [220, 0]),
      codeNode(wf, "Emails to check", "pick", [440, 0]),
      loootRun("Verify email", "job:people.email.verify", "={{ JSON.stringify({ email: $json.email }) }}", [660, 0], { key: "={{ 'n8n-email-verify:' + $json.email }}" }),
      codeNode(wf, "Verdict", "verdict", [880, 0]),
      sheetsUpdate("Write status", "List", ["email_status", "looot_cost_usd", "checked_at"], [1100, -140]),
      ifTrue("Valid?", "={{ $json.send }}", [1100, 80]),
      {
        name: "Add to Instantly", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [1320, 0],
        parameters: {
          method: "POST",
          url: "https://api.instantly.ai/api/v2/leads",
          authentication: "genericCredentialType",
          genericAuthType: "httpBearerAuth",
          sendBody: true,
          specifyBody: "json",
          jsonBody: "={{ JSON.stringify({ campaign: 'YOUR_CAMPAIGN_ID', email: $json.email, first_name: $json.first_name, last_name: $json.last_name, company_name: $json.company_name }) }}",
          options: {},
        },
      },
      noOp("Not sent", [1320, 220]),
      section("Verify section", "## Verify every address\nOne looot call per row, capped at $0.05.", [160, -180], 860, 380),
      warning("Set campaign", "## Set your campaign\nReplace YOUR_CAMPAIGN_ID before the first run, or leads go nowhere.", [1260, -240], 220, 380),
    ],
    connections: {
      "Run it": { main: [[L("Read list")]] },
      "Read list": { main: [[L("Emails to check")]] },
      "Emails to check": { main: [[L("Verify email")]] },
      "Verify email": { main: [[L("Verdict")]] },
      Verdict: { main: [[L("Write status"), L("Valid?")]] },
      "Valid?": { main: [[L("Add to Instantly")], [L("Not sent")]] },
    },
  },

  "hubspot-company-tech-stack": {
    title: "Add the tech stack to new HubSpot companies with looot technographics",
    nodes: (wf) => [
      mainNote(`## Tech stack on every new HubSpot company

### How it works
1. Every hour, reads companies recently created or updated in HubSpot.
2. Keeps those with a domain and an empty looot_tech_stack property, at most 25 per run.
3. looot looks up the technologies on each domain, falling back to the next provider when one misses.
4. The company's looot_tech_stack property gets a comma separated list, so reps and lists can filter on it.

Companies already done are remembered in the workflow's static data, which n8n keeps only for active workflows.

**Cost per company**, from looot's public catalog on 2026-10-31: tech lookup from $0 to $0.0089 depending on the provider that answers. Each call is capped at $0.05, so a run can never spend more than $1.25.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A HubSpot private app token credential with companies read and write access.
- In HubSpot, create a company property named looot_tech_stack (single-line or multi-line text).

### Customization
Change PROPERTY in **Companies without a stack** to write somewhere else. Add an IF after **Stack as text** to alert Slack when a company runs a competitor's product.`, [-620, -240], 600),
      schedule("Every hour", { field: "hours" }, [0, 0]),
      {
        name: "Recent companies", type: "n8n-nodes-base.hubspot", typeVersion: 2.1, position: [220, 0],
        parameters: { authentication: "appToken", resource: "company", operation: "getRecentlyCreatedUpdated", returnAll: false, limit: 100, additionalFields: {} },
      },
      codeNode(wf, "Companies without a stack", "pick", [440, 0]),
      loootRun("Look up tech stack", "job:company.technographics", "={{ JSON.stringify({ domain: $json.domain }) }}", [660, 0], { key: "={{ 'n8n-techstack:' + $json.domain }}" }),
      codeNode(wf, "Stack as text", "stack", [880, 0]),
      {
        name: "Update company", type: "n8n-nodes-base.hubspot", typeVersion: 2.1, position: [1100, 0],
        parameters: {
          authentication: "appToken", resource: "company", operation: "update",
          companyId: { __rl: true, mode: "id", value: "={{ $json.companyId }}" },
          updateFields: { customPropertiesUi: { customPropertiesValues: [{ property: "looot_tech_stack", value: "={{ $json.tech_stack }}" }] } },
        },
      },
      section("Pick section", "## New companies only\nA domain and no stack yet.", [160, -180], 420, 380),
      section("Lookup section", "## Look up and write\nOne looot call per company, then one HubSpot update.", [600, -180], 660, 380),
    ],
    connections: {
      "Every hour": { main: [[L("Recent companies")]] },
      "Recent companies": { main: [[L("Companies without a stack")]] },
      "Companies without a stack": { main: [[L("Look up tech stack")]] },
      "Look up tech stack": { main: [[L("Stack as text")]] },
      "Stack as text": { main: [[L("Update company")]] },
    },
  },

  "looot-agent": {
    title: "Reusable looot data agent: call it from any workflow with a task and a cost cap",
    component: true,
    nodes: (wf) => [
      mainNote(`## looot data agent, a sub-workflow you can call from anywhere

### How it works
Other workflows call this one with an **Execute Workflow** node and two inputs: \`task\` (plain words, for example "find the work email of Ada Lovelace at example.com") and \`max_cost_usd\` (the most one data call may cost).

1. The agent searches looot's catalog for the right endpoint. Search is free.
2. It inspects that endpoint to read its inputs and price. Inspect is free.
3. It runs it. The Run tool's cap comes from \`max_cost_usd\`, so a call above it is refused before any charge.
4. The calling workflow gets back \`answer\`, \`looot_calls\` and \`looot_cost_usd\`.

This is the pattern behind the other agent templates in this repo, without a fixed job list: one credential and one balance for 2,500+ endpoints.

**Cost**: the price of each call is shown by the inspect step before the run. The agent stops at 10 steps, so a task can never spend more than 10 times \`max_cost_usd\` (default $0.05). Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- An OpenAI credential.
- Self-hosted n8n: set \`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true\`.

### Customization
Narrow the system message to one domain, for example only email jobs, to make it faster and cheaper.`, [-620, -240], 660),
      {
        name: "When called by another workflow", type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1.1, position: [0, 0],
        parameters: { inputSource: "workflowInputs", workflowInputs: { values: [{ name: "task" }, { name: "max_cost_usd", type: "number" }] } },
      },
      agent("looot data agent", {
        text: "={{ $json.task }}",
        system: "You get business data for another workflow. For each task:\n1. Search the looot catalog for the task in plain words. Prefer a job id (job:<id>) when one fits, because looot then falls back between providers.\n2. Inspect the endpoint or job you picked to read its exact input fields and price.\n3. Run it with those fields. If it misses, say so; do not loop.\nAnswer with the data only, as compact JSON when the task asks for fields.",
        maxIterations: 10,
      }, [260, 0]),
      model([120, 260]),
      loootSearchTool("looot search", [260, 260]),
      loootInspectTool("looot inspect", [400, 260]),
      loootTool("looot run", "Runs a looot endpoint or job:<job id> with the input fields that inspect listed. Returns the run with status, result and actualCost.", [540, 260],
        "={{ Number($('When called by another workflow').first().json.max_cost_usd) || 0.05 }}"),
      codeNode(wf, "Answer and cost", "answer", [660, 0]),
      section("Agent section", "## Search, inspect, run\nSearch and inspect are free. Run is capped by max_cost_usd.", [80, -180], 560, 600),
    ],
    connections: {
      "When called by another workflow": { main: [[L("looot data agent")]] },
      "looot data agent": { main: [[L("Answer and cost")]] },
      "OpenAI chat model": { ai_languageModel: [[L("looot data agent", "ai_languageModel")]] },
      "looot search": { ai_tool: [[L("looot data agent", "ai_tool")]] },
      "looot inspect": { ai_tool: [[L("looot data agent", "ai_tool")]] },
      "looot run": { ai_tool: [[L("looot data agent", "ai_tool")]] },
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
      connections: def.connections,
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
    console.log(`wrote workflows/${wf}/workflow.json (${json.nodes.filter((n) => !n.type.endsWith("stickyNote")).length} nodes)`);
  }
  process.exit(stale ? 1 : 0);
}
