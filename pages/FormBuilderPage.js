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

    // --- Editor toolbar ---
    // CONFIRMED: these live INSIDE the designer frame, not on the host page,
    // and their accessible names are lowercase ("preview", "save", "cancel").
    // A page-level getByRole('button', { name: 'Preview' }) times out.
    this.saveButton = this.canvas.getByRole('button', { name: 'save' });
    this.previewButton = this.canvas.getByRole('button', { name: 'preview' });
    this.cancelButton = this.canvas.getByRole('button', { name: 'cancel' });

    // --- Element palette (left rail, inside the designer frame) ---
    // CONFIRMED from a live page snapshot: palette entries are BUTTONS whose
    // accessible name starts with U+F1C1, a Private Use Area font-icon glyph
    // (e.g. " Select File"). Any pattern anchored with ^ fails against
    // that first character, so match on the tail of the name instead — the
    // same gotcha as the Create menu in AutomationPage.
    this.selectFilePaletteItem = this.canvas.getByRole('button', { name: /Select File$/ });

    // The exact casing of the textbox entry is not yet confirmed ("TextBox",
    // "Textbox" and "Text Box" are all plausible), so accept any of them.
    this.textboxPaletteItem = this.canvas.getByRole('button', {
      name: /Text\s*Box$/i,
    });

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
    // CONFIRMED: two things match /^Properties/ — the tab button itself
    // (always present) and the panel heading, which reads "Properties - Form"
    // with no selection and "Properties - Text Box" / "Properties - Select
    // File" once a field is selected. Only the heading proves a field is
    // actually selected, so require the " - " that only the heading has.
    this.propertiesPanel = this.canvas.getByText(/^Properties\s*-\s*\S/);
    // CONFIRMED: these two carry proper accessible names.
    this.elementIdInput = this.canvas.getByRole('textbox', { name: /element id/i });
    this.elementLabelInput = this.canvas.getByRole('textbox', { name: /element label/i });

    // CONFIRMED by dumping every field in the panel (scripts/debug-panel.js):
    // the allowed-formats control is a <textarea name="fileFormat"> with no
    // accessible name and no placeholder — the panel renders "Enter file
    // formats separated by commas" as a plain text node that is not tied to it
    // by label or aria-label, so getByRole({ name }) can never match it.
    // The form-control name is the one stable hook it does expose.
    this.fileFormatsInput = this.canvas.locator('textarea[name="fileFormat"]');
  }

  /**
   * FrameLocator for the designer iframe. Declared as a getter so it is
   * re-resolved on every use — the builder swaps its iframe out when the
   * form reloads, and a cached handle would go stale.
   */
  get canvas() {
    // Target the designer frame by its src rather than taking the first
    // iframe on the page. The control room also embeds a third-party
    // fluidtopics.net help widget in its own iframe, so "first" is decided by
    // DOM order and would silently start resolving to the wrong document if
    // that widget ever moved ahead of the designer.
    return this.page.locator('iframe[src*="modules/attended"]').contentFrame();
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

  /**
   * Clicks a canvas field so its properties load in the right-hand panel.
   *
   * @param fieldLocator       the canvas field to select
   * @param expectedPanelName  the field type the panel heading should name,
   *                           e.g. "Text Box" or "Select File". Passing it
   *                           turns this into a real check: with nothing
   *                           selected the heading reads "Properties - Form",
   *                           which would otherwise satisfy a looser wait and
   *                           let a failed click slip through.
   */
  async selectField(fieldLocator, expectedPanelName) {
    await fieldLocator.click();

    if (expectedPanelName) {
      const heading = this.canvas.getByText(
        new RegExp(`^Properties\\s*-\\s*${expectedPanelName}`, 'i')
      );
      await heading.waitFor({ state: 'visible' });
      return;
    }

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
    await this.selectField(this.fileField.first(), 'Select File');
    await this.fileFormatsInput.fill(formats);
    // Blur so the builder commits the value.
    await this.canvas.locator('body').click({ position: { x: 5, y: 5 } });
  }

  /**
   * Attempts to upload a file to the Select File control.
   *
   * IMPORTANT — the control is INERT inside the form editor. This was
   * established by direct investigation (scripts/debug-preview.js), not by
   * inference:
   *
   *   - the builder canvas contains no <input type="file"> at all, and
   *     clicking "browse" fires no filechooser event
   *   - Preview does not render a live form either: it displays a static
   *     JPEG (<img class="form-preview__background">) inside an
   *     aria-modal dialog, and that image intercepts every pointer event
   *
   * So neither surface can accept a file. This is also the real reason
   * clicking "browse" by hand appears to do nothing — it is not a selector
   * problem and not a broken browser. The control only becomes functional
   * when the form is RUN by a task bot or process, where the runtime mounts
   * a real file input.
   *
   * The method is kept because it is correct for that runtime context. It
   * returns the strategy that worked, or throws a clear explanation rather
   * than a bare timeout.
   *
   * @returns {Promise<'filechooser'|'hidden-input'>}
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
      // No native dialog. Fall back to an input the UI never opened —
      // setInputFiles works on hidden or zero-sized inputs.
      if ((await this.hiddenFileInput.count()) > 0) {
        await this.hiddenFileInput.setInputFiles(filePath);
        return 'hidden-input';
      }

      throw new Error(
        'The Select File control exposes no file input in the form editor, and ' +
          'clicking "browse" fires no file chooser. This is expected: the editor ' +
          'renders a design-time preview of the control, and Preview mode is a ' +
          'static screenshot. Upload is only possible when the form is run by a ' +
          'bot/process. See scripts/debug-preview.js for the evidence.'
      );
    }
  }

  /**
   * Whether the Select File control is actually operable on the current
   * surface — true only when a real file input is mounted.
   */
  async isFileUploadOperable() {
    return (await this.hiddenFileInput.count()) > 0;
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
