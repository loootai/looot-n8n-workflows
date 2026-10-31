// Code node "Brand and questions". The questions your buyers ask Google, your brand and competitors.
const BRAND = { name: "Example", domain: "example.com", competitors: ["Acme", "Globex"] };
const QUESTIONS = ["best email finder api", "how to enrich b2b leads", "alternatives to clearbit"];
return QUESTIONS.map((query) => ({ json: { query, ...BRAND } }));
