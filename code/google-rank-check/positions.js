// Code node "Find positions". One output item per keyword: where DOMAIN ranks in the top 10.
const runs = $input.all().map((i) => i.json);
const reqs = $("Keywords").all().map((i) => i.json);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

return runs.map((run, i) => {
  const req = reqs[i];
  const organic = (run.status === "completed" && run.result && Array.isArray(run.result.organic)) ? run.result.organic : [];
  const hit = organic.find((o) => { const h = host(o.link); return h === req.domain || h.endsWith("." + req.domain); });
  const first = organic.find((o) => host(o.link) && host(o.link) !== req.domain);
  return {
    json: {
      keyword: req.keyword,
      domain: req.domain,
      position: hit ? (hit.position ?? organic.indexOf(hit) + 1) : null,
      url: hit ? hit.link : null,
      top_result: first ? first.link : null,
      status: run.status || (run.error && run.error.code) || "error",
      cost_usd: typeof run.actualCost === "number" ? run.actualCost : 0,
      checked_at: new Date().toISOString(),
    },
  };
});
