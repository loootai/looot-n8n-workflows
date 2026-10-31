// Code node "Person fields". Title, company and LinkedIn from the email. Free mail rows end here.
// @include run-helpers
const rows = $("Attendees to enrich").all().map((i) => i.json);
return $input.all().map(({ json: run }, i) => {
  const row = rows[i] || {};
  const problem = runProblem(run);
  const src = runFields(run);
  return {
    json: {
      row_number: row.row_number,
      domain: row.domain,
      work_email: Boolean(row.work_email),
      full_name: problem ? "" : find(src, ["full_name", "name"]),
      job_title: problem ? "" : find(src, ["job_title", "jobTitle", "title", "headline"]).slice(0, 200),
      company: problem ? "" : find(src, ["company_name", "companyName", "organization", "company"]),
      linkedin_url: problem ? "" : find(src, ["linkedin_url", "linkedinUrl", "linkedin"]),
      industry: "",
      employees: "",
      country: "",
      looot_cost_usd: runCost(run),
      enriched_at: new Date().toISOString(),
    },
  };
});
