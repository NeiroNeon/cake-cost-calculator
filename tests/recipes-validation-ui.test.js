import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/recipes.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../app/src/recipes.js', import.meta.url), 'utf8');

test('recipe form disables browser-native validation popups', () => {
  assert.match(html, /<form id="recipeForm" novalidate>/);
});
test('invalid fields receive inline red styling and accessible state', () => {
  assert.match(html, /\.field\.is-invalid\{border-color:var\(--bad\)/);
  assert.match(js, /field\.setAttribute\(\s*'aria-invalid'\s*,\s*'true'\s*\)/);
});
test('submit validates required recipe and ingredient cells before saving', () => {
  assert.match(js, /if\s*\(\s*!\s*validateFormUI\(\)\s*\)\s*return\s*;/);
  assert.match(js, /Введите название ингредиента\./);
  assert.match(js, /Укажите количество больше нуля\./);
});
test('invalid field is brought into view and focused', () => {
  assert.match(js, /field\.scrollIntoView\(/);
  assert.match(js, /field\.focus\(\s*\{\s*preventScroll\s*:\s*true\s*\}\s*\)/);
});
test('field error clears when the user edits the field', () => {
  assert.match(js, /clearFieldError\(field\);\s*updateCost\(\)/);
  assert.match(js, /field\.classList\.remove\('is-invalid'\)/);
});
