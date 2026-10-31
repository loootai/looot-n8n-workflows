// Code node "Company fields". Adds industry, size and country from the email domain.
// @include run-helpers
return $input.all().map(({ json: run }, i) => {
  const p = $("Person fields").itemMatching(i).json;
  const src = runFields(run);
  const ok = !runProblem(run);
  return {
    json: {
      ...p,
      company: p.company || (ok ? find(src, ["name", "company_name"]) : ""),
      industry: ok ? find(src, ["industry", "sector"]) : "",
      employees: ok ? find(src, ["employee_count", "employees", "employeeCount", "size"]) : "",
      country: ok ? find(src, ["country", "country_code"]) : "",
      looot_cost_usd: Number((p.looot_cost_usd + runCost(run)).toFixed(6)),
    },
  };
});
