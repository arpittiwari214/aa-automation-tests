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

**The file upload cannot be exercised in the form editor — this is a property
of the application, not a gap in the tests.** It was established directly, with
`scripts/debug-preview.js`:

- the builder canvas mounts no `<input type="file">` at all, and clicking
  *browse* fires no `filechooser` event
- Preview does not render a live form either. It displays a static JPEG
  (`<img class="form-preview__background">`) inside an `aria-modal` dialog,
  and that image intercepts every pointer event

So neither surface can accept a file, which is also the real reason clicking
*browse* by hand does nothing. The control only becomes operable when the form
is **run** by a bot or process, where the runtime mounts a real input.

`Step 7b` therefore **skips**, with that reason recorded in the report, rather
than asserting something hollow that would read as a verified upload. The
`uploadFile()` method is kept because it is correct for the runtime context.
Everything else about the control *is* asserted: that it renders, that its
properties panel works, and that its configuration survives a save and reload.

**Toolbar buttons live inside the iframe, in lowercase.** Preview, Save and
Cancel are `"preview"`, `"save"`, `"cancel"` inside the designer frame — not
`"Save"` on the host page. And Save is never given the `disabled` attribute:
it flips `data-input-status` from `INTERACTIVE` to `DISABLED`, so
`toBeDisabled()` never matches and the attribute must be asserted instead.

**API endpoints were captured, not guessed.** The gateway answers 401 for any
unmatched path — including deliberately nonsense ones — so a 401 is not proof
a route exists and paths cannot be validated from the outside. They were
recorded from the control room's own traffic instead:

```bash
node scripts/capture-auth.js        # the login call
node scripts/capture-repo-calls.js  # create / content / dependency calls
```

What that turned up, all now confirmed:

| Call | Route |
| --- | --- |
| Authenticate | `POST /v2/authentication` → `{ token, user, ... }` |
| List workspace | `POST /v2/repository/workspaces/private/files/list` |
| Create file | `POST /v2/repository/files` — folder is `parentFolderId` in the **body** |
| Save content | `PUT /v2/repository/files/{id}/content?hasErrors=false` |
| Save dependencies | `PUT /v2/repository/files/{id}/dependencies`, body `{ childFileIds }` |

Two things cost real time and are worth knowing. `/v1/authentication` — the
commonly cited route — returns **404** here; Community Edition is on **v2**.
And the workspace **root folder is not writable**: creating there returns
`400 repository.exception.root.folder`, so `getWritableFolderId()` picks a real
subfolder (*Bots*) out of the listing. It deliberately does not derive the root
from a file's `parentId`, because that changes the moment anything is created
in a subfolder.

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
