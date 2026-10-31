// Code node "Accounts and roles". One job search per account you watch.
const ACCOUNTS = ["Acme Corp", "Globex", "Initech"];
const SEARCH = "sales operations"; // what the job search looks for at each account
const LOCATION = "United States";
return ACCOUNTS.map((company) => ({ json: { company, query: `${SEARCH} ${company}`, location: LOCATION } }));
