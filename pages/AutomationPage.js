// pages/AutomationPage.js
//
// Page Object for the control room's "Automation" section — the list of
// bots/forms in the private workspace, plus the "Create > Form" dialog.
//
// Confidence markers used throughout this project:
//   CONFIRMED - captured from a live codegen recording or DevTools inspection
//   INFERRED  - a reasonable role/text based locator that still needs a
//               real run to verify. Re-record with `npm run codegen` to check.

class AutomationPage {
  constructor(page) {
    this.page = page;

    // CONFIRMED (codegen): left-hand nav entry.
    this.automationNavLink = page.getByRole('link', { name: 'Automation', exact: true });

    // INFERRED: the "Create" dropdown in the top toolbar of the file list.
    this.createDropdown = page.getByRole('button', { name: /^create$/i });

    // INFERRED: the "Form" entry inside the Create dropdown.
    this.createFormOption = page.getByRole('menuitem', { name: /^form$/i });

    // --- "Create form" dialog ---
    // INFERRED from the live dialog: a "Form name" field, an optional
    // description, a folder picker defaulted to \Bots, and the submit button.
    this.formNameInput = page.getByRole('textbox', { name: /form name|name/i }).first();
    this.formDescriptionInput = page.getByRole('textbox', { name: /description/i });
    this.createAndEditButton = page.getByRole('button', { name: /create\s*&\s*edit|create and edit/i });
  }

  async goto() {
    await this.automationNavLink.click();
    // The file list lazy-loads; wait for the Create control to be usable
    // rather than for a fixed timeout.
    await this.createDropdown.waitFor({ state: 'visible' });
  }

  /**
   * Runs the "Create > Form" flow and lands on the builder canvas.
   * @param {string} name        unique form name
   * @param {string} description optional free-text description
   * @returns {string} the form-editor URL the app navigated to
   */
  async createForm(name, description = '') {
    await this.createDropdown.click();
    await this.createFormOption.click();

    await this.formNameInput.fill(name);

    if (description) {
      // The description field is genuinely optional in the dialog, so only
      // touch it when the caller supplied text.
      await this.formDescriptionInput.fill(description);
    }

    await this.createAndEditButton.click();

    // The builder route always ends in /form/edit — waiting on it proves
    // the form was actually created rather than the dialog silently failing.
    await this.page.waitForURL(/\/form\/edit/, { timeout: 60 * 1000 });

    return this.page.url();
  }

  /** Opens an already-existing form from the file list by its name. */
  async openForm(name) {
    await this.page.getByRole('link', { name, exact: true }).click();
    await this.page.waitForURL(/\/form\/edit/, { timeout: 60 * 1000 });
  }
}

module.exports = { AutomationPage };
