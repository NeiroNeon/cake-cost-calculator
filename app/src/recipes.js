import {
  calculateRecipeCost,
  scaleRecipe,
  validateRecipe,
  validateRecipeGraph,
  writeJsonSafely
} from './recipes-domain.js';

const $ = (selector, root = document) => root.querySelector(selector);
const RECIPES_KEY = 'bento_recipes_v1';
const PRODUCTS_KEY = 'bento_cost_v3';
const LEGACY_PRODUCTS_KEY = 'bento_cost_v2';
const uid = () => globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const UNITS = [
  'г', 'кг', 'мг', 'мл', 'л', 'шт', 'ст. л.', 'ч. л.', 'дес. л.',
  'стакан', 'чашка', 'щепотка', 'горсть', 'капля', 'упаковка',
  'пачка', 'банка', 'коробка', 'рулон', 'порция', 'кусок',
  'ломтик', 'долька', 'зубчик', 'пучок', 'лист'
];
const money = value => `${new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number.isFinite(value) ? value : 0)} BYN`;

let recipes = loadRecipes();
let products = loadProducts();
let editingId = null;
let confirmResolver = null;

function loadRecipes() {
  try {
    const value = JSON.parse(localStorage.getItem(RECIPES_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    // Preserve stored records instead of silently discarding data that needs repair.
    return value.map(recipe => ({
      ...recipe,
      ingredients: Array.isArray(recipe?.ingredients) ? recipe.ingredients : [],
      components: Array.isArray(recipe?.components) ? recipe.components : [],
      steps: Array.isArray(recipe?.steps) ? recipe.steps : []
    }));
  } catch {
    showPageStatus('Не удалось прочитать базу рецептов. Исходные данные не изменены.', 'error');
    return [];
  }
}

function loadProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY) ?? localStorage.getItem(LEGACY_PRODUCTS_KEY);
    const data = JSON.parse(raw || '{}');
    return Array.isArray(data.products) ? data.products : [];
  } catch {
    showPageStatus('Не удалось прочитать базу продуктов. Проверьте резервную копию.', 'error');
    return [];
  }
}

