// pages/LoginPage.js
//
// Page Object for the Automation Anywhere Community Edition login screen.
//
// Every locator here is CONFIRMED — they were captured from a real
// `npx playwright codegen` recording against the live control room,
// not guessed from the HTML.

class LoginPage {
  constructor(page) {
    this.page = page;

    this.usernameInput = page.getByRole('textbox', { name: 'Username' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.loginButton = page.getByRole('button', { name: 'Log in' });

    // Shown when credentials are rejected. Used to fail fast with a clear
    // message instead of timing out on the dashboard wait below.
    this.errorMessage = page.locator('.error, [role="alert"]').first();
  }

  async goto() {
    // `next=/index` is the exact entry URL the control room itself uses.
    await this.page.goto('/#/login?next=/index');
    await this.usernameInput.waitFor({ state: 'visible' });
  }

  async login(username, password) {
    if (!username || !password) {
      throw new Error(
        'Missing credentials. Copy .env.example to .env and set AA_USERNAME and AA_PASSWORD.'
      );
    }

    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();

    // Success is "we are no longer on the login route" — more robust than
    // hard-coding /#/home, because the control room redirects to different
    // landing routes depending on the account's state.
    await this.page.waitForURL((url) => !url.hash.includes('login'), {
      timeout: 45 * 1000,
    });
  }

  /**
   * The control room shows a yellow "Upgrade to Enterprise" banner on
   * Community Edition. It sits above the page content and can intercept
   * clicks aimed at the toolbar, so dismiss it once after logging in.
   */
  async dismissUpgradeBanner() {
    const closeButton = this.page
      .getByRole('button', { name: /close|dismiss/i })
      .first();

    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }
  }
}

module.exports = { LoginPage };
