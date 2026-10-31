// Shared helper: adds up what the agent's looot calls cost, from the agent's intermediate steps
// (the agent's "Return Intermediate Steps" option is on). Each looot tool answer carries actualCost.
function agentCost(item) {
  const steps = (item && Array.isArray(item.intermediateSteps)) ? item.intermediateSteps : [];
  let usd = 0;
  let calls = 0;
  for (const step of steps) {
    const tool = String((step && step.action && step.action.tool) || "");
    if (!/looot/i.test(tool)) continue;
    calls += 1;
    const text = typeof step.observation === "string" ? step.observation : JSON.stringify(step.observation ?? "");
    for (const m of text.matchAll(/"actualCost"\s*:\s*([0-9.eE+-]+)/g)) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) usd += n;
    }
  }
  return { looot_calls: calls, looot_cost_usd: Number(usd.toFixed(6)) };
}
