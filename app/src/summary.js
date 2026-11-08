import { calculateSummary, normalizeSummaryItems } from './summary-domain.js';

const $ = selector => document.querySelector(selector);
const CALCULATORS_KEY = 'bento_cost_v3';
const LEGACY_CALCULATORS_KEY = 'bento_cost_v2';
const SUMMARY_KEY = 'bento_summary_v1';
const numberFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = value => `${numberFormat.format(Number.isFinite(value) ? value : 0)} BYN`;
const plural = (n, forms) => {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
};
const pluralCalc = n => plural(n, ['калькулятор', 'калькулятора', 'калькуляторов']);
const pluralPosition = n => plural(n, ['позиция', 'позиции', 'позиций']);

let database = { products: [], calculators: [] };
let selection = [];
let storageAvailable = true;

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadDatabase() {
  let value = readJson(CALCULATORS_KEY);
  if (value === null) value = readJson(LEGACY_CALCULATORS_KEY);
  if (!value || !Array.isArray(value.products) || !Array.isArray(value.calculators)) {
    database = { products: [], calculators: [] };
    setStatus('Не удалось прочитать базу калькуляторов. Проверьте данные в основном приложении.', true);
    return;
  }
  database = value;
}

function loadSelection() {
  const stored = readJson(SUMMARY_KEY, []);
  selection = normalizeSummaryItems(stored, database.calculators);
  if (JSON.stringify(stored) !== JSON.stringify(selection)) saveSelection();
}

function saveSelection() {
  try {
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(selection));
    storageAvailable = true;
    setStatus('');
  } catch {
    storageAvailable = false;
    setStatus('Не удалось сохранить список на этом устройстве. Освободите место в хранилище браузера.', true);
  }
}

function setStatus(message, isError = false) {
  const node = $('#status');
  node.textContent = message;
  node.classList.toggle('error', isError);
}

function renderSelect() {
  const select = $('#calculatorSelect');
  const selectedIds = new Set(selection.map(item => item.calculatorId));
  const available = database.calculators.filter(calculator => !selectedIds.has(calculator.id));
  select.innerHTML = '<option value="">Выберите калькулятор…</option>' +
    available.map(calculator =>
      `<option value="${escapeHtml(calculator.id)}">${escapeHtml(calculator.name || 'Без названия')} · ${money(calculateSummary([{ calculatorId: calculator.id, quantity: 1 }], database.calculators, database.products).total)}</option>`
    ).join('');
  $('#addCalculator').disabled = !available.length || !select.value;
  if (!available.length && database.calculators.length) {
    select.options[0].textContent = 'Все калькуляторы уже добавлены';
  } else if (!database.calculators.length) {
    select.options[0].textContent = 'Сначала создайте калькулятор';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function render() {
  selection = normalizeSummaryItems(selection, database.calculators);
  const summary = calculateSummary(selection, database.calculators, database.products);
  const list = $('#summaryList');

  $('#selectedCount').textContent = `${summary.lines.length} ${pluralPosition(summary.lines.length)}`;
  $('#totalCount').textContent = `${summary.lines.length} ${pluralCalc(summary.lines.length)}`;
  $('#grandTotal').textContent = money(summary.total);
  $('#clearList').disabled = selection.length === 0;

  if (!summary.lines.length) {
    list.innerHTML = `<div class="empty"><strong>Список пока пуст</strong>Выберите калькулятор выше и добавьте его в сводный расчёт.</div>`;
    $('#totalNote').textContent = 'Добавьте калькуляторы, чтобы собрать общий итог.';
  } else {
    list.innerHTML = summary.lines.map(line => `
      <article class="item" data-id="${escapeHtml(line.calculatorId)}">
        <div class="item-main">
          <div class="item-title">${escapeHtml(line.name)}</div>
          <div class="item-meta">${line.itemCount} ${pluralPosition(line.itemCount)} · ${money(line.unitCost)} за 1 шт.</div>
          ${line.incomplete ? '<div class="item-warning">Есть незаполненные или некорректные позиции — сумма предварительная</div>' : ''}
        </div>
        <div class="item-side">
          <div class="qty" aria-label="Количество">
            <button type="button" data-action="decrease" aria-label="Уменьшить количество">−</button>
            <input type="number" min="1" step="1" inputmode="numeric" value="${line.quantity}" data-action="quantity" aria-label="Количество калькуляторов">
            <button type="button" data-action="increase" aria-label="Увеличить количество">+</button>
          </div>
          <div class="item-cost">${money(line.total)}</div>
          <button class="remove" type="button" data-action="remove" aria-label="Удалить из списка">×</button>
        </div>
      </article>
    `).join('');
    $('#totalNote').textContent = summary.incompleteCount
      ? `${summary.incompleteCount} ${plural(summary.incompleteCount, ['калькулятор содержит неполные данные', 'калькулятора содержат неполные данные', 'калькуляторов содержат неполные данные'])}. Итог предварительный.`
      : 'Итог пересчитывается автоматически с учётом количества.';
    $('#totalNote').classList.toggle('warning', summary.incompleteCount > 0);
  }

  renderSelect();
}

$('#calculatorSelect').addEventListener('change', event => {
  $('#addCalculator').disabled = !event.target.value;
});

$('#addCalculator').addEventListener('click', () => {
  const calculatorId = $('#calculatorSelect').value;
  if (!calculatorId || selection.some(item => item.calculatorId === calculatorId)) return;
  selection.push({ calculatorId, quantity: 1 });
  saveSelection();
  render();
});

$('#summaryList').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  const row = event.target.closest('[data-id]');
  if (!button || !row) return;
  const item = selection.find(entry => entry.calculatorId === row.dataset.id);
  if (!item) return;
  if (button.dataset.action === 'remove') {
    selection = selection.filter(entry => entry.calculatorId !== item.calculatorId);
  } else if (button.dataset.action === 'increase') {
    item.quantity += 1;
  } else if (button.dataset.action === 'decrease') {
    item.quantity = Math.max(1, item.quantity - 1);
  } else {
    return;
  }
  saveSelection();
  render();
});

$('#summaryList').addEventListener('change', event => {
  if (event.target.dataset.action !== 'quantity') return;
  const row = event.target.closest('[data-id]');
  const item = selection.find(entry => entry.calculatorId === row?.dataset.id);
  if (!item) return;
  const parsed = Number(event.target.value);
  item.quantity = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
  saveSelection();
  render();
});

$('#clearList').addEventListener('click', () => {
  if (!selection.length) return;
  selection = [];
  saveSelection();
  render();
});

window.addEventListener('storage', event => {
  if (event.key === CALCULATORS_KEY || event.key === LEGACY_CALCULATORS_KEY) {
    loadDatabase();
    selection = normalizeSummaryItems(selection, database.calculators);
    saveSelection();
    render();
  } else if (event.key === SUMMARY_KEY) {
    selection = normalizeSummaryItems(readJson(SUMMARY_KEY, []), database.calculators);
    render();
  }
});

loadDatabase();
loadSelection();
render();
