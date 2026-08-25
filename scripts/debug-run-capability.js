// scripts/debug-run-capability.js
//
// Can a form actually be RUN on this account?
//
// The Select File control is inert in the form editor, so the only way to
// exercise a real upload is to run the form through a bot/process, where the
// runtime mounts a genuine <input type="file">. Running anything in
// Automation Anywhere requires a registered device (the Bot Agent). This
// script checks whether one exists, and what the control room says when a run
// is attempted, before any effort goes into automating the run itself.
//
// Run:  node scripts/debug-run-capability.js

require('dotenv').config();
const { chromium } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');

const BASE = process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital';

(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  const login = new LoginPage(page);
  await login.goto();
  await login.login(process.env.AA_USERNAME, process.env.AA_PASSWORD);
  await login.dismissUpgradeBanner();

  // Capture whatever the devices page asks the API for, plus what it renders.
  const deviceCalls = [];
  page.on('response', (res) => {
    if (/device/i.test(res.url())) {
      deviceCalls.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE, '')}`);
    }
  });

  console.log('opening My Devices…');
  await page.goto(`${BASE}/#/devices/mydevices`);
  await page.waitForTimeout(9000);

  console.log('\n--- device API calls ---');
  for (const c of [...new Set(deviceCalls)]) console.log('  ' + c);

  const bodyText = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  const cleaned = bodyText.replace(/\s+/g, ' ').trim();

  console.log('\n--- devices page text (first 700 chars) ---');
  console.log(cleaned.slice(0, 700));

  // The tell-tale phrases either way.
  const signals = [
    'Connect to my computer',
    'Download the Bot Agent',
    'No devices',
    'Device is connected',
    'CONNECTED',
    'DISCONNECTED',
    'Install the Bot Agent',
  ];
  console.log('\n--- signals present ---');
  for (const s of signals) {
    if (new RegExp(s, 'i').test(cleaned)) console.log(`  FOUND: "${s}"`);
  }

  await browser.close();
})();
