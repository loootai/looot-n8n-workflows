// Code node "Stack as text". One comma separated list per company, ready for a HubSpot property.
// @include run-helpers
const store = typeof $getWorkflowStaticData === "function" ? $getWorkflowStaticData("global") : {};
const done = new Set(Array.isArray(store.doneIds) ? store.doneIds : []);
const out = $input.all().map(({ json: run }, i) => {
  const c = $("Companies without a stack").itemMatching(i).json;
  const problem = runProblem(run);
  const items = problem ? [] : firstArray(run.result, (x) => typeof x === "string" || (x && typeof x === "object" && (x.name || x.technology || x.Name)));
  const names = [...new Set(items.map((x) => (typeof x === "string" ? x : x.name || x.technology || x.Name)).filter(Boolean))];
  if (!problem) done.add(c.companyId);
  return {
    json: {
      companyId: c.companyId,
      domain: c.domain,
      tech_stack: problem ? `lookup failed: ${problem}`.slice(0, 200) : names.length ? names.slice(0, 60).join(", ").slice(0, 1000) : "none found",
      looot_cost_usd: runCost(run),
    },
  };
});
store.doneIds = [...done].slice(-5000);
return out;
