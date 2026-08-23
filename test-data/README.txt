sample-upload.pdf is the document Use Case 1 uploads.

A small valid PDF is committed here so the suite runs out of the box on a
fresh clone. Replace it with any other file if you prefer — just keep the
name, or update SAMPLE_FILE in tests/useCase1.spec.js.

Keep it small (well under 1 MB): the Select File control enforces a size
limit, and a large file makes the upload assertion slow and flaky.
