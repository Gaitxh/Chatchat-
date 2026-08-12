import {
  adapterRecipeComplete,
  applyTeachSelection,
  createEmptyAdapterRecipe,
  recipeProgress,
  type TeachSelection,
} from "../src/provider-sdk/recipe.js";
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`Assertion failed: ${message}`)}
const base=createEmptyAdapterRecipe("provider-1");
const selection=(role:TeachSelection["role"],selector:string):TeachSelection=>({role,selector,tag:role==="composer"?"textarea":"button",id:null,ariaLabel:null,dataTestId:null,dataMessageAuthorRole:null,inputType:null,contentEditable:false,selectedAt:new Date().toISOString()});
const withComposer=applyTeachSelection(base,"provider-1",selection("composer","#prompt"));
assert(withComposer.composerSelector==="#prompt","composer selector should be stored");
const withSend=applyTeachSelection(withComposer,"provider-1",selection("send","[data-testid=send]"));
const complete=applyTeachSelection(withSend,"provider-1",{...selection("response","[data-message-author-role=assistant]"),tag:"div",dataMessageAuthorRole:"assistant"});
assert(recipeProgress(complete)===3,"recipe should report all three taught roles");
assert(adapterRecipeComplete(complete),"recipe should become complete");
let rejected=false;try{applyTeachSelection(base,"provider-1",{...selection("composer","input[type=password]"),tag:"input",inputType:"password"});}catch{rejected=true}assert(rejected,"password fields must be rejected");
console.log("✓ ChatChat Teach Mode tests passed");
