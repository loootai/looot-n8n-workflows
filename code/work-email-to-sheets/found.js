// Code node "Found an email?". Pairs each find run with its row.
// @include run-helpers
return $input.all().map(({ json: run }, i) => {
  const row = $("Rows to look up").itemMatching(i).json;
  const problem = runProblem(run);
  const email = problem ? null : findEmail(run);
  return {
    json: {
      row_number: row.row_number,
      email: email || "",
      found: Boolean(email),
      email_status: problem ? `error: ${problem}`.slice(0, 120) : email ? "found" : "not_found",
      looot_cost_usd: runCost(run),
    },
  };
});
