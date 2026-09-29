import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProject,solve,parseProject,validateUnits,auditRunGaps} from '../src/model.js';
import {boxBrief,previewBoxBrief} from '../src/box-brief.js';
import {fabricationPlan} from '../src/fabrication.js';
import {newProject} from '../src/project-workspace.js';

test('ordinary new U projects pack compact rooms without a special project starter',()=>{
 for(const width of [1900,1980,2100,2200,2400,2600,2900]){
  const p=newProject('Normal kitchen');p.room={width,depth:2900,height:2700,layout:'U'};
  const before=JSON.stringify(p),r=solve(p),job=fabricationPlan(p,r);
  assert.deepEqual(r.errors,[],String(width));assert.deepEqual(r.unmet,[],String(width));assert.deepEqual(auditRunGaps(p,r.units),[]);
  assert.equal(r.units.filter(u=>u.type==='corner').length,2);assert.equal(r.units.find(u=>u.type==='cooker').w,600);assert.equal(r.units.find(u=>u.type==='sink').w,800);
  assert.deepEqual(job.errors,[]);assert.deepEqual(job.rejected,[]);assert.equal(JSON.stringify(p),before);assert.equal(p.siteWallLabels,undefined);
 }
});

test('normal chooser preserves a measured fridge width and preferred service walls in small U kitchens',()=>{
 for(const width of [1900,2100,2200,2400,2600,2900])for(const fridgeWidth of [610,762,914]){
  const p=initialProject();p.room={width,depth:2400,height:2700,layout:'U'};p.openings=[];p.needs={sink:1,cooker:1,fridge:1,wall:3};p.preferences={sink:'D',cooker:'A',fridge:'B'};p.upperWalls=['A'];p.unitDefaults={fridge:{w:fridgeWidth},wall:{w:450}};
  const {project,plan}=previewBoxBrief(p,boxBrief(p));assert.deepEqual(plan.errors,[],`${width}/${fridgeWidth}`);assert.deepEqual(plan.unmet,[],`${width}/${fridgeWidth}`);
  assert.equal(plan.units.find(u=>u.type==='fridge').w,fridgeWidth);assert.equal(plan.units.find(u=>u.type==='cooker').wall,'A');assert.equal(plan.units.find(u=>u.type==='sink').wall,'D');assert.ok(plan.units.filter(u=>u.z>=900).every(u=>u.wall==='A'));
  const loaded=parseProject(JSON.stringify({...project,units:plan.units}));assert.equal(loaded.unitDefaults.fridge.w,fridgeWidth);assert.deepEqual(solve(loaded).errors,[]);
 }
});

test('a U fridge anchors at the usable return end beside a door and the BOM contains all placed parts',()=>{
 const p=initialProject();p.room={width:2900,depth:3190,height:2700,layout:'U'};
 p.openings=[{id:'window',wall:'D',kind:'window',x:1930,w:1260,h:1000,sill:1000},{id:'entry',wall:'D',kind:'door',x:430,w:870,h:2100,sill:0},{id:'passage',wall:'B',kind:'door',x:2205,w:985,h:2100,sill:0}];
 p.needs={sink:1,cooker:1,fridge:1,wall:4};p.preferences={sink:'D',cooker:'A',fridge:'B'};p.upperWalls=['A'];p.unitDefaults={fridge:{w:762},wall:{w:575},cooker:{frontLayout:'drawers',doorDivisions:2}};
 p.cabinetRuns={base:{A:[0,2900],B:[0,2180],D:[1325,3190]}};
 const r=solve(p),job=fabricationPlan(p,r),fridge=r.units.find(u=>u.type==='fridge');assert.deepEqual(r.errors,[]);assert.deepEqual(r.unmet,[]);assert.equal(fridge.x,1418);assert.equal(fridge.x+fridge.w,2180);
 assert.deepEqual(job.errors,[]);assert.deepEqual(job.rejected,[]);assert.ok(job.bars.length>100);assert.ok(job.panels.length>20);
 const before=JSON.stringify(p.openings);p.openings[0].sill=400;const obstructed=solve(p);assert.equal(p.openings[0].sill,400);assert.notEqual(JSON.stringify(p.openings),before);
 assert.ok(obstructed.errors.length||obstructed.unmet.length||obstructed.units.find(u=>u.type==='sink').x!==r.units.find(u=>u.type==='sink').x);
 for(const unit of obstructed.units.filter(u=>u.wall==='D'&&u.z<900))assert.ok(unit.x+unit.w<=1905+.1||unit.x>=3215-.1);
});

test('compact alternatives keep real corner-opening conflicts visible',()=>{
 const p=initialProject();p.room={width:2000,depth:2900,height:2700,layout:'U'};p.openings=[{id:'corner-door',wall:'A',kind:'door',x:0,w:800,h:2100,sill:0}];
 const r=solve(p);assert.ok(r.errors.some(e=>e.includes('conflicts with an opening')));assert.ok(validateUnits(p,r.units).length);
});

test('adding a measured fridge to an ordinary compact U keeps the other requested boxes and closes fixed-only rows at an end',()=>{
 for(const width of [1980,2100,2400,2900]){
  const p=newProject('Compact kitchen');p.room={width,depth:2900,height:2700,layout:'U'};p.needs.fridge=1;p.unitDefaults={fridge:{w:762}};
  const r=solve(p),job=fabricationPlan(p,r);assert.deepEqual(r.errors,[],String(width));assert.deepEqual(r.unmet,[],String(width));assert.deepEqual(r.gaps,[]);assert.equal(r.units.find(u=>u.type==='fridge').w,762);assert.deepEqual(job.rejected,[]);
 }
});
