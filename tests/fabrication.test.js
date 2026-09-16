import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { initialProject, solve, validateUnits, closeRunGaps, interiorFillers, parseProject, renderingPrompt, insertCabinet, repairCabinetSpace, auditCabinetSpace, TYPES } from "../src/model.js";
import {
  carcassParts,
  frontSpecs,
  supportPlan,
  notchedOutline,
} from "../src/assembly.js";
import {
  SASH_PROFILE,
  WEB_SASH_PROFILE,
  HANDLE_PROFILE,
  SOURCE_HANDLE_PROFILE,
  doorBody,
} from "../src/sash-profile.js";
import {
  fabricationPlan,
  STOCK_DEFAULTS,
  nestBars,
  nestSheets,
  placedOutline,
  fabricationFiles,
} from "../src/fabrication.js";

function inside(point, poly) {
  let on = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x, y] = poly[i],
      [a, b] = poly[j];
    if (
      y > point[1] !== b > point[1] &&
      point[0] < ((a - x) * (point[1] - y)) / (b - y) + x
    )
      on = !on;
  }
  return on;
}

test("Active complex sash matches all six walls of the untouched source, not the box substitute", () => {
  assert.equal(SASH_PROFILE, WEB_SASH_PROFILE);
  class Vector {
    constructor(x = 0, y = 0, z = 0) {
      this.set(x, y, z);
    }
    set(x, y, z) {
      Object.assign(this, { x, y, z });
    }
    scale(s) {
      return new Vector(this.x * s, this.y * s, this.z * s);
    }
    static TransformCoordinates(v) {
      return v;
    }
  }
  class Node {
    constructor() {
      this.position = new Vector();
      this.rotation = {};
    }
    computeWorldMatrix() {}
    getWorldMatrix() {
      return {};
    }
  }
  const sandbox = {
    BABYLON: {
      MeshBuilder: {
        CreateBox: (name, dims) => ({ name, dims, position: new Vector() }),
      },
      TransformNode: Node,
      Vector3: Vector,
      Tools: { ToRadians: (n) => (n * Math.PI) / 180 },
    },
  };
  vm.runInNewContext(
    readFileSync(
      new URL("../reference/fabrication/aluminum/sash.js", import.meta.url),
      "utf8",
    ) +
      ";result=generateSashBar({length:300,width:45,height:21.2,thickness:1.5,boxHeight:16.2,uDepth:5,uExtend:10,uReturn:2});",
    sandbox,
  );
  const walls = sandbox.result.meshes;
  assert.equal(walls.length, 6);
  for (let d = 0.13; d < 21.2; d += 0.43)
    for (let f = 0.17; f < 45; f += 0.47) {
      const source = walls.some(
        (m) =>
          d > (m.position.y - m.dims.height / 2) * 1000 &&
          d < (m.position.y + m.dims.height / 2) * 1000 &&
          45 - f > (m.position.z - m.dims.depth / 2) * 1000 &&
          45 - f < (m.position.z + m.dims.depth / 2) * 1000,
      );
      const adapted =
        inside([d, f], SASH_PROFILE.outer) &&
        !inside([d, f], SASH_PROFILE.inner);
      assert.equal(
        adapted,
        source,
        `channel mismatch at depth ${d}, face ${f}`,
      );
    }
});

test("Handle mouth follows the web sash depth datum for upper and base doors", () => {
  const reflected=SOURCE_HANDLE_PROFILE.outer.map(([d,f])=>[Number((SASH_PROFILE.depth-d).toFixed(6)),f]).reverse();
  assert.deepEqual(HANDLE_PROFILE.outer,reflected);
  // At mid grip-height the outer face is open and the rear leg is solid.
  // Before the fix these were reversed, with the grip facing into the carcass.
  assert.equal(inside([20.5,-10],HANDLE_PROFILE.outer),false);
  assert.equal(inside([.75,-10],HANDLE_PROFILE.outer),true);
  for(const side of ['top','bottom']){
    const body=doorBody({h:720,handleSide:side});
    const contour=HANDLE_PROFILE.outer.map(([d,f])=>[d,body.y+(side==='top'?body.height-f:f)]);
    const gripY=side==='top'?body.height+10:body.y-10;
    assert.equal(inside([20.5,gripY],contour),false);
    assert.equal(inside([.75,gripY],contour),true);
    assert.ok(contour.every(([d,y])=>d>=0&&d<=21.2&&y>=0&&y<=720));
  }
  assert.equal(SASH_PROFILE,WEB_SASH_PROFILE,'Do not replace the lipped sash');
});

