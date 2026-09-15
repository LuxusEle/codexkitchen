import test from "node:test";
import assert from "node:assert/strict";
import {
  initialProject,
  solve,
  auditRunGaps,
  closeRunGaps,
  gapResizeCandidates,
  resizeSelectedForCoverage,
  validateUnits,
  wallPoint,
} from "../src/model.js";
import {
  frameRuns,
  frontDivision,
  countertopPieces,
} from "../src/construction.js";

for (const layout of ["I", "L", "U", "GALLEY"])
  test(`${layout}: no unexplained base or upper run gaps`, () => {
    for (const width of [4800, 5200, 6000]) {
      const p = initialProject();
      p.room.layout = layout;
      p.room.width = width;
      const r = solve(p);
      assert.deepEqual(r.errors, []);
      assert.deepEqual(auditRunGaps(p, r.units), []);
    }
  });

test("Upper corner uses shallow wall-cabinet dimensions", () => {
  const p = initialProject(),
    r = solve(p),
    corner = r.units.find((u) => u.type === "wallCorner");
  assert.ok(corner);
  assert.equal(corner.w, 825);
  assert.equal(corner.d, 350);
  assert.equal(corner.x + corner.w, p.room.width);
  assert.deepEqual(validateUnits(p, r.units), []);
});

test("Automatic upper fill preserves the hood opening", () => {
  const p = initialProject(),
    r = solve(p);
  for (const cooker of r.units.filter((u) => u.type === "cooker"))
    for (const upper of r.units.filter(
      (u) => u.z >= 900 && u.wall === cooker.wall,
    ))
      assert.ok(
        upper.x + upper.w <= cooker.x || upper.x >= cooker.x + cooker.w,
      );
});

test("No upper row is added when the brief requests none", () => {
  const p = initialProject();
  p.needs.wall = 0;
  p.needs.glass = 0;
  p.needs.lift = 0;
  const r = solve(p);
  assert.ok(!r.units.some((u) => u.z >= 900));
  assert.deepEqual(r.gaps, []);
});

test('3850 mm straight run absorbs small end remnants into real base storage',()=>{
  const p=initialProject();p.room={width:3850,depth:1200,height:2700,layout:'I'};
  const result=solve(p),base=result.units.filter(u=>u.z<900);
  assert.ok(!base.some(u=>u.type==='filler'),JSON.stringify(base));
  const intervals=base.map(u=>[u.x,u.x+u.w]).sort((a,b)=>a[0]-b[0]);
  assert.equal(intervals[0][0],0);assert.equal(intervals.at(-1)[1],3850);
  for(let i=1;i<intervals.length;i++)assert.ok(Math.abs(intervals[i][0]-intervals[i-1][1])<.001);
  assert.deepEqual(result.gaps,[]);
});

test('Straight-kitchen tall units form blocks only at run beginnings or ends',()=>{
  const p=initialProject();p.room={width:4350,depth:2400,height:2700,layout:'I'};p.needs={fridge:1,oven:1,pantry:1,base:1};
  const result=solve(p),tall=result.units.filter(u=>['fridge','oven','pantry'].includes(u.type)).sort((a,b)=>a.x-b.x);
  assert.equal(tall.length,3);
  const components=[];
  for(const u of tall){const prior=components.at(-1);if(prior&&Math.abs(prior.end-u.x)<.1){prior.end=u.x+u.w;prior.units.push(u);}else components.push({start:u.x,end:u.x+u.w,units:[u]});}
  assert.ok(components.every(c=>Math.abs(c.start)<.1||Math.abs(c.end-p.room.width)<.1),JSON.stringify(components));
});

test('L-kitchen oven is the exposed end tower, never the internal corner tower',()=>{
  const p=initialProject();p.room={width:3950,depth:2400,height:2700,layout:'L'};
  const result=solve(p),oven=result.units.find(u=>u.type==='oven');
  assert.ok(oven);assert.equal(oven.wall,'B');
  assert.ok(Math.abs(oven.x+oven.w-(p.room.depth-25))<.1,JSON.stringify(oven));
  assert.ok(oven.x>675,'Oven must not start against the A/B internal corner');
});

