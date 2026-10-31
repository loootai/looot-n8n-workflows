// Code node "Domains to check". Your domain plus each competitor, one item each.
// @include run-helpers
const form = $input.first().json;
const mine = cleanDomain(form["Your domain"]);
const rivals = String(form["Competitor domains"] || "").split(/[,\s]+/).map(cleanDomain).filter((d) => d && d !== mine);
const list = [...new Set(rivals)].slice(0, 5);
return [mine, ...list].filter(Boolean).map((domain) => ({ json: { domain, mine: domain === mine } }));