test("Handle adapts without replacing complex sash; upper bottom / base top and one bar per edge", () => {
  const p = initialProject(),
    r = solve(p),
    job = fabricationPlan(p, r);
  for (const u of r.units)
    for (const f of frontSpecs(u)) {
      assert.equal(f.handleSide, u.z > 0 ? "bottom" : "top");
      const body = doorBody(f);
      assert.equal(body.height + HANDLE_PROFILE.rise, f.h);
      const bars = job.bars.filter((b) => b.id.startsWith(f.id + "-"));
      assert.equal(bars.length, 4);
      assert.equal(
        bars.filter((b) => b.profile === HANDLE_PROFILE.id).length,
        1,
      );
      assert.equal(bars.filter((b) => b.profile === SASH_PROFILE.id).length, 3);
    }
  assert.ok(!job.hardware.some((h) => h.item === "Finger pull handle"));
});

test("Continuous run shares rails and does not mirror dense front divisions at the rear", () => {
  const p = initialProject(),
    units = Array.from({ length: 8 }, (_, i) => ({
      id: `T${i}`,
      type: "base",
      wall: "A",
      x: i * 300,
      z: 0,
      w: 300,
      h: 850,
      d: 600,
    }));
  const supports = supportPlan({ start: 0, end: 2400, units }, 600);
  assert.equal(supports.front.length, 7,'Fixed end sashes replace duplicate end uprights');
  assert.equal(supports.rear.length, 3,'Rear grid contains only independent internal supports');
  for (let i = 1; i < supports.rear.length; i++)
    assert.ok(supports.rear[i] - supports.rear[i - 1] <= 600);
  const parts = carcassParts(p, units);
  assert.equal(parts.filter((p) => p.name === "Run rail").length, 4);
  const bottom = parts.filter((p) => p.name === "Continuous U-notched bottom");
  assert.equal(bottom.length, 1);
  assert.ok(Math.abs(bottom[0].cutW-(2400-2*SASH_PROFILE.depth))<.001,'Panel runs into structural end sashes');
  assert.equal(bottom[0].notches.front.length, 7);
  assert.equal(bottom[0].notches.rear.length, 0,'Rear posts behind liner do not require shelf U-cuts');
  assert.equal(bottom[0].fitClearance,1);
  assert.ok(Math.abs(bottom[0].notches.front[0][1]-bottom[0].notches.front[0][0]-27.4)<.001);
});

test('Double-door bay has no centre box upright, end sashes carry run ends, and rear count is adjustable',()=>{
  const p=initialProject(),units=[cabinet({w:1200,doorDivisions:2})];
  const base=supportPlan({start:SASH_PROFILE.depth,end:1200-SASH_PROFILE.depth,units},600,0);
  assert.deepEqual(base.front,[],'Door division must not create a structural box bar');
  assert.equal(base.rear.length,1);
  assert.equal(supportPlan({start:SASH_PROFILE.depth,end:1200-SASH_PROFILE.depth,units},600,1).rear.length,2);
  assert.equal(supportPlan({start:SASH_PROFILE.depth,end:1200-SASH_PROFILE.depth,units},600,-1).rear.length,0);
  const parts=carcassParts(p,units);
  assert.equal(parts.filter(x=>x.name==='Front upright').length,0);
  assert.equal(parts.filter(x=>x.name==='Continuous U-notched top').length,0,'Granite covers bottom cabinets');
  assert.equal(parts.filter(x=>x.name==='Continuous U-notched bottom').length,1);
});

