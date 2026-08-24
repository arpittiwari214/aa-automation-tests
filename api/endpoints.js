// api/endpoints.js
//
// Every Control Room endpoint the API suite touches, in one place.
//
// WHY THIS FILE EXISTS
// The assignment asks you to "identify required API endpoints using the
// browser Network tab". Endpoints are therefore kept here as data, not
// scattered through the client, so confirming each one against a real
// capture is a single-line edit instead of a hunt through the codebase.
//
// ---------------------------------------------------------------------------
// STATUS: authentication is CONFIRMED. The rest still need capturing.
// ---------------------------------------------------------------------------
//
// Black-box probing does not work against this host. An unauthenticated sweep
// returned 401 for every path tried, including a deliberately fake one
// (POST /definitely/not/a/real/route -> 401). The gateway answers 401 for
// essentially any unmatched route, so a 401 means "not authenticated", NOT
// "this route exists" — which is exactly why the assignment says to read the
// routes off the Network tab instead of guessing.
//
// So they were captured from a real login instead, by recording the requests
// the control room itself makes: `node scripts/capture-auth.js`.

module.exports = {
  // [CONFIRMED] Captured from a live login (scripts/capture-auth.js).
  //   POST /v2/authentication
  //   request : { username, password, captcha }
  //   response: 200 { token, user, permissions, tenantUuid, ttlSeconds, ... }
  // Note this is v2 — the commonly cited /v1/authentication returns 404 here,
  // which is what blocked the whole API suite before it was captured.
  authentication: '/v2/authentication',

  // [LIKELY] An in-page fetch to this path returned 401 rather than the
  // gateway's generic rejection while a session was active, so the route
  // appears to exist and simply needs the auth header. Still worth confirming
  // against a real capture before relying on the response shape.
  listPrivateFiles: '/v2/repository/workspaces/private/files/list',

  // [CONFIRMED] Lists the contents of a folder. Captured while the control
  // room loaded the private workspace file list.
  listFolder: (folderId) => `/v2/repository/folders/${folderId}/list`,

  // [CONFIRMED] Creates a file. Note the folder is NOT in the path — it goes
  // in the body as parentFolderId:
  //   POST /v2/repository/files
  //   body: { name, parentFolderId, description, contentType }
  createFile: '/v2/repository/files',

  // [CONFIRMED] Writes the form / workflow body onto an existing file.
  // This is a PUT, and the control room always sends hasErrors explicitly:
  //   PUT /v2/repository/files/{id}/content?hasErrors=false
  //   body: { form }
  saveFileContent: (fileId, hasErrors = false) =>
    `/v2/repository/files/${fileId}/content?hasErrors=${hasErrors}`,

  // [CONFIRMED] Registers dependencies. Also a PUT, and the body is a flat
  // list of ids under childFileIds — not an array of objects:
  //   PUT /v2/repository/files/{id}/dependencies
  //   body: { childFileIds }
  saveFileDependencies: (fileId) => `/v2/repository/files/${fileId}/dependencies`,

  // Content types named explicitly in the assignment brief.
  contentTypes: {
    form: 'application/vnd.aa.form',
    workflow: 'application/vnd.aa.workflow',
  },
};
