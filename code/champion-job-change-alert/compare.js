// Code node "Did they move?". Compares the company on the profile today with the one in the sheet.
// @include run-helpers
const rows = $("Champions to check").all().map((i) => i.json);
const norm = (s) => String(s || "").toLowerCase().replace(/\b(inc|llc|ltd|gmbh|sas|bv|corp|corporation|co)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
return $input.all().map(({ json: run }, i) => {
  const row = rows[i] || {};
  const problem = runProblem(run);
  const src = runFields(run);
  const now = problem ? "" : find(src, ["current_company", "company_name", "companyName", "company", "organization"]);
  const title = problem ? "" : find(src, ["headline", "job_title", "title", "position"]);
  const moved = Boolean(now && row.company && norm(now) !== norm(row.company) && !norm(now).includes(norm(row.company)) && !norm(row.company).includes(norm(now)));
  return {
    json: {
      row_number: row.row_number,
      company_now: now,
      title_now: title.slice(0, 200),
      moved: moved ? "yes" : (problem ? "check_failed" : "no"),
      is_moved: moved,
      looot_cost_usd: runCost(run),
      checked_at: new Date().toISOString(),
      text: `*${row.full_name || row.linkedin_url}* left ${row.company} and is now at *${now}*${title ? ` (${title.slice(0, 120)})` : ""}. ${row.linkedin_url}`,
    },
  };
});