test('Adjacent tall and base frames share one structural transition sash without a gap',()=>{
  const p=initialProject(),units=[cabinet({id:'BASE',x:0,w:600}),cabinet({id:'OVEN',type:'oven',x:600,w:600,h:2100,d:650})],parts=carcassParts(p,units);
  const baseRun=parts.find(x=>x.unitIds.includes('BASE'))?.runId,ovenRun=parts.find(x=>x.unitIds.includes('OVEN'))?.runId;
  assert.ok(baseRun&&ovenRun&&baseRun!==ovenRun);
  assert.equal(parts.filter(x=>x.assemblyId===`${baseRun}-END-RIGHT`).length,0,'Short run must not add a second side sash');
  assert.equal(parts.filter(x=>x.assemblyId===`${ovenRun}-END-LEFT`).length,5,'Tall run owns the shared side sash');
  const baseRail=Math.max(...parts.filter(x=>x.runId===baseRun&&x.name==='Run rail').map(x=>x.x+x.w));
  const sharedSash=Math.min(...parts.filter(x=>x.assemblyId===`${ovenRun}-END-LEFT`&&x.kind==='bar').map(x=>x.x));
  assert.ok(Math.abs(baseRail-sharedSash)<.001,'Base rails terminate directly into tall side sash');
  const baseRear=parts.find(x=>x.runId===baseRun&&x.name==='Continuous rear cladding');
  assert.ok(Math.abs(baseRear.x+baseRear.w-600)<.001,'Rear ACP also closes at the shared side');
});

