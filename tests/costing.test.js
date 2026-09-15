import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProject } from '../src/model.js';
import { fabricationPlan } from '../src/fabrication.js';
import { kitchenEstimate, LKR_COST_DEFAULTS } from '../src/costing.js';

test('Sri Lanka UAT price defaults and measured quantities populate editable estimate and BOM',()=>{
  const p=initialProject();p.openings=[];p.needs={};
  const units=[
    {id:'B1',type:'base',wall:'A',x:0,z:0,w:1200,h:850,d:600,doorDivisions:2},
    {id:'W1',type:'glass',wall:'A',x:0,z:1450,w:1200,h:720,d:350},
    {id:'T1',type:'pantry',wall:'A',x:1200,z:0,w:600,h:2100,d:650},
  ];
  const plan={units,errors:[],unmet:[]};
  const job=fabricationPlan(p,plan),estimate=kitchenEstimate(p,plan,job);
  assert.equal(estimate.sales.find(x=>x.key==='base').rate,LKR_COST_DEFAULTS.base);
  const tall=estimate.sales.find(x=>x.key==='tall');
  assert.equal(tall.quantity,6.89);assert.equal(tall.unit,'vertical ft');assert.equal(tall.total,103350);
  assert.ok(estimate.sales.find(x=>x.key==='granite').quantity>7);
  assert.ok(estimate.purchasing.length&&estimate.purchasing.some(x=>x.rate>0));
  const acp=estimate.purchasing.filter(x=>x.category==='Sheet stock'&&/ACP/i.test(x.item));
  assert.ok(acp.length);assert.ok(acp.every(x=>x.rate===26500),'ACP default is a per-sheet rate, not area multiplied twice');
  assert.ok(acp.every(x=>x.total===x.quantity*26500));
  const edited=kitchenEstimate({...p,costing:{salesRates:{base:20000},salesQuantities:{base:10}}},plan,job);
  assert.equal(edited.sales.find(x=>x.key==='base').total,200000);
});
