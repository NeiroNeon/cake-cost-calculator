export function calculateRecipeCost(recipe, products) {
  const byId = new Map((products || []).map(product => [product.id, product]));
  let total = 0;
  let complete = true;
  const lines = [];
  for (const ingredient of recipe?.ingredients || []) {
    if (!ingredient.productId) { complete = false; lines.push({ name: ingredient.name, cost: null }); continue; }
    const product = byId.get(ingredient.productId);
    const qty = Number(ingredient.qty);
    if (!product || !Number.isFinite(qty) || qty < 0) {
      complete = false; lines.push({ name: ingredient.name, cost: null }); continue;
    }
    const packQty = Number(product.packQty), packPrice = Number(product.packPrice);
    if (!Number.isFinite(packQty) || packQty <= 0 || !Number.isFinite(packPrice) || packPrice < 0 || product.unit !== ingredient.unit) {
      complete = false; lines.push({ name: ingredient.name, cost: null }); continue;
    }
    const cost = packPrice / packQty * qty;
    total += cost;
    lines.push({ name: ingredient.name, cost });
  }
  return { total, complete, lines };
}

export function scaleRecipeIngredients(recipe, targetYieldGrams) {
  const base = Number(recipe?.yieldGrams), target = Number(targetYieldGrams);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(target) || target <= 0) return null;
  const factor = target / base;
  return (recipe.ingredients || []).map(item => ({ ...item, qty: Number(item.qty) * factor }));
}

export function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return { ok: false, error: 'Некорректная технологическая карта.' };
  if (typeof recipe.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(recipe.id)) return { ok: false, error: 'Некорректный ID рецепта.' };
  if (typeof recipe.name !== 'string' || !recipe.name.trim()) return { ok: false, error: 'Укажите название рецепта.' };
  if (!Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps) || recipe.ingredients.length === 0) return { ok: false, error: 'Добавьте хотя бы один ингредиент и проверьте список этапов.' };
  if (!Number.isFinite(Number(recipe.yieldGrams)) || Number(recipe.yieldGrams) < 0) return { ok: false, error: 'Выход должен быть неотрицательным числом.' };
  for (const item of recipe.ingredients) {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0 || typeof item.unit !== 'string' || !item.unit.trim()) return { ok: false, error: 'Проверьте название, количество и единицу ингредиента.' };
    if (item.productId !== null && item.productId !== undefined && (typeof item.productId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(item.productId))) return { ok: false, error: 'Некорректная привязка ингредиента к базе продуктов.' };
  }
  if (recipe.timeMinutes !== null && recipe.timeMinutes !== undefined && (!Number.isFinite(Number(recipe.timeMinutes)) || Number(recipe.timeMinutes) < 0)) return { ok: false, error: 'Время приготовления должно быть неотрицательным.' };
  if (recipe.steps.some(step => typeof step !== 'string')) return { ok: false, error: 'Этапы приготовления должны быть текстовыми.' };
  return { ok: true };
}
