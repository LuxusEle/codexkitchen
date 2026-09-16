import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProject,solve} from '../src/model.js';
import {removeCabinet,canUndoCabinet,cabinetAtPoint} from '../src/cabinet-actions.js';
import {quoteReviewIssues} from '../src/quote-review.js';

test('Delete updates the requested count, preserves other boxes and supports exact undo',()=>{
  const p=initialProject(),plan=solve(p),target=plan.units.find(u=>u.type==='drawers'),snapshot=JSON.stringify(p);
  const action=removeCabinet(p,plan.units,target.id),next={...p,...action.patch};
  assert.equal(JSON.stringify(p),snapshot);assert.equal(next.needs.drawers,0);
  assert.equal(next.units.length,plan.units.length-1);assert.ok(!next.units.some(u=>u.id===target.id));
  for(const u of next.units)assert.deepEqual(u,plan.units.find(v=>v.id===u.id));
  assert.ok(canUndoCabinet(next,action.undo));assert.deepEqual({...next,...action.undo.before},p);
  assert.ok(canUndoCabinet({...next,name:'Renamed',costing:{salesRates:{base:16000}}},action.undo));
  assert.ok(!canUndoCabinet({...next,room:{...p.room,width:5000}},action.undo));
  assert.ok(!canUndoCabinet({...next,units:next.units.slice(1)},action.undo));
});
test('Automatic storage deletion does not cancel another requested box; deleting island removes its whole feature',()=>{
  const p=initialProject(),plan=solve(p),automatic=plan.units.find(u=>u.automatic&&u.type==='base');
  assert.ok(automatic);assert.deepEqual(removeCabinet(p,plan.units,automatic.id).patch.needs,p.needs);
  const island={...p,room:{...p.room,width:6500,depth:5000},island:true},r=solve(island),unit=r.units.find(u=>u.wall==='Island');
  const action=removeCabinet(island,r.units,unit.id);
  assert.equal(action.patch.island,false);assert.ok(action.patch.units.every(u=>u.wall!=='Island'));
  assert.deepEqual(action.patch.needs,island.needs);assert.ok(canUndoCabinet({...island,...action.patch},action.undo));
  assert.equal(removeCabinet(p,plan.units,'missing'),null);
});
test('Shared run frame clicks resolve the box at the hit location, including rotated walls and upper row',()=>{
  const p=initialProject(),units=[
    {id:'A1',type:'base',wall:'A',x:0,w:600,h:850,d:600,z:0},
    {id:'A2',type:'base',wall:'A',x:600,w:600,h:850,d:600,z:0},
    {id:'U2',type:'wall',wall:'A',x:600,w:600,h:720,d:350,z:1450},
    {id:'B1',type:'base',wall:'B',x:600,w:600,h:850,d:600,z:0},
  ],ids=units.map(u=>u.id);
  assert.equal(cabinetAtPoint(p,units,ids,{x:850,y:400,z:600}),'A2');
  assert.equal(cabinetAtPoint(p,units,ids,{x:850,y:1800,z:350}),'U2');
  assert.equal(cabinetAtPoint(p,units,ids,{x:p.room.width-600,y:400,z:850}),'B1');
});
test('Quote review flags omitted prices, stale manual quantities, partial BOM and below-material selling price',()=>{
  const p={...initialProject(),costing:{salesQuantities:{base:10}}},plan={errors:['Gap on A'],unmet:['Wall cabinet']},job={errors:[],rejected:[{}]};
  const estimate={sales:[{quantity:1,rate:50}],purchasing:[{quantity:1,rate:0},{quantity:1,rate:100}],salesTotal:50,purchasingTotal:100};
  const issues=quoteReviewIssues(p,plan,job,estimate).join('\n');
  for(const text of ['Gap on A','Unplaced: Wall cabinet','site measurements','no positive price','Manual quantity overrides','BOM may be partial','below the material'])assert.ok(issues.includes(text),text);
  estimate.sales[0].rate=-1;assert.ok(quoteReviewIssues(p,plan,job,estimate).some(s=>s.includes('negative')));
});
