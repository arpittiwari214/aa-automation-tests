// scripts/debug-devices.js
//
// Lists the devices registered to this account.
//
// Running a form requires a device (the Bot Agent) to execute on. If none is
// registered, the form cannot be run at all, and the file upload therefore
// cannot be exercised anywhere — which decides whether automating a run is
// worth attempting.
//
// Endpoint captured from the control room's own traffic: POST /v2/userdevices
//
// Run:  node scripts/debug-devices.js

require('dotenv').config();
const { request } = require('@playwright/test');
const { AaApiClient } = require('../api/AaApiClient');

const BASE = process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital';

(async () => {
  const ctx = await request.newContext({ baseURL: BASE });
  const api = new AaApiClient(ctx);

  const auth = await api.authenticate(process.env.AA_USERNAME, process.env.AA_PASSWORD);
  console.log('auth:', auth.status());

  const res = await ctx.post('/v2/userdevices', {
    headers: api.authHeaders,
    data: { page: { offset: 0, length: 50 }, sort: [], filter: {} },
  });

  console.log('POST /v2/userdevices ->', res.status());

  const body = await res.json().catch(async () => ({ raw: await res.text() }));
  const list = body.list || [];

  console.log(`\ndevices registered: ${list.length}`);
  for (const d of list) {
    console.log(
      `  id=${d.id} host="${d.hostName || d.nickName || ''}" ` +
        `status=${d.status || d.botAgentStatus || '?'} type=${d.type || '?'}`
    );
  }

  if (!list.length) {
    console.log('\nNo device is registered to this account.');
    console.log('Bots and forms cannot be executed without the Bot Agent installed');
    console.log('and a device registered, so a real file upload is not reachable.');
  }

  await ctx.dispose();
})();
