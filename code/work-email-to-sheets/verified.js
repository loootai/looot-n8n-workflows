// Code node "Verified row". Adds the verifier's word and the cost of both calls.
// @include run-helpers
return $input.all().map(({ json: run }, i) => {
  const prev = $("Found an email?").itemMatching(i).json;
  const problem = runProblem(run);
  return {
    json: {
      row_number: prev.row_number,
      email: prev.email,
      email_status: problem ? "unverified" : emailStatus(run),
      looot_cost_usd: Number((prev.looot_cost_usd + runCost(run)).toFixed(6)),
      checked_at: new Date().toISOString(),
    },
  };
});
