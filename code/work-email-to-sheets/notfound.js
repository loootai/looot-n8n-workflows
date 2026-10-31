// Code node "Not found row". Writes the miss (or the error) back so the row is not retried.
return $input.all().map(({ json: r }) => ({
  json: { row_number: r.row_number, email: "", email_status: r.email_status, looot_cost_usd: r.looot_cost_usd, checked_at: new Date().toISOString() },
}));
