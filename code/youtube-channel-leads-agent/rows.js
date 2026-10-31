// Code node "Channels to rows". One row per channel, keeping the subscriber floor from the form.
// @include agent-cost
const item = $input.first().json;
const form = $("Channel search form").first().json;
const min = Number(form["Minimum subscribers"]) || 0;
const list = (item.output && Array.isArray(item.output.channels)) ? item.output.channels : [];
const cost = agentCost(item);
const foundAt = new Date().toISOString();
return list
  .filter((c) => c && c.channel_name && (Number(c.subscribers) || 0) >= min)
  .map((c) => ({
    json: {
      channel_name: String(c.channel_name),
      channel_url: c.channel_url || "",
      subscribers: Number(c.subscribers) || "",
      country: c.country || "",
      website: c.website || "",
      email: String(c.email || "").toLowerCase(),
      email_status: c.email ? (c.email_status || "unknown") : "not_found",
      about: String(c.about || "").slice(0, 300),
      niche: form["Niche or keyword"] || "",
      found_at: foundAt,
      run_cost_usd: cost.looot_cost_usd,
    },
  }));
