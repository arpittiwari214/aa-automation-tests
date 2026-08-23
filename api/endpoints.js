// api/endpoints.js
//
// Every Control Room endpoint the API suite touches, in one place.
//
// WHY THIS FILE EXISTS
// The assignment asks you to "identify required API endpoints using the
// browser Network tab". Endpoints are therefore kept here as data, not
// scattered through the client, so confirming them against a real capture is
// a one-line edit each instead of a hunt through the codebase.
//
// CONFIDENCE
//   [VERIFIED]  documented Control Room API, stable across versions
//   [CAPTURE]   shape is right, but confirm the exact path against your own
//               Network-tab recording — see docs/capturing-api-calls.md
//
// Community Edition occasionally differs from Enterprise on the v2 repository
// routes, which is why the repository paths are all marked [CAPTURE].

module.exports = {
  // [VERIFIED] Returns { token, user: { id, ... } }.
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
