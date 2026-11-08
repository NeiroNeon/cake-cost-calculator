import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSummaryItems, calculateSummary } from '../app/src/summary-domain.js';

const products = [
  { id: 'flour', name: 'Мука', unit: 'г', packQty: 1000, packPrice: 4 },
  { id: 'cream', name: 'Сливки', unit: 'мл', packQty: 500, packPrice: 10 }
];
const calculators = [
  { id: 'cake', name: 'Торт', items: [{ productId: 'flour', qty: 250 }, { productId: 'cream', qty: 100 }] },
  { id: 'cream-fill', name: 'Крем', items: [{ productId: 'cream', qty: 50 }] },
  { id: 'empty', name: 'Пустой', items: [] }
];

test('normalizes selection: removes unknown and duplicate calculators, quantity is positive integer', () => {
  assert.deepEqual(
    normalizeSummaryItems([
      { calculatorId: 'cake', quantity: 2.8 },
      { calculatorId: 'cake', quantity: 4 },
      { calculatorId: 'missing', quantity: 1 },
      { calculatorId: 'cream-fill', quantity: 0 }
    ], calculators),
    [
      { calculatorId: 'cake', quantity: 2 },
      { calculatorId: 'cream-fill', quantity: 1 }
    ]
  );
});

test('calculates combined total using calculator totals multiplied by quantity', () => {
  const result = calculateSummary([
    { calculatorId: 'cake', quantity: 2 },
    { calculatorId: 'cream-fill', quantity: 3 }
  ], calculators, products);

  // Cake: 250g * 0.004 + 100ml * 0.02 = 3.00; cream: 50ml * 0.02 = 1.00.
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].unitCost, 3);
  assert.equal(result.lines[0].total, 6);
  assert.equal(result.lines[1].total, 3);
  assert.equal(result.total, 9);
  assert.equal(result.incompleteCount, 0);
});

test('flags incomplete calculator data instead of presenting its total as final', () => {
  const result = calculateSummary([{ calculatorId: 'empty', quantity: 1 }], calculators, products);
  assert.equal(result.total, 0);
  assert.equal(result.incompleteCount, 1);
  assert.equal(result.lines[0].incomplete, true);
});

test('selection is independent: missing calculator ids are dropped without mutating source data', () => {
  const before = JSON.stringify(calculators);
  const result = normalizeSummaryItems([{ calculatorId: 'cake', quantity: 1 }, { calculatorId: 'deleted', quantity: 2 }], calculators);
  assert.deepEqual(result, [{ calculatorId: 'cake', quantity: 1 }]);
  assert.equal(JSON.stringify(calculators), before);
});
