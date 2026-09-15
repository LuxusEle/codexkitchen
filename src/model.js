export const PROFILE = {
  width: 25.4,
  height: 38.1,
  wall: 1.2,
  sashDepth: 21.2,
  sashFace: 45,
  acp: 3,
  reveal: 3,
  stock: 6400,
};
export const TYPES = {
  sink: { name: "Sink unit", w: 800, h: 850, d: 600 },
  cooker: { name: "Hob + hood", w: 600, h: 850, d: 600 },
  drawers: { name: "Drawer bank", w: 600, h: 850, d: 600 },
  spice: { name: "Spice pullout", w: 200, h: 850, d: 600 },
  bottle: { name: "Bottle pullout", w: 300, h: 850, d: 600 },
  waste: { name: "Waste / recycling", w: 450, h: 850, d: 600 },
  dishwasher: { name: "Dishwasher bay", w: 600, h: 850, d: 600 },
  oven: { name: "Oven + microwave tower", w: 600, h: 2100, d: 650 },
  pantry: { name: "Tall pantry", w: 600, h: 2100, d: 650 },
  fridge: { name: "Fridge space", w: 900, h: 2100, d: 700 },
  base: { name: "Base storage", w: 600, h: 850, d: 600 },
  open: { name: "Open base shelves", w: 450, h: 850, d: 600 },
  wall: { name: "Wall cabinet", w: 600, h: 720, d: 350, z: 1450 },
  glass: { name: "Glass wall cabinet", w: 600, h: 720, d: 350, z: 1450 },
  lift: { name: "Lift-up wall cabinet", w: 600, h: 500, d: 350, z: 1450 },
  corner: { name: "Blind corner", w: 1075, h: 850, d: 600 },
  filler: { name: "Closure / filler", w: 50, h: 850, d: 600 },
};
export const CHECKS = [
  "Confirm all wall measurements",
  "Measure window sills and opening heights",
  "Mark water inlet and waste outlet",
  "Mark sockets, gas and hood duct",
  "Check ceiling, beams and wall squareness",
  "Confirm appliance models and clearances",
];
TYPES.wallCorner = {
  name: "Upper blind corner",
  w: 825,
  h: 720,
  d: 350,
  z: 1450,
};
// Lift fronts share the same top datum as the rest of the upper row.
TYPES.lift.z = 1670;
export function initialProject() {
  return {
    version: 1,
    name: "My aluminum kitchen",
    room: { width: 4800, depth: 3600, height: 2700, layout: "L" },
    openings: [
      {
        id: "window-1",
        wall: "A",
        kind: "window",
        x: 1000,
        w: 1500,
        h: 1000,
        sill: 1050,
      },
      {
        id: "door-1",
        wall: "C",
        kind: "door",
        x: 600,
        w: 900,
        h: 2100,
        sill: 0,
      },
    ],
    checks: [],
    notes: "",
    reminder: "",
    needs: {
      sink: 1,
      cooker: 1,
      drawers: 1,
      spice: 1,
      oven: 1,
      fridge: 1,
      wall: 3,
      glass: 1,
    },
    preferences: {},
    units: null,
    island: false,
    islandConfig: {
      kind: "island",
      x: null,
      y: null,
      rotation: 0,
      width: 1200,
      depth: 700,
      overhang: 300,
      pendants: 3,
      slatted: true,
    },
    style: {
      front: "#c2c9c6",
      frame: "#667477",
      counter: "#eceae2",
      wall: "#eff1ee",
      mode: "premium",
      finish: "matte",
      lighting: "Warm under-cabinet lighting with soft daylight",
      scene: "A clean contemporary home; minimal countertop accessories",
    },
  };
}
export const wallLength = (room, wall) =>
  ["A", "C"].includes(wall) ? room.width : room.depth;
export function islandSettings(p) {
  const raw=p.islandConfig||{},kind=raw.kind==='breakfast'?'breakfast':'island',
    width=Math.max(600,Math.min(3000,Number(raw.width)||1200)),depth=Math.max(450,Math.min(1200,Number(raw.depth)||700)),
    rotation=Math.abs(Number(raw.rotation))%180===90?90:0,overhang=Math.max(0,Math.min(600,Number(raw.overhang)??300)),
    physicalDepth=depth+(kind==='breakfast'?overhang:0),footprintW=rotation===90?physicalDepth:width,footprintD=rotation===90?width:physicalDepth;
  return {
    kind,width,depth,physicalDepth,footprintW,footprintD,rotation,overhang,
    pendants:Math.max(1,Math.min(5,Math.round(Number(raw.pendants)||3))),
    slatted:raw.slatted!==false,
    x:Number.isFinite(raw.x)?Math.max(0,Math.min(p.room.width-footprintW,raw.x)):(p.room.width-footprintW)/2,
    y:Number.isFinite(raw.y)?Math.max(0,Math.min(p.room.depth-footprintD,raw.y)):(p.room.depth-footprintD)/2,
  };
}
export function wallPoint(room, wall, x, d = 0) {
  switch (wall) {
    case "A":
      return [x, d];
    case "B":
      return [room.width - d, x];
    case "C":
      return [room.width - x, room.depth - d];
    default:
      return [d, room.depth - x];
  }
}
export const activeWalls = (layout) =>
  ({ I: ["A"], L: ["A", "B"], U: ["D", "A", "B"], GALLEY: ["A", "C"] })[
    layout
  ] || ["A"];
// Exposed ends of the connected cabinet run. Ends beside an L/U corner are
// internal junctions, so a tall tower must never be anchored there.
const tallOuterEnds = (layout, wall) =>
  ({
    I: { A: ["left", "right"] },
    L: { A: ["left"], B: ["right"] },
    U: { D: ["left"], B: ["right"] },
    GALLEY: { A: ["left", "right"], C: ["left", "right"] },
  })[layout]?.[wall] || [];
