import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProject,TYPES,solve,parseProject} from '../src/model.js';
import {moveCabinetRun,movableRun,shuffleDesign,designSignature,saveDesignSlot,restoreDesignSlot,placementErrors} from '../src/runPlacement.js';

const project=width=>({...initialProject(),room:{width,depth:3000,height:2700,layout:'I'},needs:{},openings:[]});
const unit=(id,type,x,w=TYPES[type].w,extra={})=>({...TYPES[type],id,type,wall:'A',x,w,z:TYPES[type].z||0,...extra});
const ordered=units=>[...units].sort((a,b)=>a.x-b.x);
const continuous=(units,a,b)=>{const row=ordered(units);assert.ok(Math.abs(row[0].x-a)<.1);for(let i=1;i<row.length;i++)assert.ok(Math.abs(row[i].x-row[i-1].x-row[i-1].w)<.1);assert.ok(Math.abs(row.at(-1).x+row.at(-1).w-b)<.1);};

test('Dragging reorders the entire base run without overlaps, gaps or mutating the original',()=>{
  const p=project(2400),units=[unit('A','base',0),unit('D','drawers',600),unit('B','base',1200),unit('W','waste',1800,600)],copy=structuredClone(units);
  const result=moveCabinetRun(p,units,'D',1800);
  assert.equal(result.valid,true,result.reason);assert.deepEqual(ordered(result.units).map(u=>u.id),['A','B','W','D']);
  continuous(result.units,0,2400);assert.deepEqual(units,copy);assert.equal(result.changedIds.length,3);
});
test('Upper runs reflow independently and leave the bottom row unchanged',()=>{
  const p=project(2400),base=unit('B','base',0,1200),units=[base,unit('W','wall',0,800),unit('G','glass',800,800),unit('L','lift',1600,800)];
  const result=moveCabinetRun(p,units,'G',2300);assert.equal(result.valid,true,result.reason);
  assert.deepEqual(result.units.find(u=>u.id==='B'),base);continuous(result.units.filter(u=>u.z>=900),0,2400);
  assert.deepEqual(ordered(result.units.filter(u=>u.z>=900)).map(u=>u.id),['W','L','G']);
});
test('Opening divides runs: dragging stops at its edge and cannot push units through it',()=>{
  const p=project(4200);p.openings=[{id:'door',kind:'door',wall:'A',x:1800,w:800,h:2100,sill:0}];
  const units=[unit('A','base',0,875),unit('D','drawers',875,900),unit('B','base',2625,775),unit('C','base',3400,800)];
  const result=moveCabinetRun(p,units,'A',4100);assert.equal(result.valid,true,result.reason);
  continuous(result.units.filter(u=>['A','D'].includes(u.id)),0,1775);
  assert.deepEqual(result.units.slice(2),units.slice(2));
});
test('Tall oven remains an end anchor and row reordering never places it in the middle',()=>{
  const p=project(2400),units=[unit('O','oven',0),unit('A','base',600),unit('D','drawers',1200),unit('B','base',1800)];
  const result=moveCabinetRun(p,units,'D',0);assert.equal(result.valid,true,result.reason);assert.equal(result.units[0].x,0);
  continuous(result.units,0,2400);assert.equal(movableRun(p,units,'O'),null);
});
test('Gap adjustment exhausts door capacity, then spice, then drawers; does not touch sink',()=>{
  const p=project(3370),units=[unit('B','base',0,1190),unit('P','spice',1190,240),unit('D','drawers',1430,1100),unit('S','sink',2570)];
  const result=moveCabinetRun(p,units,'D',1430);assert.equal(result.valid,true,result.reason);
  assert.equal(result.units[0].w,1200);assert.equal(result.units[1].w,250);assert.equal(result.units[2].w,1120);assert.equal(result.units[3].w,800);continuous(result.units,0,3370);
});
test('A fixed-only gap cannot be approved; selected sink exception is capped at 50 mm',()=>{
  const p=project(1450),units=[unit('S','sink',0),unit('DW','dishwasher',850)];
  const result=moveCabinetRun(p,units,'S',0);assert.equal(result.valid,false);assert.equal(result.units[0].w,800);
  const approved=moveCabinetRun(p,units,'S',0,{editableIds:['S']});assert.equal(approved.valid,true,approved.reason);
  assert.equal(approved.units[0].w,850);assert.equal(approved.units[0].widthAdjustmentApproved,true);
  assert.equal(moveCabinetRun(project(1500),units,'S',0,{editableIds:['S']}).valid,false);
});
test('Shrinking also respects tier order and never shrinks the fixed cooker',()=>{
  const p=project(2500),units=[unit('B','base',0,1200),unit('C','cooker',1200),unit('D','drawers',1700,800)];
  const result=moveCabinetRun(p,units,'B',0);assert.equal(result.valid,true,result.reason);
  assert.equal(result.units[0].w,1100);assert.equal(result.units[1].w,600);assert.equal(result.units[2].w,800);continuous(result.units,0,2500);
});
test('Cooker proposals at a run edge or under an upper cabinet cannot be approved',()=>{
  const p=project(2400),units=[unit('A','base',0,900),unit('C','cooker',900),unit('B','base',1500,900)];
  assert.equal(moveCabinetRun(p,units,'C',0).valid,false);
  const withUpper=[...units,unit('W','wall',0,900)];
  assert.ok(placementErrors(p,[...withUpper.filter(u=>u.id!=='C'),unit('C','cooker',500)]).some(e=>e.includes('hood')));
});
test('Shuffle produces four distinct valid layouts without changing fixed services or requirements',()=>{
  const p=initialProject(),original=solve(p).units,seen=[];
  for(let i=1;i<=4;i++){
    const result=shuffleDesign(p,original,i,seen);assert.ok(result.signature,result.reason);assert.ok(!seen.includes(result.signature));seen.push(result.signature);
    assert.deepEqual(placementErrors(p,result.units),[]);
    for(const u of original.filter(u=>['sink','cooker','oven','fridge'].includes(u.type)))assert.deepEqual(result.units.find(v=>v.id===u.id),u);
    assert.deepEqual(result.units.map(u=>u.type).sort(),original.map(u=>u.type).sort());
  }
});
test('Shuffle does not call identical equal-size door boxes a new design',()=>{
  const p=project(1800),units=[unit('A','base',0),unit('B','base',600),unit('C','base',1200)];
  const result=shuffleDesign(p,units,1);assert.ok(result.reason);assert.equal(designSignature(result.units),designSignature(units));
});
test('Four slots are deep snapshots, survive JSON import, restore room and never recursively copy slots',()=>{
  let p=project(2400),units=[unit('A','base',0,1200),unit('B','drawers',1200,1200)];
  for(let i=0;i<4;i++){p={...p,name:`Option ${i}`};p=saveDesignSlot(p,units,i);}
  assert.equal(p.designVariants.length,4);units[0].w=999;
  p=parseProject(JSON.stringify(p));const restored=restoreDesignSlot({...p,room:{...p.room,width:4000}},0);
  assert.equal(restored.name,'Option 0');assert.equal(restored.room.width,2400);assert.equal(restored.units[0].w,1200);
  assert.equal(restored.designVariants.length,4);assert.ok(p.designVariants.every(s=>!s.project.designVariants));
  assert.throws(()=>saveDesignSlot(p,[],4),/four/);
});
test('Import rejects malformed or recursively nested alternative slots',()=>{
  const p=project(2400);
  assert.throws(()=>parseProject(JSON.stringify({...p,designVariants:Array(5).fill(null)})),/four/);
  assert.throws(()=>parseProject(JSON.stringify({...p,designVariants:[{name:'bad'}]})),/Invalid saved Design/);
  assert.throws(()=>parseProject(JSON.stringify({...p,designVariants:[{project:{...p,designVariants:[]}}]})),/Invalid saved Design/);
});
test('All arrangements keep valid previews non-overlapping, cover the moved run and preserve every cabinet',()=>{
  let checked=0;
  for(const layout of ['I','L','U','GALLEY']){
    const p=initialProject();p.room.layout=layout;const source=solve(p).units,serialized=JSON.stringify(source);
    for(const u of source){
      const run=movableRun(p,source,u.id);if(!run)continue;
      for(const target of [run.domain[0],(run.domain[0]+run.domain[1])/2,run.domain[1]]){
        const result=moveCabinetRun(p,source,u.id,target);
        assert.equal(result.units.length,source.length);
        if(result.valid){
          checked++;assert.deepEqual(placementErrors(p,result.units),[],`${layout} ${u.id} ${target}`);
          continuous(result.units.filter(v=>run.boxes.some(b=>b.id===v.id)),...run.domain);
        }
      }
    }
    assert.equal(JSON.stringify(source),serialized);
  }
  assert.ok(checked>50,`Only ${checked} valid previews checked`);
});
