// scripts/capture-repo-calls.js
//
// Captures the repository API calls the control room makes when a form is
// created and saved through the UI — the create-file, save-content and
// save-dependencies routes Use Case 2 needs.
//
// This is the "identify required API endpoints using the browser Network tab"
// step, automated. It is used instead of guessing paths because this host
// answers 401 for almost any unmatched route, so probing cannot distinguish a
// real path from a wrong one. Driving the real UI and recording what it sends
// is the only reliable way to learn them.
//
// Run:  node scripts/capture-repo-calls.js

require('dotenv').config();
const { chromium } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { AutomationPage } = require('../pages/AutomationPage');
const { FormBuilderPage } = require('../pages/FormBuilderPage');

const BASE = process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital';

(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  const captured = [];

  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(BASE)) return;
    if (req.method() === 'GET') return;
    if (!/repository|workspace|folder|file/i.test(url)) return;

    let bodyKeys = '';
    try {
      const d = req.postData();
      if (d) {
        const parsed = JSON.parse(d);
        bodyKeys = Array.isArray(parsed) ? '[array]' : Object.keys(parsed).join(', ');
      }
    } catch {
      bodyKeys = '(non-JSON)';
    }

    captured.push({ method: req.method(), path: url.replace(BASE, ''), bodyKeys });
  });

  const login = new LoginPage(page);
  const automation = new AutomationPage(page);
  const form = new FormBuilderPage(page);

  await login.goto();
  await login.login(process.env.AA_USERNAME, process.env.AA_PASSWORD);
  await login.dismissUpgradeBanner();

  console.log('creating a form through the UI…');
  await automation.goto();
  await automation.createForm(`CaptureRepo_${Date.now()}`, 'endpoint capture');
  await form.waitForCanvasReady();

  await form.addTextbox();
  await form.addFileUpload();

  console.log('saving…');
  await form.saveForm();
  await page.waitForTimeout(8000);

  console.log('\n' + '='.repeat(78));
  console.log('REPOSITORY CALLS (non-GET)');
  console.log('='.repeat(78));
  const seen = new Set();
  for (const c of captured) {
    const key = `${c.method} ${c.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`${c.method.padEnd(6)} ${c.path}`);
    if (c.bodyKeys) console.log(`       body: { ${c.bodyKeys} }`);
  }
  if (!captured.length) console.log('(nothing captured)');
  console.log('='.repeat(78));

  await browser.close();
})();
