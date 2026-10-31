// Code node "Competitors". One news search per name. Quotes keep the match exact.
const COMPETITORS = ["Acme Corp", "Globex", "Initech"];
return COMPETITORS.map((name) => ({ json: { name, query: `"${name}"` } }));
