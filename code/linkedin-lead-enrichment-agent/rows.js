// Code node "Leads to rows". One row per person; people without a LinkedIn URL are dropped.
// @include agent-cost
const item = $input.first().json;
const leads = (item.output && Array.isArray(item.output.leads)) ? item.output.leads : [];
const cost = agentCost(item);
const at = new Date().toISOString();
return leads
  .filter((l) => l && l.full_name && l.linkedin_url)
  .map((l) => ({
    json: {
      full_name: l.full_name,
      title: l.title || "",
      company: l.company || "",
      company_domain: l.company_domain || "",
      linkedin_url: l.linkedin_url,
      email: l.email || "",
      email_status: l.email_status || (l.email ? "unknown" : "not_found"),
      about: (l.about || "").slice(0, 500),
      recent_post_topics: Array.isArray(l.recent_post_topics) ? l.recent_post_topics.join("; ") : (l.recent_post_topics || ""),
      icebreaker: l.icebreaker || "",
      found_at: at,
      run_cost_usd: cost.looot_cost_usd,
    },
  }));
