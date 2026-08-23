// api/payloads.js
//
// Request bodies for the form and the process, kept out of the specs so the
// tests read as a sequence of steps rather than a wall of JSON.
//
// [CAPTURE] The exact field/node schema the Control Room expects is not
// publicly documented and differs between releases. The structures below
// follow the assignment brief literally (three named form fields; a three-node
// workflow). Build the same form and process once by hand in the UI, capture
// the save-content request in the Network tab, and paste its body shape here.
// docs/capturing-api-calls.md walks through exactly that.

/**
 * Form body with the three fields the assignment names:
 * TextBox, TextArea and Number.
 */
function formContent(formName) {
  return {
    name: formName,
    variables: [],
    elements: [
      {
        elementId: 'TextBox0',
        type: 'TextBox',
        label: 'TextBox',
        required: false,
      },
      {
        elementId: 'TextArea0',
        type: 'TextArea',
        label: 'TextArea',
        required: false,
      },
      {
        elementId: 'Number0',
        type: 'Number',
        label: 'Number',
        required: false,
      },
    ],
  };
}

/**
 * Three-node workflow: InitialStep -> FormStep -> exit.
 * Both InitialStep and FormStep reference the form file created earlier,
 * which is what makes the dependency link in step 8 meaningful.
 */
function processContent(processName, formFileId) {
  return {
    name: processName,
    nodes: [
      {
        id: 'InitialStep',
        type: 'InitialStep',
        formFileId,
        next: 'FormStep',
      },
      {
        id: 'FormStep',
        type: 'FormStep',
        formFileId,
        next: 'exit',
      },
      {
        id: 'exit',
        type: 'Exit',
        next: null,
      },
    ],
  };
}

module.exports = { formContent, processContent };
