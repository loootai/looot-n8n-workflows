// Workflow definitions added in 0.3.0: eight more "one agent, one key" rebuilds, six more rebuilds
// without an agent or with a small one, and six GTM jobs on the plain looot node.
// scripts/build-node.mjs merges these into WORKFLOWS and writes the JSON files.
import {
  uuid, NODE_LINE, TOKEN_LINE, mainNote, section, warning, codeNode, loootRun, loootTool, model, parser, agent,
  formTrigger, manual, schedule, noOp, ifTrue, SHEET_ID, sheetTab, sheetsRead, sheetsAppend, sheetsUpdate, slack, hubspotUpsert, L, RUN_TOOL_HEAD,
} from "./node-kit.mjs";

const TOOL_LINE = "Self-hosted n8n: set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` so the agent can use the looot node as a tool.";
const PRICES = "from looot's public catalog on 2026-10-31";

const notion = (name, pos, blocks = ["={{ $json.body }}"]) => ({
  name, type: "n8n-nodes-base.notion", typeVersion: 2.2, position: pos,
  parameters: {
    resource: "databasePage",
    databaseId: { __rl: true, mode: "id", value: "YOUR_DATABASE_ID" },
    title: "={{ $json.title }}",
    blockUi: { blockValues: blocks.map((textContent) => ({ textContent })) },
    options: {},
  },
});
const gmail = (wf, name, sendTo, pos) => ({
  name, type: "n8n-nodes-base.gmail", typeVersion: 2.1, position: pos, webhookId: uuid(`${wf}:gmail`),
  parameters: { sendTo, subject: "={{ $json.subject }}", message: "={{ $json.html }}", options: { appendAttribution: false } },
});
const webhook = (wf, name, path, pos) => ({
  name, type: "n8n-nodes-base.webhook", typeVersion: 2, position: pos, webhookId: uuid(`${wf}:webhook`),
  parameters: { httpMethod: "POST", path, options: {} },
});
const instantly = (name, pos) => ({
  name, type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: pos,
  parameters: {
    method: "POST",
    url: "https://api.instantly.ai/api/v2/leads",
    authentication: "genericCredentialType",
    genericAuthType: "httpBearerAuth",
    sendBody: true,
    specifyBody: "json",
    jsonBody: "={{ JSON.stringify({ campaign: 'YOUR_CAMPAIGN_ID', email: $json.email, first_name: $json.first_name, last_name: $json.last_name, company_name: $json.company_name, personalization: $json.first_line }) }}",
    options: {},
  },
});
const weekly = (name, hour, pos) => schedule(name, { field: "weeks", triggerAtDay: [1], triggerAtHour: hour }, pos);

