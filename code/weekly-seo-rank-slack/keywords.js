// Code node "Keywords". Your domain, the keywords to track and the search location.
const DOMAIN = "example.com";
const LOCATION = "United States";
const KEYWORDS = ["email finder api", "b2b data enrichment", "verify email address"];
return KEYWORDS.map((keyword) => ({ json: { domain: DOMAIN, keyword, location: LOCATION } }));
