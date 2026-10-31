// Code node "Read the verdict". Deliverable means valid, catch_all or risky. Free mail is not scored.
// @include run-helpers
const FREE = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|gmx|mail|yandex|zoho)\./i;
const run = $input.first().json;
const lead = $("Lead from answers").first().json;
const problem = runProblem(run);
const status = problem ? "unverified" : emailStatus(run);
return [{
  json: {
    ...lead,
    email_status: status,
    deliverable: !problem && ["valid", "catch_all", "risky"].includes(status) && !FREE.test(lead.domain),
    verify_problem: problem || "",
    looot_cost_usd: runCost(run),
  },
}];
