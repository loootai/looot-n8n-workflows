// Code node "Keywords". Edit DOMAIN and KEYWORDS. One item per keyword, one Google results page each.
const DOMAIN = "example.com";
const KEYWORDS = ["example keyword one", "example keyword two"];
const GL = "us"; // country
const HL = "en"; // language

const day = new Date().toISOString().slice(0, 10);
return KEYWORDS.map((q) => ({
  json: {
    keyword: q,
    domain: DOMAIN,
    request: {
      // serper-search is one pinned endpoint ($0.001 per call) with a known answer shape: organic[] {title, link, position}.
      endpointId: "serper-search",
      input: { q, gl: GL, hl: HL, num: 10 },
      // Same keyword, same day: a retry is free. Tomorrow is a new check.
      idempotencyKey: ("n8n-rank:" + day + ":" + GL + ":" + q).toLowerCase().slice(0, 180),
    },
  },
}));