const cabinet=(extra={})=>({id:'TEST',type:'base',wall:'A',x:0,z:0,w:600,h:850,d:600,...extra});
test('End skins and interior liners do not intersect box members; front bars have no ACP masks',()=>{
  const parts=carcassParts(initialProject(),[cabinet()]);
  assert.ok(!parts.some(p=>p.name==='Front frame facing'));
  const overlaps=(a,b)=>['x','y','z'].every((key,i)=>Math.min(a[key]+a[['w','h','d'][i]],b[key]+b[['w','h','d'][i]])-Math.max(a[key],b[key])>.001);
  for(const a of parts.filter(p=>p.kind==='panel'&&!p.outline))
    for(const b of parts.filter(p=>p.kind==='bar'&&!p.sashPlacement))assert.ok(!overlaps(a,b),`${a.name} intersects ${b.name}`);
  const rear=parts.find(p=>p.name==='Continuous rear cladding');
  for(const post of parts.filter(p=>p.name==='Rear upright'))assert.ok(rear.z>=post.z+post.d-.001);
  for(const a of parts.filter(p=>p.kind==='panel'))
    for(const b of parts.filter(p=>p.kind==='panel'&&p.id!==a.id))assert.ok(!overlaps(a,b),`${a.name} overlaps ${b.name}`);
});
test('Box ends are fixed four-sided detailed sash assemblies with no handles or hinges',()=>{
  const p=initialProject(),units=[cabinet()],parts=carcassParts(p,units);
  assert.ok(!parts.some(p=>p.name==='End cladding'));
  const endParts=parts.filter(p=>p.assemblyType==='fixed-end');
  assert.equal(endParts.length,10);
  const job=fabricationPlan({...p,fabrication:{sashLength:5000,barLength:6400}},{units,errors:[],unmet:[]});
  for(const side of ['LEFT','RIGHT']){
    const id=`R1-END-${side}`,members=job.bars.filter(b=>b.assemblyId===id),panels=job.panels.filter(p=>p.assemblyId===id);
    assert.equal(members.length,4);assert.equal(panels.length,1);
    assert.ok(members.every(b=>b.profile===SASH_PROFILE.id&&b.stockLength===5000&&b.miterStart===45&&b.miterEnd===45&&b.hasHandle===false));
    assert.deepEqual(members.map(b=>b.length),[600,600,811.9,811.9]);
    assert.equal(panels[0].cutW,791.9);assert.equal(panels[0].cutH,580);
    assert.ok(!job.hardware.some(h=>h.id.startsWith(id)));
    assert.ok(members.every(b=>b.x>=0&&b.x+b.w<=600&&b.z>=0&&b.z+b.d<=600));
  }
  // The infill overlaps the sash bounding box but is seated in the EMPTY
  // return channel, not in metal; a bounding-box collision test is insufficient.
  for(let depth=18.3;depth<21.2;depth+=.4)
    for(let face=10.1;face<45;face+=1)
      assert.equal(inside([depth,face],SASH_PROFILE.outer)&&!inside([depth,face],SASH_PROFILE.inner),false);
});
test('Custom incomplete designs still nest placed parts; invalid units are excluded',()=>{
  const p=initialProject();p.units=[cabinet()];
  const job=fabricationPlan(p,solve(p));
  assert.ok(job.errors.length>0);assert.ok(job.barNest.stocks.length>0);assert.ok(job.sheetNest.sheets.length>0);
  const bad=fabricationPlan(p,{units:[cabinet({w:NaN})],errors:[],unmet:[]});
  assert.equal(bad.bars.length,0);assert.ok(bad.errors.some(e=>e.includes('excluded')));
});
test('150–250 mm spice fronts are valid; widths outside that range are rejected',()=>{
  const p=initialProject();p.openings=[];p.needs={};
  const spice=cabinet({type:'spice',w:150});
  assert.deepEqual(validateUnits(p,[spice]),[]);
  assert.equal(frontSpecs(spice)[0].w,147);
  const job=fabricationPlan(p,{units:[spice],errors:[],unmet:[]});
  assert.ok(job.bars.some(b=>b.id==='TEST-F1-TOP'));
  assert.ok(validateUnits(p,[cabinet({type:'spice',w:149})]).some(e=>e.includes('Minimum')));
  assert.ok(validateUnits(p,[cabinet({type:'spice',w:251})]).some(e=>e.includes('Invalid dimensions')));
});
test('Door divisions, ACP/glass and colour survive save/import and reach cutting/prompt',()=>{
  const p=initialProject();p.openings=[];p.needs={};p.units=[cabinet({doorDivisions:3,frontMaterial:'glass',frontColor:'#aa3322',w:900})];
  const saved=parseProject(JSON.stringify(p)),unit=saved.units[0];
  assert.equal(frontSpecs(unit).length,3);
  assert.ok(frontSpecs(unit).every(f=>f.glass&&f.color==='#aa3322'));
  const plan=solve(saved),job=fabricationPlan(saved,plan);
  assert.equal(job.panels.filter(p=>p.material==='Glass'&&p.finish==='#aa3322').length,3);
  assert.match(renderingPrompt(saved,plan),/divisions 3/);
});
test('Middle K13 filler is absorbed into storage and no fixed centre panel remains',()=>{
  const p=initialProject();p.openings=[];p.needs={};p.room.layout='I';p.room.width=2400;
  const units=[cabinet({id:'L',type:'drawers'}),cabinet({id:'K13',type:'filler',x:600,w:100}),cabinet({id:'R',x:700,w:600})];
  assert.equal(interiorFillers(p,units)[0].id,'K13');
  const fixed=closeRunGaps(p,units);
  assert.ok(!fixed.some(u=>u.id==='K13'));assert.equal(interiorFillers(p,fixed).length,0);
  assert.equal(fixed.find(u=>u.id==='L').w,600,'Specialist drawer width must not change');
  assert.equal(fixed.find(u=>u.id==='R').w,700);
  assert.equal(frontSpecs(fixed.find(u=>u.id==='L')).length,3);
  assert.equal(units[0].w,600,'Input project is not mutated');
});
test('Fixed appliances never get a new middle filler when a gap cannot safely resize',()=>{
  const p=initialProject();p.openings=[];p.needs={};p.room.layout='I';
  const units=[cabinet({id:'L',type:'cooker'}),cabinet({id:'R',type:'sink',x:700})];
  const fixed=closeRunGaps(p,units);
  assert.ok(!fixed.some(u=>u.type==='filler'&&u.x===600));
  assert.equal(fixed.find(u=>u.id==='L').w,600);
  assert.ok(solve({...p,units:fixed}).gaps.some(g=>g.x===600&&g.w===100));
});
test('U layout has no middle fillers; widened corner access gets opening divided doors',()=>{
  const p=initialProject();p.room.layout='U';
  const plan=solve(p);assert.deepEqual(plan.errors,[]);assert.equal(interiorFillers(p,plan.units).length,0);
  const corner=plan.units.find(u=>u.type==='corner'&&u.hand==='left');
  assert.ok(corner.w>=1075);assert.ok(frontSpecs(corner).length>=1);
  assert.ok(frontSpecs(corner).every(f=>f.x>=625&&f.w>90&&f.kind==='hinge'));
  assert.equal(plan.units.find(u=>u.type==='sink').w,800);
  assert.ok(plan.units.find(u=>u.type==='spice').w>=150&&plan.units.find(u=>u.type==='spice').w<=250);
});
test('Auditor fills repeatedly, preserves specialist sizes, and stops at fixed constraints',()=>{
  const p=initialProject();p.openings=[];p.needs={};p.room.layout='I';p.room.width=2400;
  const input=[cabinet({id:'B',w:600}),cabinet({id:'S',type:'spice',x:600,w:200}),cabinet({id:'X',type:'sink',x:900,w:800})];
  const result=repairCabinetSpace(p,input);
  assert.ok(result.audit.complete);assert.ok(result.passes<=24);
  assert.equal(result.units.find(u=>u.id==='S').w,200);
  assert.equal(result.units.find(u=>u.id==='S').x,700);
  assert.equal(result.units.find(u=>u.id==='X').x,900);
  assert.deepEqual(repairCabinetSpace(p,result.units).units,result.units,'Repair must be idempotent');
  const blocked=repairCabinetSpace(p,[cabinet({id:'H',type:'cooker',x:300}),cabinet({id:'S',type:'sink',x:1000})]);
  assert.equal(blocked.reason,'constraints');assert.ok(blocked.audit.gaps.some(g=>g.x===900&&g.w===100));
});
test('Space audit excludes room openings and all current automatic arrangements fill available walls',()=>{
  for(const layout of ['I','L','U','GALLEY']){
    const p=initialProject();p.room.layout=layout;
    const plan=solve(p),audit=auditCabinetSpace(p,plan.units);
    assert.ok(audit.complete,JSON.stringify(audit.gaps));
    for(const row of audit.rows)assert.ok(Math.abs(row.covered+row.unboxed-row.usable)<.001);
  }
  const p=initialProject();p.room.layout='I';p.needs={};p.openings=[{id:'D',wall:'A',kind:'door',x:1000,w:900,h:2100,sill:0}];
  const result=repairCabinetSpace(p,[]);
  assert.ok(result.audit.complete);
  assert.equal(result.audit.rows[0].usable,p.room.width-900-50,'Door keeps 25 mm clearance on each side');
  assert.ok(result.units.every(u=>u.x+u.w<=975+.1||u.x>=1925-.1));
});
test('Specialist insertion replaces free automatic bays, never stacks at occupied A/25',()=>{
  const p=initialProject();p.needs.oven=1;p.needs.fridge=1;p.room.width=4200;p.room.depth=3700;
  const original=solve(p).units,snapshot=JSON.stringify(original);
  for(const type of ['spice','bottle','waste','drawers']){
    const r=insertCabinet(p,original,type);assert.ok(!r.error,r.error);
    assert.equal(r.unit.w,TYPES[type].w);assert.equal(r.unit.type,type);
    assert.deepEqual(validateUnits(p,r.units),[]);assert.ok(auditCabinetSpace(p,r.units).complete);
    for(const u of original.filter(u=>!u.automatic))assert.deepEqual(r.units.find(v=>v.id===u.id),u);
  }
  for(const type of ['pantry','oven']){
    const r=insertCabinet(p,original,type);assert.match(r.error,/No clear/);
  }
  assert.equal(JSON.stringify(original),snapshot);
  const empty={...p,openings:[],needs:{}};
  for(const type of ['pantry','oven','spice','drawers'])assert.ok(insertCabinet(empty,[],type).unit,`${type} must insert where room permits`);
});
test('Specialist clear openings contain no arbitrary mid-height shelf rails or panels',()=>{
  for(const type of ['sink','drawers','spice','bottle','waste','oven']){
    const parts=carcassParts(initialProject(),[cabinet({type,h:TYPES[type].h})]);
    assert.ok(parts.some(p=>p.name==='Run rail'));
    assert.ok(!parts.some(p=>p.name.toLowerCase().includes('shelf')),`${type} opening is obstructed`);
  }
});
test('Every shelf and plinth bar terminates into another bar; shelves are four-sided',()=>{
  const units=[
    cabinet({id:'B1',x:0,w:600}),
    cabinet({id:'SINK',type:'sink',x:600,w:800}),
    cabinet({id:'B2',x:1400,w:1200}),
  ],parts=carcassParts(initialProject(),units),frames=Map.groupBy(
    parts.filter(p=>['shelf-frame','plinth-frame'].includes(p.assemblyType)),
    p=>p.assemblyId,
  );
  const overlap=(a0,a1,b0,b1,t=.001)=>Math.min(a1,b1)>=Math.max(a0,b0)-t;
  const endTouches=(bar,end,other)=>{
    const dims={x:['x','w'],y:['y','h'],z:['z','d']},axis=bar.axis,
      plane=bar[axis]+(end?bar[dims[axis][1]]:0);
    if(plane<other[axis]-.001||plane>other[axis]+other[dims[axis][1]]+.001)return false;
    return Object.keys(dims).filter(k=>k!==axis).every(k=>overlap(
      bar[k],bar[k]+bar[dims[k][1]],other[k],other[k]+other[dims[k][1]],
    ));
  };
  const shelves=[...frames].filter(([,members])=>members[0].assemblyType==='shelf-frame');
  assert.equal(shelves.length,2,'The sink must split, not receive, shelf framing');
  for(const [id,members] of frames){
    if(members[0].assemblyType==='shelf-frame'){
      for(const side of ['rear','front','left','right'])
        assert.equal(members.filter(p=>p.name===`Shelf ${side} rail`).length,1,`${id} needs one ${side} side`);
    }else assert.equal(members.length,4,`${id} plinth must be a closed rectangle`);
    for(const bar of members)for(const end of [0,1])
      assert.ok(members.some(other=>other.id!==bar.id&&endTouches(bar,end,other)),`${bar.id} ${bar.name} end ${end} is unsupported`);
  }
  for(const panel of parts.filter(p=>p.name==='Continuous U-notched shelf')){
    const frame=frames.get(panel.assemblyId)||[...frames.values()].find(m=>m[0].runId===panel.runId&&m[0].assemblyType==='shelf-frame'&&panel.x>=m[0].x-.1&&panel.x+panel.w<=m[0].x+m[0].w+.1);
    assert.ok(frame,'Shelf ACP must belong inside a structural perimeter');
    const rear=frame.find(p=>p.name==='Shelf rear rail'),front=frame.find(p=>p.name==='Shelf front rail');
    assert.ok(panel.z>=rear.z+rear.d-.001&&panel.z+panel.d<=front.z+.001);
  }
});
test('Legacy open base storage imports as closed units, preserving quantity and placed dimensions',()=>{
  const p=initialProject();p.openings=[];p.needs={open:1,base:1};
  p.units=[cabinet({type:'open',w:450})];
  const imported=parseProject(JSON.stringify(p));
  assert.equal(imported.needs.base,2);assert.ok(!imported.needs.open);
  assert.equal(imported.units[0].type,'base');assert.equal(imported.units[0].w,450);
  assert.equal(frontSpecs(imported.units[0]).length,1);
  assert.ok(!solve({...p,units:null}).units.some(u=>u.type==='open'));
  assert.match(insertCabinet(p,[],'open').error,/not allowed/);
});
test('No unframed side ACP remains; panel cuts follow the actual combined-engine upright orientation',()=>{
  const units=[cabinet(),cabinet({id:'B2',x:600})],parts=carcassParts(initialProject(),units);
  assert.ok(!parts.some(q=>q.name==='Inner end liner'));
  const ends=parts.filter(q=>q.name==='Fixed end sash infill');
  assert.equal(ends.length,2);assert.ok(ends.every(q=>q.assemblyType==='fixed-end'&&!q.outline));
  for(const post of parts.filter(q=>q.name==='Front upright')){assert.equal(post.w,25.4);assert.equal(post.d,38.1);}
  for(const post of parts.filter(q=>q.name==='Rear upright')){assert.equal(post.w,38.1);assert.equal(post.d,25.4);}
  const rear=parts.find(q=>q.name==='Continuous rear cladding');
  assert.equal(rear.x,SASH_PROFILE.depth);assert.equal(rear.w,1200-2*SASH_PROFILE.depth);
  for(const post of parts.filter(q=>q.name==='Rear upright'))assert.ok(Math.abs(post.z+post.d-rear.z)<.001,'Rear ACP is flush to turned uprights');
  for(const panel of parts.filter(q=>q.outline)){
    assert.equal(panel.notches.front.length,panel.notchSources.length);
    for(const id of panel.notchSources){
      const post=parts.find(q=>q.id===id);
      assert.ok(post.y<panel.y+panel.h&&post.y+post.h>panel.y);
      assert.ok(Math.abs(panel.notchDepth-(panel.z+panel.d-post.z+1))<.001);
      const cut=panel.notches.front.find(([a,b])=>a<=post.x-panel.x&&b>=post.x+post.w-panel.x);
      assert.ok(cut);assert.ok(Math.abs(cut[1]-cut[0]-27.4)<.001);
    }
  }
});

