// Code node "Verdict". Only valid addresses go to Instantly. Set SEND_CATCH_ALL to true to
// also send catch-all addresses (the server accepts everything, so some will bounce).
// @include run-helpers
const SEND_CATCH_ALL = false;
return $input.all().map(({ json: run }, i) => {
  const row = $("Emails to check").itemMatching(i).json;
  const problem = runProblem(run);
  const status = problem ? "unverified" : emailStatus(run);
  return {
    json: {
      ...row,
      email_status: status,
      send: status === "valid" || (SEND_CATCH_ALL && status === "catch_all"),
      looot_cost_usd: runCost(run),
      checked_at: new Date().toISOString(),
    },
  };
});
