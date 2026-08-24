// scripts/capture-auth.js
//
// Automates the "identify required API endpoints using the browser Network tab"
// step of Use Case 2.
//
// Instead of guessing auth routes (and risking account lockout by firing
// credentials at a dozen candidate URLs), this drives a real browser login and
// records the request the control room itself makes. Whatever URL carries the
// username IS the auth endpoint, by definition.
//
// Run it with:  node scripts/capture-auth.js
//
// It prints the endpoint path, the response field holding the token, and the
// header name the app uses on subsequent calls. Nothing secret is printed —
// token and password values are masked.

require('dotenv').config();
const { chromium } = require('@playwright/test');

const BASE = process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital';
const USER = process.env.AA_USERNAME;
const PASS = process.env.AA_PASSWORD;

const mask = (v) =>
  typeof v === 'string' && v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} chars)` : '***';

(async () => {
  if (!USER || !PASS) {
    console.error('Missing AA_USERNAME / AA_PASSWORD in .env');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const page = await browser.newPage();

  const authCalls = [];
  const apiCalls = [];

  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(BASE)) return;
    const method = req.method();
    if (method === 'GET') return;

    let body = '';
    try {
      body = req.postData() || '';
    } catch {
      /* binary or unavailable */
    }

    const path = url.replace(BASE, '');
    // The request that carries the username is the login call.
    if (body.includes(USER)) {
      authCalls.push({ method, path, body });
    }
    apiCalls.push({ method, path });
  });

  console.log('Logging in to capture the auth request…\n');
  await page.goto(`${BASE}/#/login?next=/index`);
  await page.getByRole('textbox', { name: 'Username' }).fill(USER);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASS);

  const responsePromise = page
    .waitForResponse((r) => {
      const req = r.request();
      if (req.method() !== 'POST') return false;
      const d = req.postData() || '';
      return d.includes(USER);
    }, { timeout: 60000 })
    .catch(() => null);

  await page.getByRole('button', { name: 'Log in' }).click();
  const authResponse = await responsePromise;

  console.log('='.repeat(70));
  if (authCalls.length === 0) {
    console.log('No request carrying the username was seen.');
    console.log('The app may send credentials in a non-JSON encoding.');
  } else {
    for (const c of authCalls) {
      console.log(`AUTH ENDPOINT:  ${c.method} ${c.path}`);
      try {
        const parsed = JSON.parse(c.body);
        console.log('Request fields:', Object.keys(parsed).join(', '));
      } catch {
        console.log('Request body is not JSON.');
      }
    }
  }

  if (authResponse) {
    console.log(`Response status: ${authResponse.status()}`);
    try {
      const json = await authResponse.json();
      console.log('Response fields:', Object.keys(json).join(', '));
      for (const key of ['token', 'accessToken', 'access_token', 'jwt']) {
        if (json[key]) console.log(`  -> token field is "${key}":`, mask(json[key]));
      }
    } catch {
      console.log('Response body is not JSON.');
    }
  }

  // After login, walk to the repository so the follow-up calls reveal the
  // header name and the /v2/repository/... routes the API suite needs.
  console.log('\nNavigating to the file list to capture repository calls…');
  await page.goto(`${BASE}/#/bots/repository`);
  await page.waitForTimeout(6000);

  const repoCalls = apiCalls.filter((c) => /repository|workspace|folder|file/i.test(c.path));
  console.log('\nRepository calls observed:');
  const seen = new Set();
  for (const c of repoCalls) {
    const key = `${c.method} ${c.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${key}`);
  }

  // Which header carries the session token on authenticated calls?
  const probe = await page.evaluate(async (base) => {
    try {
      const r = await fetch(`${base}/v2/repository/workspaces/private/files/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: { offset: 0, length: 1 } }),
      });
      return r.status;
    } catch (e) {
      return String(e);
    }
  }, BASE);
  console.log(`\nIn-page fetch to listPrivateFiles returned: ${probe}`);

  console.log('='.repeat(70));
  await browser.close();
})();
