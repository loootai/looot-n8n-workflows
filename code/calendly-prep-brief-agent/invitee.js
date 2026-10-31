// Code node "Read the booking". Pulls the invitee, the event and the booking answers from Calendly.
const FREE = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|gmx|mail|yandex|zoho)\./i;
const body = $input.first().json;
const p = body.payload || body;
const email = String(p.email || "").trim().toLowerCase();
const domain = email.includes("@") ? email.split("@")[1] : "";
const ev = p.scheduled_event || p.event || {};
const answers = (Array.isArray(p.questions_and_answers) ? p.questions_and_answers : [])
  .map((q) => `${q.question}: ${q.answer}`).join("\n");
return [{
  json: {
    email,
    name: String(p.name || [p.first_name, p.last_name].filter(Boolean).join(" ")).trim(),
    domain,
    work_email: Boolean(domain) && !FREE.test(domain),
    event_name: ev.name || "",
    start_time: ev.start_time || "",
    answers,
  },
}];
