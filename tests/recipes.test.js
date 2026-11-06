import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRecipeCost, scaleRecipeIngredients, validateRecipe } from '../app/src/recipes-domain.js';
const flour={id:'flour',name:'Мука',unit:'г',packQty:1000,packPrice:5};
const recipe={id:'r1',name:'Бисквит',category:'Бисквит',yieldGrams:500,ingredients:[{name:'Мука',productId:'flour',qty:200,unit:'г'},{name:'Ваниль',productId:null,qty:2,unit:'г'}],steps:['Смешать','Выпечь']};
test('recipe cost uses linked product price per matching unit',()=>{const r=calculateRecipeCost(recipe,[flour]);assert.equal(r.total,1);assert.equal(r.complete,false)});
test('recipe cost is complete when every ingredient is linked',()=>{const r=calculateRecipeCost({...recipe,ingredients:[recipe.ingredients[0]]},[flour]);assert.equal(r.complete,true);assert.equal(r.total,1)});
test('unit mismatch is not silently converted',()=>{const r=calculateRecipeCost({...recipe,ingredients:[{...recipe.ingredients[0],unit:'мл'}]},[flour]);assert.equal(r.complete,false);assert.equal(r.total,0)});
test('scale recipe proportionally to target yield',()=>{const scaled=scaleRecipeIngredients(recipe,1000);assert.equal(scaled[0].qty,400);assert.equal(scaled[1].qty,4)});
test('invalid yield cannot be scaled',()=>assert.equal(scaleRecipeIngredients({...recipe,yieldGrams:0},800),null));
test('valid mixed linked and custom recipe passes validation',()=>assert.equal(validateRecipe(recipe).ok,true));
test('recipe rejects negative ingredient quantity',()=>assert.equal(validateRecipe({...recipe,ingredients:[{...recipe.ingredients[0],qty:-1}]}).ok,false));
test('recipe rejects unsafe identifiers',()=>assert.equal(validateRecipe({...recipe,id:'bad/id'}).ok,false));

test('recipe requires at least one ingredient',()=>assert.equal(validateRecipe({...recipe,ingredients:[]}).ok,false));
test('recipe rejects zero ingredient quantity',()=>assert.equal(validateRecipe({...recipe,ingredients:[{...recipe.ingredients[0],qty:0}]}).ok,false));
