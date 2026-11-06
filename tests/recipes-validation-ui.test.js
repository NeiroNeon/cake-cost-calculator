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
  assert.match(js, /field\.setAttribute\('aria-invalid','true'\)/);
});
test('submit validates required recipe and ingredient cells before saving', () => {
  assert.match(js, /if\(!validateFormUI\(\)\)return;/);
  assert.match(js, /Введите название ингредиента\./);
  assert.match(js, /Укажите количество больше нуля\./);
});
test('invalid field is brought into view and focused', () => {
  assert.match(js, /field\.scrollIntoView\(/);
  assert.match(js, /field\.focus\(\{preventScroll:true\}\)/);
});
test('field error clears when the user edits the field', () => {
  assert.match(js, /clearFieldError\(el\);updateCost\(\)/);
  assert.match(js, /field\.classList\.remove\('is-invalid'\)/);
});
