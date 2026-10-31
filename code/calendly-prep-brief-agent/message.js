// Code node "Slack message". The brief, who booked, when, and what the data cost.
// @include agent-cost
const item = $input.first().json;
const b = $("Read the booking").first().json;
const cost = agentCost(item);
const brief = typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "");
const when = b.start_time ? new Date(b.start_time).toUTCString().replace(":00 GMT", " UTC") : "time not given";
return [{
  json: {
    text: `*New booking:* ${b.name || b.email} (${b.email}), ${b.event_name || "meeting"}, ${when}\n\n${brief}\n\n_${cost.looot_calls} looot calls, $${cost.looot_cost_usd.toFixed(4)}_`,
    ...cost,
  },
}];