function showPageStatus(message, type = 'info') {
  const status = $('#pageStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `page-status ${type}${message ? '' : ' hidden'}`;
}

function save(nextRecipes = recipes) {
  const result = writeJsonSafely(localStorage, RECIPES_KEY, nextRecipes);
  if (!result.ok) {
    showPageStatus(`${result.error} Текущая база не была заменена. Экспортируйте резервную копию и освободите место.`, 'error');
    return false;
  }
  showPageStatus('Изменения сохранены на этом устройстве.', 'success');
  return true;
}

function recipeCost(recipe, source = recipes) {
  return calculateRecipeCost(recipe, products, source);
}

function clearFieldError(field) {
  if (!field) return;
  field.classList.remove('is-invalid');
  field.removeAttribute('aria-invalid');
  field.nextElementSibling?.classList.contains('field-error') &&
    field.nextElementSibling.remove();
}

function clearAllFieldErrors() {
  document.querySelectorAll('#recipeForm .is-invalid').forEach(field => {
    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');
  });
  document.querySelectorAll('#recipeForm .field-error').forEach(error => error.remove());
}

function markFieldError(field, message) {
  clearFieldError(field);
  field.classList.add('is-invalid');
  field.setAttribute('aria-invalid', 'true');
  const error = document.createElement('div');
  error.className = 'field-error';
  error.textContent = message;
  field.insertAdjacentElement('afterend', error);
}

function focusInvalidField(field) {
  const body = $('#editor .body');
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (body) {
    const fieldRect = field.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    if (fieldRect.top < bodyRect.top || fieldRect.bottom > bodyRect.bottom) {
      body.scrollBy({
        top: fieldRect.top - bodyRect.top - (bodyRect.height - fieldRect.height) / 2,
        behavior: 'smooth'
      });
    }
  }
  field.focus({ preventScroll: true });
}

function validateFormUI() {
  clearAllFieldErrors();
  const invalid = [];
  const name = $('#name');

  if (!name.value.trim()) invalid.push([name, 'Укажите название технологической карты.']);

  const ingredientRows = [...$('#ingredients').children];
  const componentRows = [...$('#components').children];

  for (const row of ingredientRows) {
    const ingredientName = row.querySelector('.ing-name');
    const qty = row.querySelector('.ing-qty');
    if (!ingredientName.value.trim()) {
      invalid.push([ingredientName, 'Введите название ингредиента.']);
    }
    if (!qty.value.trim() || !Number.isFinite(Number(qty.value)) || Number(qty.value) <= 0) {
      invalid.push([qty, 'Укажите количество больше нуля.']);
    }
  }

  for (const row of componentRows) {
    const recipeSelect = row.querySelector('.component-recipe');
    const qty = row.querySelector('.component-qty');
    if (!recipeSelect.value) invalid.push([recipeSelect, 'Выберите вложенную технологическую карту.']);
    if (!qty.value.trim() || !Number.isFinite(Number(qty.value)) || Number(qty.value) <= 0) {
      invalid.push([qty, 'Укажите массу компонента больше нуля.']);
    }
  }

  if (!ingredientRows.length && !componentRows.length) {
    const addButton = $('#addIngredient');
    invalid.push([addButton, 'Добавьте хотя бы один ингредиент или вложенный рецепт.']);
  }

  for (const selector of ['#yield', '#temperature', '#time', '#scaleTo']) {
    const field = $(selector);
    if (field.value !== '' && !field.validity.valid) {
      invalid.push([field, 'Проверьте числовое значение этого поля.']);
    }
  }

  if (componentRows.length && (!$('#yield').value || Number($('#yield').value) <= 0)) {
    invalid.push([$('#yield'), 'Для составного рецепта укажите выход больше нуля.']);
  }

  for (const [field, message] of invalid) markFieldError(field, message);
  if (invalid.length) {
    focusInvalidField(invalid[0][0]);
    return false;
  }
  return true;
}

function getAvailableComponentRecipes() {
  return recipes.filter(candidate => {
    if (!candidate?.id || candidate.id === editingId) return false;
    if (!editingId) return true;

    // A candidate is unavailable if it already depends on the recipe being edited.
    const visited = new Set();
    const reachesCurrent = id => {
      if (id === editingId) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      const recipe = recipes.find(item => item.id === id);
      return (recipe?.components || []).some(component => reachesCurrent(component.recipeId));
    };
    return !reachesCurrent(candidate.id);
  });
}

function render() {
  const query = $('#search').value.trim().toLocaleLowerCase('ru');
  const category = $('#category').value;
  const filtered = recipes.filter(recipe => {
    const componentNames = (recipe.components || [])
      .map(component => recipes.find(item => item.id === component.recipeId)?.name || '');
    const searchable = [recipe.name, ...recipe.ingredients.map(item => item.name), ...componentNames]
      .join(' ').toLocaleLowerCase('ru');
    return (!category || recipe.category === category) && (!query || searchable.includes(query));
  });

  $('#count').textContent = `${recipes.length} ${recipes.length === 1 ? 'рецепт' : recipes.length < 5 ? 'рецепта' : 'рецептов'}`;
  $('#cards').innerHTML = filtered.length ? filtered.map(recipe => {
    const cost = recipeCost(recipe);
    const missing = cost.errors.length;
    const ingredientCount = recipe.ingredients.length;
    const componentCount = (recipe.components || []).length;
    return `<article class="card">
      <h3>${esc(recipe.name)}</h3>
      <p>${esc(recipe.category || 'Без категории')} · ${recipe.yieldGrams ? `${esc(recipe.yieldGrams)} г` : 'выход не указан'}</p>
      <p>${ingredientCount} ингредиентов · ${componentCount} компонентов · ${recipe.steps.length} этапов</p>
      <div class="card-foot">
        <span class="price">${cost.complete ? money(cost.total) : 'Нужны данные'}</span>
        <div class="actions">
          <button class="btn" data-edit="${esc(recipe.id)}" type="button">Открыть</button>
          <button class="btn danger" data-delete="${esc(recipe.id)}" type="button" aria-label="Удалить рецепт">×</button>
        </div>
      </div>
      ${missing ? `<p class="badtext">${missing} проблем расчёта — проверьте состав и привязки</p>` : ''}
    </article>`;
  }).join('') : '<div class="empty">Рецептов пока нет. Создайте первую технологическую карту.</div>';
}

function ingredientRow(item = {}) {
  const options = products.map(product =>
    `<option value="${esc(product.id)}">${esc(product.name)} · ${esc(product.unit)}</option>`
  ).join('');
  const row = document.createElement('div');
  row.className = 'ingredient';
  const units = [...new Set([...UNITS, item.unit || 'г', ...products.map(product => product.unit).filter(Boolean)])];

  row.innerHTML = `
    <input class="field ing-name" maxlength="100" aria-label="Название ингредиента" placeholder="Название ингредиента" value="${esc(item.name || '')}">
    <input class="field ing-qty" type="number" min="0" step="any" inputmode="decimal" aria-label="Количество ингредиента" placeholder="Кол-во" value="${item.qty ?? ''}">
    <select class="field ing-unit" aria-label="Единица измерения">${units.map(unit =>
      `<option value="${esc(unit)}" ${unit === (item.unit || 'г') ? 'selected' : ''}>${esc(unit)}</option>`
    ).join('')}</select>
    <button class="btn danger remove" type="button" aria-label="Удалить ингредиент">×</button>
    <select class="field ing-product" aria-label="Привязка к закупочному продукту" style="grid-column:1/-1">
      <option value="">Текстовый ингредиент — без цены</option>${options}
    </select>`;

  row.querySelector('.ing-product').value = item.productId || '';
  row.querySelector('.ing-product').addEventListener('change', event => {
    const product = products.find(entry => entry.id === event.target.value);
    if (product) {
      row.querySelector('.ing-name').value = product.name;
      const unit = row.querySelector('.ing-unit');
      if (![...unit.options].some(option => option.value === product.unit)) {
        unit.add(new Option(product.unit, product.unit));
      }
      unit.value = product.unit;
    }
    clearFieldError(event.target);
    updateCost();
  });
  row.querySelector('.remove').addEventListener('click', () => {
    row.remove();
    updateCost();
  });
  row.querySelectorAll('input, select').forEach(field => {
    field.addEventListener('input', () => {
      clearFieldError(field);
      updateCost();
    });
    field.addEventListener('change', () => clearFieldError(field));
  });
  return row;
}

function componentRow(item = {}) {
  const row = document.createElement('div');
  row.className = 'component-row';
  const available = getAvailableComponentRecipes();
  const selectedExists = recipes.some(recipe => recipe.id === item.recipeId);
  const selectedRecipe = recipes.find(recipe => recipe.id === item.recipeId);
  const options = available.map(recipe =>
    `<option value="${esc(recipe.id)}">${esc(recipe.name)} · ${esc(recipe.yieldGrams || 0)} г</option>`
  ).join('');
  const missingOption = item.recipeId && !selectedExists
    ? `<option value="${esc(item.recipeId)}">Недоступная карта (${esc(item.recipeId)})</option>` : '';

  row.innerHTML = `
    <select class="field component-recipe" aria-label="Вложенная технологическая карта">
      <option value="">Выберите технологическую карту</option>${missingOption}${options}
    </select>
    <input class="field component-qty" type="number" min="0" step="any" inputmode="decimal"
      aria-label="Масса вложенного компонента, граммы" placeholder="Масса, г" value="${item.qtyGrams ?? ''}">
    <span class="component-yield subtle">${selectedRecipe?.yieldGrams ? `Выход: ${esc(selectedRecipe.yieldGrams)} г` : 'Выход карты'}</span>
    <button class="btn danger remove-component" type="button" aria-label="Удалить компонент">×</button>`;

  row.querySelector('.component-recipe').value = item.recipeId || '';
  row.querySelector('.component-recipe').addEventListener('change', event => {
    const recipe = recipes.find(entry => entry.id === event.target.value);
    row.querySelector('.component-yield').textContent = recipe?.yieldGrams
      ? `Выход: ${recipe.yieldGrams} г` : 'Выход карты';
    clearFieldError(event.target);
    updateCost();
  });
  row.querySelector('.component-qty').addEventListener('input', event => {
    clearFieldError(event.target);
    updateCost();
  });
  row.querySelector('.remove-component').addEventListener('click', () => {
    row.remove();
    updateCost();
  });
  return row;
}

function stepRow(value = '') {
  const row = document.createElement('div');
  row.className = 'step';
  row.innerHTML = `
    <div class="step-num"></div>
    <textarea class="field" maxlength="1000" aria-label="Этап приготовления" placeholder="Опишите действие, время или признак готовности">${esc(value)}</textarea>
    <button class="btn danger" type="button" aria-label="Удалить этап">×</button>`;
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    renumberSteps();
  });
  return row;
}

