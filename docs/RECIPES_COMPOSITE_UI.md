# Composite recipe editor — implementation notes

This patch connects the existing composite-recipe domain engine to the recipe editor UI.

## Included

- Add, edit and remove nested recipe components.
- Component usage quantity is expressed in grams.
- Cost calculation now receives the full recipe collection, so nested costs propagate.
- Recipe scaling scales both direct ingredients and nested component quantities.
- Dependency graph validation runs before saving and importing.
- The selector excludes the current recipe and recipes that already depend on it.
- Recipe form validation marks all invalid fields inline, sets `aria-invalid`, and focuses the first invalid field.
- Native `alert()` and `confirm()` calls are removed from the recipe editor.
- Storage writes use `writeJsonSafely`; in-memory state is committed only after a successful write.
- Import errors and save failures are shown in an inline status region.
- Existing recipe records are preserved on load instead of silently filtered out.

## Data compatibility

The existing `bento_recipes_v1` key remains unchanged. Recipes without a `components` array are treated as having an empty component list. Existing ingredient and step fields remain compatible.

## Apply and verify

Extract the archive into the repository root, allowing the included files to overwrite their counterparts, then run:

```bash
npm run check
git diff --check
```

Do not commit until the checks pass and the UI has been tested in a browser.
