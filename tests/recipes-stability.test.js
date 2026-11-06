import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRecipeCost, scaleRecipe, validateRecipe, validateRecipeGraph, writeJsonSafely } from '../app/src/recipes-domain.js';
const flour={id:'flour',name:'Мука',unit:'г',packQty:1000,packPrice:5};
const base={id:'sponge',name:'Бисквит',yieldGrams:500,ingredients:[{name:'Мука',productId:'flour',qty:200,unit:'г'}],components:[],steps:['Выпечь']};
const cream={id:'cream',name:'Крем',yieldGrams:300,ingredients:[{name:'Мука',productId:'flour',qty:100,unit:'г'}],components:[],steps:['Смешать']};
const cake={id:'cake',name:'Торт',yieldGrams:1000,ingredients:[],components:[{recipeId:'sponge',qtyGrams:400},{recipeId:'cream',qtyGrams:200}],steps:['Собрать']};

test('composite recipe sums proportional component costs',()=>{const r=calculateRecipeCost(cake,[flour],[base,cream,cake]);assert.equal(r.complete,true);assert.ok(Math.abs(r.total - (1/500*400 + 0.5/300*200)) < 1e-12)});
test('nested recipe cost propagates incomplete child state',()=>{const incomplete={...base,ingredients:[{name:'Vanilla',productId:null,qty:2,unit:'г'}]};const r=calculateRecipeCost({...cake,components:[{recipeId:'sponge',qtyGrams:100}]},[flour],[incomplete,cake]);assert.equal(r.complete,false)});
test('cycle is rejected in recipe graph',()=>{const a={...base,components:[{recipeId:'b',qtyGrams:10}]};const b={...cream,id:'b',components:[{recipeId:'sponge',qtyGrams:10}]};assert.equal(validateRecipeGraph([a,b]).ok,false)});
test('missing component reference is rejected',()=>assert.equal(validateRecipeGraph([{...base,components:[{recipeId:'missing',qtyGrams:10}]}]).ok,false));
test('component-only recipe is valid',()=>assert.equal(validateRecipe({...cake,ingredients:[]}).ok,true));
test('scale includes nested component quantities',()=>{const scaled=scaleRecipe(cake,2000);assert.equal(scaled.components[0].qtyGrams,800);assert.equal(scaled.factor,2)});
test('invalid component quantity is rejected',()=>assert.equal(validateRecipe({...cake,components:[{recipeId:'sponge',qtyGrams:0}]}).ok,false));
test('duplicate recipe IDs are rejected',()=>assert.equal(validateRecipeGraph([base,{...cream,id:'sponge'}]).ok,false));
test('safe storage reports quota errors without clearing old value',()=>{let old='old';const storage={setItem(){const e=new Error();e.name='QuotaExceededError';throw e;}};const result=writeJsonSafely(storage,'recipes',[]);assert.equal(result.ok,false);assert.equal(old,'old')});
test('safe storage writes valid JSON',()=>{let value='';const storage={setItem(k,v){value=v}};assert.equal(writeJsonSafely(storage,'recipes',[base]).ok,true);assert.equal(JSON.parse(value)[0].id,'sponge')});
