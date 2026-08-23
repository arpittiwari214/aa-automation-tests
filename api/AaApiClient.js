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
        // A single page is enough — we only need one record to read its
        // parentId, which is the private workspace root.
        page: { offset: 0, length: 1 },
        sort: [{ field: 'name', direction: 'asc' }],
      },
    });
  }

  /**
   * Steps 3 and 6 — create an empty file of the given content type.
   * @param {string|number} folderId  destination folder
   * @param {string} name             file name, must be unique in the folder
   * @param {string} contentType      E.contentTypes.form or .workflow
   */
  async createFile(folderId, name, contentType) {
    return this.request.post(E.createFileInFolder(folderId), {
      headers: this.authHeaders,
      data: { name, type: contentType, contentType },
    });
  }

  /** Steps 4 and 7 — write the form / workflow body onto an existing file. */
  async saveContent(fileId, content) {
    return this.request.put(E.saveFileContent(fileId), {
      headers: this.authHeaders,
      data: content,
    });
  }

  /**
   * Steps 5 and 8 — register this file's dependencies.
   * @param {Array<string|number>} dependencyFileIds files this one relies on
   */
  async saveDependencies(fileId, dependencyFileIds = []) {
    return this.request.post(E.saveFileDependencies(fileId), {
      headers: this.authHeaders,
      data: {
        dependencies: dependencyFileIds.map((id) => ({ fileId: id })),
      },
    });
  }
}

module.exports = { AaApiClient };