function renumberSteps() {
  [...$('#steps').children].forEach((row, index) => {
    row.querySelector('.step-num').textContent = `${index + 1}.`;
  });
}

function readIngredients() {
  return [...$('#ingredients').children].map(row => ({
    name: row.querySelector('.ing-name').value.trim(),
    qty: Number(row.querySelector('.ing-qty').value) || 0,
    unit: row.querySelector('.ing-unit').value,
    productId: row.querySelector('.ing-product').value || null
  }));
}

function readComponents() {
  return [...$('#components').children].map(row => ({
    recipeId: row.querySelector('.component-recipe').value || '',
    qtyGrams: Number(row.querySelector('.component-qty').value) || 0
  }));
}

function updateCost() {
  const draft = {
    id: editingId || '__draft__',
    yieldGrams: Number($('#yield').value) || 0,
    ingredients: readIngredients(),
    components: readComponents()
  };
  const requestedTarget = Number($('#scaleTo').value);
  const target = requestedTarget > 0 ? requestedTarget : draft.yieldGrams;
  const scaled = target > 0 && draft.yieldGrams > 0
    ? scaleRecipe(draft, target) : null;
  const costingRecipe = scaled
    ? { ...draft, ingredients: scaled.ingredients, components: scaled.components }
    : draft;
  const cost = calculateRecipeCost(costingRecipe, products, recipes);
  const linkedCount = cost.lines.filter(line => line.cost !== null).length;
  const details = cost.lines.map(line => {
    const type = line.type === 'component' ? 'Компонент' : 'Ингредиент';
    return `<div class="rowline"><span>${type}: ${esc(line.name)}</span><strong>${line.cost === null ? '—' : money(line.cost)}</strong></div>`;
  }).join('');

  $('#costPanel').innerHTML = `
    <div class="rowline"><span>Расчётная себестоимость</span><strong>${money(cost.total)}</strong></div>
    <div class="rowline"><span>Полный расчёт</span><strong>${cost.complete ? 'Да' : 'Нет'}</strong></div>
    ${details}
    ${cost.errors.length ? `<div class="notice">${cost.errors.length} позиций не удалось полностью рассчитать. Проверьте продукты, единицы и вложенные карты.</div>` : ''}
    ${draft.yieldGrams > 0 ? `<div class="rowline"><span>Себестоимость на 100 г</span><strong>${money(cost.total / (target || draft.yieldGrams) * 100)}</strong></div>` : ''}
    ${scaled ? `<div class="subtle">Масштабирование: ×${scaled.factor.toFixed(3)}${linkedCount ? ` · учтено строк: ${linkedCount}` : ''}</div>` : ''}
  `;
}