export const MORE_WORKFLOWS = {
  "apollo-outreach-agent": {
    title: "Find B2B leads, verify their emails and add them to an Instantly campaign with one AI agent and looot",
    rebuildOf: 6983,
    nodes: (wf) => [
      mainNote(`## B2B leads with verified emails and a first line, straight into Instantly

### How it works
1. You fill in a form: job title, location, an industry keyword, how many leads and one line on what you sell.
2. One AI agent searches people through looot, reads each LinkedIn profile and company homepage, finds the work email and verifies it.
3. It writes a one sentence first line per lead from what it read.
4. Only leads with a valid address go to your Instantly campaign, with the first line in the personalization field.

One looot credential replaces the Apify, Emailable, Jina and Perplexity accounts this flow usually needs.

**Cost per lead**, ${PRICES}: people search from $0.00036 per result, profile $0.0012, page read from $0.0002, email find from $0.0036, verify $0.00145. About $0.007 per lead. Each call is capped at $0.03 and the agent at 70 steps, so a run can never spend more than $2.10. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- An OpenAI credential.
- An Instantly API key with leads:create as a **Bearer Auth** credential, and your campaign ID in **Add to Instantly**.
- ${TOOL_LINE}

### Customization
Change the first line rule in the agent's system message. Add a Google Sheets node after **Valid leads only** to keep a copy.`, [-620, -240], 720),
      formTrigger(wf, "Lead search form", "Find leads for a campaign", "Searches people, verifies emails and writes a first line. Data is billed to your looot balance.", [
        ["Job title", { placeholder: "Head of Sales", requiredField: true }],
        ["Location", { placeholder: "United States", requiredField: true }],
        ["Industry keyword", { placeholder: "SaaS" }],
        ["How many leads", { fieldType: "number", placeholder: "10", requiredField: true }],
        ["What you sell, in one line", { placeholder: "Call recording for sales teams", requiredField: true }],
      ], [0, 0]),
      agent("Outreach research agent", {
        text: "=Find {{ Math.min(Number($json['How many leads']) || 10, 15) }} people with the job title \"{{ $json['Job title'] }}\" in {{ $json['Location'] }}{{ $json['Industry keyword'] ? ' at ' + $json['Industry keyword'] + ' companies' : '' }}.\nWe sell: {{ $json['What you sell, in one line'] }}",
        system: "You build cold email lists.\n1. job:people.search with {\"job_title\": \"...\", \"location\": \"...\", \"limit\": <count>} (add \"company\" for the keyword).\n2. For each person: job:linkedin.person.profile with {\"linkedin_url\": \"...\"}, then job:web.scrape.markdown on their company homepage.\n3. job:people.email.find with {\"first_name\", \"last_name\", \"domain\"}, then job:people.email.verify with {\"email\": \"...\"}. email_status is the verifier's word: valid, invalid, catch_all, risky or unknown.\n4. first_line: one sentence under 25 words that links something real from the profile or homepage to what we sell. No flattery, no invented facts.\nSkip people whose email you cannot find.",
        maxIterations: 70,
        parser: true,
      }, [260, 0]),
      model([180, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:people.search, input {\"job_title\": \"...\", \"location\": \"...\", \"company\": \"...\", \"limit\": 10}: people with LinkedIn URLs.\n- job:linkedin.person.profile, input {\"linkedin_url\": \"...\"}: the profile.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.\n- job:people.email.find, input {\"first_name\": \"...\", \"last_name\": \"...\", \"domain\": \"example.com\"}: work email.\n- job:people.email.verify, input {\"email\": \"...\"}: deliverability.`, [360, 260]),
      parser("Leads format", { leads: [{ first_name: "Ada", last_name: "Lovelace", title: "Head of Sales", company: "Example Inc", company_domain: "example.com", linkedin_url: "https://www.linkedin.com/in/example", email: "ada@example.com", email_status: "valid", first_line: "One sentence." }] }, [540, 260]),
      codeNode(wf, "Valid leads only", "rows", [660, 0]),
      instantly("Add to Instantly", [880, 0]),
      section("Form section", "## Who to reach\nTitle, place, keyword, count and your offer.", [-60, -180], 240, 380),
      section("Agent section", "## Search, read, verify, write\nFive looot jobs behind one tool, each call capped at $0.03.", [200, -180], 440, 600),
      warning("Set campaign", "## Set your campaign\nReplace YOUR_CAMPAIGN_ID in **Add to Instantly** before the first run.", [820, -180], 240, 380),
    ],
    connections: {
      "Lead search form": { main: [[L("Outreach research agent")]] },
      "Outreach research agent": { main: [[L("Valid leads only")]] },
      "Valid leads only": { main: [[L("Add to Instantly")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Outreach research agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Outreach research agent", "ai_tool")]] },
      "Leads format": { ai_outputParser: [[L("Outreach research agent", "ai_outputParser")]] },
    },
  },

  "linkedin-sheet-outreach-agent": {
    title: "Add verified emails and a personal message to LinkedIn leads in Google Sheets with one AI agent and looot",
    rebuildOf: 4685,
    nodes: (wf) => [
      mainNote(`## LinkedIn URLs in a sheet to verified emails and a personal message

### How it works
1. Every hour, the workflow reads your Leads sheet and picks up to 10 rows with a LinkedIn URL and an empty status.
2. For each row, one AI agent reads the profile and recent posts through looot, finds the work email and verifies it.
3. It writes a short personal message from what the person posted or does.
4. The row gets name, title, company, email, email status, the message, a status and what the row cost.

One looot credential replaces the Apollo, RapidAPI LinkedIn and Mails.so accounts this flow usually needs.

**Cost per row**, ${PRICES}: profile $0.0012, posts $0.0015, email find from $0.0036, verify $0.00145. About $0.008 per row. Each call is capped at $0.03 and each row's agent at 6 steps, so a row can never cost more than $0.18. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Google Sheets and OpenAI credentials.
- A sheet named Leads with the headers: linkedin_url, company_domain, full_name, title, company, email, email_status, message, status, looot_cost_usd, checked_at. Set the spreadsheet ID in both Sheets nodes.
- ${TOOL_LINE}

### Customization
Change MAX_ROWS in **Rows to enrich**. Edit the message rule in the agent's system message.`, [-620, -240], 720),
      schedule("Every hour", { field: "hours" }, [0, 0]),
      sheetsRead("Read leads", "Leads", [220, 0]),
      codeNode(wf, "Rows to enrich", "pick", [440, 0]),
      agent("Enrich and write agent", {
        text: "=LinkedIn profile: {{ $json.linkedin_url }}{{ $json.company_domain ? '\\nCompany domain: ' + $json.company_domain : '' }}",
        system: "You enrich one lead.\n1. job:linkedin.person.profile with {\"linkedin_url\": \"...\"}, then job:linkedin.person.posts with the same input.\n2. Find the company domain from the profile if it was not given, then job:people.email.find with {\"first_name\", \"last_name\", \"domain\"}.\n3. If you got an address, job:people.email.verify with {\"email\": \"...\"}.\n4. message: two sentences under 50 words that refer to a real recent post or their current role. Never invent facts.\nLeave a field empty when you did not find it.",
        maxIterations: 6,
        parser: true,
      }, [660, 0]),
      model([600, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:linkedin.person.profile, input {\"linkedin_url\": \"...\"}: the profile.\n- job:linkedin.person.posts, input {\"linkedin_url\": \"...\"}: recent posts.\n- job:people.email.find, input {\"first_name\": \"...\", \"last_name\": \"...\", \"domain\": \"example.com\"}: work email.\n- job:people.email.verify, input {\"email\": \"...\"}: deliverability.`, [740, 260]),
      parser("Lead format", { full_name: "Ada Lovelace", title: "VP Marketing", company: "Example Inc", email: "ada@example.com", email_status: "valid", message: "Two sentences." }, [880, 260]),
      codeNode(wf, "Row to write", "row", [1000, 0]),
      sheetsUpdate("Write back", "Leads", ["full_name", "title", "company", "email", "email_status", "message", "status", "looot_cost_usd", "checked_at"], [1220, 0]),
      section("Read section", "## Pick the rows\nA LinkedIn URL and no status yet, up to 10 an hour.", [-60, -180], 640, 380),
      section("Agent section", "## One agent run per row\nProfile, posts, email find and verify through one looot tool.", [600, -180], 380, 600),
      section("Write section", "## Write the row back\nMatched on the sheet's row number.", [980, -180], 420, 380),
    ],
    connections: {
      "Every hour": { main: [[L("Read leads")]] },
      "Read leads": { main: [[L("Rows to enrich")]] },
      "Rows to enrich": { main: [[L("Enrich and write agent")]] },
      "Enrich and write agent": { main: [[L("Row to write")]] },
      "Row to write": { main: [[L("Write back")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Enrich and write agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Enrich and write agent", "ai_tool")]] },
      "Lead format": { ai_outputParser: [[L("Enrich and write agent", "ai_outputParser")]] },
    },
  },

  "trial-signup-scoring-agent": {
    title: "Score new trial signups against your ICP with one AI agent and looot and alert Slack on hot leads",
    rebuildOf: 13644,
    nodes: (wf) => [
      mainNote(`## Score every new trial signup and post the hot ones to Slack

### How it works
1. Your app posts each new signup to the webhook: \`{"email": "...", "name": "..."}\`.
2. Free mail addresses stop at **Free mail, skipped** and cost nothing.
3. For work emails, one AI agent looks up the person and the company through looot and reads the company homepage, then scores the fit from 0 to 100 against your ICP.
4. Hot signups (70 or more) go to Slack with title, company, size and the reason. Edit the ICP line in the system message.

One looot credential replaces the Firecrawl and Scrapin.io accounts this flow usually needs.

**Cost per signup**, ${PRICES}: person from email from $0.0036, company data $0.0019, page read from $0.0002. About $0.006 per work email signup. Each call is capped at $0.03 and the agent at 6 steps, so a signup can never cost more than $0.18. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- OpenAI and Slack credentials. Set the channel ID in **Post to Slack**.
- Point your signup event at the production webhook URL.
- ${TOOL_LINE}

### Customization
Change HOT and WARM in **Score and route**. Add a HubSpot or Instantly node on the hot branch.`, [-620, -240], 700),
      webhook(wf, "New signup", "looot/trial-signup", [0, 0]),
      codeNode(wf, "Read the signup", "signup", [220, 0]),
      ifTrue("Work email?", "={{ $json.work_email }}", [440, 0]),
      agent("Fit scoring agent", {
        text: "=New signup: {{ $json.name }} <{{ $json.email }}>, company domain {{ $json.domain }}.",
        system: "You score new trial signups for a sales team.\nICP: B2B software companies with 20 to 2,000 employees; buyers in sales, marketing, RevOps or the founding team. Edit this line for your buyer.\n1. job:people.enrich.by-email with {\"email\": \"...\"} for name, title and LinkedIn.\n2. job:company.enrich with {\"domain\": \"...\"} for size, industry and country.\n3. job:web.scrape.markdown on https://<domain> to see what the company sells.\nfit_score 0 to 100. reason: one sentence with the facts behind the score. Never invent data.",
        maxIterations: 6,
        parser: true,
      }, [660, -100]),
      model([600, 160]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:people.enrich.by-email, input {\"email\": \"ada@example.com\"}: the person behind an email.\n- job:company.enrich, input {\"domain\": \"example.com\"}: company size, industry, country.\n- job:web.scrape.markdown, input {\"url\": \"https://example.com\"}: one page as text.`, [740, 160]),
      parser("Score format", { full_name: "Ada Lovelace", title: "Head of Sales", company: "Example Inc", company_size: "120 employees", industry: "Software", fit_score: 82, reason: "One sentence." }, [880, 160]),
      codeNode(wf, "Score and route", "route", [1000, -100]),
      ifTrue("Hot lead?", "={{ $json.hot }}", [1220, -100]),
      slack("Post to Slack", [1440, -200]),
      noOp("Not hot", [1440, 0]),
      noOp("Free mail, skipped", [440, 220]),
      section("Filter section", "## Work emails only\nFree mail stops here at $0.", [160, -180], 420, 380),
      section("Agent section", "## Look up and score\nPerson, company and homepage through one looot tool.", [600, -260], 380, 560),
      section("Route section", "## Hot signups to Slack\n70 or more by default.", [980, -260], 600, 420),
    ],
    connections: {
      "New signup": { main: [[L("Read the signup")]] },
      "Read the signup": { main: [[L("Work email?")]] },
      "Work email?": { main: [[L("Fit scoring agent")], [L("Free mail, skipped")]] },
      "Fit scoring agent": { main: [[L("Score and route")]] },
      "Score and route": { main: [[L("Hot lead?")]] },
      "Hot lead?": { main: [[L("Post to Slack")], [L("Not hot")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Fit scoring agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Fit scoring agent", "ai_tool")]] },
      "Score format": { ai_outputParser: [[L("Fit scoring agent", "ai_outputParser")]] },
    },
  },

  "content-trends-agent": {
    title: "Turn this week's news on your topics into content ideas in Google Sheets with one AI agent and looot",
    rebuildOf: 7372,
    nodes: (wf) => [
      mainNote(`## Weekly content ideas from what moved in your topics

### How it works
1. Every Monday at 8, **Topics** hands the agent your themes and audience.
2. One AI agent searches this week's news per topic, pulls Google autocomplete suggestions for the search terms people type, and reads the two most useful articles, all through looot.
3. It writes content ideas with a title, an angle, why it matters now, target keywords and sources.
4. Each idea lands as a row in Google Sheets.

One looot credential replaces the SerpAPI and Firecrawl accounts this flow usually needs.

**Cost per run**, ${PRICES}: news search $0.001, Google autocomplete $0.00099, a page read from $0.0002. Three topics cost about $0.01 in data. Each call is capped at $0.03 and the agent at 25 steps, so a run can never spend more than $0.75. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Google Sheets and OpenAI credentials.
- A sheet named Ideas with the headers: week, topic, title, angle, why_now, keywords, sources, cost_usd. Set its ID in **Save ideas**.
- Edit **Topics**.
- ${TOOL_LINE}

### Customization
Ask for LinkedIn post drafts instead of titles in the system message. Run it daily for news-heavy topics.`, [-620, -240], 680),
      weekly("Every Monday at 8", 8, [0, 0]),
      codeNode(wf, "Topics", "topics", [220, 0]),
      agent("Content strategy agent", {
        text: "=Topics: {{ $json.topics.join('; ') }}\nAudience: {{ $json.audience }}\nIdeas per topic: {{ $json.ideas_per_topic }}",
        system: "You plan content for a B2B brand.\nFor each topic:\n1. job:news.search with {\"query\": \"<topic>\"} and keep stories from the last 7 days.\n2. job:google.keywords.suggestions with {\"query\": \"<topic>\"} to see what people type.\n3. Read the two most useful articles with job:web.scrape.markdown.\nThen write the ideas: a specific title, the angle, why now in one sentence (cite the news), 3 to 5 keywords from the suggestions, and the source URLs. No generic ideas.",
        maxIterations: 25,
        parser: true,
      }, [440, 0]),
      model([380, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:news.search, input {\"query\": \"...\"}: Google News articles.\n- job:google.keywords.suggestions, input {\"query\": \"...\"}: Google autocomplete suggestions.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.`, [520, 260]),
      parser("Ideas format", { ideas: [{ topic: "cold email deliverability", title: "A specific title", angle: "The angle.", why_now: "One sentence citing the news.", keywords: ["keyword one"], sources: ["https://news.example.com/1"] }] }, [680, 260]),
      codeNode(wf, "Ideas to rows", "rows", [860, 0]),
      sheetsAppend("Save ideas", "Ideas", [1080, 0]),
      section("Topics section", "## What to watch\nEdit the topics and the audience.", [-60, -180], 460, 380),
      section("Agent section", "## News, searches, articles\nThree looot jobs behind one tool.", [380, -180], 440, 600),
      section("Save section", "## One row per idea\nEach row carries its share of the data cost.", [820, -180], 440, 380),
    ],
    connections: {
      "Every Monday at 8": { main: [[L("Topics")]] },
      Topics: { main: [[L("Content strategy agent")]] },
      "Content strategy agent": { main: [[L("Ideas to rows")]] },
      "Ideas to rows": { main: [[L("Save ideas")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Content strategy agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Content strategy agent", "ai_tool")]] },
      "Ideas format": { ai_outputParser: [[L("Content strategy agent", "ai_outputParser")]] },
    },
  },

  "research-report-email-agent": {
    title: "Email yourself a sourced research report on any topic with one AI agent and looot",
    rebuildOf: 3579,
    nodes: (wf) => [
      mainNote(`## A sourced research report in your inbox

### How it works
1. You fill in a form with a topic and the address that should get the report.
2. One AI agent plans a few searches, runs them on Google, the web and Google News through looot, reads the best pages and writes a report with links to its sources.
3. The report arrives by Gmail with how many data calls it took and what they cost.

One looot credential replaces the SerpAPI, Google Custom Search and NewsAPI keys this flow usually needs.

**Cost per report**, ${PRICES}: Google results $0.0009 to $0.001 per search, news $0.001, a page read from $0.0002. A report with 5 searches and 8 page reads costs about $0.007 in data. Each call is capped at $0.03 and the agent at 20 steps, so a report can never cost more than $0.60. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- OpenAI and Gmail credentials.
- ${TOOL_LINE}

### Customization
Change the report format in the agent's system message. Swap the form for a weekly schedule with a fixed topic to get a standing brief.`, [-620, -240], 620),
      formTrigger(wf, "Report form", "Research a topic", "Searches Google, the web and news, reads the best pages and emails you a report.", [
        ["Topic", { placeholder: "How mid-market companies buy sales tools in 2026", requiredField: true }],
        ["Send the report to", { fieldType: "email", requiredField: true }],
      ], [0, 0]),
      agent("Research agent", {
        text: "=Research this topic and write a report: {{ $json['Topic'] }}",
        system: "You are a careful research assistant.\n1. Plan 3 to 6 search queries that cover the topic from different sides.\n2. Run them with the looot tool: job:google.serp.organic for Google, job:news.search for recent news, job:web.search when Google is thin.\n3. Read the 5 to 8 most useful pages with job:web.scrape.markdown.\n4. Write markdown: a 3 line summary, sections with findings, then a Sources list with every URL as [title](url).\nOnly state what the pages say. Say when sources disagree.",
        maxIterations: 20,
      }, [260, 0]),
      model([200, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:google.serp.organic, input {\"query\": \"...\", \"location\": \"United States\"}: Google organic results.\n- job:news.search, input {\"query\": \"...\"}: Google News articles.\n- job:web.search, input {\"query\": \"...\", \"limit\": 10}: web search results.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.`, [360, 260]),
      codeNode(wf, "Build the email", "email", [520, 0]),
      gmail(wf, "Send the report", "={{ $json.to }}", [740, 0]),
      section("Agent section", "## Search, read, write\nThe agent's only data tool is looot. Every call is capped at $0.03.", [200, -180], 300, 600),
      section("Send section", "## Email the report\nMarkdown to HTML, a cost line, then Gmail.", [500, -180], 400, 380),
    ],
    connections: {
      "Report form": { main: [[L("Research agent")]] },
      "Research agent": { main: [[L("Build the email")]] },
      "Build the email": { main: [[L("Send the report")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Research agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Research agent", "ai_tool")]] },
    },
  },

  "account-brief-notion-agent": {
    title: "Turn a company domain into a full account brief in Notion with one AI agent and looot",
    rebuildOf: 10391,
    nodes: (wf) => [
      mainNote(`## A full account brief in Notion from one domain

### How it works
1. You fill in a form with a company domain and one line on what you sell.
2. One AI agent pulls company data, reads the homepage and pricing page, checks recent news, open jobs, the tech stack and review sites, all through looot.
3. It writes a brief: what they do, size and funding, pricing, tech stack, hiring, news, the pains you can solve and talking points, with sources.
4. The brief becomes a Notion page.

One looot credential replaces the Firecrawl and Perplexity accounts this flow usually needs.

**Cost per brief**, ${PRICES}: company data $0.0019, news $0.001, job search from $0.0005, tech stack $0 to $0.0089, Google results $0.0009 to $0.001, a page read from $0.0002. About $0.02 per brief. Each call is capped at $0.03 and the agent at 20 steps, so a brief can never cost more than $0.60. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- OpenAI and Notion credentials. A Notion database with a Name title property; set its ID in **Save to Notion**.
- ${TOOL_LINE}

### Customization
Change the brief fields in **Brief format** and the system message together. Trigger it from a new HubSpot deal instead of the form.`, [-620, -240], 700),
      formTrigger(wf, "Account form", "Research an account", "Builds a one page account brief in Notion.", [
        ["Company domain", { placeholder: "example.com", requiredField: true }],
        ["What you sell, in one line", { placeholder: "Call recording for sales teams", requiredField: true }],
      ], [0, 0]),
      agent("Account research agent", {
        text: "=Account: {{ $json['Company domain'] }}\nWe sell: {{ $json['What you sell, in one line'] }}",
        system: "You prepare account briefs for account executives.\n1. job:company.enrich with {\"domain\": \"...\"}.\n2. job:web.scrape.markdown on the homepage and the pricing page.\n3. job:news.search with {\"query\": \"\\\"<company name>\\\"\"}.\n4. job:jobs.search with {\"query\": \"<company name>\", \"company\": \"<company name>\"} for open roles.\n5. job:company.technographics with {\"domain\": \"...\"}.\n6. job:google.serp.organic with {\"query\": \"<company name> reviews\"}.\npains_we_solve and talking_points must tie a fact you found to what we sell. List every URL you used.",
        maxIterations: 20,
        parser: true,
      }, [260, 0]),
      model([180, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:company.enrich, input {\"domain\": \"example.com\"}: size, industry, funding, location.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.\n- job:news.search, input {\"query\": \"...\"}: Google News articles.\n- job:jobs.search, input {\"query\": \"...\", \"company\": \"...\"}: open job postings.\n- job:company.technographics, input {\"domain\": \"example.com\"}: technologies on the site.\n- job:google.serp.organic, input {\"query\": \"...\"}: Google organic results.`, [360, 260]),
      parser("Brief format", { name: "Example Inc", domain: "example.com", one_liner: "What they sell and to whom.", size: "120 employees", funding: "Series A", hq: "Austin, US", pricing: "From $49 per seat", tech_stack: ["HubSpot"], hiring: ["2 SDR roles"], recent_news: ["2026-10: launched X"], pains_we_solve: ["One line."], talking_points: ["One line."], sources: ["https://example.com/pricing"] }, [540, 260]),
      codeNode(wf, "Brief to page", "page", [660, 0]),
      notion("Save to Notion", [880, 0]),
      section("Form section", "## Which account\nA domain and your one line offer.", [-60, -180], 240, 380),
      section("Agent section", "## Six looot jobs, one tool\nCompany, pages, news, jobs, stack and reviews.", [200, -180], 440, 600),
      section("Save section", "## One Notion page\nThe page ends with what the data cost.", [650, -180], 420, 380),
    ],
    connections: {
      "Account form": { main: [[L("Account research agent")]] },
      "Account research agent": { main: [[L("Brief to page")]] },
      "Brief to page": { main: [[L("Save to Notion")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Account research agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Account research agent", "ai_tool")]] },
      "Brief format": { ai_outputParser: [[L("Account research agent", "ai_outputParser")]] },
    },
  },

  "maps-leads-outreach-agent": {
    title: "Find Google Maps leads with verified emails and a drafted opener using one AI agent and looot",
    rebuildOf: 6091,
    nodes: (wf) => [
      mainNote(`## Google Maps leads with a verified email and a first line

### How it works
1. You fill in a form: a business type, a place, how many leads and what you offer.
2. One AI agent searches Google Maps through looot, reads each business website for an email and something specific about them, and verifies the email.
3. It drafts a two sentence opener per business from what the site says.
4. Each business lands in Google Sheets with contact details, email status, notes from the site and the opener.

One looot credential replaces the Apify and Firecrawl accounts this flow usually needs.

**Cost per run**, ${PRICES}: Google Maps search $0.001 per call, a page read from $0.0002, verify $0.00145. 20 leads cost about $0.04 in data. Each call is capped at $0.03 and the agent at 45 steps, so a run can never spend more than $1.35. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Google Sheets and OpenAI credentials.
- A sheet named Leads with the headers: name, address, phone, website, email, email_status, website_notes, opener, search, found_at, run_cost_usd. Set its ID in **Save leads**.
- ${TOOL_LINE}

### Customization
Change the opener rule in the system message. Add an Instantly or Gmail draft node after **Save leads**.`, [-620, -240], 680),
      formTrigger(wf, "Lead search form", "Find local leads with an opener", "Searches Google Maps, reads each website and verifies the email.", [
        ["Business type", { placeholder: "physiotherapy clinics", requiredField: true }],
        ["City or area", { placeholder: "Manchester, UK", requiredField: true }],
        ["How many leads", { fieldType: "number", placeholder: "15", requiredField: true }],
        ["What you offer, in one line", { placeholder: "Online booking for clinics", requiredField: true }],
      ], [0, 0]),
      agent("Local outreach agent", {
        text: "=Find {{ Math.min(Number($json['How many leads']) || 10, 20) }} {{ $json['Business type'] }} in {{ $json['City or area'] }}.\nWe offer: {{ $json['What you offer, in one line'] }}",
        system: "You build local outreach lists.\n1. job:maps.local.search with {\"query\": \"<business type> in <place>\"}; add \"page\": 2 if you need more.\n2. For each business with a website: job:web.scrape.markdown on it (and the contact page if no email shows). Note one specific fact about them in website_notes.\n3. If you found an email: job:people.email.verify with {\"email\": \"...\"}.\n4. opener: two sentences under 40 words that use the fact and connect it to our offer.\nNever invent data. Skip businesses without a website.",
        maxIterations: 45,
        parser: true,
      }, [260, 0]),
      model([180, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:maps.local.search, input {\"query\": \"dentists in Austin, Texas\", \"page\": 1}: Google Maps businesses.\n- job:web.scrape.markdown, input {\"url\": \"https://example.com\"}: one page as text.\n- job:people.email.verify, input {\"email\": \"...\"}: deliverability.`, [360, 260]),
      parser("Leads format", { leads: [{ name: "Example Clinic", address: "1 High St, Manchester", phone: "+44 161 555 0100", website: "https://example.com", email: "hello@example.com", email_status: "valid", website_notes: "Opened a second site in 2026.", opener: "Two sentences." }] }, [540, 260]),
      codeNode(wf, "Leads to rows", "rows", [660, 0]),
      sheetsAppend("Save leads", "Leads", [900, 0]),
      section("Form section", "## What to find\nType, place, count and your offer.", [-60, -180], 240, 380),
      section("Agent section", "## Maps, website, verify, draft\nThree looot jobs behind one tool.", [200, -180], 440, 600),
      section("Save section", "## One row per business\nWith the email status and the opener.", [650, -180], 440, 380),
    ],
    connections: {
      "Lead search form": { main: [[L("Local outreach agent")]] },
      "Local outreach agent": { main: [[L("Leads to rows")]] },
      "Leads to rows": { main: [[L("Save leads")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Local outreach agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Local outreach agent", "ai_tool")]] },
      "Leads format": { ai_outputParser: [[L("Local outreach agent", "ai_outputParser")]] },
    },
  },

  "hubspot-contact-enrichment": {
    title: "Fill in job title, company and location on new HubSpot contacts with looot person enrichment",
    rebuildOf: 6103,
    nodes: (wf) => [
      mainNote(`## Job title, company and location on new HubSpot contacts

### How it works
1. Every hour, reads contacts recently created or updated in HubSpot.
2. Keeps work emails with an empty job title that were not tried before, at most 25 per run.
3. looot looks up the person behind each email, falling back to the next provider when one misses.
4. The contact gets job title, company, city and country. Contacts with no match are left alone.

No AI step. One looot credential replaces the Apollo and RapidAPI LinkedIn accounts this flow usually needs.

Contacts already tried are remembered in the workflow's static data, which n8n keeps only for active workflows.

**Cost per contact**, ${PRICES}: person from email from $0.0036. Each call is capped at $0.05, so a run can never spend more than $1.25. A failed call costs $0.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A HubSpot private app token credential with contacts read and write access, set in both HubSpot nodes.

### Customization
Change MAX in **Contacts to enrich**. Map more fields in **Update contact**, for example the LinkedIn URL into a custom property.`, [-620, -240], 640),
      schedule("Every hour", { field: "hours" }, [0, 0]),
      {
        name: "Recent contacts", type: "n8n-nodes-base.hubspot", typeVersion: 2.1, position: [220, 0],
        parameters: { authentication: "appToken", resource: "contact", operation: "getRecentlyCreatedUpdated", returnAll: false, limit: 100, additionalFields: {} },
      },
      codeNode(wf, "Contacts to enrich", "pick", [440, 0]),
      loootRun("Look up the person", "job:people.enrich.by-email", "={{ JSON.stringify({ email: $json.email }) }}", [660, 0], { key: "={{ 'n8n-person-by-email:' + $json.email }}" }),
      codeNode(wf, "Contact fields", "fields", [880, 0]),
      hubspotUpsert("Update contact", {
        firstName: "={{ $json.first_name }}",
        lastName: "={{ $json.last_name }}",
        jobTitle: "={{ $json.job_title }}",
        companyName: "={{ $json.company }}",
        city: "={{ $json.city }}",
        country: "={{ $json.country }}",
      }, [1100, 0]),
      section("Pick section", "## New contacts only\nWork email, no job title, not tried before.", [160, -180], 420, 380),
      section("Lookup section", "## Look up and write\nOne looot call per contact, then one HubSpot upsert.", [600, -180], 660, 380),
    ],
    connections: {
      "Every hour": { main: [[L("Recent contacts")]] },
      "Recent contacts": { main: [[L("Contacts to enrich")]] },
      "Contacts to enrich": { main: [[L("Look up the person")]] },
      "Look up the person": { main: [[L("Contact fields")]] },
      "Contact fields": { main: [[L("Update contact")]] },
    },
  },

  "calendly-prep-brief-agent": {
    title: "Post a research brief to Slack when someone books a Calendly meeting, with one AI agent and looot",
    rebuildOf: 8957,
    nodes: (wf) => [
      mainNote(`## A brief on every new Calendly booking, in Slack

### How it works
1. Someone books a meeting on your Calendly.
2. The workflow reads who booked, the event, the time and their answers to your booking questions.
3. One AI agent looks up the person behind the email, their LinkedIn profile, the company and recent news through looot.
4. A short brief with who they are, what the company does, what is new and three questions to ask lands in Slack.

One looot credential replaces the Perplexity and RapidAPI accounts this flow usually needs.

**Cost per booking**, ${PRICES}: person from email from $0.0036, profile $0.0012, company data $0.0019, news $0.001. About $0.008 per booking. Each call is capped at $0.03 and the agent at 8 steps, so a booking can never cost more than $0.24. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Calendly (OAuth2), OpenAI and Slack credentials. Set the channel ID in **Post to Slack**.
- ${TOOL_LINE}

### Customization
Send the brief by Gmail instead of Slack. Add your offer to the system message so the questions fit it.`, [-620, -240], 640),
      {
        name: "New Calendly booking", type: "n8n-nodes-base.calendlyTrigger", typeVersion: 2, position: [0, 0], webhookId: uuid(`${wf}:calendly`),
        parameters: { scope: "user", events: ["invitee.created"] },
      },
      codeNode(wf, "Read the booking", "invitee", [220, 0]),
      agent("Meeting prep agent", {
        text: "=Prepare me for a meeting with {{ $json.name }} <{{ $json.email }}>{{ $json.work_email ? ' from ' + $json.domain : '' }}.\nEvent: {{ $json.event_name }} at {{ $json.start_time }}.\nTheir answers:\n{{ $json.answers }}",
        system: "You prepare a seller for a booked call.\n1. job:people.enrich.by-email with {\"email\": \"...\"}.\n2. If you get a LinkedIn URL: job:linkedin.person.profile with {\"linkedin_url\": \"...\"}.\n3. If the email is on a company domain: job:company.enrich with {\"domain\": \"...\"} and job:news.search with {\"query\": \"\\\"<company name>\\\"\"}.\nWrite at most 150 words in Slack markdown: who they are, what the company does, what is new, and 3 questions to ask that use their booking answers. Only use what the data says.",
        maxIterations: 8,
      }, [440, 0]),
      model([380, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:people.enrich.by-email, input {\"email\": \"ada@example.com\"}: the person behind an email.\n- job:linkedin.person.profile, input {\"linkedin_url\": \"...\"}: the profile.\n- job:company.enrich, input {\"domain\": \"example.com\"}: company data.\n- job:news.search, input {\"query\": \"...\"}: Google News articles.`, [520, 260]),
      codeNode(wf, "Slack message", "message", [700, 0]),
      slack("Post to Slack", [920, 0]),
      section("Booking section", "## Who booked\nName, email, event, time and booking answers.", [-60, -180], 460, 380),
      section("Agent section", "## Research the booking\nFour looot jobs behind one tool.", [380, -180], 300, 600),
      section("Slack section", "## Brief in Slack\nWith the data cost of the brief.", [680, -180], 420, 380),
    ],
    connections: {
      "New Calendly booking": { main: [[L("Read the booking")]] },
      "Read the booking": { main: [[L("Meeting prep agent")]] },
      "Meeting prep agent": { main: [[L("Slack message")]] },
      "Slack message": { main: [[L("Post to Slack")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Meeting prep agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Meeting prep agent", "ai_tool")]] },
    },
  },

  "job-postings-research-agent": {
    title: "Find companies hiring for a role and research each one with one AI agent and looot into Google Sheets",
    rebuildOf: 6076,
    nodes: (wf) => [
      mainNote(`## Job postings to researched accounts in Google Sheets

### How it works
1. You fill in a form: the job title to look for, a location, how many postings and what you sell.
2. One AI agent searches job postings through looot, then for each hiring company finds its domain, pulls company data and reads its homepage.
3. It says in one line why each company is worth a call, given what you sell.
4. Each posting lands as a row in Google Sheets.

A company hiring for a role you help with is a buying signal. One looot credential replaces the Apify and Tavily accounts this flow usually needs.

**Cost per run**, ${PRICES}: job search from $0.0005 per call, Google results $0.0009 to $0.001, company data $0.0019, a page read from $0.0002. 10 postings cost about $0.04 in data. Each call is capped at $0.03 and the agent at 40 steps, so a run can never spend more than $1.20. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Google Sheets and OpenAI credentials.
- A sheet named Postings with the headers: job_title, company, company_domain, location, job_url, company_size, industry, company_summary, why_relevant, search, found_at, cost_usd. Set its ID in **Save postings**.
- ${TOOL_LINE}

### Customization
Add a filter rule to the system message, for example only companies under 500 employees.`, [-620, -240], 700),
      formTrigger(wf, "Job search form", "Find companies hiring", "Searches job postings and researches each hiring company.", [
        ["Job title", { placeholder: "RevOps Manager", requiredField: true }],
        ["Location", { placeholder: "United States", requiredField: true }],
        ["How many postings", { fieldType: "number", placeholder: "10", requiredField: true }],
        ["What you sell, in one line", { placeholder: "CRM data cleanup", requiredField: true }],
      ], [0, 0]),
      agent("Hiring research agent", {
        text: "=Find {{ Math.min(Number($json['How many postings']) || 10, 20) }} job postings for \"{{ $json['Job title'] }}\" in {{ $json['Location'] }}, one per company.\nWe sell: {{ $json['What you sell, in one line'] }}",
        system: "You turn job postings into researched accounts.\n1. job:jobs.search with {\"query\": \"<job title>\", \"location\": \"...\", \"limit\": 25}. Keep one posting per company.\n2. For each company: job:google.serp.organic with {\"query\": \"<company> official site\"} to find the domain, then job:company.enrich with {\"domain\": \"...\"} and job:web.scrape.markdown on the homepage.\n3. company_summary: one line on what they sell. why_relevant: one line linking the posting to what we sell.\nNever invent data. Leave a field empty when unknown.",
        maxIterations: 40,
        parser: true,
      }, [260, 0]),
      model([180, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:jobs.search, input {\"query\": \"RevOps Manager\", \"location\": \"United States\", \"limit\": 25}: job postings.\n- job:google.serp.organic, input {\"query\": \"...\"}: Google organic results.\n- job:company.enrich, input {\"domain\": \"example.com\"}: size, industry, location.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.`, [360, 260]),
      parser("Postings format", { postings: [{ job_title: "RevOps Manager", company: "Example Inc", company_domain: "example.com", location: "Remote, US", job_url: "https://jobs.example.com/1", company_size: "120 employees", industry: "Software", company_summary: "One line.", why_relevant: "One line." }] }, [540, 260]),
      codeNode(wf, "Postings to rows", "rows", [660, 0]),
      sheetsAppend("Save postings", "Postings", [900, 0]),
      section("Form section", "## Which role\nTitle, place, count and your offer.", [-60, -180], 240, 380),
      section("Agent section", "## Postings to accounts\nFour looot jobs behind one tool.", [200, -180], 440, 600),
      section("Save section", "## One row per posting\nWith the company research and the reason.", [650, -180], 440, 380),
    ],
    connections: {
      "Job search form": { main: [[L("Hiring research agent")]] },
      "Hiring research agent": { main: [[L("Postings to rows")]] },
      "Postings to rows": { main: [[L("Save postings")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Hiring research agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Hiring research agent", "ai_tool")]] },
      "Postings format": { ai_outputParser: [[L("Hiring research agent", "ai_outputParser")]] },
    },
  },

  "seo-content-brief-agent": {
    title: "Write an SEO content brief from live Google results with one AI agent and looot into Notion",
    rebuildOf: 10829,
    nodes: (wf) => [
      mainNote(`## SEO content brief from the pages that rank today

### How it works
1. You fill in a form with a keyword and a country.
2. One AI agent reads Google's top results and autocomplete suggestions for the keyword through looot, then reads the top 3 to 5 ranking pages.
3. It writes a brief: search intent, a title, an H2 outline, questions to answer, related keywords, the length of the ranking pages and what they all miss.
4. The brief becomes a Notion page.

One looot credential replaces the DataForSEO and SerpAPI accounts this flow usually needs.

**Cost per brief**, ${PRICES}: Google results $0.0009 to $0.001, autocomplete $0.00099, a page read from $0.0002. About $0.004 per brief. Each call is capped at $0.03 and the agent at 15 steps, so a brief can never cost more than $0.45. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- OpenAI and Notion credentials. A Notion database with a Name title property; set its ID in **Save to Notion**.
- ${TOOL_LINE}

### Customization
Add your brand voice and product to the system message. Swap Notion for Google Docs.`, [-620, -240], 640),
      formTrigger(wf, "Brief form", "Write a content brief", "Reads today's Google results for a keyword and writes a brief in Notion.", [
        ["Keyword", { placeholder: "email verification api", requiredField: true }],
        ["Country", { placeholder: "United States", requiredField: true }],
      ], [0, 0]),
      agent("SEO brief agent", {
        text: "=Keyword: {{ $json['Keyword'] }}\nCountry: {{ $json['Country'] }}",
        system: "You write SEO content briefs.\n1. job:google.serp.organic with {\"query\": \"<keyword>\", \"location\": \"<country>\"}.\n2. job:google.keywords.suggestions with {\"query\": \"<keyword>\"}.\n3. Read the top 3 to 5 organic pages with job:web.scrape.markdown.\nWrite the brief in plain text under 5,000 characters: search intent, a title, an H2 outline, questions to answer, related keywords, the rough word count of the ranking pages, what they all miss, and the URLs you read.",
        maxIterations: 15,
      }, [260, 0]),
      model([200, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:google.serp.organic, input {\"query\": \"...\", \"location\": \"United States\"}: Google organic results.\n- job:google.keywords.suggestions, input {\"query\": \"...\"}: Google autocomplete suggestions.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.`, [360, 260]),
      codeNode(wf, "Brief to page", "page", [520, 0]),
      notion("Save to Notion", [740, 0], ["={{ $json.part1 }}", "={{ $json.part2 }}", "={{ $json.part3 }}"]),
      section("Agent section", "## Results, suggestions, pages\nThree looot jobs behind one tool.", [200, -180], 300, 600),
      section("Save section", "## One Notion page\nSplit into blocks of up to 1,990 characters.", [500, -180], 400, 380),
    ],
    connections: {
      "Brief form": { main: [[L("SEO brief agent")]] },
      "SEO brief agent": { main: [[L("Brief to page")]] },
      "Brief to page": { main: [[L("Save to Notion")]] },
      "OpenAI chat model": { ai_languageModel: [[L("SEO brief agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("SEO brief agent", "ai_tool")]] },
    },
  },

  "instagram-content-ideas-agent": {
    title: "Turn the best recent posts of Instagram accounts into content ideas with one AI agent and looot",
    rebuildOf: 4658,
    nodes: (wf) => [
      mainNote(`## Weekly content ideas from the Instagram accounts you watch

### How it works
1. Every Monday at 8, **Accounts to watch** hands the agent a list of Instagram handles and your audience.
2. One AI agent reads each account's recent posts through looot and picks the ones with the most likes and comments.
3. For the best ones it searches the web for context, then writes why each post worked and an idea with a hook for your audience.
4. Each idea lands as a row in Google Sheets.

One looot credential replaces the Apify and Perplexity accounts this flow usually needs.

**Cost per run**, ${PRICES}: Instagram posts $0.00188 per account, web search from $0 per result. Three accounts cost about $0.01 in data. Each call is capped at $0.03 and the agent at 20 steps, so a run can never spend more than $0.60. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Google Sheets and OpenAI credentials.
- A sheet named Ideas with the headers: week, source_handle, post_url, likes, comments, why_it_worked, idea, hook, cost_usd. Set its ID in **Save ideas**.
- Edit the handles in **Accounts to watch**.
- ${TOOL_LINE}

### Customization
Ask for reel scripts instead of ideas in the system message. Read the handles from a sheet instead of the Code node.`, [-620, -240], 680),
      weekly("Every Monday at 8", 8, [0, 0]),
      codeNode(wf, "Accounts to watch", "accounts", [220, 0]),
      agent("Content discovery agent", {
        text: "=Instagram accounts: {{ $json.handles.join(', ') }}\nOur audience: {{ $json.audience }}\nRead up to {{ $json.posts_per_account }} recent posts per account.",
        system: "You find content that works on Instagram and adapt it.\n1. For each handle: job:instagram.user.posts with {\"handle\": \"<handle without @>\"}.\n2. Pick the 5 posts with the most likes plus comments across all accounts.\n3. For each, one job:web.search with {\"query\": \"<the post's topic>\"} for context.\n4. why_it_worked: one line from the caption, format and numbers. idea and hook: adapted to our audience, not a copy.\nUse real post URLs and counts from the data only.",
        maxIterations: 20,
        parser: true,
      }, [440, 0]),
      model([380, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:instagram.user.posts, input {\"handle\": \"natgeo\"}: recent posts with captions, likes and comments.\n- job:web.search, input {\"query\": \"...\", \"limit\": 5}: web search results.`, [520, 260]),
      parser("Ideas format", { ideas: [{ source_handle: "natgeo", post_url: "https://www.instagram.com/p/example", likes: 12000, comments: 300, why_it_worked: "One line.", idea: "One line.", hook: "First line of the post." }] }, [680, 260]),
      codeNode(wf, "Ideas to rows", "rows", [860, 0]),
      sheetsAppend("Save ideas", "Ideas", [1080, 0]),
      section("Accounts section", "## Who to watch\nEdit the handles and your audience.", [-60, -180], 460, 380),
      section("Agent section", "## Posts, context, ideas\nTwo looot jobs behind one tool.", [380, -180], 440, 600),
      section("Save section", "## One row per idea\nWith the source post and its numbers.", [820, -180], 440, 380),
    ],
    connections: {
      "Every Monday at 8": { main: [[L("Accounts to watch")]] },
      "Accounts to watch": { main: [[L("Content discovery agent")]] },
      "Content discovery agent": { main: [[L("Ideas to rows")]] },
      "Ideas to rows": { main: [[L("Save ideas")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Content discovery agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Content discovery agent", "ai_tool")]] },
      "Ideas format": { ai_outputParser: [[L("Content discovery agent", "ai_outputParser")]] },
    },
  },

  "youtube-channel-leads-agent": {
    title: "Find YouTube channels in a niche and their verified contact emails with one AI agent and looot",
    rebuildOf: 4582,
    nodes: (wf) => [
      mainNote(`## YouTube channels in a niche to verified contacts in Google Sheets

### How it works
1. You fill in a form: a niche or keyword, how many channels and a subscriber floor.
2. One AI agent searches YouTube through looot, reads each channel's details, and if the channel links a website, reads it for a business email.
3. Every email it finds is verified.
4. Each channel above the floor lands in Google Sheets with subscribers, country, website, email and email status.

Good for sponsorships, partnerships and creator outreach. One looot credential replaces the Apify and ZeroBounce accounts this flow usually needs. Nothing is sent: you review the list first.

**Cost per run**, ${PRICES}: YouTube search $0.00188, channel details $0.00188, a page read from $0.0002, verify $0.00145. 10 channels cost about $0.04 in data. Each call is capped at $0.03 and the agent at 50 steps, so a run can never spend more than $1.50. Model tokens are billed by OpenAI.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Google Sheets and OpenAI credentials.
- A sheet named Channels with the headers: channel_name, channel_url, subscribers, country, website, email, email_status, about, niche, found_at, run_cost_usd. Set its ID in **Save channels**.
- ${TOOL_LINE}

### Customization
Add a Gmail node after **Save channels** to send a first email to valid addresses.`, [-620, -240], 700),
      formTrigger(wf, "Channel search form", "Find YouTube channels", "Searches YouTube, reads channel details and verifies contact emails.", [
        ["Niche or keyword", { placeholder: "home espresso", requiredField: true }],
        ["How many channels", { fieldType: "number", placeholder: "10", requiredField: true }],
        ["Minimum subscribers", { fieldType: "number", placeholder: "5000" }],
      ], [0, 0]),
      agent("Channel finder agent", {
        text: "=Find {{ Math.min(Number($json['How many channels']) || 10, 15) }} YouTube channels about {{ $json['Niche or keyword'] }} with at least {{ Number($json['Minimum subscribers']) || 0 }} subscribers.",
        system: "You build creator outreach lists.\n1. job:youtube.search with {\"query\": \"<niche>\"}; search again with a related phrase if you need more channels.\n2. For each distinct channel: job:youtube.channel with {\"url\": \"<channel url>\"} for subscribers, country, description and links.\n3. If the description has no email but links a website, read it with job:web.scrape.markdown and look for a contact email.\n4. job:people.email.verify with {\"email\": \"...\"} for every email you found.\nNever invent an email or a subscriber count.",
        maxIterations: 50,
        parser: true,
      }, [260, 0]),
      model([180, 260]),
      loootTool("looot", `${RUN_TOOL_HEAD}\n- job:youtube.search, input {\"query\": \"...\"}: videos and channels.\n- job:youtube.channel, input {\"url\": \"https://www.youtube.com/@example\"}: channel details and links.\n- job:web.scrape.markdown, input {\"url\": \"https://...\"}: one page as text.\n- job:people.email.verify, input {\"email\": \"...\"}: deliverability.`, [360, 260]),
      parser("Channels format", { channels: [{ channel_name: "Example Coffee", channel_url: "https://www.youtube.com/@example", subscribers: 54000, country: "US", website: "https://example.com", email: "hello@example.com", email_status: "valid", about: "One line." }] }, [540, 260]),
      codeNode(wf, "Channels to rows", "rows", [660, 0]),
      sheetsAppend("Save channels", "Channels", [900, 0]),
      section("Form section", "## Which niche\nKeyword, count and subscriber floor.", [-60, -180], 240, 380),
      section("Agent section", "## Search, read, verify\nFour looot jobs behind one tool.", [200, -180], 440, 600),
      section("Save section", "## One row per channel\nChannels under the floor are dropped.", [650, -180], 440, 380),
    ],
    connections: {
      "Channel search form": { main: [[L("Channel finder agent")]] },
      "Channel finder agent": { main: [[L("Channels to rows")]] },
      "Channels to rows": { main: [[L("Save channels")]] },
      "OpenAI chat model": { ai_languageModel: [[L("Channel finder agent", "ai_languageModel")]] },
      looot: { ai_tool: [[L("Channel finder agent", "ai_tool")]] },
      "Channels format": { ai_outputParser: [[L("Channel finder agent", "ai_outputParser")]] },
    },
  },

  "typeform-lead-qualifier": {
    title: "Verify, enrich and score Typeform leads with looot, save them to HubSpot and alert Slack on hot ones",
    rebuildOf: 10203,
    nodes: (wf) => [
      mainNote(`## Qualify Typeform leads before they reach HubSpot

### How it works
1. Someone submits your Typeform. The workflow finds the email, name and answers by reading the question titles.
2. looot verifies the email. Undeliverable addresses and free mail stop at **Skip**.
3. looot enriches the company from the email domain, and **Score the lead** scores it against your ICP: size, industry, country and email status.
4. Every qualified lead is created or updated in HubSpot. Hot leads (70 or more) also go to Slack.

No AI step: two looot calls per lead. One looot credential replaces the Hunter and AbstractAPI keys this flow usually needs.

**Cost per lead**, ${PRICES}: verify $0.00145, company data $0.0019. About $0.0034 per qualified lead, $0.00145 for one that stops at the email check. Each call is capped at $0.05.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Typeform, HubSpot (private app token) and Slack credentials. Set your form in **New Typeform entry** and the channel ID in **Post to Slack**.
- Your form needs an email question.

### Customization
Edit ICP in **Score the lead**. Map more answers to HubSpot fields in **Create or update contact**.`, [-620, -240], 640),
      {
        name: "New Typeform entry", type: "n8n-nodes-base.typeformTrigger", typeVersion: 1.1, position: [0, 0], webhookId: uuid(`${wf}:typeform`),
        parameters: { formId: "YOUR_FORM_ID", simplifyAnswers: true, onlyAnswers: true },
      },
      codeNode(wf, "Lead from answers", "lead", [220, 0]),
      loootRun("Verify email", "job:people.email.verify", "={{ JSON.stringify({ email: $json.email }) }}", [440, 0], { key: "={{ 'n8n-typeform-verify:' + $json.email }}" }),
      codeNode(wf, "Read the verdict", "verdict", [660, 0]),
      ifTrue("Qualified email?", "={{ $json.deliverable }}", [880, 0]),
      loootRun("Enrich company", "job:company.enrich", "={{ JSON.stringify({ domain: $json.domain }) }}", [1100, -100], { key: "={{ 'n8n-typeform-company:' + $json.domain }}" }),
      codeNode(wf, "Score the lead", "score", [1320, -100]),
      hubspotUpsert("Create or update contact", {
        firstName: "={{ $json.first_name }}",
        lastName: "={{ $json.last_name }}",
        companyName: "={{ $json.company }}",
        industry: "={{ $json.industry }}",
        country: "={{ $json.country }}",
      }, [1540, -240]),
      ifTrue("Hot lead?", "={{ $json.hot }}", [1540, 0]),
      slack("Post to Slack", [1760, -60]),
      noOp("Not hot", [1760, 120]),
      noOp("Skip", [1100, 160]),
      section("Verify section", "## Check the email first\nUndeliverable and free mail stop here.", [160, -180], 640, 400),
      section("Score section", "## Enrich, score, route\nEvery qualified lead to HubSpot, hot ones to Slack too.", [1040, -320], 900, 360),
    ],
    connections: {
      "New Typeform entry": { main: [[L("Lead from answers")]] },
      "Lead from answers": { main: [[L("Verify email")]] },
      "Verify email": { main: [[L("Read the verdict")]] },
      "Read the verdict": { main: [[L("Qualified email?")]] },
      "Qualified email?": { main: [[L("Enrich company")], [L("Skip")]] },
      "Enrich company": { main: [[L("Score the lead")]] },
      "Score the lead": { main: [[L("Create or update contact"), L("Hot lead?")]] },
      "Hot lead?": { main: [[L("Post to Slack")], [L("Not hot")]] },
    },
  },

  "champion-job-change-alert": {
    title: "Alert Slack when a customer champion changes jobs, with weekly LinkedIn checks through looot",
    nodes: (wf) => [
      mainNote(`## Know when a champion moves to a new company

### How it works
1. Every Monday at 9, reads your Champions sheet: people who bought or used your product, with their LinkedIn URL and company.
2. looot reads each LinkedIn profile, falling back to the next provider when one misses.
3. If the current company on the profile is not the one in the sheet, the person moved.
4. Every row gets company_now, title_now, moved and checked_at. Each move posts to Slack with the new company and the profile link.

A champion at a new company already knows your product. That is the warmest outbound there is.

**Cost per champion per week**, ${PRICES}: LinkedIn profile $0.0012. 100 champions cost about $0.12 a week. Each call is capped at $0.05, and a failed call costs $0.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- Google Sheets and Slack credentials. Set the spreadsheet ID in both Sheets nodes and the channel ID in **Post to Slack**.
- A sheet named Champions with the headers: full_name, linkedin_url, company, company_now, title_now, moved, looot_cost_usd, checked_at.

### Customization
After a move, update the company column so the next week compares against the new job. Add a HubSpot node on the moved branch.`, [-620, -240], 640),
      weekly("Every Monday at 9", 9, [0, 0]),
      sheetsRead("Read champions", "Champions", [220, 0]),
      codeNode(wf, "Champions to check", "pick", [440, 0]),
      loootRun("Read LinkedIn profile", "job:linkedin.person.profile", "={{ JSON.stringify({ linkedin_url: $json.linkedin_url }) }}", [660, 0], { key: "={{ 'n8n-champion:' + $json.linkedin_url + ':' + $now.toFormat('kkkk-WW') }}" }),
      codeNode(wf, "Did they move?", "compare", [880, 0]),
      sheetsUpdate("Write back", "Champions", ["company_now", "title_now", "moved", "looot_cost_usd", "checked_at"], [1100, -140]),
      ifTrue("Moved?", "={{ $json.is_moved }}", [1100, 80]),
      slack("Post to Slack", [1320, 0]),
      noOp("Same company", [1320, 200]),
      section("Read section", "## Who to check\nRows with a LinkedIn URL, up to 100.", [160, -180], 420, 380),
      section("Check section", "## Profile today vs the sheet\nOne looot call per champion.", [600, -180], 440, 380),
      section("Alert section", "## Moves go to Slack\nEvery row is written back.", [1060, -260], 420, 560),
    ],
    connections: {
      "Every Monday at 9": { main: [[L("Read champions")]] },
      "Read champions": { main: [[L("Champions to check")]] },
      "Champions to check": { main: [[L("Read LinkedIn profile")]] },
      "Read LinkedIn profile": { main: [[L("Did they move?")]] },
      "Did they move?": { main: [[L("Write back"), L("Moved?")]] },
      "Moved?": { main: [[L("Post to Slack")], [L("Same company")]] },
    },
  },

  "funding-news-hubspot-task": {
    title: "Create a HubSpot task when a target account announces funding, from daily looot news searches",
    nodes: (wf) => [
      mainNote(`## A HubSpot task for every funding announcement at your accounts

### How it works
1. Every day at 8, looot runs one Google News search per target account for funding words: raises, Series A to C, seed.
2. **New funding news** keeps headlines that name the account and a round, and skips links it already turned into a task.
3. Each new announcement becomes a HubSpot task on that company with the headline, the link and the source.

Fresh funding often means new budget and new hires. The task puts it in front of the account owner the same day.

Links already used are remembered in the workflow's static data, which n8n keeps only for active workflows.

**Cost per day**, ${PRICES}: news search $0.001 per account. 50 accounts cost $0.05 a day, about $1.50 a month. Each call is capped at $0.05.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A HubSpot private app token credential with CRM objects write access.
- List your accounts and their HubSpot company IDs in **Accounts**.

### Customization
Edit the FUNDING pattern in **New funding news** to also catch acquisitions or new offices. Post to Slack as well with a Slack node after the task.`, [-620, -240], 640),
      schedule("Every day at 8", { triggerAtHour: 8 }, [0, 0]),
      codeNode(wf, "Accounts", "accounts", [220, 0]),
      loootRun("Search funding news", "job:news.search", "={{ JSON.stringify({ query: $json.query }) }}", [440, 0], { key: "={{ 'n8n-funding:' + $json.company + ':' + $now.toFormat('yyyy-MM-dd') }}" }),
      codeNode(wf, "New funding news", "tasks", [660, 0]),
      {
        name: "Create HubSpot task", type: "n8n-nodes-base.hubspot", typeVersion: 2.1, position: [880, 0],
        parameters: {
          authentication: "appToken", resource: "engagement", operation: "create", type: "task",
          metadata: { subject: "={{ $json.subject }}", body: "={{ $json.body }}", status: "NOT_STARTED", forObjectType: "COMPANY" },
          additionalFields: { associations: { companyIds: "={{ $json.company_id }}" } },
        },
      },
      section("Search section", "## One news search per account\nEdit the list in Accounts.", [160, -180], 420, 380),
      section("Task section", "## Only new funding headlines\nOne task per account per day at most.", [600, -180], 440, 380),
    ],
    connections: {
      "Every day at 8": { main: [[L("Accounts")]] },
      Accounts: { main: [[L("Search funding news")]] },
      "Search funding news": { main: [[L("New funding news")]] },
      "New funding news": { main: [[L("Create HubSpot task")]] },
    },
  },

  "ai-visibility-check": {
    title: "Check weekly whether Google's AI Overviews name your brand or competitors, with looot and Slack",
    nodes: (wf) => [
      mainNote(`## Weekly AI visibility check in Slack

### How it works
1. Every Monday at 8, looot runs each buyer question you list through Google and reads the AI Overview, falling back to the next provider when one misses.
2. **Visibility report** checks each answer: is there an AI Overview, does it name your brand or cite your domain, and which competitors it names.
3. One Slack message shows the count of answers that mention you and a line per question.

Buyers ask Google before they ask sales. This shows which questions you are missing from.

**Cost per question per week**, ${PRICES}: Google AI Overview $0.001 to $0.0056 depending on the provider that answers. 10 questions cost at most about $0.06 a week. Each call is capped at $0.05.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A Slack credential with chat:write. Set the channel ID in **Post to Slack**.
- Put your brand, domain, competitors and questions in **Brand and questions**.

### Customization
Write each week's result to Google Sheets to chart the trend. Add questions from your sales calls.`, [-620, -240], 580),
      weekly("Every Monday at 8", 8, [0, 0]),
      codeNode(wf, "Brand and questions", "queries", [220, 0]),
      loootRun("Read the AI Overview", "job:google.serp.ai-overview", "={{ JSON.stringify({ query: $json.query }) }}", [440, 0], { key: "={{ 'n8n-aio:' + $json.query + ':' + $now.toFormat('kkkk-WW') }}" }),
      codeNode(wf, "Visibility report", "report", [660, 0]),
      slack("Post to Slack", [880, 0]),
      section("Ask section", "## One question per call\nEdit brand, competitors and questions.", [160, -180], 420, 380),
      section("Report section", "## Named, cited or missing\nOne Slack message a week.", [600, -180], 440, 380),
    ],
    connections: {
      "Every Monday at 8": { main: [[L("Brand and questions")]] },
      "Brand and questions": { main: [[L("Read the AI Overview")]] },
      "Read the AI Overview": { main: [[L("Visibility report")]] },
      "Visibility report": { main: [[L("Post to Slack")]] },
    },
  },

  "weekly-seo-rank-slack": {
    title: "Post a weekly Google rank report for your keywords to Slack with looot",
    nodes: (wf) => [
      mainNote(`## Weekly Google rank report in Slack

### How it works
1. Every Monday at 8, looot runs one Google search per keyword you track, in the location you set.
2. **Rank report** finds your domain's position in the results and compares it with last week: up, down, same, new or dropped out.
3. One Slack message lists every keyword with its position and change, plus what the searches cost.

Last week's positions are kept in the workflow's static data, which n8n keeps only for active workflows. The first run has nothing to compare with.

**Cost per keyword per week**, ${PRICES}: Google results $0.0009 to $0.001. 20 keywords cost about $0.02 a week. Each call is capped at $0.05, and a failed call costs $0.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A Slack credential with chat:write, and the bot invited to the channel. Set the channel ID in **Post to Slack**.
- Set your domain, location and keywords in **Keywords**.

### Customization
Run it daily by changing the schedule. Add a second domain to watch a competitor's ranks the same way.`, [-620, -240], 560),
      weekly("Every Monday at 8", 8, [0, 0]),
      codeNode(wf, "Keywords", "keywords", [220, 0]),
      loootRun("Search Google", "job:google.serp.organic", "={{ JSON.stringify({ query: $json.keyword, location: $json.location }) }}", [440, 0], { key: "={{ 'n8n-rank:' + $json.keyword + ':' + $now.toFormat('kkkk-WW') }}" }),
      codeNode(wf, "Rank report", "report", [660, 0]),
      slack("Post to Slack", [880, 0]),
      section("Search section", "## One search per keyword\nEdit domain, location and keywords.", [160, -180], 420, 380),
      section("Report section", "## Position and change\nCompared with last week's run.", [600, -180], 440, 380),
    ],
    connections: {
      "Every Monday at 8": { main: [[L("Keywords")]] },
      Keywords: { main: [[L("Search Google")]] },
      "Search Google": { main: [[L("Rank report")]] },
      "Rank report": { main: [[L("Post to Slack")]] },
    },
  },

  "backlink-prospect-finder": {
    title: "Find sites that link to your competitors but not to you with looot backlink data into Google Sheets",
    nodes: (wf) => [
      mainNote(`## Backlink prospects: who links to competitors and not to you

### How it works
1. You fill in a form with your domain and up to 5 competitor domains.
2. looot lists the referring domains of your site and of each competitor.
3. **Link gaps** keeps sites that link to at least one competitor and not to you, sorted by how many competitors they link to, then by rank.
4. The top 100 land in Google Sheets as your outreach list.

A site that links to two or three of your competitors already covers your space. Those are the easiest links to ask for.

**Cost per run**, ${PRICES}: referring domains $0.024 per domain. You plus 3 competitors cost about $0.10. Each call is capped at $0.05, and a failed call costs $0.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A Google Sheets credential. A sheet named Prospects with the headers: referring_domain, links_to_competitors, competitor_count, rank, your_domain, found_at, run_cost_usd. Set its ID in **Save prospects**.

### Customization
Change MAX_ROWS in **Link gaps**. Add an agent after it to find a contact email for each site.`, [-620, -240], 600),
      formTrigger(wf, "Domains form", "Find backlink prospects", "Compares the referring domains of your site and your competitors.", [
        ["Your domain", { placeholder: "example.com", requiredField: true }],
        ["Competitor domains", { placeholder: "example.org, example.net", requiredField: true }],
      ], [0, 0]),
      codeNode(wf, "Domains to check", "domains", [220, 0]),
      loootRun("Referring domains", "job:backlinks.referring.domains", "={{ JSON.stringify({ domain: $json.domain }) }}", [440, 0], { key: "={{ 'n8n-refdomains:' + $json.domain + ':' + $now.toFormat('yyyy-MM-dd') }}" }),
      codeNode(wf, "Link gaps", "gaps", [660, 0]),
      sheetsAppend("Save prospects", "Prospects", [880, 0]),
      section("Lookup section", "## Referring domains for each site\nYours plus up to 5 competitors.", [160, -180], 420, 380),
      section("Gap section", "## Link to them, not to you\nSorted by competitor count, then rank.", [600, -180], 440, 380),
    ],
    connections: {
      "Domains form": { main: [[L("Domains to check")]] },
      "Domains to check": { main: [[L("Referring domains")]] },
      "Referring domains": { main: [[L("Link gaps")]] },
      "Link gaps": { main: [[L("Save prospects")]] },
    },
  },

  "webinar-attendee-enrichment": {
    title: "Enrich a webinar or event attendee list in Google Sheets with title, company and LinkedIn using looot",
    nodes: (wf) => [
      mainNote(`## Enrich webinar and event attendees in Google Sheets

### How it works
1. Paste your attendee export into a sheet named Attendees with an email column, then run the workflow.
2. It picks rows with an email and no enriched_at yet, up to 200 per run.
3. looot looks up the person behind each email: name, job title, company and LinkedIn URL.
4. For work emails, looot also enriches the company from the domain: industry, size and country. Free mail rows skip that step.
5. Every row is written back, so you can sort attendees by title and company size before follow-up.

**Cost per attendee**, ${PRICES}: person from email from $0.0036, company data $0.0019. About $0.0055 for a work email, $0.0036 for free mail. Each call is capped at $0.05, and a failed call costs $0.

### Setup
- ${NODE_LINE}
- ${TOKEN_LINE}
- A Google Sheets credential. A sheet named Attendees with the headers: email, full_name, job_title, company, linkedin_url, industry, employees, country, looot_cost_usd, enriched_at. Set the spreadsheet ID in both Sheets nodes.

### Customization
Change MAX in **Attendees to enrich**. Add an IF after **Company fields** to send senior titles to Slack.`, [-620, -240], 620),
      manual([0, 0]),
      sheetsRead("Read attendees", "Attendees", [220, 0]),
      codeNode(wf, "Attendees to enrich", "pick", [440, 0]),
      loootRun("Look up the person", "job:people.enrich.by-email", "={{ JSON.stringify({ email: $json.email }) }}", [660, 0], { key: "={{ 'n8n-person-by-email:' + $json.email }}" }),
      codeNode(wf, "Person fields", "person", [880, 0]),
      ifTrue("Work email?", "={{ $json.work_email }}", [1100, 0]),
      loootRun("Enrich company", "job:company.enrich", "={{ JSON.stringify({ domain: $json.domain }) }}", [1320, -100], { key: "={{ 'n8n-company:' + $json.domain }}" }),
      codeNode(wf, "Company fields", "company", [1540, -100]),
      sheetsUpdate("Write back", "Attendees", ["full_name", "job_title", "company", "linkedin_url", "industry", "employees", "country", "looot_cost_usd", "enriched_at"], [1760, 0]),
      section("Read section", "## Pick the rows\nAn email and not enriched yet.", [160, -180], 420, 380),
      section("Enrich section", "## Person, then company\nCompany data only for work emails.", [600, -240], 1080, 500),
      section("Write section", "## Write the row back\nMatched on the sheet's row number.", [1700, -180], 240, 380),
    ],
    connections: {
      "Run it": { main: [[L("Read attendees")]] },
      "Read attendees": { main: [[L("Attendees to enrich")]] },
      "Attendees to enrich": { main: [[L("Look up the person")]] },
      "Look up the person": { main: [[L("Person fields")]] },
      "Person fields": { main: [[L("Work email?")]] },
      "Work email?": { main: [[L("Enrich company")], [L("Write back")]] },
      "Enrich company": { main: [[L("Company fields")]] },
      "Company fields": { main: [[L("Write back")]] },
    },
  },
};
