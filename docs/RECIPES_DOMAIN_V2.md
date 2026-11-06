# Pastry Studio — calculation core v2

## Backward compatibility

- Existing recipes with only `ingredients` remain valid; missing `components` is treated as an empty array.
- `calculateRecipeCost(recipe, products)` keeps its original call signature and behavior for simple recipes.
- `scaleRecipeIngredients(recipe, targetYieldGrams)` still returns the ingredient array expected by the MVP UI.
- New composite recipes use `components: [{ recipeId, qtyGrams }]`. `qtyGrams` is the mass of the finished child recipe used in the parent recipe.

## Composite costing

For a child recipe, the engine calculates its complete batch cost and divides it by the child's `yieldGrams`. The parent component cost is:

`child total cost / child yield × grams used`

The calculation recursively includes nested components. Incomplete child calculations propagate `complete: false` to the parent; partial known costs remain visible but must not be treated as a final cost.

## Safety rules

- No unit conversion is inferred.
- Missing product and recipe references are reported, never replaced by name matching.
- `validateRecipeGraph()` rejects duplicate IDs, missing component references and dependency cycles.
- `writeJsonSafely()` reports quota/storage errors and never clears the existing key.
- Composite quantities are scaled alongside direct ingredients by `scaleRecipe()`.

## Current scope

This release adds and tests the domain engine. The existing UI does not yet expose component editing; that is the next isolated UI patch. This separation keeps the currently published MVP usable while the calculation rules are tested independently.
