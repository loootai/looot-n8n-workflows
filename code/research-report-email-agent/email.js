// Code node "Build the email". Turns the agent's markdown report into simple HTML with a cost line.
// @include agent-cost
const item = $input.first().json;
const form = $("Report form").first().json;
const cost = agentCost(item);
const md = typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
const html = md.split("\n").map((line) => {
  const h = line.match(/^(#{1,4})\s+(.*)$/);
  if (h) return `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`;
  if (/^\s*[-*]\s+/.test(line)) return `<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
  return line.trim() ? `<p>${inline(line)}</p>` : "";
}).join("\n");
const topic = String(form["Topic"] || "your topic").slice(0, 80);
return [{
  json: {
    to: String(form["Send the report to"] || "").trim(),
    subject: `Research report: ${topic}`,
    html: `${html}\n<hr><p style="color:#666">${cost.looot_calls} looot calls, data cost $${cost.looot_cost_usd.toFixed(4)}. Model tokens are billed by your model provider.</p>`,
    ...cost,
  },
}];
