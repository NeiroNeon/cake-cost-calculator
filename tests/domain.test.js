import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUnitCost, calculateLineCost, calculateTotal, validateBackup } from '../app/src/domain.js';

const flour = { id: 'flour', name: 'Мука', unit: 'г', packQty: 1000, packPrice: 4.85 };
const sugar = { id: 'sugar', name: 'Сахар', unit: 'г', packQty: 1000, packPrice: 3.9 };

test('unit cost is calculated from package price and quantity', () => assert.ok(Math.abs(calculateUnitCost(flour) - 0.00485) < 1e-12));
test('invalid package quantity and negative price are safely rejected', () => {
  assert.equal(calculateUnitCost({ ...flour, packQty: 0 }), 0);
  assert.equal(calculateUnitCost({ ...flour, packPrice: -1 }), 0);
});
test('line cost is unit cost multiplied by used quantity', () => assert.equal(calculateLineCost(flour, 120), 0.582));
test('negative or non-numeric usage does not create a negative cost', () => {
  assert.equal(calculateLineCost(flour, -2), 0);
  assert.equal(calculateLineCost(flour, 'abc'), 0);
});
test('calculator total sums monetary line costs across products', () => {
  const calc = { items: [{ productId: 'flour', qty: 120 }, { productId: 'sugar', qty: 90 }] };
  assert.ok(Math.abs(calculateTotal(calc, [flour, sugar]) - 0.933) < 1e-12);
});
test('missing product references are ignored by total calculation', () => {
  assert.equal(calculateTotal({ items: [{ productId: 'missing', qty: 5 }] }, []), 0);
});
test('valid legacy-compatible data passes backup validation', () => {
  const result = validateBackup({ products: [flour], calculators: [{ id: 'c1', name: 'Бенто', items: [{ productId: 'flour', qty: 120 }] }] });
  assert.equal(result.ok, true);
});
test('backup with dangling product reference is rejected', () => {
  const result = validateBackup({ products: [], calculators: [{ id: 'c1', name: 'Бенто', items: [{ productId: 'absent', qty: 1 }] }] });
  assert.equal(result.ok, false);
});
test('backup with invalid pack data is rejected', () => {
  const result = validateBackup({ products: [{ ...flour, packQty: 0 }], calculators: [] });
  assert.equal(result.ok, false);
});
test('duplicate identifiers are rejected', () => {
  const result = validateBackup({ products: [flour, { ...flour, name: 'Другая мука' }], calculators: [] });
  assert.equal(result.ok, false);
});
