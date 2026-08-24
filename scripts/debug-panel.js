// scripts/debug-panel.js
//
// One-off investigation helper. Logs in, creates a form, drops a Select File
// element on the canvas, selects it, and dumps every <input> in the properties
// panel with the attributes a locator could key off.
//
// Written because the allowed-formats input has no accessible name, so two
// rounds of guessing at a locator both missed. Reading the real DOM once is
// cheaper than guessing a third time.
//
// Run:  node scripts/debug-panel.js

require('dotenv').config();
const { chromium } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { AutomationPage } = require('../pages/AutomationPage');
const { FormBuilderPage } = require('../pages/FormBuilderPage');

(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  // LoginPage.goto() navigates to a path relative to baseURL, which normally
  // comes from playwright.config.js. A standalone script bypasses the config,
  // so supply it here or the relative URL fails to resolve.
  const context = await browser.newContext({
    baseURL: process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital',
    viewport: { width: 1600, height: 900 },
  });
  const page = await context.newPage();

  const login = new LoginPage(page);
  const automation = new AutomationPage(page);
  const form = new FormBuilderPage(page);

  await login.goto();
  await login.login(process.env.AA_USERNAME, process.env.AA_PASSWORD);
  await login.dismissUpgradeBanner();

  await automation.goto();
  await automation.createForm(`DebugPanel_${Date.now()}`, 'debug');
  await form.waitForCanvasReady();

  await form.addFileUpload();
  await form.selectField(form.fileField.first(), 'Select File');

  // Go through the same FrameLocator the page object uses, rather than
  // picking a frame out of page.frames() — the designer is not simply
  // "the first non-main frame", and guessing there returned an empty document.
  const inputs = await form.canvas.locator('input, textarea').all();

  console.log(`\n=== ${inputs.length} inputs in the designer frame ===`);
  for (const el of inputs) {
    if (!(await el.isVisible().catch(() => false))) continue;

    const [type, aria, placeholder, id, cls] = await Promise.all([
      el.getAttribute('type'),
      el.getAttribute('aria-label'),
      el.getAttribute('placeholder'),
      el.getAttribute('id'),
      el.getAttribute('class'),
    ]);

    // The visible label sitting above each input, read from its container.
    const nearby = await el
      .locator('xpath=ancestor::*[position()<=3]')
      .last()
      .innerText()
      .catch(() => '');

    console.log(
      `[${type || 'text'}]`.padEnd(12),
      `aria="${aria || ''}"`.padEnd(28),
      `ph="${placeholder || ''}"`.padEnd(30),
      `id="${id || ''}"`.padEnd(14),
      `near="${(nearby || '').replace(/\s+/g, ' ').trim().slice(0, 45)}"`
    );
  }

  await browser.close();
})();
