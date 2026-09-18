const params = new URLSearchParams(location.search);
const token = params.get('token') || sessionStorage.getItem('relayToken') || '';
if (token) sessionStorage.setItem('relayToken', token);
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const status = document.querySelector('#status');
const headline = document.querySelector('#headline');
const detail = document.querySelector('#detail');
const primary = document.querySelector('#primary');
let state;

function paint(next) {
  state = next;
  const human = state.mode === 'human';
  status.textContent = human ? 'Your turn' : 'Agent in control';
  status.className = `pill ${state.mode}`;
  headline.textContent = human ? (state.reason || 'Human action required') : 'The agent is working';
  detail.textContent = human ? 'Open the shared browser, complete the human-only step, then return control.' : 'You can watch the shared browser. Tabs, cookies and page state stay in one Chromium session.';
  primary.textContent = human ? 'Open shared browser' : 'Watch shared browser';
  primary.disabled = false;
}
async function refresh() {
  const response = await fetch('/api/state', { headers });
  if (!response.ok) throw new Error('Add ?token=… to this URL');
  paint(await response.json());
}
primary.addEventListener('click', async () => {
  window.open(state.browserUrl, 'relay-browser', 'noopener');
  if (state.mode === 'human') {
    const done = document.createElement('button');
    done.textContent = 'Return control to agent';
    done.onclick = async () => {
      const response = await fetch('/api/release', { method: 'POST', headers, body: JSON.stringify({ leaseId: state.leaseId }) });
      paint(await response.json());
      done.remove();
    };
    primary.after(done);
  }
});
refresh().catch(error => { headline.textContent = 'Cannot connect'; detail.textContent = error.message; status.textContent = 'Offline'; });
setInterval(() => refresh().catch(() => {}), 1500);
