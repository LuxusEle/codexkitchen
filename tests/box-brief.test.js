import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProject,solve,parseProject,validateUnits,renderingPrompt,repairCabinetSpace} from '../src/model.js';
import {boxBrief,toggleBriefBox,previewBoxBrief} from '../src/box-brief.js';
import {frontSpecs,carcassParts} from '../src/assembly.js';
import {fabricationPlan} from '../src/fabrication.js';

const compact=()=>({...initialProject(),room:{width:2210,depth:2410,height:2700,layout:'L'},openings:[],needs:{sink:1,cooker:1,wall:2},preferences:{sink:'B',cooker:'A'},upperWalls:['A']});

test('Tall units and fridge are opt-in; new layouts never invent them',()=>{
  for(const layout of ['I','L','U','GALLEY']){
    const p=initialProject();p.room.layout=layout;
    const r=solve(p);
    for(const type of ['oven','pantry','fridge']){assert.equal(p.needs[type],0);assert.ok(!r.units.some(u=>u.type===type));}
    assert.deepEqual(r.errors,[]);
  }
  const saved=initialProject();saved.needs.oven=1;saved.needs.fridge=1;
  const loaded=parseProject(JSON.stringify(saved)),r=solve(loaded);
  assert.ok(r.units.some(u=>u.type==='oven'));assert.ok(r.units.some(u=>u.type==='fridge'));
});
test('2210 × 2410 L run places sink, cooker and drawers with no unboxed spans',()=>{
  const p=compact();p.needs.drawers=1;
  const r=solve(p);
  assert.deepEqual(r.errors,[]);assert.deepEqual(r.unmet,[]);assert.deepEqual(r.gaps,[]);
  const cooker=r.units.find(u=>u.type==='cooker');assert.equal(cooker.wall,'A');assert.equal(cooker.w,600);assert.ok(cooker.x>=300);
  assert.equal(r.units.find(u=>u.type==='sink').wall,'B');
  assert.ok(r.units.filter(u=>u.z>=900).every(u=>u.wall==='A'));
});
test('B returns below 2500 mm still receive cabinets, including beneath a 1000 mm sill',()=>{
  for(const depth of [1900,2210,2410,2499]){
    const p=compact();p.room.depth=depth;
    // Window width/offset here are synthetic test data, not claimed site measurements.
    p.openings=[{id:'test-window',wall:'B',kind:'window',x:700,w:900,h:1000,sill:1000}];
    const r=solve(p);assert.deepEqual(r.errors,[],`${depth}`);assert.deepEqual(r.unmet,[]);assert.deepEqual(r.gaps,[]);
    assert.ok(r.units.some(u=>u.wall==='B'&&u.type==='sink'));
  }
});
test('Resized room explains the invalid old window, without silently moving a measured opening',()=>{
  const p=initialProject();p.room.width=2210;p.room.depth=2410;
  const before=JSON.stringify(p.openings),r=solve(p);
  assert.match(r.errors[0],/Offset 1000 \+ width 1500 = 2500 mm; wall length 2210/);
  assert.equal(JSON.stringify(p.openings),before);assert.equal(r.units.length,0);
});
test('Box toggles retain count and dimensions, preview is non-mutating, settings round-trip',()=>{
  const p=compact();p.unitDefaults={wall:{w:450,h:800,doorDivisions:1}};
  const before=JSON.stringify(p),draft=boxBrief(p);
  const off=toggleBriefBox(draft,'wall',false),on=toggleBriefBox(off,'wall',true);
  assert.equal(off.needs.wall,0);assert.equal(on.needs.wall,2);assert.deepEqual(on.unitDefaults,p.unitDefaults);
  const {project,plan}=previewBoxBrief(p,on);assert.deepEqual(plan.errors,[]);assert.equal(JSON.stringify(p),before);
  assert.ok(plan.units.filter(u=>u.z>=900&&u.type!=='filler').every(u=>u.h===800&&u.doorDivisions===1));
  const approved={...project,units:plan.units},loaded=parseProject(JSON.stringify(approved));
  assert.deepEqual(loaded.unitDefaults,on.unitDefaults);assert.deepEqual(loaded.boxCounts,on.boxCounts);assert.deepEqual(loaded.upperWalls,['A']);
});
test('Chooser rejects invalid sizes and quantities and never stretches fixed appliance widths',()=>{
  for(const [type,custom] of [['cooker',{w:650}],['sink',{w:850}],['spice',{w:100}],['wall',{h:150}],['base',{doorDivisions:7}]]){
    const p=compact();p.unitDefaults={[type]:custom};assert.ok(solve(p).errors.length,type);assert.throws(()=>parseProject(JSON.stringify(p)));
  }
  const p=compact();p.needs.wall=2.5;assert.ok(solve(p).errors.length);
});
test('Hob drawer fronts share the 3D/BOM recipe, open uppers have no doors and bases cannot be open',()=>{
  const p=compact();p.unitDefaults={cooker:{frontLayout:'drawers',doorDivisions:2},wall:{frontLayout:'open'}};
  const r=solve(p);assert.deepEqual(r.errors,[]);
  const hob=r.units.find(u=>u.type==='cooker'),fronts=frontSpecs(hob);
  assert.equal(fronts.length,2);assert.ok(fronts.every(f=>f.kind==='drawer'));
  for(const u of r.units.filter(u=>u.type==='wall'))assert.deepEqual(frontSpecs(u),[]);
  assert.ok(!carcassParts(p,[hob]).some(part=>/shelf/i.test(part.name)));
  const fab=fabricationPlan(p,r);assert.equal(fab.hardware.filter(x=>x.unitId===hob.id&&x.item==='Drawer box + runner pair').length,2);
  assert.match(renderingPrompt(p,r),/fronts drawers/);assert.match(renderingPrompt(p,r),/fronts open shelves/);
  assert.ok(validateUnits(p,[{...hob,type:'base',frontLayout:'open'}]).some(e=>/front arrangement/.test(e)));
  const repaired=repairCabinetSpace({...p,unitDefaults:{wall:{h:800}}},r.units.filter(u=>u.z<900));
  assert.ok(repaired.units.filter(u=>u.type==='wall').every(u=>u.h===800));
});
