import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/src/recipes.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../app/recipes.html', import.meta.url), 'utf8');

test('recipe editor calculates costs with the full recipe collection', () => {
  assert.match(source, /calculateRecipeCost\(recipe, products, source\)/);
  assert.match(source, /calculateRecipeCost\(costingRecipe, products, recipes\)/);
});

test('recipe editor supports nested components and proportional scaling', () => {
  assert.match(source, /function componentRow/);
  assert.match(source, /function readComponents/);
  assert.match(source, /scaleRecipe\(draft, target\)/);
  assert.match(html, /id="components"/);
  assert.match(html, /id="addComponent"/);
});

test('recipe editor validates the dependency graph before saving and importing', () => {
  assert.match(source, /validateRecipeGraph\(nextRecipes\)/);
  assert.match(source, /validateRecipeGraph\(incoming\)/);
});

test('recipe editor uses safe storage and does not use native validation dialogs', () => {
  assert.match(source, /writeJsonSafely\(localStorage, RECIPES_KEY, nextRecipes\)/);
  assert.doesNotMatch(source, /\balert\s*\(/);
  assert.doesNotMatch(source, /\bconfirm\s*\(/);
});

test('recipe editor provides inline field errors and accessible invalid state', () => {
  assert.match(source, /classList\.add\('is-invalid'\)/);
  assert.match(source, /setAttribute\('aria-invalid', 'true'\)/);
  assert.match(source, /focusInvalidField\(invalid\[0\]\[0\]\)/);
});

test('recipe editor prevents deleting recipes used as nested components', () => {
  assert.match(source, /const dependents = recipes\.filter\(item =>/);
  assert.match(source, /component\.recipeId === recipe\.id/);
  assert.match(source, /if \(dependents\.length\)/);
  assert.match(source, /Нельзя удалить карту/);
  assert.match(source, /dependents\.map\(item =>/);
  assert.match(source, /showPageStatus\([\s\S]*?'error'\s*\)/);
  assert.match(source, /const nextRecipes = recipes\.filter\(item => item\.id !== recipe\.id\)/);
});
