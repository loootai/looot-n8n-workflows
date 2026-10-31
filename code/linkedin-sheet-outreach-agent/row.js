// Code node "Row to write". Pairs each agent answer with its sheet row and adds what it cost.
// @include agent-cost
const rows = $("Rows to enrich").all().map((i) => i.json);
return $input.all().map(({ json: item }, i) => {
  const o = (item.output && typeof item.output === "object") ? item.output : {};
  const cost = agentCost(item);
  return {
    json: {
      row_number: rows[i] ? rows[i].row_number : null,
      full_name: o.full_name || "",
      title: o.title || "",
      company: o.company || "",
      email: String(o.email || "").toLowerCase(),
      email_status: o.email ? (o.email_status || "unknown") : "not_found",
      message: String(o.message || "").slice(0, 600),
      status: o.full_name ? "done" : "no_profile",
      looot_cost_usd: cost.looot_cost_usd,
      checked_at: new Date().toISOString(),
    },
  };
});
