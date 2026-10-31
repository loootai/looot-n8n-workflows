// Code node "Read the verdict". Turns the verification run into deliverable yes/no.
// catch_all counts as deliverable: the server accepts every address, so it may still bounce.
// @include run-helpers
const run = $input.first().json;
const form = $("Lead form").first().json;
const email = String(form["Business email"] || "").trim().toLowerCase();
const problem = runProblem(run);
const status = problem ? "unknown" : emailStatus(run);
return [{
  json: {
    email,
    first_name: String(form["First name"] || "").trim(),
    last_name: String(form["Last name"] || "").trim(),
    domain: cleanDomain(email.split("@")[1]),
    email_status: status,
    deliverable: status === "valid" || status === "catch_all",
    verify_problem: problem,
    verify_cost_usd: runCost(run),
  },
}];
