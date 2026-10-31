// Code node "Companies to research". One item per outside company on today's calendar.
const YOUR_DOMAIN = "example.com"; // your own email domain, so internal meetings are skipped
const FREE_MAIL = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|gmx|mail|yandex)\./;

const byDomain = new Map();
for (const { json: ev } of $input.all()) {
  const attendees = Array.isArray(ev.attendees) ? ev.attendees : [];
  for (const a of attendees) {
    const email = String((a && a.email) || "").toLowerCase();
    const domain = email.split("@")[1] || "";
    if (!domain || domain === YOUR_DOMAIN || FREE_MAIL.test(domain) || domain.endsWith("calendar.google.com")) continue;
    const entry = byDomain.get(domain) || { domain, meetings: [], people: [] };
    const title = ev.summary || "Meeting";
    const start = (ev.start && (ev.start.dateTime || ev.start.date)) || "";
    if (!entry.meetings.some((m) => m.title === title && m.start === start)) entry.meetings.push({ title, start });
    if (!entry.people.includes(email)) entry.people.push(email);
    byDomain.set(domain, entry);
  }
}
return [...byDomain.values()].slice(0, 10).map((json) => ({ json }));
