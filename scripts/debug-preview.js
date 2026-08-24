// scripts/debug-preview.js
//
// Checks whether the Select File control becomes a real <input type="file">
// once the form is running in Preview mode.
//
// Why: on the builder canvas the control renders as a design-time preview with
// no file input at all — no filechooser event fires and no hidden input exists,
// which is why both the automated upload AND a human clicking "browse" do
// nothing. If Preview mounts a real input, that is where the upload belongs.
//
// Run:  node scripts/debug-preview.js

require('dotenv').config();
const { chromium } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { AutomationPage } = require('../pages/AutomationPage');
const { FormBuilderPage } = require('../pages/FormBuilderPage');

const BASE = process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital';

async function reportFileInputs(page, label) {
  console.log(`\n--- ${label} ---`);
  console.log(`pages open: ${page.context().pages().length}`);

  for (const frame of page.frames()) {
    const count = await frame.locator('input[type="file"]').count().catch(() => 0);
    if (count > 0) {
      console.log(`  FILE INPUT FOUND: ${count} in frame ${frame.url().slice(0, 80) || '(main)'}`);
      const el = frame.locator('input[type="file"]').first();
      for (const attr of ['accept', 'name', 'class', 'id']) {
        const v = await el.getAttribute(attr).catch(() => null);
        if (v) console.log(`     ${attr}="${v}"`);
      }
    }
  }

  const total = (
    await Promise.all(page.frames().map((f) => f.locator('input[type="file"]').count().catch(() => 0)))
  ).reduce((a, b) => a + b, 0);
  if (total === 0) console.log('  no input[type="file"] anywhere');
  return total;
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const context = await browser.newContext({
    baseURL: BASE,
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
  await automation.createForm(`DebugPreview_${Date.now()}`, 'debug');
  await form.waitForCanvasReady();

  await form.addTextbox();
  await form.addFileUpload();

  await reportFileInputs(page, 'BUILDER CANVAS');

  // Where do the toolbar buttons actually live, and what are they called?
  // page-level getByRole('button', { name: 'Preview' }) times out, so dump
  // every button in every frame before trying to click anything.
  console.log('\n--- buttons per frame ---');
  for (const frame of page.frames()) {
    const buttons = await frame.locator('button').all().catch(() => []);
    const names = [];
    for (const b of buttons.slice(0, 80)) {
      const [aria, txt] = await Promise.all([
        b.getAttribute('aria-label').catch(() => null),
        b.innerText().catch(() => ''),
      ]);
      const label = (aria || txt || '').replace(/\s+/g, ' ').trim();
      if (label) names.push(JSON.stringify(label));
    }
    console.log(`\nframe ${frame.url().slice(0, 70) || '(main)'} — ${buttons.length} buttons`);
    console.log('  ' + names.join(', ').slice(0, 1200));
  }

  console.log('\nclicking Preview…');
  await form.previewButton.click();
  await page.waitForTimeout(8000);

  await reportFileInputs(page, 'PREVIEW MODE');

  // What is actually on screen in preview?
  for (const frame of page.frames()) {
    const hit = await frame
      .locator('.file-upload-content, .aa_field--file')
      .count()
      .catch(() => 0);
    if (hit) {
      const txt = await frame
        .locator('.file-upload-content, .aa_field--file')
        .first()
        .innerText()
        .catch(() => '');
      console.log(`\nfile field text in preview: "${(txt || '').replace(/\s+/g, ' ').trim()}"`);
    }
  }

  // Does clicking "browse" in preview create the input / fire a chooser?
  // If the app uses the File System Access API (showOpenFilePicker) rather
  // than an <input type="file">, no filechooser event will ever fire and
  // Playwright cannot drive it — that would be the real explanation.
  console.log('\n--- does browse do anything in preview? ---');
  const usesFsApi = await page.evaluate(() => 'showOpenFilePicker' in window);
  console.log(`window.showOpenFilePicker available: ${usesFsApi}`);

  for (const [label, sel] of [
    ['browse link', 'text=browse'],
    ['upload area', '.file-upload-content'],
  ]) {
    for (const frame of page.frames()) {
      const target = frame.locator(sel).first();
      if (!(await target.count().catch(() => 0))) continue;

      const chooser = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
      await target.click({ timeout: 5000 }).catch((e) => {
        // The full message names the element that intercepts the pointer,
        // which is the whole point of this diagnostic.
        console.log(`  click failed:\n${e.message.split('\n').slice(0, 12).map((l) => '    ' + l).join('\n')}`);
      });
      const fc = await chooser;
      console.log(`  ${label}: filechooser ${fc ? 'FIRED' : 'did not fire'}`);

      const after = await frame.locator('input[type="file"]').count().catch(() => 0);
      console.log(`  ${label}: input[type=file] in DOM after click = ${after}`);
      break;
    }
  }

  await browser.close();
})();