test("U-notches have independent front/rear positions and retain one connected sheet", () => {
  const outline = notchedOutline(600, 550, [[300, 326]], [[100, 126]], 13.2);
  assert.equal(inside([110, 5], outline), false);
  assert.equal(inside([310, 545], outline), false);
  assert.equal(inside([110, 545], outline), true);
  assert.equal(inside([310, 5], outline), true);
  assert.equal(inside([310, 270], outline), true);
});

test("Stock nesting accounts for every part, kerf and trim; blank placements never overlap", () => {
  const p = initialProject(),
    job = fabricationPlan(p, solve(p));
  assert.deepEqual(job.errors, []);
  assert.deepEqual(job.rejected, []);
  assert.equal(
    job.barNest.stocks.reduce((a, s) => a + s.cuts.length, 0),
    job.bars.length,
  );
  assert.equal(
    job.sheetNest.sheets.reduce((a, s) => a + s.placements.length, 0),
    job.panels.length,
  );
  for (const b of job.barNest.stocks) {
    assert.ok(b.remaining >= -0.001);
    assert.ok(
      Math.abs(
        b.length -
          (2 * job.settings.endTrim +
            b.remaining +
            b.cuts.reduce((n, c) => n + c.length + job.settings.barKerf, 0)),
      ) < 0.01,
    );
  }
  for (const s of job.sheetNest.sheets) {
    for (const p of s.placements) {
      assert.ok(
        p.x >= 10 &&
          p.y >= 10 &&
          p.x + p.w <= s.width - 10 + 0.001 &&
          p.y + p.h <= s.height - 10 + 0.001,
      );
      for (const [x, y] of placedOutline(p))
        assert.ok(
          x >= p.x - 0.001 &&
            x <= p.x + p.w + 0.001 &&
            y >= p.y - 0.001 &&
            y <= p.y + p.h + 0.001,
        );
    }
    for (let i = 0; i < s.placements.length; i++)
      for (let j = i + 1; j < s.placements.length; j++) {
        const a = s.placements[i],
          b = s.placements[j];
        assert.ok(
          a.x + a.w + 4 <= b.x + 0.001 ||
            b.x + b.w + 4 <= a.x + 0.001 ||
            a.y + a.h + 4 <= b.y + 0.001 ||
            b.y + b.h + 4 <= a.y + 0.001,
        );
      }
  }
  assert.ok(
    Object.keys(fabricationFiles(job)).some((k) => k.endsWith("-review.svg")),
  );
});

