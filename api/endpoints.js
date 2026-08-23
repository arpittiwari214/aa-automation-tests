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
// STATUS: every path below is UNCONFIRMED. Capture before trusting.
// ---------------------------------------------------------------------------
//
// An unauthenticated probe was run against this host to try to validate the
// paths from outside. It could not, and the reason is worth recording:
//
//   POST /v1/authentication            -> 404
//   POST /v2/authentication            -> 401
//   POST /v1/auth/login                -> 401
//   POST /oauth2/token                 -> 401
//   POST /definitely/not/a/real/route  -> 401   (this is the important one)
//
// The API gateway answers 401 for essentially any unmatched path, so a 401
// says "you are not authenticated", NOT "this route exists". That makes
// black-box path discovery impossible here — which is exactly why the
// assignment tells you to read the routes off the Network tab instead.
//
// The one genuine signal: /v1/authentication returned 404 rather than the
// blanket 401. A 404 means something actually matched and rejected it, so
// this is likely NOT the Community Edition auth path despite being the
// commonly cited one. Confirm it first — see docs/capturing-api-calls.md.

module.exports = {
  // [CAPTURE - PRIORITY] Probe returned 404 here, unlike the blanket 401
  // everywhere else. Treat as probably wrong. Log in with DevTools open and
  // read the real login POST off the Network tab; it takes about 30 seconds
  // and unblocks every other call in this file.
  authentication: '/v1/authentication',

  // [CAPTURE] Lists files in a workspace. The response carries the private
  // workspace's root folder id, which every create call below hangs off.
  listPrivateFiles: '/v2/repository/workspaces/private/files/list',

  // [CAPTURE] Creates an empty file of a given contentType inside a folder.
  createFileInFolder: (folderId) => `/v2/repository/folders/${folderId}/file`,

  // [CAPTURE] Writes the actual form / workflow body onto an existing file.
  saveFileContent: (fileId) => `/v2/repository/files/${fileId}/content`,

  // [CAPTURE] Registers which other files this file depends on.
  saveFileDependencies: (fileId) => `/v2/repository/files/${fileId}/dependencies`,

  // Content types named explicitly in the assignment brief.
  contentTypes: {
    form: 'application/vnd.aa.form',
    workflow: 'application/vnd.aa.workflow',
  },
};
