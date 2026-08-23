# Automation Anywhere — UI & API Test Automation

Playwright suite covering both use cases from the assignment against
Automation Anywhere Community Edition.

- **Use Case 1** — build a form with a Textbox and a File Upload control
  through the browser, and verify the upload (UI automation).
- **Use Case 2** — create a Form and a three-node Process entirely over HTTP
  (API automation).

Built on the Page Object Model, with an equivalent client-object layer on the
API side.

## Framework and tools

| | |
| --- | --- |
| Test runner | [Playwright Test](https://playwright.dev/) (JavaScript) |
| UI pattern | Page Object Model — `pages/` |
| API pattern | API client object — `api/` |
| HTTP | Playwright's built-in `request` fixture (no axios/supertest needed) |
| Config | `dotenv` — credentials never live in source |

## Project structure

```
aa-automation-tests/
├── pages/                      # Page Object Model (Use Case 1)
│   ├── LoginPage.js            #   control room sign-in
│   ├── AutomationPage.js       #   Automation menu + Create > Form dialog
│   └── FormBuilderPage.js      #   the form designer canvas
├── api/                        # API layer (Use Case 2)
│   ├── endpoints.js            #   every endpoint, in one place
│   ├── AaApiClient.js          #   auth + repository calls
│   └── payloads.js             #   form and workflow request bodies
├── tests/
│   ├── useCase1.spec.js        # 8 UI tests, one per assignment step
│   └── useCase2.spec.js        # 8 API tests, one per assignment step
├── test-data/
│   └── sample-upload.pdf       # the document Use Case 1 uploads
├── docs/
│   └── capturing-api-calls.md  # how to confirm endpoints from the Network tab
├── playwright.config.js
└── .env.example
```

## Setup

```bash
npm install
npx playwright install chromium
```

Then create your `.env` from the template and fill in real values:

```bash
cp .env.example .env
```

```
AA_BASE_URL=https://community.cloud.automationanywhere.digital
AA_USERNAME=your_username
AA_PASSWORD=your_password
AA_FORM_URL=            # optional, see below
```

`.env` is git-ignored and must stay that way.

## Running the tests

```bash
npm run test:usecase1     # UI tests (opens a browser)
npm run test:usecase2     # API tests (no browser)
npm test                  # both
npm run report            # open the HTML report from the last run
```

Each use case is a separate Playwright *project*, so they can be run and
reported independently.

## How the tests map to the assignment

**Use Case 1** — `tests/useCase1.spec.js`

| Assignment step | Test |
| --- | --- |
| 1. Log in | `Step 1 — logs in to the control room` |
| 2-4. Automation → Create → Form | `Steps 2-4 — creates a new Form` |
| 5. Drag Textbox + Select File | `Step 5 — drags the Textbox and Select File elements` |
| 6. Verify right-panel interactions | `Step 6 — opens each element and verifies its properties panel` |
| 7. Enter text, upload a document | `Step 7a` / `Step 7b` |
| 8. Save and verify the upload | `Step 8` / `Step 8b` |

**Use Case 2** — `tests/useCase2.spec.js` — one test per API step, each
asserting the status code plus the specific thing the brief calls for
(a valid `id` on creation, success on every content and dependency save).

## Environment and configuration notes

**The form designer runs inside an iframe.** This is the single most important
implementation detail. A top-level `page.locator('.file-upload-content')` will
never match, because that element only exists in the frame's document.
`FormBuilderPage` routes every canvas locator through a `FrameLocator`
(`this.canvas`). If you extend the page object, do the same.

**A loading overlay intercepts early clicks.** The builder paints a
transparent `.loadable__overlay` over the designer while it boots, so the form
looks interactive before it is, and clicks land on the overlay instead of the
control underneath. `waitForCanvasReady()` waits for it to clear. This is the
usual explanation for "clicking *browse* does nothing" — including when
clicking by hand.

**File upload has two strategies.** `uploadFile()` first clicks *browse* and
intercepts the native file chooser. If no chooser fires within 8 seconds it
falls back to setting files directly on the hidden `<input type="file">`.
The fallback is what lets the test pass even on accounts where the *browse*
link is unresponsive to a real mouse click.

**Selectors carry confidence markers.** Locators are commented `CONFIRMED`
(captured from a live codegen recording or DevTools inspection) or `INFERRED`
(reasonable, not yet exercised against a real run). Re-record with
`npm run codegen` to promote an inferred locator.

**Every API endpoint needs confirming from a capture.** An unauthenticated
probe of this host showed the gateway answers 401 for any unmatched path —
including deliberately nonsense ones — so a 401 cannot be read as proof that a
route exists. Paths cannot be validated from the outside, which is precisely
why the assignment says to read them off the Network tab.

Start with authentication: it was the one path returning 404 rather than the
blanket 401, so `/v1/authentication` is probably not the Community Edition
route despite being the commonly cited one. Nothing else in the suite can run
until that call resolves. `docs/capturing-api-calls.md` walks through the
capture.

**Tests run serially, single worker.** Community Edition permits one active
session per user, so parallel workers would evict each other's login. Within
each use case the steps are ordered and share state, matching the assignment's
sequential flow.

**Timeouts are generous.** The control room takes a long time to boot its
editors; the suite uses a 90-second test timeout and a 45-second navigation
timeout rather than the Playwright defaults.

## Security note

Never commit `.env`, and never paste real credentials into a chat, an issue, a
screenshot, or a saved codegen recording. `npx playwright codegen` writes
whatever you type into its output — including your password in plain text —
which is why `codegen-*.js` is git-ignored. If a password does get committed,
rotating it is the only real fix; deleting the line does not remove it from
git history.