test("Oversize bars and panels are explicitly rejected, with rotation obeyed", () => {
  assert.equal(
    nestBars(
      [
        {
          id: "X",
          profile: "box",
          finish: "black",
          stockLength: 6000,
          length: 6000,
        },
      ],
      STOCK_DEFAULTS,
    ).rejected.length,
    1,
  );
  const p = {
    id: "P",
    material: "ACP",
    thickness: 3,
    cutW: 1000,
    cutH: 2000,
    grain: "none",
  };
  assert.equal(
    nestSheets([p], { ...STOCK_DEFAULTS, allowRotation: false }).rejected
      .length,
    1,
  );
  assert.equal(
    nestSheets([p], STOCK_DEFAULTS).sheets[0].placements[0].rotated,
    true,
  );
});

test("Toe-base frame is floor-row only and is never added below top cabinets", () => {
  const p=initialProject(),upper={id:"W1",type:"wall",wall:"A",x:0,w:600,h:720,d:350,z:1450,automatic:false},
    lower={id:"B1",type:"base",wall:"A",x:700,w:600,h:850,d:600,z:0,automatic:false};
  const upperParts=carcassParts(p,[upper]);
  assert.equal(upperParts.some(part=>part.assemblyType==="plinth-frame"),false);
  assert.equal(upperParts.some(part=>part.name.startsWith("Plinth")),false);
  assert.equal(carcassParts(p,[lower]).some(part=>part.assemblyType==="plinth-frame"),true);
});
