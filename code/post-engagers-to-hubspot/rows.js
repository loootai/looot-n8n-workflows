// Code node "Contacts with an email". Keeps people the agent found an address for.
// Invalid addresses are dropped so HubSpot only gets contacts you can email.
// @include agent-cost
const item = $input.first().json;
const people = (item.output && Array.isArray(item.output.people)) ? item.output.people : [];
const cost = agentCost(item);
const form = $("Post URL form").first().json;
return people
  .filter((p) => p && /@/.test(p.email || "") && p.email_status !== "invalid")
  .map((p) => ({
    json: {
      email: String(p.email).toLowerCase(),
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      job_title: p.headline || p.title || "",
      company: p.company || "",
      company_domain: p.company_domain || "",
      linkedin_url: p.linkedin_url || "",
      engagement: p.engagement || "",
      email_status: p.email_status || "unknown",
      source_post: form["LinkedIn post URL"] || "",
      run_cost_usd: cost.looot_cost_usd,
    },
  }));
