# Capturing the Control Room API calls

Use Case 2 asks you to "identify required API endpoints using the browser
Network tab". This is how to do that, and where to put what you find.

## Why some endpoints are marked `[CAPTURE]`

`api/endpoints.js` marks each path either `[VERIFIED]` or `[CAPTURE]`.

- `[VERIFIED]` — `/v1/authentication` is the documented, long-stable Control
  Room auth route. It is safe to rely on.
- `[CAPTURE]` — the `/v2/repository/...` routes differ between Community
  Edition and Enterprise, and between releases. The shapes in this repo follow
  the assignment brief, but you should confirm them against your own account
  before claiming the suite passes end to end.

Getting this from a capture is not a workaround — it is literally step one of
the assignment's own instructions.

## The capture procedure

1. Log in to the Control Room in Chrome.
2. Open DevTools (`F12`) and select the **Network** tab.
3. Tick **Preserve log**, and set the filter to **Fetch/XHR**. This hides the
   images and stylesheets so you only see API traffic.
4. Now perform, by hand, exactly the flow Use Case 2 automates:
   - create a Form in your private workspace
   - add a TextBox, a TextArea and a Number field
   - save it
   - create a Process
   - add the three steps, referencing the form
   - save it
5. For each request that appears, note four things:
   - **Method + URL** → goes in `api/endpoints.js`
   - **Request headers** → confirm it is `X-Authorization`, not `Bearer`
   - **Request payload** → goes in `api/payloads.js`
   - **Response body** → tells you which field holds the new file's `id`

## Reading a request quickly

Right-click any request in the Network list and choose
**Copy → Copy as fetch**. That gives you the full URL, headers and body in one
paste, which is much faster than clicking through the tabs.

**Before you paste that anywhere: it contains your auth token.** Strip it.
A token is as sensitive as the password that produced it.

## Where each capture lands

| What you captured | File to edit |
| --- | --- |
| The create-file URL | `api/endpoints.js` → `createFileInFolder` |
| The save-content URL | `api/endpoints.js` → `saveFileContent` |
| The dependencies URL | `api/endpoints.js` → `saveFileDependencies` |
| The form body JSON | `api/payloads.js` → `formContent()` |
| The workflow body JSON | `api/payloads.js` → `processContent()` |

The specs in `tests/useCase2.spec.js` should not need to change — they assert
on status codes and ids, which stay the same regardless of the exact route.

## A faster alternative for the UI half

For Use Case 1 selectors, skip DevTools entirely:

```bash
npm run codegen
```

Click through the flow and Playwright writes the locators for you. Two rules:

- Do not save the generated file into the repo — it records your password in
  plain text. Copy the locator lines you want, then close the window.
- Prefer the `getByRole` locators it generates over raw CSS. They survive
  redesigns much better.
