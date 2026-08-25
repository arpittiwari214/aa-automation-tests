// scripts/render-guide-pdf.js
//
// Renders docs/guide-print.html to docs/Automation-Anywhere-Testbench-Guide.pdf
// using Chromium's own print engine, which gives real control over pagination,
// widow/orphan handling and webfonts.
//
// Run:  npm run guide:pdf
//
// Edit docs/guide-print.html and re-run to regenerate.

const { chromium } = require('@playwright/test');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'docs', 'guide-print.html');
const OUT =
  process.argv[3] || path.join(ROOT, 'docs', 'Automation-Anywhere-Testbench-Guide.pdf');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'load' });
  // Webfonts must be resolved before layout is measured for pagination.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-family:'JetBrains Mono',monospace;font-size:7pt;
                  color:#8A9793;padding:0 16mm;display:flex;
                  justify-content:space-between;">
        <span>Automation Anywhere Testbench — Project Guide</span>
        <span class="pageNumber"></span>
      </div>`,
  });

  await browser.close();
  console.log('written:', OUT);
})();
