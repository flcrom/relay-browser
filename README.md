# Relay Browser

A working prototype for a person and an automation agent to share **one Chromium process**. When the agent reaches CAPTCHA, MFA, consent, payment confirmation or another human-only step, it requests a takeover and stops browser input. The person uses noVNC to interact with the live browser, then returns control. Tabs, cookies and in-memory page state are preserved because Chromium never restarts.

> Relay Browser does not solve or bypass CAPTCHA. It lets the person complete it directly.

## Architecture

- `browser`: Chromium on Xvfb, visible through noVNC (`localhost:6080`) and controllable through CDP (`localhost:9222`).
- `coordinator`: dependency-free Node server with an authenticated control API and dashboard (`localhost:3000`).
- `chrome-data`: persistent Docker volume for the browser profile.
- Cooperative lease: agents must check/request control and stop CDP input while `mode === "human"`.

## Run

Requires Docker Compose and Node 20+ for local tests.

```bash
cp .env.example .env
# Set a long random RELAY_TOKEN in .env
docker compose up --build
```

Open `http://localhost:3000/?token=YOUR_TOKEN`. Run the demonstration agent in a second terminal:

```bash
RELAY_TOKEN=YOUR_TOKEN npm run demo:agent
```

It requests a CAPTCHA takeover and waits. Click **Open shared browser**, do the human step, then click **Return control to agent**. The demo resumes. Real automation connects Playwright/Puppeteer to `http://localhost:9222` and follows the same control protocol.

## Agent integration

```js
const state = await fetch('http://localhost:3000/api/state', {
  headers: { Authorization: `Bearer ${process.env.RELAY_TOKEN}` }
}).then(r => r.json());
if (state.mode !== 'agent') await waitUntilControlReturns();

await fetch('http://localhost:3000/api/takeover', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.RELAY_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'Please complete the CAPTCHA' })
});
// Do not issue browser input until /api/state returns mode: agent.
```

## Test

```bash
npm test
```

Tests cover authentication, takeover ownership, stale-lease expiry, and the end-to-end request/release API.

## Security and constraints

- Ports bind to `127.0.0.1` by default. For remote use, put the dashboard and noVNC behind TLS plus an authenticated tunnel. Never expose CDP (`9222`) to the public internet.
- Change the development token. noVNC itself is only loopback-bound in this prototype; production should add per-session credentials and short-lived URLs.
- Control is cooperative. An agent that ignores the coordinator can still send CDP input. Production adapters should enforce the lease in the browser-control transport, not rely only on client behavior.
- Some sites invalidate a CAPTCHA when IP, browser fingerprint or window changes. Relay avoids browser/window changes, but no design can guarantee a site's acceptance.
