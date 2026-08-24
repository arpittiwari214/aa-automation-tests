// api/AaApiClient.js
//
// Thin wrapper over Playwright's APIRequestContext for the Control Room API.
//
// This is the API-side equivalent of a Page Object: the tests describe *what*
// they are doing, this class knows *how* the HTTP call is shaped. Keeping the
// token, headers and URL building in here means a spec never repeats them.
//
// Every method returns the raw APIResponse rather than pre-parsed JSON, so the
// specs can assert on status codes — which the assignment requires at each step.

const E = require('./endpoints');

class AaApiClient {
  /** @param {import('@playwright/test').APIRequestContext} request */
  constructor(request) {
    this.request = request;
    this.token = null;
    this.userId = null;
  }

  /** Headers for any authenticated call. The Control Room uses X-Authorization, not Bearer. */
  get authHeaders() {
    if (!this.token) {
      throw new Error('Not authenticated — call authenticate() first.');
    }
    return {
      'X-Authorization': this.token,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Step 1 — authenticate and capture the token.
   * Stores the token on the instance so later calls can use it.
   */
  async authenticate(username, password) {
    if (!username || !password) {
      throw new Error(
        'Missing credentials. Copy .env.example to .env and set AA_USERNAME and AA_PASSWORD.'
      );
    }

    const response = await this.request.post(E.authentication, {
      data: { username, password },
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok()) {
      const body = await response.json();
      this.token = body.token;
      this.userId = body.user?.id ?? null;
    }

    return response;
  }

  /**
   * Step 2 — find the private workspace's root folder id.
   * Every subsequent create call needs somewhere to put the new file.
   */
  async listPrivateFiles() {
    return this.request.post(E.listPrivateFiles, {
      headers: this.authHeaders,
      data: {
        // Ask for a full page rather than a single record: the listing is how
        // the workspace's folders are discovered, and one record is whatever
        // happens to sort first.
        page: { offset: 0, length: 50 },
        sort: [{ field: 'name', direction: 'asc' }],
      },
    });
  }

  /** Lists the entries inside a folder. */
  async listFolder(folderId) {
    return this.request.post(E.listFolder(folderId), {
      headers: this.authHeaders,
      data: {
        page: { offset: 0, length: 50 },
        sort: [{ field: 'name', direction: 'asc' }],
      },
    });
  }

  /**
   * Step 2 — resolve a folder that files can actually be created in.
   *
   * The private workspace ROOT is not writable. Posting to it returns
   *   400 { code: "repository.exception.root.folder",
   *         message: "Can not create under root folder" }
   *
   * Note it is NOT enough to take a file's parentId and treat it as the root:
   * that yields whichever folder that particular file happens to live in, so
   * the answer changes as soon as anything is created in a subfolder.
   *
   * The workspace listing already includes folder entries (folder === true),
   * so pick from those directly. Prefer "Bots", where the control room puts
   * automations, and fall back to any other folder.
   *
   * @returns {Promise<string>} id of a writable folder
   */
  async getWritableFolderId() {
    const listed = await this.listPrivateFiles();
    if (!listed.ok()) {
      throw new Error(`Could not list private workspace: ${listed.status()}`);
    }

    const entries = (await listed.json()).list || [];
    const folders = entries.filter((e) => e.folder);
    const target = folders.find((f) => /^bots$/i.test(f.name)) || folders[0];

    if (!target) {
      throw new Error(
        `No folder found in the private workspace to create files in. ` +
          `Listing returned ${entries.length} entries, none of them folders.`
      );
    }

    // The chosen folder's own parent is the (non-writable) workspace root.
    this.rootFolderId = target.parentId;
    this.workingFolderName = target.name;
    return target.id;
  }

  /**
   * Steps 3 and 6 — create an empty file of the given content type.
   * @param {string|number} folderId  destination folder
   * @param {string} name             file name, must be unique in the folder
   * @param {string} contentType      E.contentTypes.form or .workflow
   */
  async createFile(folderId, name, contentType, description = 'Created by automated API test') {
    // CONFIRMED shape (scripts/capture-repo-calls.js): the destination folder
    // travels in the body as parentFolderId, not in the URL.
    return this.request.post(E.createFile, {
      headers: this.authHeaders,
      data: { name, parentFolderId: String(folderId), description, contentType },
    });
  }

  /**
   * Steps 4 and 7 — write the form / workflow body onto an existing file.
   * @param {string|number} fileId
   * @param {object} content  e.g. { form: {...} } for a form file
   */
  async saveContent(fileId, content) {
    return this.request.put(E.saveFileContent(fileId), {
      headers: this.authHeaders,
      data: content,
    });
  }

  /**
   * Steps 5 and 8 — register this file's dependencies.
   * CONFIRMED shape: a flat array of ids under childFileIds.
   * @param {Array<string|number>} dependencyFileIds files this one relies on
   */
  async saveDependencies(fileId, dependencyFileIds = []) {
    return this.request.put(E.saveFileDependencies(fileId), {
      headers: this.authHeaders,
      data: { childFileIds: dependencyFileIds.map(String) },
    });
  }
}

module.exports = { AaApiClient };