function openEditor(recipe = null) {
  editingId = recipe?.id || null;
  clearAllFieldErrors();
  showPageStatus('', 'info');
  $('#dialogTitle').textContent = recipe ? 'Редактирование карты' : 'Новая технологическая карта';
  $('#name').value = recipe?.name || '';
  $('#cat').value = recipe?.category || 'Бисквит';
  $('#yield').value = recipe?.yieldGrams ?? '';
  $('#temperature').value = recipe?.temperature ?? '';
  $('#time').value = recipe?.timeMinutes ?? '';
  $('#storage').value = recipe?.storage || '';
  $('#notes').value = recipe?.notes || '';

  $('#ingredients').replaceChildren();
  (recipe?.ingredients?.length ? recipe.ingredients : [{}])
    .forEach(item => $('#ingredients').append(ingredientRow(item)));
  $('#components').replaceChildren();
  (recipe?.components || []).forEach(item => $('#components').append(componentRow(item)));
  $('#steps').replaceChildren();
  (recipe?.steps?.length ? recipe.steps : [''])
    .forEach(step => $('#steps').append(stepRow(step)));
  renumberSteps();
  $('#editor').showModal();
  updateCost();
}

function askConfirm(message, confirmText = 'Подтвердить') {
  const dialog = $('#confirmDialog');
  $('#confirmMessage').textContent = message;
  $('#confirmOk').textContent = confirmText;
  dialog.showModal();
  return new Promise(resolve => {
    confirmResolver = resolve;
  });
}

function finishConfirm(result) {
  if (!confirmResolver) return;
  const resolve = confirmResolver;
  confirmResolver = null;
  $('#confirmDialog').close();
  resolve(result);
}

$('#confirmOk').addEventListener('click', () => finishConfirm(true));
$('#confirmCancel').addEventListener('click', () => finishConfirm(false));
$('#confirmDialog').addEventListener('cancel', event => {
  event.preventDefault();
  finishConfirm(false);
});

