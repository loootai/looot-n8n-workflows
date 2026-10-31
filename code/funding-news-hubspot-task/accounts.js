// Code node "Accounts". Your target accounts. hubspot_company_id links the task to the company.
const ACCOUNTS = [
  { company: "Acme Corp", hubspot_company_id: "YOUR_COMPANY_ID" },
  { company: "Globex", hubspot_company_id: "YOUR_COMPANY_ID" },
];
return ACCOUNTS.map((a) => ({
  json: { ...a, query: `"${a.company}" (raises OR raised OR funding OR "Series A" OR "Series B" OR "Series C" OR seed)` },
}));
