// Code node "Link gaps". Sites that link to your competitors but not to you, most competitors first.
// @include run-helpers
const MAX_ROWS = 100;
const asked = $("Domains to check").all().map((i) => i.json);
const mineLinks = new Set();
const gap = new Map();
let cost = 0;
$input.all().forEach(({ json: run }, i) => {
  const d = asked[i] || {};
  cost += runCost(run);
  if (runProblem(run)) return;
  const refs = firstArray(run.result, (x) => x && typeof x === "object" && (x.domain || x.referring_domain || x.domain_from));
  for (const r of refs) {
    const ref = cleanDomain(r.domain || r.referring_domain || r.domain_from);
    if (!ref) continue;
    if (d.mine) { mineLinks.add(ref); continue; }
    const g = gap.get(ref) || { referring_domain: ref, links_to: new Set(), rank: Number(r.rank || r.domain_rank || r.domain_authority || 0) || 0 };
    g.links_to.add(d.domain);
    gap.set(ref, g);
  }
});
const found = new Date().toISOString();
const rows = [...gap.values()]
  .filter((g) => !mineLinks.has(g.referring_domain))
  .sort((a, b) => b.links_to.size - a.links_to.size || b.rank - a.rank)
  .slice(0, MAX_ROWS);
return rows.map((g) => ({
  json: {
    referring_domain: g.referring_domain,
    links_to_competitors: [...g.links_to].join(", "),
    competitor_count: g.links_to.size,
    rank: g.rank || "",
    your_domain: (asked.find((a) => a.mine) || {}).domain || "",
    found_at: found,
    run_cost_usd: Number(cost.toFixed(6)),
  },
}));
