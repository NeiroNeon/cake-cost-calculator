const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Pure costing engine. Component quantities are grams of the child recipe's finished yield. */
export function calculateRecipeCost(recipe, products = [], recipes = [], stack = []) {
  const byProductId = new Map((products || []).map(product => [product.id, product]));
  const byRecipeId = new Map((recipes || []).map(item => [item.id, item]));
  const currentId = recipe?.id;
  if (currentId && stack.includes(currentId)) {
    return { total: 0, complete: false, lines: [], errors: [{ code: 'cycle', recipeId: currentId }] };
  }
  const nextStack = currentId ? [...stack, currentId] : stack;
  let total = 0;
  let complete = true;
  const lines = [];
  const errors = [];

  for (const ingredient of recipe?.ingredients || []) {
    const qty = Number(ingredient.qty);
    const product = byProductId.get(ingredient.productId);
    if (!ingredient.productId || !product || !Number.isFinite(qty) || qty <= 0) {
      complete = false;
      lines.push({ type: 'ingredient', name: ingredient.name, cost: null });
      errors.push({ code: !ingredient.productId ? 'unlinked-ingredient' : 'missing-product', name: ingredient.name });
      continue;
    }
    const packQty = Number(product.packQty), packPrice = Number(product.packPrice);
    if (!Number.isFinite(packQty) || packQty <= 0 || !Number.isFinite(packPrice) || packPrice < 0 || product.unit !== ingredient.unit) {
      complete = false;
      lines.push({ type: 'ingredient', name: ingredient.name, cost: null });
      errors.push({ code: 'invalid-product-or-unit', name: ingredient.name });
      continue;
    }
    const cost = packPrice / packQty * qty;
    total += cost;
    lines.push({ type: 'ingredient', name: ingredient.name, cost });
  }

  for (const component of recipe?.components || []) {
    const child = byRecipeId.get(component.recipeId);
    const usedGrams = Number(component.qtyGrams);
    if (!child || !Number.isFinite(usedGrams) || usedGrams <= 0 || !Number.isFinite(Number(child.yieldGrams)) || Number(child.yieldGrams) <= 0) {
      complete = false;
      lines.push({ type: 'component', recipeId: component.recipeId, name: child?.name || 'Неизвестный рецепт', cost: null });
      errors.push({ code: !child ? 'missing-component' : 'invalid-component-yield', recipeId: component.recipeId });
      continue;
    }
    if (nextStack.includes(child.id)) {
      complete = false;
      lines.push({ type: 'component', recipeId: child.id, name: child.name, cost: null });
      errors.push({ code: 'cycle', recipeId: child.id });
      continue;
    }
    const childCost = calculateRecipeCost(child, products, recipes, nextStack);
    const cost = childCost.total / Number(child.yieldGrams) * usedGrams;
    total += cost;
    lines.push({ type: 'component', recipeId: child.id, name: child.name, qtyGrams: usedGrams, cost, complete: childCost.complete });
    if (!childCost.complete) complete = false;
    errors.push(...childCost.errors);
  }
  return { total, complete, lines, errors };
}

export function scaleRecipe(recipe, targetYieldGrams) {
  const base = Number(recipe?.yieldGrams), target = Number(targetYieldGrams);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(target) || target <= 0) return null;
  const factor = target / base;
  return {
    ingredients: (recipe.ingredients || []).map(item => ({ ...item, qty: Number(item.qty) * factor })),
    components: (recipe.components || []).map(item => ({ ...item, qtyGrams: Number(item.qtyGrams) * factor })),
    factor
  };
}

// Backward-compatible API used by the original MVP UI and tests.
export function scaleRecipeIngredients(recipe, targetYieldGrams) {
  return scaleRecipe(recipe, targetYieldGrams)?.ingredients ?? null;
}

export function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return { ok: false, error: 'Некорректная технологическая карта.' };
  if (typeof recipe.id !== 'string' || !SAFE_ID.test(recipe.id)) return { ok: false, error: 'Некорректный ID рецепта.' };
  if (typeof recipe.name !== 'string' || !recipe.name.trim()) return { ok: false, error: 'Укажите название рецепта.' };
  if (!Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps)) return { ok: false, error: 'Некорректный состав рецепта или список этапов.' };
  const components = recipe.components ?? [];
  if (!Array.isArray(components) || (!recipe.ingredients.length && !components.length)) return { ok: false, error: 'Добавьте хотя бы один ингредиент или вложенный рецепт.' };
  if (!Number.isFinite(Number(recipe.yieldGrams)) || Number(recipe.yieldGrams) < 0) return { ok: false, error: 'Выход должен быть неотрицательным числом.' };
  for (const item of recipe.ingredients) {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0 || typeof item.unit !== 'string' || !item.unit.trim()) return { ok: false, error: 'Проверьте название, количество и единицу ингредиента.' };
    if (item.productId != null && (typeof item.productId !== 'string' || !SAFE_ID.test(item.productId))) return { ok: false, error: 'Некорректная привязка ингредиента к базе продуктов.' };
  }
  for (const component of components) {
    if (!component || typeof component.recipeId !== 'string' || !SAFE_ID.test(component.recipeId) || !Number.isFinite(Number(component.qtyGrams)) || Number(component.qtyGrams) <= 0) return { ok: false, error: 'Проверьте вложенный рецепт и его количество в граммах.' };
  }
  if (recipe.timeMinutes != null && (!Number.isFinite(Number(recipe.timeMinutes)) || Number(recipe.timeMinutes) < 0)) return { ok: false, error: 'Время приготовления должно быть неотрицательным.' };
  if (recipe.temperature != null && !Number.isFinite(Number(recipe.temperature))) return { ok: false, error: 'Проверьте температуру приготовления.' };
  if (recipe.steps.some(step => typeof step !== 'string')) return { ok: false, error: 'Этапы приготовления должны быть текстовыми.' };
  return { ok: true };
}

/** Validates references and rejects self-links, missing recipes and dependency cycles. */
export function validateRecipeGraph(recipes) {
  if (!Array.isArray(recipes)) return { ok: false, error: 'Ожидается список рецептов.' };
  const byId = new Map();
  for (const recipe of recipes) {
    const result = validateRecipe(recipe);
    if (!result.ok) return result;
    if (byId.has(recipe.id)) return { ok: false, error: `Повторяется ID рецепта: ${recipe.id}` };
    byId.set(recipe.id, recipe);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return { ok: false, error: `Обнаружена циклическая зависимость: ${id}` };
    if (visited.has(id)) return { ok: true };
    visiting.add(id);
    for (const component of byId.get(id)?.components || []) {
      if (!byId.has(component.recipeId)) return { ok: false, error: `Не найден вложенный рецепт: ${component.recipeId}` };
      const child = visit(component.recipeId);
      if (!child.ok) return child;
    }
    visiting.delete(id); visited.add(id);
    return { ok: true };
  }
  for (const id of byId.keys()) { const result = visit(id); if (!result.ok) return result; }
  return { ok: true };
}

/** Writes first, then lets callers commit in-memory state. Never clears existing data on failure. */
export function writeJsonSafely(storage, key, value) {
  try {
    const serialized = JSON.stringify(value);
    storage.setItem(key, serialized);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.name === 'QuotaExceededError' ? 'Недостаточно места в хранилище устройства.' : 'Не удалось сохранить данные в браузере.' };
  }
}
