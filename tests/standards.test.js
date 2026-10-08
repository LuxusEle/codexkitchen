import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_STANDARDS,readShopStandards,writeShopStandards,applyShopStandards,applyShopStandardsIfSet,standardHeightFor,hasShopStandards} from '../src/standards.js';
import {initialProject} from '../src/model.js';

function fakeStorage(init){const m=new Map(Object.entries(init||{}));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};}

test('Shop standards round-trip, clamp and default safely',()=>{
  const s=fakeStorage();
  assert.equal(hasShopStandards(s),false);
  assert.deepEqual(readShopStandards(s),DEFAULT_STANDARDS);
  const saved=writeShopStandards({baseH:870,wallH:719.6},s);
  assert.deepEqual(saved,{baseH:870,wallH:720});
  assert.deepEqual(readShopStandards(s),{baseH:870,wallH:720});
  assert.equal(hasShopStandards(s),true);
  assert.deepEqual(writeShopStandards({baseH:2000,wallH:10},s),{baseH:900,wallH:200});
  s.setItem('codex-shop-standards','{broken');
  assert.deepEqual(readShopStandards(s),DEFAULT_STANDARDS);
});

test('New projects stay untouched until standards are saved',()=>{
  const p=initialProject();
  const plain=applyShopStandardsIfSet(p,fakeStorage());
  assert.equal(plain.unitDefaults,undefined);
  const withStd=applyShopStandardsIfSet(initialProject(),fakeStorage({'codex-shop-standards':JSON.stringify({baseH:870,wallH:745})}));
  assert.equal(withStd.unitDefaults.base.h,870);
  assert.equal(withStd.unitDefaults.cooker.h,870);
  assert.equal(withStd.unitDefaults.corner.h,870);
  assert.equal(withStd.unitDefaults.wall.h,745);
  assert.equal(withStd.unitDefaults.glass.h,745);
  assert.equal(withStd.unitDefaults.wallCorner.h,745);
  assert.equal(withStd.unitDefaults.oven,undefined);
  assert.equal(withStd.unitDefaults.lift,undefined);
});

test('Standard height lookup covers base, wall and skips talls',()=>{
  assert.equal(standardHeightFor('cooker'),DEFAULT_STANDARDS.baseH);
  assert.equal(standardHeightFor('wall'),DEFAULT_STANDARDS.wallH);
  assert.equal(standardHeightFor('oven'),null);
  assert.equal(standardHeightFor('lift'),null);
  assert.equal(standardHeightFor('nope'),null);
});

test('Applying standards keeps other unitDefaults fields',()=>{
  const p=initialProject();
  p.unitDefaults={base:{w:700,h:820,frontLayout:'drawers'}};
  const next=applyShopStandards(p,{baseH:870,wallH:720});
  assert.equal(next.unitDefaults.base.h,870);
  assert.equal(next.unitDefaults.base.w,700);
  assert.equal(next.unitDefaults.base.frontLayout,'drawers');
  assert.equal(p.unitDefaults.base.h,820);
});
