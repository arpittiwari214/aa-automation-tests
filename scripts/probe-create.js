// scripts/probe-create.js
//
// Prints the server's actual response when creating a form file, so a 400 can
// be read rather than guessed at.
//
// Run:  node scripts/probe-create.js

require('dotenv').config();
const { request } = require('@playwright/test');
const { AaApiClient } = require('../api/AaApiClient');
const E = require('../api/endpoints');

const BASE = process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital';

(async () => {
  const ctx = await request.newContext({ baseURL: BASE });
  const api = new AaApiClient(ctx);

  const auth = await api.authenticate(process.env.AA_USERNAME, process.env.AA_PASSWORD);
  console.log('auth:', auth.status());

  const list = await api.listPrivateFiles();
  console.log('list:', list.status());
  const listBody = await list.json();
  console.log('\nprivate workspace entries:');
  for (const e of (listBody.list || []).slice(0, 15)) {
    console.log(
      `  id=${String(e.id).padEnd(10)} parent=${String(e.parentId).padEnd(10)} ` +
        `folder=${String(e.folder).padEnd(5)} name="${e.name}" path="${e.path || ''}"`
    );
  }

  // Creation is rejected directly under the workspace root, so find a real
  // subfolder to write into.
  const rootId = (listBody.list || [])[0]?.parentId;
  console.log(`\nroot folder id = ${rootId}; listing its children…`);

  const kids = await ctx.post(E.listFolder(rootId), {
    headers: api.authHeaders,
    data: { page: { offset: 0, length: 50 }, sort: [{ field: 'name', direction: 'asc' }] },
  });
  console.log('children status:', kids.status());
  const kidsBody = await kids.json().catch(() => ({}));
  for (const e of (kidsBody.list || []).slice(0, 15)) {
    console.log(
      `  id=${String(e.id).padEnd(10)} folder=${String(e.folder).padEnd(5)} name="${e.name}"`
    );
  }

  const target = (kidsBody.list || []).find((e) => e.folder);
  const folderId = target ? target.id : rootId;
  console.log(`\ncreating in folder ${folderId} (${target ? target.name : 'ROOT — will fail'})`);
  const name = `ApiForm_${Date.now()}`;

  // Send exactly the shape the UI sends and print whatever comes back.
  const payload = {
    name,
    parentFolderId: String(folderId),
    description: 'Created by automated API test',
    contentType: E.contentTypes.form,
  };
  console.log('\nPOST', E.createFile);
  console.log('payload:', JSON.stringify(payload));

  const res = await ctx.post(E.createFile, {
    headers: api.authHeaders,
    data: payload,
  });
  console.log('\nstatus:', res.status());
  console.log('body  :', (await res.text()).slice(0, 900));

  await ctx.dispose();
})();
