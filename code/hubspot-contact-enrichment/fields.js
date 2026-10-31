// Code node "Contact fields". Maps the looot person answer onto HubSpot contact fields.
// @include run-helpers
const picked = $("Contacts to enrich").all().map((i) => i.json);
const out = [];
$input.all().forEach(({ json: run }, i) => {
  const c = picked[i] || {};
  if (runProblem(run)) return;
  const src = runFields(run);
  const title = find(src, ["job_title", "jobTitle", "title", "headline", "position"]);
  const company = find(src, ["company_name", "companyName", "organization", "company"]);
  if (!title && !company) return;
  out.push({
    json: {
      email: c.email,
      first_name: find(src, ["first_name", "firstName", "given_name"]),
      last_name: find(src, ["last_name", "lastName", "family_name"]),
      job_title: title.slice(0, 200),
      company: company.slice(0, 200),
      city: find(src, ["city", "locality"]),
      country: find(src, ["country", "country_name", "countryCode"]),
      looot_cost_usd: runCost(run),
    },
  });
});
return out;
