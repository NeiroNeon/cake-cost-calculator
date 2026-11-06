import { calculateRecipeCost, scaleRecipeIngredients, validateRecipe } from './recipes-domain.js';

const $ = (s, root=document) => root.querySelector(s);
const RECIPES_KEY = 'bento_recipes_v1';
const PRODUCTS_KEY = 'bento_cost_v3';
const LEGACY_PRODUCTS_KEY = 'bento_cost_v2';
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const UNITS = ['г','кг','мг','мл','л','шт','ст. л.','ч. л.','дес. л.','стакан','чашка','щепотка','горсть','капля','упаковка','пачка','банка','коробка','рулон','порция','кусок','ломтик','долька','зубчик','пучок','лист'];
const money = value => `${new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)} BYN`;
let recipes = loadRecipes(), products = loadProducts(), editingId = null;

function loadRecipes(){try{const value=JSON.parse(localStorage.getItem(RECIPES_KEY)||'[]');return Array.isArray(value)?value.filter(r=>validateRecipe(r).ok):[]}catch{return []}}
function loadProducts(){try{const raw=localStorage.getItem(PRODUCTS_KEY)??localStorage.getItem(LEGACY_PRODUCTS_KEY);const data=JSON.parse(raw||'{}');return Array.isArray(data.products)?data.products:[]}catch{return []}}
function save(){try{localStorage.setItem(RECIPES_KEY,JSON.stringify(recipes));return true}catch(error){alert('Не удалось сохранить базу рецептов в памяти устройства. Экспортируйте данные и освободите место в браузере.');return false}}
function recipeCost(recipe){return calculateRecipeCost(recipe,products)}
function render(){
 const query=$('#search').value.trim().toLocaleLowerCase('ru');
 const category=$('#category').value;
 const filtered=recipes.filter(r=>(!category||r.category===category)&&(!query||[r.name,...r.ingredients.map(i=>i.name)].join(' ').toLocaleLowerCase('ru').includes(query)));
 $('#count').textContent=`${recipes.length} ${recipes.length===1?'рецепт':recipes.length<5?'рецепта':'рецептов'}`;
 $('#cards').innerHTML=filtered.length?filtered.map(r=>{const c=recipeCost(r);const missing=r.ingredients.filter(i=>!i.productId).length;return `<article class="card"><h3>${esc(r.name)}</h3><p>${esc(r.category)} · ${r.yieldGrams?`${r.yieldGrams} г`:'выход не указан'}</p><p>${r.ingredients.length} ингредиентов · ${r.steps.length} этапов</p><div class="card-foot"><span class="price">${c.complete?money(c.total):'Нужны цены'}</span><div class="actions"><button class="btn" data-edit="${esc(r.id)}">Открыть</button><button class="btn danger" data-delete="${esc(r.id)}" aria-label="Удалить рецепт">×</button></div></div>${missing?`<p class="badtext">${missing} поз. без привязки к закупочной базе</p>`:''}</article>`}).join(''):'<div class="empty">Рецептов пока нет. Создайте первую технологическую карту.</div>';
}
function ingredientRow(item={}){
 const options=products.map(p=>`<option value="${esc(p.id)}" ${p.id===item.productId?'selected':''}>${esc(p.name)} · ${esc(p.unit)}</option>`).join('');
 const row=document.createElement('div');row.className='ingredient';
 const units=[...new Set([...UNITS,item.unit||'г',...products.map(p=>p.unit).filter(Boolean)])];
 row.innerHTML=`<input class="field ing-name" maxlength="100" placeholder="Название ингредиента" value="${esc(item.name||'')}"><input class="field ing-qty" type="number" min="0" step="any" placeholder="Кол-во" value="${item.qty??''}"><select class="field ing-unit">${units.map(u=>`<option ${u===(item.unit||'г')?'selected':''}>${esc(u)}</option>`).join('')}</select><button class="btn danger remove" type="button" aria-label="Удалить ингредиент">×</button><select class="field ing-product" style="grid-column:1/-1"><option value="">Текстовый ингредиент — без цены</option>${options}</select>`;
 row.querySelector('.ing-product').value=item.productId||'';
 row.querySelector('.ing-product').addEventListener('change',event=>{
  const product=products.find(p=>p.id===event.target.value);
  if(product){row.querySelector('.ing-name').value=product.name;let unit=row.querySelector('.ing-unit');if(![...unit.options].some(o=>o.value===product.unit)){unit.add(new Option(product.unit,product.unit))}unit.value=product.unit}
  updateCost();
 });
 row.querySelector('.remove').addEventListener('click',()=>{row.remove();updateCost()});
 row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',updateCost));
 return row;
}
function stepRow(value=''){
 const row=document.createElement('div');row.className='step';
 row.innerHTML=`<div class="step-num"></div><textarea class="field" maxlength="1000" placeholder="Опишите действие, время или признак готовности">${esc(value)}</textarea><button class="btn danger" type="button" aria-label="Удалить этап">×</button>`;
 row.querySelector('button').addEventListener('click',()=>{row.remove();renumberSteps()});return row;
}
function renumberSteps(){[...$('#steps').children].forEach((row,i)=>row.querySelector('.step-num').textContent=`${i+1}.`)}
function readIngredients(){return [...$('#ingredients').children].map(row=>({name:row.querySelector('.ing-name').value.trim(),qty:Number(row.querySelector('.ing-qty').value)||0,unit:row.querySelector('.ing-unit').value,productId:row.querySelector('.ing-product').value||null})).filter(i=>i.name)}
function updateCost(){
 const draft={ingredients:readIngredients(),yieldGrams:Number($('#yield').value)||0};
 const cost=calculateRecipeCost(draft,products);
 const missing=draft.ingredients.filter(i=>!i.productId);
 const requestedTarget=Number($('#scaleTo').value);const target=requestedTarget>0?requestedTarget:draft.yieldGrams;
 const scaled=target&&draft.yieldGrams?scaleRecipeIngredients({...draft,yieldGrams:draft.yieldGrams},target):null;
 const scaledCost=scaled?calculateRecipeCost({...draft,ingredients:scaled},products):cost;
 $('#costPanel').innerHTML=`<div class="rowline"><span>Себестоимость привязанных ингредиентов</span><strong>${money(scaledCost.total)}</strong></div><div class="rowline"><span>Стоимость полностью рассчитана</span><strong>${scaledCost.complete?'Да':'Нет'}</strong></div>${missing.length?`<div class="notice">${missing.length} текстовых ингредиентов не имеют цены. Привяжите их к продуктам для полного расчёта.</div>`:''}${draft.yieldGrams?`<div class="rowline"><span>Себестоимость на 100 г</span><strong>${money(scaledCost.total/target*100)}</strong></div>${scaled?`<div class="subtle">Масштабирование: ×${(target/draft.yieldGrams).toFixed(3)}</div><div class="subtle">${scaled.map(i=>`${esc(i.name)} — ${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(i.qty)} ${esc(i.unit)}`).join('<br>')}</div>`:''}`:''}`;

}
function openEditor(recipe=null){
 editingId=recipe?.id||null;$('#dialogTitle').textContent=recipe?'Редактирование карты':'Новая технологическая карта';
 $('#name').value=recipe?.name||'';$('#cat').value=recipe?.category||'Бисквит';$('#yield').value=recipe?.yieldGrams||'';
 $('#temperature').value=recipe?.temperature??'';$('#time').value=recipe?.timeMinutes??'';$('#storage').value=recipe?.storage||'';$('#notes').value=recipe?.notes||'';
 $('#ingredients').replaceChildren();(recipe?.ingredients?.length?recipe.ingredients:[{}]).forEach(i=>$('#ingredients').append(ingredientRow(i)));
 $('#steps').replaceChildren();(recipe?.steps?.length?recipe.steps:['']).forEach(s=>$('#steps').append(stepRow(s)));renumberSteps();
 $('#editor').showModal();updateCost();
}
$('#newRecipe').addEventListener('click',()=>openEditor());
$('#closeEditor').addEventListener('click',()=>$('#editor').close());
$('#cancel').addEventListener('click',()=>$('#editor').close());
$('#addIngredient').addEventListener('click',()=>$('#ingredients').append(ingredientRow()));
$('#addStep').addEventListener('click',()=>{$('#steps').append(stepRow());renumberSteps()});
['#yield','#name','#cat','#scaleTo'].forEach(s=>$(s).addEventListener('input',updateCost));
$('#recipeForm').addEventListener('submit',event=>{
 event.preventDefault();
 const recipe={id:editingId||uid(),name:$('#name').value.trim(),category:$('#cat').value,yieldGrams:Number($('#yield').value)||0,ingredients:readIngredients(),steps:[...$('#steps').querySelectorAll('textarea')].map(x=>x.value.trim()).filter(Boolean),temperature:$('#temperature').value===''?null:Number($('#temperature').value),timeMinutes:$('#time').value===''?null:Number($('#time').value),storage:$('#storage').value.trim(),notes:$('#notes').value.trim(),updatedAt:new Date().toISOString()};
 const check=validateRecipe(recipe);
 if(!check.ok){alert(check.error);return}
 const index=recipes.findIndex(r=>r.id===recipe.id);if(index<0)recipes.unshift(recipe);else recipes[index]=recipe;
 save();$('#editor').close();render();
});
$('#cards').addEventListener('click',event=>{
 const edit=event.target.closest('[data-edit]');const del=event.target.closest('[data-delete]');
 if(edit){const r=recipes.find(x=>x.id===edit.dataset.edit);if(r)openEditor(r)}
 if(del){const r=recipes.find(x=>x.id===del.dataset.delete);if(r&&confirm(`Удалить рецепт «${r.name}»?`)){recipes=recipes.filter(x=>x.id!==r.id);save();render()}}
});
$('#search').addEventListener('input',render);$('#category').addEventListener('change',render);
$('#exportRecipes').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),recipes},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pastry-recipes-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('#importRecipes').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  const parsed=JSON.parse(await file.text());const incoming=Array.isArray(parsed)?parsed:parsed.recipes;
  if(!Array.isArray(incoming)||incoming.some(r=>!validateRecipe(r).ok))throw new Error('Файл содержит некорректные рецепты.');
  const ids=new Set();for(const r of incoming){if(ids.has(r.id))throw new Error('В файле повторяются ID рецептов.');ids.add(r.id)}
  if(!confirm(`Импортировать ${incoming.length} рецептов? Текущая база рецептов будет заменена.`))return;
  recipes=incoming;save();render();alert('Рецепты импортированы.');
 }catch(error){alert(error.message||'Не удалось прочитать файл.')}finally{event.target.value=''}
});
window.addEventListener('storage',event=>{if(event.key===PRODUCTS_KEY||event.key===LEGACY_PRODUCTS_KEY){products=loadProducts();render();if($('#editor').open)updateCost()}});
render();
