// tests/useCase1.spec.js
//
// Use Case 1 — Form with Upload Flow (UI Automation)
//
// Mirrors the eight steps in the assignment, in order:
//   1. log in                    5. drag Textbox + Select File onto the canvas
//   2. open Automation           6. click each element, check the right panel
//   3. Create > Form             7. type text, upload a document
//   4. fill details, Create      8. save and verify the upload
//
// The tests run serially and share one page, because each step depends on the
// form the previous step built. Splitting them into independent tests would
// mean creating a throwaway form per assertion.

require('dotenv').config();
const path = require('path');
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { AutomationPage } = require('../pages/AutomationPage');
const { FormBuilderPage } = require('../pages/FormBuilderPage');

const SAMPLE_FILE = path.resolve(__dirname, '../test-data/sample-upload.pdf');
const SAMPLE_TEXT = 'Test Automation Entry';

// Unique per run so repeated executions do not collide in the workspace.
const FORM_NAME = `TextboxFileUploadForm_${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Use Case 1 — Form with Upload Flow (UI Automation)', () => {
  let page;
  let loginPage;
  let automationPage;
  let formPage;
  let formUrl;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    loginPage = new LoginPage(page);
    automationPage = new AutomationPage(page);
    formPage = new FormBuilderPage(page);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('Step 1 — logs in to the control room with valid credentials', async () => {
    await loginPage.goto();
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.loginButton).toBeEnabled();

    await loginPage.login(process.env.AA_USERNAME, process.env.AA_PASSWORD);

    // Landing anywhere other than /#/login is the definition of a successful login.
    expect(page.url()).not.toContain('login');
    await loginPage.dismissUpgradeBanner();
  });

  test('Steps 2-4 — creates a new Form from the Automation menu', async () => {
    // If AA_FORM_URL is set, reuse that form instead of creating a new one.
    if (process.env.AA_FORM_URL) {
      formUrl = process.env.AA_FORM_URL;
      test.info().annotations.push({
        type: 'note',
        description: 'Reusing existing form from AA_FORM_URL; creation flow skipped.',
      });
      await formPage.gotoFormEditor(formUrl);
    } else {
      await automationPage.goto();
      await expect(automationPage.createDropdown).toBeVisible();

      formUrl = await automationPage.createForm(
        FORM_NAME,
        'Form with textbox and file upload for automation testing.'
      );
      await formPage.waitForCanvasReady();
    }

    // Reaching the builder route is the proof the form was actually created.
    expect(formUrl).toMatch(/\/form\/edit/);
  });

  test('Step 5 — drags the Textbox and Select File elements onto the canvas', async () => {
    await formPage.addTextbox();
    await expect(formPage.textboxField.first()).toBeVisible();

    await formPage.addFileUpload();
    await expect(formPage.fileField.first()).toBeVisible();

    // Assignment expectation: "UI element visibility and functionality".
    await expect(formPage.textboxInput).toBeEditable();
    await expect(formPage.fileUploadArea).toBeVisible();
    // The control renders "Drop file here or  browse" with two spaces before
    // the link, so match on flexible whitespace rather than a literal space.
    await expect(formPage.fileUploadArea).toContainText(/drop file here or\s+browse/i);
  });

  test('Step 6 — opens each element and verifies its properties panel', async () => {
    // The panel heading names the selected field type, so asserting on it
    // proves the click actually landed on the intended element.
    await formPage.selectField(formPage.textboxField.first(), 'Text Box');
    await expect(formPage.elementIdInput).toHaveValue(/Text\s*Box\d+/i);

    await formPage.selectField(formPage.fileField.first(), 'Select File');
    await expect(formPage.elementIdInput).toHaveValue(/File\d+/i);

    // An empty format allowlist makes the control reject every file, so set it
    // explicitly rather than relying on the builder's default.
    await formPage.setAllowedFileFormats('pdf,png,jpg,docx');
    // The builder normalises the list on blur, rewriting "a,b" as "a, b", so
    // assert on the entries with flexible separators rather than the exact
    // string that was typed in.
    await expect(formPage.fileFormatsInput).toHaveValue(/pdf,\s*png,\s*jpg,\s*docx/);
  });

  test('Step 7a — accepts and retains text in the textbox', async () => {
    await formPage.fillTextbox(SAMPLE_TEXT);
    await expect(formPage.textboxInput).toHaveValue(SAMPLE_TEXT);
  });

  test('Step 7b — uploads a document and shows the filename as confirmation', async () => {
    // The Select File control is inert inside the form editor. Verified
    // directly, not assumed (scripts/debug-preview.js):
    //   - the builder canvas mounts no <input type="file">, and clicking
    //     "browse" fires no filechooser event
    //   - Preview is not a live form: it is a static JPEG
    //     (<img class="form-preview__background">) inside an aria-modal
    //     dialog, and that image intercepts all pointer events
    // It only becomes operable when the form is run by a bot or process.
    //
    // Skipping with this reason is deliberate: the report then shows the step
    // as explicitly not-run with the cause, rather than passing on a hollow
    // assertion that would imply an upload was verified when none occurred.
    const operable = await formPage.isFileUploadOperable();
    test.skip(
      !operable,
      'Select File is inert in the form editor (no file input on the canvas; ' +
        'Preview is a static screenshot). Upload can only be exercised when the ' +
        'form is run by a bot/process. Evidence: scripts/debug-preview.js.'
    );

    const strategy = await formPage.uploadFile(SAMPLE_FILE);
    test.info().annotations.push({ type: 'upload-strategy', description: strategy });

    // Assignment expectation: "File upload status and confirmation".
    await expect(formPage.uploadedFileName('sample-upload.pdf')).toBeVisible({
      timeout: 20 * 1000,
    });
  });

  test('Step 8 — saves the form and verifies the backend accepted it', async () => {
    // Assignment expectation: "Form submission behavior and backend response".
    // Asserting on the actual HTTP response proves the save reached the server,
    // rather than just proving a toast appeared.
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          /repository|file|form/i.test(response.url()) &&
          ['POST', 'PUT'].includes(response.request().method()),
        { timeout: 45 * 1000 }
      ),
      formPage.saveForm(),
    ]);

    expect(saveResponse.ok()).toBeTruthy();
    expect(saveResponse.status()).toBeLessThan(400);

    // The builder greys out Save once there is nothing left to persist, but it
    // never sets the disabled attribute — it flips data-input-status from
    // INTERACTIVE to DISABLED and swaps a CSS class. toBeDisabled() inspects
    // the real disabled/aria-disabled state, so it reports the button as
    // enabled throughout and never matches. Assert the attribute the app
    // actually drives.
    await expect(formPage.saveButton).toHaveAttribute('data-input-status', 'DISABLED', {
      timeout: 20 * 1000,
    });
  });

  test('Step 8b — the saved form definition survives a reload', async () => {
    // What persists across a reload is the form DEFINITION — the fields that
    // were placed and configured — since the editor saves a design, not a
    // filled-in submission. Asserting the fields and their configuration come
    // back is the real check that the save reached the backend and stuck.
    await page.reload();
    await formPage.waitForCanvasReady();

    await expect(formPage.textboxField.first()).toBeVisible();
    await expect(formPage.fileField.first()).toBeVisible();

    // The allowed-formats value set in Step 6 must have persisted too.
    await formPage.selectField(formPage.fileField.first(), 'Select File');
    await expect(formPage.fileFormatsInput).toHaveValue(/pdf,\s*png,\s*jpg,\s*docx/);
  });
});
