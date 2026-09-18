const base = process.env.RELAY_URL || 'http://localhost:3000';
const token = process.env.RELAY_TOKEN || 'dev-only-token';
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
async function call(path, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
console.log('Agent: navigating with CDP at http://localhost:9222');
const takeover = await call('/api/takeover', { method: 'POST', body: JSON.stringify({ reason: 'Please complete the CAPTCHA in the shared browser' }) });
console.log(`Human takeover requested (${takeover.leaseId}). Waiting without touching the browser…`);
for (;;) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const state = await call('/api/state');
  if (state.mode === 'agent') break;
}
console.log('Control returned. Agent can continue in the same Chromium session.');
