// Code node "New matching jobs". Keeps postings at the account whose title matches a signal role.
// Postings already alerted are remembered in the workflow's static data (active workflows only).
// @include run-helpers
const ROLE = /rev(enue)?\s*ops|sales\s*op|sdr|bdr|account\s*exec|head of sales|vp sales|growth/i;
const accounts = $("Accounts and roles").all().map((i) => i.json.company);
const store = typeof $getWorkflowStaticData === "function" ? $getWorkflowStaticData("global") : {};
const seen = new Set(Array.isArray(store.seenJobs) ? store.seenJobs : []);
let cost = 0;
const lines = [];
$input.all().forEach(({ json: run }, i) => {
  cost += runCost(run);
  if (runProblem(run)) return;
  const company = accounts[i] || "";
  const jobs = firstArray(run.result, (x) => x && typeof x === "object" && (x.title || x.job_title || x.jobTitle));
  for (const j of jobs) {
    const title = String(j.title || j.job_title || j.jobTitle || "");
    const at = String(j.company || j.company_name || j.companyName || (j.company && j.company.name) || "");
    if (!ROLE.test(title)) continue;
    if (company && at && !at.toLowerCase().includes(company.toLowerCase().split(" ")[0])) continue;
    const url = j.url || j.link || j.job_url || j.jobUrl || "";
    const id = url || `${company}:${title}`;
    if (seen.has(id)) continue;
    seen.add(id);
    lines.push(`• *${company}* is hiring: ${url ? `<${url}|${title.replace(/[<>|]/g, "")}>` : title}${j.location ? ` (${j.location})` : ""}`);
  }
});
store.seenJobs = [...seen].slice(-1000);
if (!lines.length) return [];
return [{ json: { text: `Hiring signals\n\n${lines.join("\n")}\n\n_${accounts.length} searches, $${cost.toFixed(4)} in looot calls_`, looot_cost_usd: Number(cost.toFixed(6)) } }];
