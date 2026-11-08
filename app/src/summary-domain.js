/**
 * Pure helpers for the independent summary calculator.
 * Selection is stored separately from the calculator database.
 */
import { calculateTotal } from './domain.js';

export function normalizeSummaryItems(items, calculators) {
  const validIds = new Set((calculators || []).map(item => item?.id).filter(Boolean));
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const calculatorId = typeof item?.calculatorId === 'string' ? item.calculatorId : '';
    if (!calculatorId || !validIds.has(calculatorId) || seen.has(calculatorId)) continue;
    const rawQuantity = Number(item.quantity);
    const quantity = Number.isFinite(rawQuantity) ? Math.max(1, Math.floor(rawQuantity)) : 1;
    seen.add(calculatorId);
    result.push({ calculatorId, quantity });
  }
  return result;
}

export function calculateSummary(items, calculators, products) {
  const byId = new Map((calculators || []).map(calculator => [calculator.id, calculator]));
  const productIds = new Set((products || []).map(product => product.id));
  const lines = normalizeSummaryItems(items, calculators).map(selection => {
    const calculator = byId.get(selection.calculatorId);
    const sourceItems = Array.isArray(calculator?.items) ? calculator.items : [];
    const incomplete = sourceItems.length === 0 || sourceItems.some(item =>
      !item?.productId ||
      !productIds.has(item.productId) ||
      !Number.isFinite(Number(item.qty)) ||
      Number(item.qty) <= 0
    );
    const unitCost = calculateTotal(calculator, products);
    return {
      calculatorId: selection.calculatorId,
      name: String(calculator?.name || 'Без названия').trim() || 'Без названия',
      quantity: selection.quantity,
      unitCost,
      total: unitCost * selection.quantity,
      itemCount: sourceItems.length,
      incomplete
    };
  });
  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.total, 0),
    incompleteCount: lines.filter(line => line.incomplete).length
  };
}