export function subtract(spans, cut) {
  return spans.flatMap(([a, b]) =>
    cut[1] <= a || cut[0] >= b
      ? [[a, b]]
      : [
          [a, Math.max(a, cut[0])],
          [Math.min(b, cut[1]), b],
        ].filter(([x, y]) => y - x > 0.01),
  );
}
const overlap = (a, b) => a[0] < b[1] - 0.1 && b[0] < a[1] - 0.1;
export function roomErrors(p) {
  let e = [];
  if(!['I','L','U','GALLEY'].includes(p.room.layout))e.push('Unsupported kitchen arrangement.');
  for (const [k, min, max] of [
    ["width", 1200, 12000],
    ["depth", 1200, 12000],
    ["height", 1800, 4500],
  ])
    if (!Number.isFinite(p.room[k]) || p.room[k] < min || p.room[k] > max)
      e.push(`Room ${k} must be ${min}–${max} mm.`);
  for (const o of p.openings) {
    if (
      !["A", "B", "C", "D"].includes(o.wall) ||
      !["window", "door"].includes(o.kind) ||
      ![o.x, o.w, o.h, o.sill].every(Number.isFinite) ||
      o.x < 0 ||
      o.w < 100 ||
      o.h < 100 ||
      o.sill < 0 ||
      o.x + o.w > wallLength(p.room, o.wall) + 0.1 ||
      o.sill + o.h > p.room.height + 0.1
    )
      e.push(`${o.kind} on wall ${o.wall} must fit within the wall.`);
  }
  p.openings.forEach((o, i) =>
    p.openings.slice(i + 1).forEach((q) => {
      if (
        q.wall === o.wall &&
        overlap([o.x, o.x + o.w], [q.x, q.x + q.w]) &&
        overlap([o.sill, o.sill + o.h], [q.sill, q.sill + q.h])
      )
        e.push(`Openings overlap on wall ${o.wall}.`);
    }),
  );
  return [...new Set(e)];
}
function blocked(p, wall, z, h, type) {
  return p.openings
    .filter(
      (o) =>
        o.wall === wall &&
        (type === "cooker"
          ? o.sill < 2250 && o.sill + o.h > 850
          : overlap([z, z + h], [o.sill, o.sill + o.h])),
    )
    .map((o) => [Math.max(0, o.x - 25), o.x + o.w + 25]);
}
export function footprint(p, u) {
  if (u.wall === "Island") {
    const base=islandSettings(p),c={...base,x:u.islandX??u.ix??base.x,y:u.islandY??u.iy??base.y,rotation:u.islandRotation??base.rotation,width:u.islandWidth??base.width},
      physicalDepth=u.d+((u.featureKind??c.kind)==='breakfast'?(u.islandOverhang??c.overhang):0);
    if(c.rotation===90)return [c.x,c.y+c.width-(u.x+u.w),c.x+physicalDepth,c.y+c.width-u.x];
    return [c.x+u.x,c.y,c.x+u.x+u.w,c.y+physicalDepth];
  }
  let a = wallPoint(p.room, u.wall, u.x, 0),
    b = wallPoint(p.room, u.wall, u.x + u.w, u.d);
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
  ];
}
export const minimumCabinetWidth=u=>u.type==='filler' ? 0.1 : u.type==='spice'?150:300;
export const maximumCabinetWidth=u=>u.type==='spice'?250:1600;
export function validateUnits(p, units) {
  let errors = [...roomErrors(p)];
  for (const u of units) {
    if (
      !TYPES[u.type] ||
      !Number.isFinite(u.w) ||
      u.w < minimumCabinetWidth(u) ||
      u.w > maximumCabinetWidth(u) ||
      !Number.isFinite(u.x) ||
      !Number.isFinite(u.z) ||
      !Number.isFinite(u.h) ||
      !Number.isFinite(u.d) ||
      u.h < 100 ||
      u.d < 100
    ) {
      errors.push(`Invalid dimensions for ${u.id}. Minimum ${u.type==='filler'?'closure':u.type} width: ${minimumCabinetWidth(u)} mm.`);
      continue;
    }
    if(u.doorDivisions!==undefined&&u.doorDivisions!==0&&(!Number.isInteger(u.doorDivisions)||u.doorDivisions<1||u.doorDivisions>6))errors.push(`Invalid door divisions for ${u.id}.`);
    if(u.frontMaterial&&!['acp','glass'].includes(u.frontMaterial))errors.push(`Invalid front material for ${u.id}.`);
    if(u.frontColor&&!/^#[0-9a-f]{6}$/i.test(u.frontColor))errors.push(`Invalid front colour for ${u.id}.`);
    if(u.type==='cooker'&&Math.abs(u.w-TYPES.cooker.w)>.1)errors.push(`Cooker ${u.id} width is fixed at ${TYPES.cooker.w} mm; the hood follows the same width.`);
    if(u.type==='sink'&&Math.abs(u.w-TYPES.sink.w)>.1&&!u.widthAdjustmentApproved)errors.push(`Sink ${u.id} width is fixed at ${TYPES.sink.w} mm unless a minor space-resolver adjustment is approved.`);
    const accessWidth=u.w-(u.type==='corner'?625:u.type==='wallCorner'?375:0);
    if(u.doorDivisions>0&&u.type!=='drawers'&&(accessWidth/u.doorDivisions-3)<=90)errors.push(`Door divisions for ${u.id} leave a leaf too narrow for the 45 mm sash.`);
    let f = footprint(p, u);
    if (
      f[0] < -0.1 ||
      f[1] < -0.1 ||
      f[2] > p.room.width + 0.1 ||
      f[3] > p.room.depth + 0.1 ||
      u.z < 0 ||
      u.z + u.h > p.room.height
    )
      errors.push(`${TYPES[u.type].name} ${u.id} is outside the room.`);
    if (
      u.wall !== "Island" &&
      blocked(p, u.wall, u.z, u.h, u.type).some((b) =>
        overlap(b, [u.x, u.x + u.w]),
      )
    )
      errors.push(`${TYPES[u.type].name} ${u.id} conflicts with an opening.`);
    if(u.type==='cooker'&&u.wall!=='Island'){
      const domain=legalRunSpans(p,units,u.wall,false).find(([a,b])=>u.x>=a-.1&&u.x+u.w<=b+.1);
      if(!domain||u.x-domain[0]<300-.1||domain[1]-(u.x+u.w)<300-.1)
        errors.push(`Cooker ${u.id} must stay within the run with at least 300 mm of cabinet space on both sides.`);
    }
  }
  units.forEach((a, i) =>
    units.slice(i + 1).forEach((b) => {
      if (!overlap([a.z, a.z + a.h], [b.z, b.z + b.h])) return;
      const f = footprint(p, a),
        g = footprint(p, b);
      if (
        overlap([f[0], f[2]], [g[0], g[2]]) &&
        overlap([f[1], f[3]], [g[1], g[3]])
      )
        errors.push(`${a.id} overlaps ${b.id}.`);
    }),
  );
  for(const u of interiorFillers(p,units))errors.push(`${u.id}: middle filler on wall ${u.wall}; use Close run gaps to redistribute cabinet widths.`);
  return [...new Set(errors)];
}
export function closeLegacyBaseUnits(p){
  if(!(p.needs.open>0)&&!p.units?.some(u=>u.type==='open'&&u.z<900))return p;
  const needs={...p.needs,base:(p.needs.base||0)+(p.needs.open||0)};
  delete needs.open;
  return {...p,needs,preferences:{...p.preferences,base:p.preferences?.base||p.preferences?.open||''},units:p.units?.map(u=>u.type==='open'&&u.z<900?{...u,type:'base'}:u)||null};
}
export function solve(p) {
  p=closeLegacyBaseUnits(p);
  const errors = roomErrors(p);
  if (errors.length) return { units: [], errors, unmet: [], warnings: [] };
  if (p.units) {
    const gaps = auditRunGaps(p, p.units);
    return {
      units: p.units,
      errors: [...validateUnits(p, p.units), ...gaps.map((g) => g.message)],
      gaps,
      unmet: missing(p, p.units),
      warnings: [
        "Manual arrangement. Use Close run gaps to fill empty spans without resetting the brief.",
      ],
    };
  }
  const walls = activeWalls(p.room.layout),
    units = [],
    unmet = [];
  let n = 0;
  const add = (type, wall, x, w, extra = {}) => {
    const t = TYPES[type],
      u = {
        id: `K${String(++n).padStart(2, "0")}`,
        type,
        wall,
        x,
        w: w ?? t.w,
        h: t.h,
        d: t.d,
        z: t.z || 0,
        ...extra,
      };
    units.push(u);
    return u;
  };
  // A owns blind corners; perpendicular return starts beyond the shared footprint.
  const reserve = {
    A: [25, p.room.width - 25],
    B: [25, p.room.depth - 25],
    C: [25, p.room.width - 25],
    D: [25, p.room.depth - 25],
  };
  if (["L", "U"].includes(p.room.layout)) {
    if (p.room.width < 2200 || p.room.depth < 1900)
      return {
        units: [],
        errors: ["This corner arrangement needs at least 2200 × 1900 mm."],
        unmet: [],
        warnings: [],
      };
    add("corner", "A", p.room.width - 1075, 1075, { hand: "right" });
    reserve.A[1] = p.room.width - 1075;
    reserve.B[0] = 675;
  }
  if (p.room.layout==='U') {
    if (p.room.width < 3000)
      return {
        units: [],
        errors: ["A U kitchen needs at least 3000 mm room width in UAT 1."],
        unmet: [],
        warnings: [],
      };
    add("corner", "A", 0, 1075, { hand: "left" });
    reserve.A[0] = 1075;
    reserve.D[1] = p.room.depth - 675;
  }
  function spaces(wall, type) {
    let t = TYPES[type],
      upper = (t.z || 0) > 900,
      sp = upper ? legalRunSpans(p, units, wall, true) : [reserve[wall]];
    for (const b of blocked(p, wall, t.z || 0, t.h, type)) sp = subtract(sp, b);
    for (const u of units.filter(
      (u) =>
        u.wall === wall &&
        overlap([u.z, u.z + u.h], [t.z || 0, (t.z || 0) + t.h]),
    ))
      sp = subtract(sp, [u.x, u.x + u.w]);
    return sp;
  }
  const baseOrder = [
    "oven",
    "fridge",
    "pantry",
    "sink",
    "cooker",
    "dishwasher",
    "spice",
    "bottle",
    "waste",
    "drawers",
    "open",
    "base",
  ];
  const placeRequested = (order) => { for (const type of order) {
    if (type === "wall") addUpperCorners(p, units, add);
    for (let j = 0; j < (p.needs[type] || 0); j++) {
      const t = TYPES[type],
        preferred = p.preferences[type],
        choices = preferred ? walls.filter((w) => w === preferred) : [...walls];
      let candidates = [];
      for (const wall of choices) {
        for (const [a, b] of spaces(wall, type)) {
          const policy=widthAdjustmentPolicy({type,w:t.w}),candidateW=policy&&!['sink','drawers'].includes(type)?Math.min(t.w,b-a):t.w;
          if (b - a + 0.1 < candidateW||candidateW<(policy?.min??t.w)-.1) continue;
          let x = a;
          let score = (b - a - candidateW) / 10000;
          if (["fridge", "oven", "pantry"].includes(type)) {
            const tallUnits=units.filter(u=>u.wall===wall&&["fridge","oven","pantry"].includes(u.type));
            const outer=tallOuterEnds(p.room.layout,wall),
              leftAnchor=(outer.includes('left')&&Math.abs(a-reserve[wall][0])<.1)||tallUnits.some(u=>Math.abs(u.x+u.w-a)<.1),
              rightAnchor=(outer.includes('right')&&Math.abs(b-reserve[wall][1])<.1)||tallUnits.some(u=>Math.abs(u.x-b)<.1);
            // Tall units form blocks from the beginning/end of the usable run.
            // Do not drop an oven tower into the middle of worktop cabinets.
            for(const xx of [...new Set([...(leftAnchor?[a]:[]),...(rightAnchor?[b-candidateW]:[])])])
              candidates.push({wall,x:xx,w:candidateW,score:score-(wall==="B"?2:0)});
            continue;
          }
          if(type==='cooker'){
            x=a+(b-a-t.w)/2;
            const domain=legalRunSpans(p,units,wall,false).find(([da,db])=>x>=da-.1&&x+t.w<=db+.1);
            if(!domain||x-domain[0]<300-.1||domain[1]-(x+t.w)<300-.1)continue;
            const sink=units.find(u=>u.type==='sink'&&u.wall===wall),runMiddle=(domain[0]+domain[1])/2;
            score+=Math.abs(x+t.w/2-runMiddle)/1000+(wall==='B'?-1.5:0);
            if(sink&&Math.abs((x+t.w/2)-(sink.x+sink.w/2))<600)score+=5;
            candidates.push({wall,x,w:t.w,score});
            continue;
          }
          if (type === "sink") {
            const win = p.openings.find(
              (o) => o.wall === wall && o.kind === "window" && o.sill >= t.h,
            );
            if (win) {
              x = Math.max(a, Math.min(b - t.w, win.x + win.w / 2 - t.w / 2));
              score -= 10;
            }
          }
          if(type==='spice'&&units.some(u=>u.type==='cooker'&&u.wall===wall))score+=2;
          candidates.push({ wall, x, w:candidateW, score });
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      if (candidates.length) add(type, candidates[0].wall, candidates[0].x,candidates[0].w);
      else unmet.push(`${t.name}${preferred ? ` on wall ${preferred}` : ""}`);
    }
  }};
  // Finish the floor-standing row before positioning wall cabinets. The
  // straight-run normalizer may move the cooker to eliminate several small
  // gaps; its final position is the datum for the hood opening above.
  placeRequested(baseOrder);
  fillUntilStable(p, units, add, true, [false]);
  // Some small closures are discovered before the ordinary storage bay that
  // can absorb them exists. Revisit only generated END closures once all bays
  // have been created; impossible closures remain explicit.
  if(absorbGeneratedEndClosures(p,units))fillUntilStable(p,units,add,true,[false]);
  if(['I','GALLEY'].includes(p.room.layout))normalizeStraightBaseRuns(p,units);
  placeRequested(["wall", "glass", "lift"]);
  fillUntilStable(p, units, add, true, [true]);
  if (p.island) {
    const c=islandSettings(p),bayCount=Math.max(1,Math.ceil(c.width/600)),bayW=c.width/bayCount,
      common={ix:c.x,iy:c.y,islandX:c.x,islandY:c.y,islandRotation:c.rotation,islandWidth:c.width,islandOverhang:c.overhang,islandPhysicalDepth:c.physicalDepth,featureKind:c.kind,d:c.depth};
    for(let i=0;i<bayCount;i++)add(i===0?"drawers":"base","Island",i*bayW,bayW,common);
  }
  const problems = validateUnits(p, units);
  const warnings = [];
  if (p.island) {
    const island = units.filter((u) => u.wall === "Island");
    const others = units.filter((u) => u.wall !== "Island" && u.z < 900);
    let min = Infinity;
    for (const a of island)
      for (const b of others) {
        const f = footprint(p, a),
          g = footprint(p, b),
          dx = Math.max(0, g[0] - f[2], f[0] - g[2]),
          dy = Math.max(0, g[1] - f[3], f[1] - g[3]);
        min = Math.min(min, Math.hypot(dx, dy));
      }
    if (min < 900)
      problems.push(
        `Island clearance is only ${Math.round(min)} mm; enlarge the room or remove the island (UAT minimum 900 mm).`,
      );
  }
  if (units.some((u) => u.type === "filler" && u.w > 100))
    warnings.push("A closure exceeds 100 mm. Review adjacent cabinet widths.");
  const gaps = auditRunGaps(p, units);
  problems.push(...gaps.map((g) => g.message));
  return { units, errors: [...new Set(problems)], unmet, warnings, gaps };
}
const upperWanted = (p,units=[]) =>
  ["wall", "glass", "lift"].some((t) => (p.needs[t] || 0) > 0)||units.some(u=>u.z>=900);
const isUpper = (u) => u.z >= 900;
function upperBlockers(p, units, wall) {
  return units
    .filter((u) => u.wall === wall && u.type === "cooker")
    .map((u) => [u.x, u.x + u.w]);
}
// Legal span domains are shared by filling and auditing. Openings and occupied
// perpendicular footprints are explicit exclusions, not unexplained gaps.
export function legalRunSpans(p, units, wall, upper) {
  const z = upper ? 1450 : 0,
    h = upper ? 720 : 850,
    d = upper ? 350 : 600;
  let spans = [[0, wallLength(p.room, wall)]];
  for (const b of blocked(p, wall, z, h, upper ? "wall" : "base"))
    spans = subtract(spans, b);
  if (upper)
    for (const b of upperBlockers(p, units, wall)) spans = subtract(spans, b);
  for (const u of units.filter(
    (u) =>
      u.wall !== wall &&
      u.wall !== "Island" &&
      overlap([u.z, u.z + u.h], [z, z + h]),
  )) {
    const f = footprint(p, u);
    let along, depth;
    if (wall === "A") {
      along = [f[0], f[2]];
      depth = [f[1], f[3]];
    } else if (wall === "B") {
      along = [f[1], f[3]];
      depth = [p.room.width - f[2], p.room.width - f[0]];
    } else if (wall === "C") {
      along = [p.room.width - f[2], p.room.width - f[0]];
      depth = [p.room.depth - f[3], p.room.depth - f[1]];
    } else {
      along = [p.room.depth - f[3], p.room.depth - f[1]];
      depth = [f[0], f[2]];
    }
    if (overlap(depth, [0, d])) spans = subtract(spans, along);
  }
  return spans;
}
function addUpperCorners(p, units, add) {
  if (!upperWanted(p) || !["L", "U"].includes(p.room.layout)) return;
  for (const hand of p.room.layout==='U' ? ["right", "left"] : ["right"]) {
    const t = TYPES.wallCorner,
      x = hand === "right" ? p.room.width - t.w : 0;
    if (units.some((u) => u.type === "wallCorner" && u.hand === hand)) continue;
    const u = {
      ...t,
      id: "upper-corner-candidate",
      type: "wallCorner",
      wall: "A",
      x,
      z: t.z,
      hand,
    };
    const blockers = [
      ...blocked(p, "A", t.z, t.h, "wall"),
      ...upperBlockers(p, units, "A"),
    ];
    if (
      blockers.some((b) => overlap(b, [x, x + t.w])) ||
      validateUnits(p, [...units, u]).length
    )
      continue;
    add("wallCorner", "A", x, t.w, { hand, automatic: true });
  }
}
function rowGaps(p, units, wall, upper) {
  let spans = legalRunSpans(p, units, wall, upper);
  const z = upper ? 1450 : 0,
    h = upper ? 720 : 850;
  for (const u of units.filter(
    (u) => u.wall === wall && overlap([u.z, u.z + u.h], [z, z + h]),
  ))
    spans = subtract(spans, [u.x, u.x + u.w]);
  return spans;
}
export function auditRunGaps(p, units) {
  if (roomErrors(p).length) return [];
  const gaps = [];
  for (const upper of [false, true]) {
    if (upper && !upperWanted(p,units)) continue;
    for (const wall of activeWalls(p.room.layout)) {
      for (const [a, b] of rowGaps(p, units, wall, upper)) {
        if (b - a > 0.1)
          gaps.push({
            wall,
            row: upper ? "upper" : "base",
            x: a,
            w: b - a,
            message: `Unfilled ${upper ? "upper" : "base"} run on wall ${wall}: ${Math.round(b - a)} mm at ${Math.round(a)} mm.`,
          });
      }
    }
  }
  return gaps;
}
export function interiorFillers(p,units){
  return units.filter(u=>u.type==='filler'&&u.wall!=='Island'&&legalRunSpans(p,units,u.wall,isUpper(u)).some(([a,b])=>{
    const row=units.filter(v=>v.type!=='filler'&&v.wall===u.wall&&isUpper(v)===isUpper(u)&&v.x>=a-.1&&v.x+v.w<=b+.1);
    return row.some(v=>v.x+v.w<=u.x+.1)&&row.some(v=>v.x>=u.x+u.w-.1);
  }));
}
const adjustableStorage = new Set(['base','wall','glass','open']);
const movableStorage = new Set(['drawers','spice','bottle','waste','pantry','lift']);
// Pass a small gap through a contiguous storage row to an ordinary bay.
// Specialist widths/front divisions are never changed; fixed appliances and
// corner ownership are barriers. Validate the whole candidate before applying.
function absorbStorageGap(p,units,wall,upper,a,b,automatic=false){
  const width=b-a;
  for(const direction of [-1,1]){
    let edge=direction===-1?a:b;
    const moving=[];
    for(let i=0;i<units.length;i++){
      const next=units.find(u=>u.wall===wall&&isUpper(u)===upper&&!moving.includes(u)&&Math.abs((direction===-1?u.x+u.w:u.x)-edge)<.1);
      if(!next)break;
      const corner=['corner','wallCorner'].includes(next.type)&&(direction===-1?next.hand==='left':next.hand==='right');
      if((adjustableStorage.has(next.type)||corner)&&next.w+width<=(corner?1600:1200)){
        const changed=new Map(moving.map(u=>[u.id,{...u,x:u.x-direction*width}]));
        changed.set(next.id,{...next,x:next.x+(direction===1?-width:0),w:next.w+width});
        const before=new Set(validateUnits(p,units));
        const candidate=units.map(u=>changed.get(u.id)||u);
        if(validateUnits(p,candidate).some(e=>!before.has(e)))break;
        for(const u of units)if(changed.has(u.id))Object.assign(u,changed.get(u.id));
        return true;
      }
      if(!movableStorage.has(next.type)&&!(automatic&&['oven','fridge','dishwasher'].includes(next.type)))break;
      moving.push(next);
      edge=direction===-1?next.x:next.x+next.w;
    }
  }
  return false;
}
function fillRunGaps(p, units, add, automatic=false, rows=[false,true]) {
  for (const upper of rows) {
    if (upper && !upperWanted(p,units)) continue;
    for (const wall of activeWalls(p.room.layout)) {
      const z = upper ? 1450 : 0;
      // Create real cabinet bays before resolving small edge remnants. That
      // gives the absorber a storage bay to grow instead of freezing a fake
      // filler merely because the gaps were encountered left-to-right.
      const gaps=rowGaps(p, units, wall, upper).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
      for (const [a, b] of gaps) {
        let width = b - a;
        if (width < 0.1) continue;
        const neighbors = units.filter(
          (u) =>
            u.wall === wall &&
            isUpper(u) === upper &&
            (Math.abs(u.x + u.w - a) < 0.1 || Math.abs(u.x - b) < 0.1),
        );
        const middle=neighbors.some(u=>Math.abs(u.x+u.w-a)<.1)&&neighbors.some(u=>Math.abs(u.x-b)<.1);
        // Only ordinary storage or a corner's accessible side may grow.
        // Never stretch purchased pullouts, drawer banks or appliance towers.
        const adjustable = [...neighbors].sort((a,b)=>Number(['corner','wallCorner'].includes(a.type))-Number(['corner','wallCorner'].includes(b.type))).find(
          (u) =>
            ["base", "wall", "glass", "open", ...(middle?['corner','wallCorner']:[])].includes(u.type) &&
            u.w + width <= (['corner','wallCorner'].includes(u.type)?1600:1200) &&
            (!['corner','wallCorner'].includes(u.type)||(u.hand==='left'?Math.abs(u.x+u.w-a)<.1:Math.abs(u.x-b)<.1)) &&
            width < 300,
        );
        if (adjustable) {
          if (Math.abs(adjustable.x - b) < 0.1) adjustable.x = a;
          adjustable.w += width;
          continue;
        }
        // Small closures are explicit parts, with adjacent tall heights/depths.
        if (width < 300) {
          // During automatic generation, carry an end remnant through a
          // contiguous specialist/appliance row into an adjustable storage
          // bay. This avoids fake 25/75 mm end panels in otherwise full runs.
          if(absorbStorageGap(p,units,wall,upper,a,b,automatic))continue;
          // Never hide a mid-run gap behind a fixed panel. If both neighbours
          // are fixed appliances, leave a visible design issue for adjustment.
          if(middle)continue;
          const neighbor =
            neighbors.find((u) =>
              ["fridge", "oven", "pantry"].includes(u.type),
            ) || neighbors[0];
          const h = upper ? 720 : neighbor?.h || 850,
            d = neighbor?.d || (upper ? 350 : 600);
          add("filler", wall, a, width, {
            z,
            h,
            d,
            automatic: true,
            closure: true,
          });
          continue;
        }
        // Use the widest practical storage bays so a 600–1200 mm opening gets
        // two sash leaves without a structural box-bar post at their meeting.
        const count = Math.ceil(width / 1200),
          w = width / count;
        for (let i = 0; i < count; i++)
          add(upper ? "wall" : "base", wall, a + i * w, w, { automatic: true });
      }
    }
  }
}
function absorbGeneratedEndClosures(p,units){
  let changed=false;
  for(const filler of [...units.filter(u=>u.type==='filler'&&u.automatic)]){
    const upper=isUpper(filler),domain=legalRunSpans(p,units,filler.wall,upper).find(([a,b])=>filler.x>=a-.1&&filler.x+filler.w<=b+.1);
    if(!domain||!(Math.abs(filler.x-domain[0])<.1||Math.abs(filler.x+filler.w-domain[1])<.1))continue;
    const index=units.indexOf(filler);units.splice(index,1);
    if(!absorbStorageGap(p,units,filler.wall,upper,filler.x,filler.x+filler.w,true))units.splice(index,0,filler);
    else changed=true;
  }
  return changed;
}
function normalizeStraightBaseRuns(p,units){
  const snapshot=units.map(u=>({...u}));
  let changed=false;
  for(const wall of activeWalls(p.room.layout))for(const [a,b] of legalRunSpans(p,units,wall,false)){
    const inDomain=u=>u.wall===wall&&u.z<900&&u.x>=a-.1&&u.x+u.w<=b+.1;
    for(let i=units.length-1;i>=0;i--)if(inDomain(units[i])&&units[i].type==='filler'&&units[i].automatic){units.splice(i,1);changed=true;}
    const row=units.filter(u=>inDomain(u)&&u.type!=='filler');
    if(!row.length)continue;
    const tall=row.filter(u=>['fridge','oven','pantry'].includes(u.type));
    const left=tall.filter(u=>u.x-a<=b-(u.x+u.w)).sort((x,y)=>x.x-y.x),right=tall.filter(u=>!left.includes(u)).sort((x,y)=>x.x-y.x);
    const body=row.filter(u=>!tall.includes(u)),storage=body.filter(u=>u.type==='base'),fixed=body.filter(u=>u.type!=='base');
    const storageWidth=b-a-[...left,...right,...fixed].reduce((sum,u)=>sum+u.w,0);
    // A remaining opening wider than one 1200 mm door bay needs another real
    // storage cabinet, not two separated 75/125 mm holes or a fake filler.
    const requiredStorage=Math.ceil(Math.max(0,storageWidth)/1200);
    while(storage.length<requiredStorage){
      let suffix=1,id;
      do{id=`AUTO-BASE-${wall}-${suffix++}`}while(units.some(u=>u.id===id));
      const added={id,type:'base',wall,x:a,w:600,h:TYPES.base.h,d:TYPES.base.d,z:0,automatic:true};
      units.push(added);row.push(added);body.push(added);storage.push(added);changed=true;
    }
    if((!storage.length&&Math.abs(storageWidth)>.1)||storageWidth<storage.length*300-.1||storageWidth>storage.length*1200+.1){units.splice(0,units.length,...snapshot);return false;}
    const each=storage.length?storageWidth/storage.length:0,orders=[];
    const permute=(prefix,rest)=>{
      if(orders.length>=50000)return;
      if(!rest.length){orders.push(prefix);return;}
      for(let i=0;i<rest.length;i++)permute([...prefix,rest[i]],[...rest.slice(0,i),...rest.slice(i+1)]);
    };
    if(body.length<=8)permute([],body);else orders.push([...body].sort((x,y)=>x.x-y.x));
    let best=null;
    for(const order of orders){
      let cursor=a;const placement=new Map(),sequence=[...left,...order,...right];
      for(const u of sequence){const w=u.type==='base'?each:u.w;placement.set(u.id,{x:cursor,w});cursor+=w;}
      if(Math.abs(cursor-b)>.1)continue;
      const candidate=units.map(u=>placement.has(u.id)?{...u,...placement.get(u.id)}:{...u});
      if(validateUnits(p,candidate).length)continue;
      const score=sequence.reduce((sum,u)=>sum+Math.abs(placement.get(u.id).x-u.x)*(u.type==='base'?1:5),0);
      if(!best||score<best.score)best={score,placement};
    }
    if(!best){units.splice(0,units.length,...snapshot);return false;}
    for(const u of row){const next=best.placement.get(u.id);if(Math.abs(u.x-next.x)>.1||Math.abs(u.w-next.w)>.1)changed=true;Object.assign(u,next);}
  }
  if(validateUnits(p,units).length){units.splice(0,units.length,...snapshot);return false;}
  return changed;
}
export function auditCabinetSpace(p,units){
  const errors=roomErrors(p);
  if(errors.length)return {rows:[],gaps:[],errors,complete:false};
  const gaps=auditRunGaps(p,units),rows=[];
  for(const upper of [false,true]){
    if(upper&&!upperWanted(p,units))continue;
    for(const wall of activeWalls(p.room.layout)){
      const domains=legalRunSpans(p,units,wall,upper);
      const free=rowGaps(p,units,wall,upper);
      const usable=domains.reduce((s,[a,b])=>s+b-a,0),unboxed=free.reduce((s,[a,b])=>s+b-a,0);
      rows.push({wall,row:upper?'upper':'base',usable,unboxed,covered:usable-unboxed,domains,free});
    }
  }
  const conflicts=validateUnits(p,units);
  return {rows,gaps,errors:conflicts,complete:gaps.length===0&&conflicts.length===0};
}
export function widthAdjustmentPolicy(u){
  if(['base','wall','glass','open','waste','pantry','lift'].includes(u.type))
    return {priority:1,label:'Flexible door unit',min:minimumCabinetWidth(u),max:1200};
  if(u.type==='spice')return {priority:2,label:'Spice pullout 150–250 mm',min:150,max:250};
  if(u.type==='drawers')return {priority:3,label:'Drawers — adjust after door units',min:300,max:1200};
  if(u.type==='sink')return {priority:4,label:'Sink exception — last, approval required',min:TYPES.sink.w-50,max:TYPES.sink.w+50,lastResort:true};
  return null;
}
function rowBoxOverlaps(units){
  const overlaps=[];
  for(const wall of ['A','B','C','D'])for(const upper of [false,true]){
    const row=units.filter(u=>u.wall===wall&&isUpper(u)===upper).sort((a,b)=>a.x-b.x);
    for(let i=0;i<row.length;i++)for(let j=i+1;j<row.length&&row[j].x<row[i].x+row[i].w-.1;j++){
      const amount=Math.min(row[i].x+row[i].w,row[j].x+row[j].w)-Math.max(row[i].x,row[j].x);
      if(amount>.1)overlaps.push({wall,row:upper?'upper':'base',left:row[i],right:row[j],amount});
    }
  }
  return overlaps;
}
export function gapResizeCandidates(p,units,gaps=auditRunGaps(p,units)){
  const found=new Map();
  const addByHierarchy=(options,required,capacityKey)=>{
    let remaining=required;
    for(const priority of [...new Set(options.map(option=>option.priority))].sort((a,b)=>a-b)){
      const tier=options.filter(option=>option.priority===priority);
      for(const option of tier)found.set(option.id,option);
      remaining-=tier.reduce((sum,option)=>sum+option[capacityKey],0);
      if(remaining<=.1)break;
    }
  };
  for(const gap of gaps){
    const upper=gap.row==='upper',left=gap.x,right=gap.x+gap.w;
    const options=[];
    for(const u of units.filter(u=>u.wall===gap.wall&&isUpper(u)===upper&&widthAdjustmentPolicy(u)&&(Math.abs(u.x+u.w-left)<.2||Math.abs(u.x-right)<.2))){
      const policy=widthAdjustmentPolicy(u),{min,max}=policy,growCapacity=Math.max(0,max-u.w),shrinkCapacity=Math.max(0,u.w-min);
      if(growCapacity>.1)options.push({
        id:u.id,type:u.type,wall:u.wall,row:gap.row,x:u.x,w:u.w,
        ...policy,growCapacity,shrinkCapacity,
      });
    }
    addByHierarchy(options,gap.w,'growCapacity');
  }
  for(const overlap of rowBoxOverlaps(units)){
    const options=[];
    for(const u of [overlap.left,overlap.right]){
      const policy=widthAdjustmentPolicy(u);if(!policy)continue;
      const {min,max}=policy,shrinkCapacity=Math.max(0,u.w-min),growCapacity=Math.max(0,max-u.w);
      if(shrinkCapacity>.1)options.push({id:u.id,type:u.type,wall:u.wall,row:overlap.row,x:u.x,w:u.w,...policy,growCapacity,shrinkCapacity});
    }
    addByHierarchy(options,overlap.amount,'shrinkCapacity');
  }
  return [...found.values()].sort((a,b)=>a.priority-b.priority||a.wall.localeCompare(b.wall)||a.row.localeCompare(b.row)||a.x-b.x);
}
// User-authorised gap closure. Only checked boxes may change width. A checked
// box touching the left side grows right; one touching the right side grows
// left, keeping its far edge fixed. Purchased appliance bays and pullouts are
// deliberately excluded from the candidate list.
export function resizeSelectedForCoverage(p,existing,selectedIds){
  const original=existing.map(u=>({...u})),units=existing.map(u=>({...u})),selected=new Set(selectedIds),changes=new Map();
  let passes=0,reason='No selected cabinet touches a remaining gap.';
  for(;passes<24;passes++){
    const overlaps=rowBoxOverlaps(units),gaps=auditRunGaps(p,units);
    if(!gaps.length&&!overlaps.length){reason='filled';break;}
    let progressed=false;
    for(const overlap of overlaps.slice(0,1)){
      let remaining=overlap.amount,
        active=[overlap.left,overlap.right].filter(u=>{const policy=widthAdjustmentPolicy(u);return selected.has(u.id)&&policy&&u.w>policy.min+.1});
      while(remaining>.1&&active.length){
        const share=remaining/active.length,next=[];
        for(const u of active){
          const policy=widthAdjustmentPolicy(u),take=Math.min(share,u.w-policy.min);
          if(take<=.1)continue;
          if(u.id===overlap.right.id)u.x+=take;
          u.w-=take;remaining-=take;progressed=true;
          if(u.type==='sink')u.widthAdjustmentApproved=true;
          const prior=changes.get(u.id)||{id:u.id,from:existing.find(v=>v.id===u.id)?.w??u.w,to:u.w};
          prior.to=u.w;changes.set(u.id,prior);
          if(u.w>policy.min+.1)next.push(u);
        }
        active=next;
      }
    }
    const remainingGaps=auditRunGaps(p,units);
    for(const gap of remainingGaps){
      const upper=gap.row==='upper',left=gap.x,right=gap.x+gap.w,
        neighbors=units.filter(u=>{const policy=widthAdjustmentPolicy(u);return u.wall===gap.wall&&isUpper(u)===upper&&selected.has(u.id)&&policy&&
          (Math.abs(u.x+u.w-left)<.2||Math.abs(u.x-right)<.2)&&u.w<policy.max-.1});
      if(!neighbors.length)continue;
      let remaining=gap.w,active=[...neighbors];
      while(remaining>.1&&active.length){
        const share=remaining/active.length,next=[];
        for(const u of active){
          const policy=widthAdjustmentPolicy(u),take=Math.min(share,policy.max-u.w);
          if(take<=.1)continue;
          const growsLeft=Math.abs(u.x-right)<.2;
          if(growsLeft)u.x-=take;
          u.w+=take;remaining-=take;progressed=true;
          if(u.type==='sink')u.widthAdjustmentApproved=true;
          const prior=changes.get(u.id)||{id:u.id,from:existing.find(v=>v.id===u.id)?.w??u.w,to:u.w};
          prior.to=u.w;changes.set(u.id,prior);
          if(u.w<policy.max-.1)next.push(u);
        }
        active=next;
      }
    }
    if(!progressed){reason='Select a listed cabinet beside every remaining gap.';break;}
  }
  const conflicts=validateUnits(p,units);
  if(conflicts.length)return {units:original,audit:auditCabinetSpace(p,original),changes:[],reason:`Width change rejected: ${conflicts[0]}`};
  const audit=auditCabinetSpace(p,units);
  if(!audit.gaps.length)reason='filled';
  else if(passes===24)reason='Stopped at the safety pass limit.';
  return {units,audit,changes:[...changes.values()],reason};
}
function fillUntilStable(p,units,add,automatic=false,rows=[false,true]){
  const signature=()=>JSON.stringify(units.map(u=>[u.id,u.x,u.w,u.wall,u.z]));
  const remaining=()=>auditRunGaps(p,units).filter(g=>rows.includes(g.row==='upper'));
  let passes=0,reason='filled';
  for(;passes<24;){
    const before=signature();
    fillRunGaps(p,units,add,automatic,rows);passes++;
    if(!remaining().length)break;
    if(signature()===before){reason='constraints';break;}
  }
  if(passes===24&&remaining().length)reason='iteration-limit';
  return {passes,reason};
}
export function repairCabinetSpace(p, existing) {
  if(roomErrors(p).length)return {units:existing.map(u=>({...u})),passes:0,reason:'invalid-room',audit:auditCabinetSpace(p,existing)};
  const midIds=new Set(interiorFillers(p,existing).map(u=>u.id));
  const units = existing.filter(u=>!midIds.has(u.id)).map((u) => ({ ...u }));
  let i = 0;
  const used = new Set(units.map((u) => u.id));
  const add = (type, wall, x, w, extra = {}) => {
    let id;
    do {
      id = `G${String(++i).padStart(3, "0")}`;
    } while (used.has(id));
    used.add(id);
    const t = TYPES[type];
    const u = { id, type, wall, x, w, h: t.h, d: t.d, z: t.z || 0, ...extra };
    units.push(u);
    return u;
  };
  addUpperCorners(p, units, add);
  const result=fillUntilStable(p, units, add);
  return {units,...result,audit:auditCabinetSpace(p,units)};
}
export function closeRunGaps(p,existing){return repairCabinetSpace(p,existing).units;}
export function insertCabinet(p,existing,type){
  const t=TYPES[type];
  if(type==='open')return {error:'Open base cabinets are not allowed. Choose closed base storage.'};
  if(!t||['corner','wallCorner','filler'].includes(type))return {error:'Use the layout/corner controls for this part.'};
  let n=1;while(existing.some(u=>u.id===`M${n}`))n++;
  const id=`M${n}`,z=t.z||0;
  const replaceable=u=>u.automatic&&adjustableStorage.has(u.type)&&u.wall!=='Island';
  const baseline=new Set(validateUnits(p,existing));
  for(const wall of activeWalls(p.room.layout).filter(w=>!p.preferences[type]||p.preferences[type]===w)){
    let spans=[[0,wallLength(p.room,wall)]];
    for(const cut of blocked(p,wall,z,t.h,type))spans=subtract(spans,cut);
    for(const u of existing.filter(u=>u.wall===wall&&!replaceable(u)&&overlap([u.z,u.z+u.h],[z,z+t.h])))spans=subtract(spans,[u.x,u.x+u.w]);
    for(const [a,b] of spans.filter(([a,b])=>b-a>=t.w-.1)){
      for(const x of [...new Set([a,b-t.w])]){
        const unit={id,type,wall,x,z,w:t.w,h:t.h,d:t.d};
        const candidate=[];
        let seq=0;
        for(const u of existing){
          if(!replaceable(u)||u.wall!==wall||!overlap([u.z,u.z+u.h],[z,z+t.h])||!overlap([u.x,u.x+u.w],[x,x+t.w])){candidate.push({...u});continue;}
          for(const [l,r] of subtract([[u.x,u.x+u.w]],[x,x+t.w])){
            if(r-l<300)continue; // Repair the residual with real opening storage below.
            let remId=u.id;
            if(candidate.some(v=>v.id===remId)){
              do{remId=`${id}-R${++seq}`}while(existing.some(v=>v.id===remId)||candidate.some(v=>v.id===remId));
            }
            candidate.push({...u,id:remId,x:l,w:r-l});
          }
        }
        candidate.push(unit);
        if(validateUnits(p,candidate).some(e=>!baseline.has(e)))continue;
        const repaired=closeRunGaps(p,candidate);
        if(validateUnits(p,repaired).some(e=>!baseline.has(e)))continue;
        const oldGaps=auditRunGaps(p,existing);
        const newGaps=auditRunGaps(p,repaired);
        if(newGaps.some(g=>!oldGaps.some(old=>old.wall===g.wall&&old.row===g.row&&g.x>=old.x-.1&&g.x+g.w<=old.x+old.w+.1)))continue;
        return {units:repaired,id,unit:repaired.find(u=>u.id===id)};
      }
    }
  }
  return {error:`No clear ${t.w} mm space for ${t.name}. Existing specialist units and appliances were kept unchanged. Free a suitable bay, or use Your kitchen to request an automatic rearrangement.`};
}
function missing(p, units) {
  return Object.entries(p.needs).flatMap(([t, count]) =>
    Array.from(
      {
        length: Math.max(
          0,
          count -
            units.filter(
              (u) => u.type === t && !u.automatic && u.wall !== "Island",
            ).length,
        ),
      },
      () => TYPES[t]?.name || t,
    ),
  );
}
export function renderingPrompt(p, plan) {
  const units = plan.units
    .map(
      (u) =>
        `${u.id}: ${TYPES[u.type].name}, ${u.wall === "Island" ? `${u.featureKind==='breakfast'?'breakfast bar':'island'} at ${Math.round(u.islandX??u.ix)},${Math.round(u.islandY??u.iy)} mm, rotation ${u.islandRotation||0}°` : `wall ${u.wall} at ${Math.round(u.x)} mm`}, W${Math.round(u.w)} × H${u.h} × D${u.d} mm, bottom ${u.z} mm; infill ${u.frontMaterial||(u.type==='glass'?'glass':'acp')}, colour ${u.frontColor||p.style.front}, divisions ${u.doorDivisions||'automatic'}`,
    )
    .join("\n")+(p.island&&islandSettings(p).kind==='breakfast'?`\nBREAKFAST BAR: dark stone overhang, warm vertical timber-slat outer face and ${islandSettings(p).pendants} warm glass pendant lights matching the supplied references; retain aluminum construction and fronts on the working side.`:'')+`\nIMAGE REFERENCE KEY: use all wall A/B/C/D elevations plus the island elevation when supplied. Isometric labels are cabinet ID / W(width mm) and map directly to this schedule.`;
  return `Create a photorealistic visualization using the attached CODEX KITCHEN reference images.\n\nREFERENCE PRIORITY\nPerspective = camera and visible design. Plan = positions and dimensions. Elevations = exact front divisions. Frame view = aluminum construction. Preserve the room, cabinet count, proportions, corner ownership, appliances, openings and camera angle. Do not add, remove or relocate cabinets. Render materials and lighting, not a new layout.\n\nPROJECT: ${p.name}\nRoom: ${p.room.width} × ${p.room.depth} × ${p.room.height} mm. Layout: ${p.room.layout}. Walls A rear, B right, C front, D left (clockwise).\nOpenings: ${p.openings.map((o) => `${o.kind} wall ${o.wall}, offset ${o.x}, width ${o.w}, height ${o.h}, sill ${o.sill} mm`).join("; ") || "none"}.\n\nCONSTRUCTION\n${p.style.mode} aluminum frame, 25.4 × 38.1 mm hollow box bar, wall 1.2 mm; 3 mm ACP; 45 mm sash face and 21.2 mm sash depth; 3 mm front reveals. Keep shared run members continuous. Frame finish ${p.style.frame}; front color ${p.style.front}, ${p.style.finish}; countertop ${p.style.counter}; wall ${p.style.wall}. Glass display fronts remain glass.\nLighting: ${p.style.lighting}. Setting: ${p.style.scene}.\n\nCABINET SCHEDULE\n${units}\n\n${plan.errors.length || plan.unmet.length ? "UNRESOLVED DESIGN: " + [...plan.errors, ...plan.unmet.map((x) => "Unplaced " + x)].join("; ") : "Design passed UAT room/footprint checks."}\nSite notes: ${p.notes || "None"}.\n\nOutput a clean high-resolution architectural interior image, realistic aluminum reflections and ACP texture, straight verticals and believable appliance scale. Do not draw dimensions or labels on the final image. Ask about conflicts between references instead of inventing changes. These are UAT design references, not approved fabrication drawings.`;
}
export function parseProject(text) {
  const p = JSON.parse(text);
  if (
    p?.version !== 1 ||
    !p.room ||
    !p.style ||
    !Array.isArray(p.openings) ||
    !p.needs
  )
    throw Error("Choose a CODEX KITCHEN UAT 1 project JSON.");
  if (p.openings.length > 40 || p.units?.length > 200)
    throw Error("Project exceeds UAT size limits.");
  for (const [k, v] of Object.entries(p.needs))
    if (!TYPES[k] || !Number.isInteger(v) || v < 0 || v > (k==='base'?24:12))
      throw Error("Invalid cabinet requirements.");
  const base = initialProject();
  const clean = closeLegacyBaseUnits({
    ...base,
    ...p,
    room: { ...base.room, ...p.room },
    style: { ...base.style, ...p.style },
    islandConfig: { ...base.islandConfig, ...p.islandConfig },
    checks: Array.isArray(p.checks)
      ? p.checks.filter((x) => CHECKS.includes(x))
      : [],
    preferences: p.preferences || {},
    units: p.units || null,
  });
  if (!["I", "L", "U", "GALLEY"].includes(clean.room.layout))
    throw Error("Unsupported layout.");
  const e = roomErrors(clean);
  if (e.length) throw Error(e[0]);
  if (clean.units) {
    const e = validateUnits(clean, clean.units);
    if (e.length) throw Error(e[0]);
  }
  if(p.designVariants!==undefined){
    if(!Array.isArray(p.designVariants)||p.designVariants.length>4)throw Error('A project can contain at most four saved designs.');
    clean.designVariants=p.designVariants.map((slot,i)=>{
      if(slot===null)return null;
      if(!slot?.project||slot.project.designVariants!==undefined)throw Error(`Invalid saved Design ${i+1}.`);
      return {name:`Design ${i+1}`,savedAt:typeof slot.savedAt==='string'?slot.savedAt:'',project:parseProject(JSON.stringify(slot.project))};
    });
  }
  return clean;
}