$('#newRecipe').addEventListener('click', () => openEditor());
$('#closeEditor').addEventListener('click', () => $('#editor').close());
$('#cancel').addEventListener('click', () => $('#editor').close());
$('#addIngredient').addEventListener('click', () => {
  $('#ingredients').append(ingredientRow());
});
$('#addComponent').addEventListener('click', () => {
  $('#components').append(componentRow());
});
$('#addStep').addEventListener('click', () => {
  $('#steps').append(stepRow());
  renumberSteps();
});

['#yield', '#name', '#cat', '#scaleTo'].forEach(selector => {
  $(selector).addEventListener('input', event => {
    clearFieldError(event.target);
    updateCost();
  });
});
['#temperature', '#time'].forEach(selector => {
  $(selector).addEventListener('input', event => clearFieldError(event.target));
});

$('#recipeForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!validateFormUI()) return;

  const recipe = {
    id: editingId || uid(),
    name: $('#name').value.trim(),
    category: $('#cat').value,
    yieldGrams: Number($('#yield').value) || 0,
    ingredients: readIngredients(),
    components: readComponents(),
    steps: [...$('#steps').querySelectorAll('textarea')]
      .map(field => field.value.trim()).filter(Boolean),
    temperature: $('#temperature').value === '' ? null : Number($('#temperature').value),
    timeMinutes: $('#time').value === '' ? null : Number($('#time').value),
    storage: $('#storage').value.trim(),
    notes: $('#notes').value.trim(),
    updatedAt: new Date().toISOString()
  };

  const validation = validateRecipe(recipe);
  if (!validation.ok) {
    const field = validation.error.includes('название') ? $('#name') : $('#yield');
    markFieldError(field, validation.error);
    focusInvalidField(field);
    return;
  }

  const nextRecipes = recipes.filter(item => item.id !== recipe.id);
  nextRecipes.unshift(recipe);
  const graph = validateRecipeGraph(nextRecipes);
  if (!graph.ok) {
    const field = $('#components').querySelector('.component-recipe') || $('#yield');
    markFieldError(field, graph.error);
    focusInvalidField(field);
    return;
  }

  if (!save(nextRecipes)) return;
  recipes = nextRecipes;
  $('#editor').close();
  render();
});

$('#cards').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit]');
  const remove = event.target.closest('[data-delete]');
  if (edit) {
    const recipe = recipes.find(item => item.id === edit.dataset.edit);
    if (recipe) openEditor(recipe);
  }
  if (remove) {
    const recipe = recipes.find(item => item.id === remove.dataset.delete);
    if (!recipe) return;

    const dependents = recipes.filter(item =>
      item.id !== recipe.id &&
      (item.components || []).some(component => component.recipeId === recipe.id)
    );

    if (dependents.length) {
      const names = dependents.map(item => `«${item.name}»`).join(', ');
      showPageStatus(
        `Нельзя удалить карту «${recipe.name}»: она используется в ${dependents.length} других картах: ${names}. Сначала удалите эти вложенные компоненты или замените их.`,
        'error'
      );
      return;
    }

    const accepted = await askConfirm(
      `Удалить технологическую карту «${recipe.name}»?`,
      'Удалить'
    );
    if (!accepted) return;

    const nextRecipes = recipes.filter(item => item.id !== recipe.id);
    if (!save(nextRecipes)) return;

    recipes = nextRecipes;
    render();
  }
});

$('#search').addEventListener('input', render);
$('#category').addEventListener('change', render);

$('#exportRecipes').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    recipes
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pastry-recipes-backup.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showPageStatus('Резервная копия подготовлена.', 'success');
});

$('#importRecipes').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed) ? parsed : parsed.recipes;
    if (!Array.isArray(incoming)) throw new Error('В файле не найден список технологических карт.');
    const graph = validateRecipeGraph(incoming);
    if (!graph.ok) throw new Error(graph.error);
    const accepted = await askConfirm(
      `Импортировать ${incoming.length} технологических карт? Текущая база рецептов будет заменена.`,
      'Импортировать'
    );
    if (!accepted) return;
    if (!save(incoming)) return;
    recipes = incoming;
    render();
    showPageStatus(`Импортировано карт: ${recipes.length}.`, 'success');
  } catch (error) {
    showPageStatus(error.message || 'Не удалось прочитать файл. Проверьте формат JSON.', 'error');
  } finally {
    event.target.value = '';
  }
});

window.addEventListener('storage', event => {
  if (event.key === PRODUCTS_KEY || event.key === LEGACY_PRODUCTS_KEY) {
    products = loadProducts();
    render();
    if ($('#editor').open) updateCost();
  }
});

render();
