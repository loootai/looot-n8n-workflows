// Code node "Lead from answers". Typeform sends {question title: answer}; this finds the email, the
// name and the company size answer by looking at the questions, so it works with most lead forms.
const a = $input.first().json;
const entries = Object.entries(a).map(([k, v]) => [String(k).toLowerCase(), typeof v === "object" && v !== null ? (v.label || v.text || v.email || JSON.stringify(v)) : String(v ?? "")]);
const pick = (re) => (entries.find(([k]) => re.test(k)) || [])[1] || "";
const email = (entries.map(([, v]) => v).find((v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v).trim())) || "").trim().toLowerCase();
const full = pick(/full name|your name|^name/);
return [{
  json: {
    email,
    domain: email.includes("@") ? email.split("@")[1] : "",
    first_name: pick(/first name/) || full.split(" ")[0] || "",
    last_name: pick(/last name|surname/) || full.split(" ").slice(1).join(" "),
    stated_size: pick(/team size|company size|employees|how many people/),
    need: pick(/what do you|looking for|use case|how can we help/).slice(0, 500),
  },
}];
