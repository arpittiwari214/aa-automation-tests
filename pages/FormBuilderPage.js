// pages/FormBuilderPage.js
//
// Page Object for the form-builder canvas.
//
// THE IMPORTANT THING ABOUT THIS PAGE:
// The whole form designer (element palette + canvas) is rendered inside an
// <iframe>. A plain `page.locator('.file-upload-content')` will never match,
// because that class only exists in the frame's document, not the top one.
// Everything canvas-related therefore goes through `this.canvas`.
//
// This was confirmed by a codegen recording, which emitted:
//   page.locator('iframe').first().contentFrame().locator('.file-upload-content')
//
// If a palette locator ever fails while canvas locators still work, it means
// that particular control lives OUTSIDE the iframe — swap `this.canvas` for
// `this.page` on just that line.

class FormBuilderPage {
  constructor(page) {
    this.page = page;

    // --- Top toolbar (outside the iframe) ---
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.previewButton = page.getByRole('button', { name: 'Preview' });
    this.closeButton = page.getByRole('button', { name: 'Close' });

    // --- Element palette (left rail, inside the designer frame) ---
    this.textboxPaletteItem = this.canvas.getByText('TextBox', { exact: true });
    this.selectFilePaletteItem = this.canvas.getByText('Select File', { exact: true });

    // --- Canvas fields ---
    // CONFIRMED via the form's own Styles tab: the builder assigns every
    // field type a stable container class (.aa_field--textbox, .aa_field--file).
    // Scoping to those containers is far more reliable than matching loose
    // text, which would also hit the palette entry of the same name.
    this.textboxField = this.canvas.locator('.aa_field--textbox');
    this.textboxInput = this.textboxField.locator('input, textarea').first();

    this.fileField = this.canvas.locator('.aa_field--file');
    this.fileUploadArea = this.fileField.locator('.file-upload-content');
    this.browseLink = this.fileField.getByText('browse');
    this.hiddenFileInput = this.fileField.locator('input[type="file"]');

    // --- Right-hand properties panel (inside the designer frame) ---
    this.propertiesPanel = this.canvas.getByText(/^Properties/);
    this.elementIdInput = this.canvas.getByRole('textbox', { name: /element id/i });
    this.elementLabelInput = this.canvas.getByRole('textbox', { name: /element label/i });
    this.fileFormatsInput = this.canvas.getByRole('textbox', {
      name: /file formats/i,
    });
  }

  /**
   * FrameLocator for the designer iframe. Declared as a getter so it is
   * re-resolved on every use — the builder swaps its iframe out when the
   * form reloads, and a cached handle would go stale.
   */
  get canvas() {
    return this.page.locator('iframe').first().contentFrame();
  }

  async gotoFormEditor(formUrl) {
    await this.page.goto(formUrl);
    await this.waitForCanvasReady();
  }

  /**
   * The builder paints a `.loadable__overlay` over the designer while it
   * boots. It is transparent, so the form looks ready before it actually is,
   * and any click lands on the overlay instead of the element underneath.
   * This is the single most likely cause of "the browse link does nothing".
   */
  async waitForCanvasReady() {
    // `hidden` also passes when the element was never present, so this is
    // safe whether or not the overlay renders on a given load.
    await this.page
      .locator('.loadable__overlay')
      .first()
      .waitFor({ state: 'hidden', timeout: 60 * 1000 });

    await this.canvas.locator('body').waitFor({ state: 'visible' });
  }

  /**
   * Drags a palette element onto the canvas.
   *
   * `locator.dragTo()` alone is not reliable here: the builder listens for a
   * stream of mousemove events, and dragTo emits only a start and an end.
   * Stepping the mouse manually is what makes the drop register.
   */
  async dragElementToCanvas(paletteItem) {
    const dropZone = this.canvas.locator('.aa_form-container').first();

    const source = await paletteItem.boundingBox();
    const target = await dropZone.boundingBox();

    if (!source || !target) {
      throw new Error('Could not resolve drag source or drop target bounding box.');
    }

    await this.page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await this.page.mouse.down();

    // Intermediate moves matter — the builder only starts tracking a drag
    // after it sees movement, so jumping straight to the target drops nothing.
    await this.page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 3,
      { steps: 20 }
    );
    await this.page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 10 }
    );

    await this.page.mouse.up();
  }

  async addTextbox() {
    await this.dragElementToCanvas(this.textboxPaletteItem);
    await this.textboxField.first().waitFor({ state: 'visible' });
  }

  async addFileUpload() {
    await this.dragElementToCanvas(this.selectFilePaletteItem);
    await this.fileField.first().waitFor({ state: 'visible' });
  }

  /** Clicks a canvas field so its properties load in the right-hand panel. */
  async selectField(fieldLocator) {
    await fieldLocator.click();
    await this.propertiesPanel.waitFor({ state: 'visible' });
  }

  async fillTextbox(text) {
    await this.textboxInput.fill(text);
  }

  /**
   * Restricts the accepted file types on the Select File element.
   * An empty format list is one reason the control can reject every file.
   */
  async setAllowedFileFormats(formats = 'pdf,png,jpg,docx') {
    await this.selectField(this.fileField);
    await this.fileFormatsInput.fill(formats);
    // Blur so the builder commits the value.
    await this.canvas.locator('body').click({ position: { x: 5, y: 5 } });
  }

  /**
   * Uploads a file to the Select File control.
   *
   * Two strategies, because the control behaves differently depending on
   * whether the builder has injected its real <input type="file"> yet:
   *   1. Click "browse" and intercept the native file chooser.
   *   2. If no chooser appears, set files straight onto the hidden input.
   *
   * Strategy 2 is what makes this work even when a human clicking "browse"
   * gets nothing — Playwright can populate an input the UI never opened.
   */
  async uploadFile(filePath) {
    await this.waitForCanvasReady();

    try {
      const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 8000 });
      await this.browseLink.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(filePath);
      return 'filechooser';
    } catch {
      // No native dialog fired. Fall back to the underlying input.
      // `setInputFiles` works on inputs that are hidden or zero-sized.
      await this.hiddenFileInput.setInputFiles(filePath);
      return 'hidden-input';
    }
  }

  /** Resolves to the filename text the control displays once a file is attached. */
  uploadedFileName(fileName) {
    return this.fileField.getByText(fileName, { exact: false });
  }

  async saveForm() {
    await this.saveButton.click();
  }

  /** True once the Save button goes disabled, which is how the builder signals "no unsaved changes". */
  async isSaved() {
    return this.saveButton.isDisabled();
  }
}

module.exports = { FormBuilderPage };
