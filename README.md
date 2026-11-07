# Phase 2 — inline validation for the main calculator

## What this patch changes

The patch updates **only** `app/index.html`:

- Product form: shows field-level errors for product name, package quantity and price; scrolls to and focuses the first invalid field.
- Calculator: validates calculator name, product selection and ingredient quantity before completing the calculator; highlights the invalid control and moves focus to it.
- JSON import: displays parsing and structure errors inline instead of opening a system-style confirmation dialog for validation failures.
- Adds accessible live error/status regions and red invalid-field styling.

It does not modify recipe-editor files, README, tests, or any other project file.

## Apply in Termux

Run from the repository root:

```bash
cd ~/projects/cake-cost-calculator
unzip -o ~/storage/shared/Download/phase2-inline-validation-v2.zip -d .
bash apply-phase2.sh
```

If you saved the archive in another folder, adjust only the path to the ZIP.

The script:
1. Confirms it is running from the repository root.
2. Verifies the SHA-256 of `app/index.html` against the exact file you uploaded for review.
3. Checks every patch anchor before writing anything.
4. Creates a timestamped backup beside `app/index.html`.
5. Updates only `app/index.html`.
6. Runs `npm run check` and `git diff --check`.

If the file has changed since the uploaded copy, the script stops without writing. Do not bypass this check; send a fresh `app/index.html` archive for review.

## Rollback

The script prints the exact backup filename, for example:

```bash
cp app/index.html.phase2-backup-YYYYMMDD-HHMMSS app/index.html
```

Use the actual filename printed by the script. This restores only `app/index.html`.

## After applying

Check the output of the script, then inspect:

```bash
git status --short
git diff -- app/index.html
```

Keep all existing phase 1 changes. Do not commit or push until the changes have been reviewed and approved.
