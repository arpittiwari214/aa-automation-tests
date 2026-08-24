// tests/useCase2.spec.js
//
// Use Case 2 — Create a Process with a Form via API (API Automation)
//
// The eight steps from the assignment, each asserted:
//   1. authenticate, capture token        5. save form dependencies
//   2. get private workspace folder id    6. create the process file
//   3. create the form file               7. save the 3-node workflow content
//   4. save form content (3 fields)       8. save process dependencies -> form
//
// No browser is launched here — the `request` fixture speaks HTTP directly,
// which is the whole point of the API half of the assignment.

require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { AaApiClient } = require('../api/AaApiClient');
const { formContent, processContent } = require('../api/payloads');
const E = require('../api/endpoints');

// Unique names so re-runs don't collide with files left by a previous run.
const RUN_ID = Date.now();
const FORM_NAME = `ApiForm_${RUN_ID}`;
const PROCESS_NAME = `ApiProcess_${RUN_ID}`;

test.describe.configure({ mode: 'serial' });

test.describe('Use Case 2 — Create a Process with a Form via API', () => {
  let client;
  let privateFolderId;
  let formFileId;
  let processFileId;

  test.beforeAll(async ({ playwright }) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital',
      // Fail loudly on non-2xx rather than throwing, so each spec can assert
      // on the status code itself.
      ignoreHTTPSErrors: false,
    });
    client = new AaApiClient(context);
  });

  test('Step 1 — authenticates and captures a valid auth token', async () => {
    const response = await client.authenticate(
      process.env.AA_USERNAME,
      process.env.AA_PASSWORD
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);

    // The token is what every later step depends on.
    expect(client.token).toBeTruthy();
  });

  test('Step 2 — retrieves the private workspace folder id', async () => {
    const response = await client.listPrivateFiles();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.list)).toBeTruthy();
    expect(body.list.length).toBeGreaterThan(0);

    // Taking any file's parentId yields the workspace ROOT, which is not
    // writable — creating there returns 400 repository.exception.root.folder
    // ("Can not create under root folder"). Resolve a real subfolder instead.
    privateFolderId = await client.getWritableFolderId();
    expect(privateFolderId).toBeTruthy();
    expect(String(privateFolderId)).toMatch(/^\d+$/);

    // And it must not be the root we were just handed.
    expect(String(privateFolderId)).not.toBe(String(client.rootFolderId));
  });

  test('Step 3 — creates a Form file and gets back a valid id', async () => {
    const response = await client.createFile(
      privateFolderId,
      FORM_NAME,
      E.contentTypes.form
    );

    // The API returns 200 or 201 depending on the route; both mean created.
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(String(body.id)).toMatch(/^\d+$/);

    formFileId = body.id;
  });

  test('Step 4 — saves form content with TextBox, TextArea and Number fields', async () => {
    const response = await client.saveContent(formFileId, formContent(FORM_NAME));

    expect([200, 201]).toContain(response.status());
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    // The saved file should still be the one we created.
    expect(String(body.id ?? formFileId)).toBe(String(formFileId));
  });

  test('Step 5 — saves the form file dependencies', async () => {
    // A standalone form has no upstream dependencies; the call still has to
    // succeed, because the Control Room records an explicit empty set.
    const response = await client.saveDependencies(formFileId, []);

    expect([200, 201]).toContain(response.status());
    expect(response.ok()).toBeTruthy();
  });

  test('Step 6 — creates a Process file and gets back a valid id', async () => {
    const response = await client.createFile(
      privateFolderId,
      PROCESS_NAME,
      E.contentTypes.workflow
    );

    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(String(body.id)).toMatch(/^\d+$/);

    processFileId = body.id;
    // The process must be a different file from the form.
    expect(String(processFileId)).not.toBe(String(formFileId));
  });

  test('Step 7 — saves the 3-node workflow referencing the form', async () => {
    const content = processContent(PROCESS_NAME, formFileId);

    // Guard the payload itself: the assignment specifies exactly this shape.
    expect(content.nodes).toHaveLength(3);
    expect(content.nodes.map((n) => n.id)).toEqual(['InitialStep', 'FormStep', 'exit']);
    expect(content.nodes[0].formFileId).toBe(formFileId);
    expect(content.nodes[1].formFileId).toBe(formFileId);

    const response = await client.saveContent(processFileId, content);

    expect([200, 201]).toContain(response.status());
    expect(response.ok()).toBeTruthy();
  });

  test('Step 8 — links the form as a dependency of the process', async () => {
    const response = await client.saveDependencies(processFileId, [formFileId]);

    expect([200, 201]).toContain(response.status());
    expect(response.ok()).toBeTruthy();
  });
});