test('4700 mm straight run without fridge closes multiple specialist gaps in one reflow',()=>{
  const p=initialProject();p.room={width:4700,depth:2400,height:2700,layout:'I'};p.needs.fridge=0;
  const result=solve(p),base=result.units.filter(u=>u.z<900).sort((a,b)=>a.x-b.x);
  assert.equal(base[0].type,'oven');assert.equal(base[0].x,0);
  assert.ok(!base.some(u=>u.type==='filler'));
  for(let i=1;i<base.length;i++)assert.ok(Math.abs(base[i].x-(base[i-1].x+base[i-1].w))<.001,JSON.stringify(base));
  assert.ok(Math.abs(base.at(-1).x+base.at(-1).w-4700)<.001);
  assert.deepEqual(result.gaps,[]);assert.deepEqual(auditRunGaps(p,result.units),[]);
});

test("Manual gaps are reported and repaired without moving fixed appliances", () => {
  const p = initialProject(),
    original = solve(p).units;
  const base = original.find((u) => u.type === "base" && u.automatic);
  const upper = original.find((u) => u.type === "wall" && u.automatic);
  p.units = original.filter((u) => u.id !== base.id && u.id !== upper.id);
  const snapshot = structuredClone(p.units),
    r = solve(p);
  assert.ok(r.gaps.some((g) => g.row === "base"));
  assert.ok(r.gaps.some((g) => g.row === "upper"));
  assert.ok(r.errors.some((e) => e.includes("Unfilled")));
  const fixed = closeRunGaps(p, p.units);
  assert.deepEqual(p.units, snapshot, "repair must not mutate its input");
  assert.deepEqual(auditRunGaps(p, fixed), []);
  assert.deepEqual(validateUnits(p, fixed), []);
  for (const u of original.filter((u) =>
    ["sink", "cooker", "oven", "fridge", "spice"].includes(u.type),
  ))
    assert.deepEqual(
      fixed.find((v) => v.id === u.id),
      u,
    );
  assert.deepEqual(
    closeRunGaps(p, fixed),
    fixed,
    "repeated repair is idempotent",
  );
});

test("User-selected fixed box grows into an adjacent gap and no space remains",()=>{
  const p=initialProject();
  p.room={width:2000,depth:2400,height:2700,layout:'I'};
  p.openings=[];
  p.needs=Object.fromEntries(Object.keys(p.needs).map(key=>[key,0]));
  const units=[
    {id:'D1',type:'drawers',wall:'A',x:0,w:600,h:850,d:600,z:0,automatic:false},
    {id:'S1',type:'sink',wall:'A',x:700,w:800,h:850,d:600,z:0,automatic:false},
    {id:'B1',type:'base',wall:'A',x:1500,w:500,h:850,d:600,z:0,automatic:false},
  ];
  const gaps=auditRunGaps(p,units),candidates=gapResizeCandidates(p,units,gaps);
  assert.equal(gaps.length,1);
  assert.deepEqual(candidates.map(candidate=>candidate.id),['D1'],'drawers must be offered before the last-resort sink exception');
  const unchanged=resizeSelectedForCoverage(p,units,[]);
  assert.equal(unchanged.audit.gaps.length,1);
  const fixed=resizeSelectedForCoverage(p,units,['D1']);
  assert.equal(fixed.audit.complete,true,fixed.reason);
  assert.equal(fixed.units.find(unit=>unit.id==='D1').w,700);
  assert.equal(fixed.units.find(unit=>unit.id==='S1').x,700);
  assert.deepEqual(validateUnits(p,fixed.units),[]);
  assert.equal(units[0].w,600,'input must not be mutated');
});

test("User-selected box may shrink to remove a fixed-box overlap",()=>{
  const p=initialProject();
  p.room={width:2000,depth:2400,height:2700,layout:'I'};p.openings=[];
  p.needs=Object.fromEntries(Object.keys(p.needs).map(key=>[key,0]));
  const units=[
    {id:'D1',type:'drawers',wall:'A',x:0,w:700,h:850,d:600,z:0,automatic:false},
    {id:'S1',type:'sink',wall:'A',x:650,w:800,h:850,d:600,z:0,automatic:false},
    {id:'B1',type:'base',wall:'A',x:1450,w:550,h:850,d:600,z:0,automatic:false},
  ];
  assert.ok(validateUnits(p,units).some(error=>error.includes('overlaps')));
  assert.deepEqual(gapResizeCandidates(p,units,[]).map(candidate=>candidate.id),['D1']);
  const fixed=resizeSelectedForCoverage(p,units,['D1']);
  assert.equal(fixed.audit.complete,true,fixed.reason);
  assert.equal(fixed.units.find(unit=>unit.id==='D1').w,650);
  assert.deepEqual(validateUnits(p,fixed.units),[]);
});

