/** Pure calculation and backup-validation helpers. No browser dependencies. */
export function calculateUnitCost(product) {
  const quantity = Number(product?.packQty);
  const price = Number(product?.packPrice);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) return 0;
  return price / quantity;
}

export function calculateLineCost(product, usedQuantity) {
  const quantity = Number(usedQuantity);
  if (!Number.isFinite(quantity) || quantity < 0) return 0;
  return calculateUnitCost(product) * quantity;
}

export function calculateTotal(calculator, products) {
  const byId = new Map((products || []).map(product => [product.id, product]));
  return (calculator?.items || []).reduce((sum, item) => {
    const product = byId.get(item.productId);
    return product ? sum + calculateLineCost(product, item.qty) : sum;
  }, 0);
}

export function validateBackup(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Ожидается JSON-объект.' };
  if (!Array.isArray(input.products) || !Array.isArray(input.calculators)) return { ok: false, error: 'В файле должны быть массивы products и calculators.' };
  const productIds = new Set();
  for (const product of input.products) {
    if (!product || typeof product.id !== 'string' || !product.id || typeof product.name !== 'string' || !product.name.trim()) return { ok: false, error: 'Найдена запись продукта без корректного ID или названия.' };
    if (productIds.has(product.id)) return { ok: false, error: `Повторяется ID продукта: ${product.id}` };
    productIds.add(product.id);
    if (!Number.isFinite(Number(product.packQty)) || Number(product.packQty) <= 0 || !Number.isFinite(Number(product.packPrice)) || Number(product.packPrice) < 0) return { ok: false, error: `Некорректная упаковка или цена продукта «${product.name}».` };
    if (typeof product.unit !== 'string' || !product.unit.trim()) return { ok: false, error: `Не указана единица измерения продукта «${product.name}».` };
  }
  const calculatorIds = new Set();
  for (const calculator of input.calculators) {
    if (!calculator || typeof calculator.id !== 'string' || !calculator.id || typeof calculator.name !== 'string' || !Array.isArray(calculator.items)) return { ok: false, error: 'Найдена некорректная запись калькулятора.' };
    if (calculatorIds.has(calculator.id)) return { ok: false, error: `Повторяется ID калькулятора: ${calculator.id}` };
    calculatorIds.add(calculator.id);
    for (const item of calculator.items) {
      if (!item || typeof item.productId !== 'string' || !Number.isFinite(Number(item.qty)) || Number(item.qty) < 0) return { ok: false, error: `Некорректная позиция в калькуляторе «${calculator.name}».` };
      if (!productIds.has(item.productId)) return { ok: false, error: `В калькуляторе «${calculator.name}» есть ссылка на отсутствующий продукт.` };
    }
  }
  return { ok: true, data: { products: input.products, calculators: input.calculators } };
}
