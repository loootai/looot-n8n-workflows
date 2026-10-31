// Code node "Read the signup". Takes {email, name} from the webhook body and flags free mail domains.
const FREE = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|gmx|mail|yandex|zoho)\./i;
const body = $input.first().json.body || $input.first().json;
const email = String(body.email || "").trim().toLowerCase();
const domain = email.includes("@") ? email.split("@")[1] : "";
return [{
  json: {
    email,
    name: String(body.name || body.full_name || "").trim(),
    domain,
    work_email: Boolean(domain) && !FREE.test(domain),
    received_at: new Date().toISOString(),
  },
}];