test("Sink width is offered only after higher-priority drawer capacity is exhausted",()=>{
  const p=initialProject();p.room={width:2020,depth:2400,height:2700,layout:'I'};p.openings=[];p.needs={};
  const units=[
    {id:'D1',type:'drawers',wall:'A',x:0,w:1100,h:850,d:600,z:0},
    {id:'S1',type:'sink',wall:'A',x:1220,w:800,h:850,d:600,z:0},
  ],candidates=gapResizeCandidates(p,units,auditRunGaps(p,units));
  assert.deepEqual(candidates.map(candidate=>candidate.id),['D1','S1']);
  assert.equal(candidates.at(-1).priority,4);
  const fixed=resizeSelectedForCoverage(p,units,['D1','S1']),sink=fixed.units.find(unit=>unit.id==='S1');
  assert.equal(fixed.audit.complete,true,fixed.reason);
  assert.equal(sink.w,850);assert.equal(sink.widthAdjustmentApproved,true);
});

test("Small end closures are valid and tall end closures match the appliance", () => {
  const p = initialProject(),
    r = solve(p),
    closures = r.units.filter((u) => u.type === "filler");
  assert.deepEqual(validateUnits(p, closures), []);
  for(const end of closures.filter(u=>u.z<900)){
    const neighbor=r.units.find(u=>u.id!==end.id&&u.wall===end.wall&&['fridge','oven','pantry'].includes(u.type)&&(Math.abs(u.x+u.w-end.x)<.1||Math.abs(end.x+end.w-u.x)<.1));
    if(neighbor){assert.equal(end.h,neighbor.h);assert.equal(end.d,neighbor.d);}
  }
});

test("Adjacent and split doors retain a consistent 3 mm reveal", () => {
  const a = frontDivision(600, 1)[0],
    b = frontDivision(850, 2);
  assert.equal(600 + b[0].x - (a.x + a.w), 3);
  assert.equal(b[1].x - (b[0].x + b[0].w), 3);
  assert.equal(850 - (b[1].x + b[1].w), 1.5);
});

test("Frame rails join through fillers and ignore unrelated height groups", () => {
  const common = { wall: "A", z: 1450, h: 720, d: 350 };
  const units = [
    { ...common, id: "1", type: "wall", x: 0, w: 600 },
    { ...common, id: "2", type: "filler", x: 600, w: 75 },
    { ...common, id: "3", type: "wall", x: 675, w: 600 },
    { ...common, id: "4", type: "lift", x: 2000, w: 600, h: 500, z: 1670 },
  ];
  const runs = frameRuns(units),
    run = runs.find((r) => r.start === 0);
  assert.equal(runs.length, 2);
  assert.equal(run.end, 1275);
  assert.equal(run.units.length, 3);
});

const contains = (s, x, y) =>
  x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.d;
test("Worktops cover base fillers, do not overlap at turns and retain the sink hole", () => {
  for (const layout of ["L", "U"]) {
    const p = initialProject();
    p.room.layout = layout;
    const r = solve(p),
      surfaces = countertopPieces(p, r.units);
    for (const filler of r.units.filter(
      (u) => u.type === "filler" && u.z === 0 && u.h < 1000,
    )) {
      const [x, y] = wallPoint(
        p.room,
        filler.wall,
        filler.x + filler.w / 2,
        filler.d / 2,
      );
      assert.ok(
        surfaces.some((s) => s.z === filler.h && contains(s, x, y)),
        `uncovered filler ${filler.id}`,
      );
    }
    for (let i = 0; i < surfaces.length; i++)
      for (let j = i + 1; j < surfaces.length; j++) {
        const a = surfaces[i],
          b = surfaces[j];
        if (a.z !== b.z) continue;
        const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const d = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
        assert.ok(
          w <= 0.01 || d <= 0.01,
          `overlapping worktops ${a.unitId}/${b.unitId}`,
        );
      }
    const sink = r.units.find((u) => u.type === "sink"),
      [x, y] = wallPoint(p.room, sink.wall, sink.x + sink.w / 2, 280);
    assert.ok(
      !surfaces.some((s) => contains(s, x, y)),
      "sink cutout must remain open",
    );
  }
});
