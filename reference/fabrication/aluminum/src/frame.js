// ─── Profile: 25mm × 35mm (25 horizontal, 35 vertical = height) ───
// Spec coords: X=along-wall, Y=depth(0=back,-front), Z=height
const PW = 0.025;  // 25mm — horizontal thickness
const PH = 0.035;  // 35mm — vertical height
const TOL = 0.0005;

let _id = { b: 1, j: 1, h: 1 };

function nxt(p) { const k = p.toLowerCase(); return p + String(_id[k]++).padStart(3, '0'); }
function dist(a, b) { return Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2 + (b.z-a.z)**2); }
function lerp(a, b, t) { return { x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t, z: a.z+(b.z-a.z)*t }; }

// Spec (X,Y,Z) → Babylon (X, Y=Z, Z=-Y)
function toWorld(bars, cx, cz) {
  for (const b of bars) {
    b.wS = { x: b.sx - cx, y: b.sz, z: -b.sy - cz };
    b.wE = { x: b.ex - cx, y: b.ez, z: -b.ey - cz };
    b.len = dist(b.wS, b.wE);
  }
}

function ptSeg(p, a, b) {
  const dx = b.x-a.x, dy = b.y-a.y, dz = b.z-a.z;
  const l2 = dx*dx+dy*dy+dz*dz;
  if (l2 < 1e-12) return dist(p, a);
  let t = ((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x+t*dx, y: a.y+t*dy, z: a.z+t*dz });
}

// ─── L-JOINT TEST: 2 bars × 300mm ───
// CONVENTION: spec (sx,sy,sz) = CORNER of bar (not centerline)
// Bar A (Y-axis): corner (0,0,0), 25mm thick in X, 300mm in Y, 35mm tall in Z
//   Occupies X:[0,25], Y:[0,300], Z:[0,35]
// Bar B (X-axis): corner (25,0,0) = Bar A's RIGHT FACE. 25mm thick in Y, 300mm in X, 35mm tall in Z
//   Occupies X:[25,325], Y:[0,25], Z:[0,35]
// Joint: where faces meet at X=25, Y=[0,25], Z=[0,35]
export function generateLJoint(len_mm) {
  _id = { b: 1, j: 1, h: 1 };
  const L = len_mm / 1000;
  const bars = [], joints = [], holes = [], errors = [];

  function addBar(role, sx, sy, sz, axis, runLen) {
    const id = nxt('B');
    let ex = sx, ey = sy, ez = sz;
    if (axis === 'X') { ex = sx + runLen; ey = sy + PW; }
    else if (axis === 'Y') { ex = sx + PW; ey = sy + runLen; }
    ez = sz + PH;
    const b = { id, role, sx, sy, sz, ex, ey, ez, axis, len: runLen };
    bars.push(b);
    return b;
  }

  // Bar A: Y-axis at corner (0,0,0), runs 300mm along Y
  const BA = addBar('bar_A_vertical', 0, 0, 0, 'Y', L);

  // Bar B: X-axis at corner (PW,0,0) = right face of Bar A, runs 300mm along X
  const BB = addBar('bar_B_horizontal', PW, 0, 0, 'X', L);

  // Joint at X=PW, Y=0, Z=0 (the corner where faces meet)
  const J01 = { id: nxt('J'), type: 'L', x: PW, y: 0, z: 0, bars: [BA.id, BB.id] };
  joints.push(J01);

  // Validate: joint at X=PW must be on Bar A's face (X goes 0→PW, Y goes 0→L)
  // Distance from joint to Bar A's right edge: joint at (PW,0), bar A edge at X=PW, Y any
  // Joint is at Bar A's X=PW edge, Y=0 corner → ON the bar ✓
  // Distance from joint to Bar B's start: joint at (PW,0), bar B starts at (PW,0) → distance 0 ✓

  // Holes: 2 per bar, 5mm and 10mm from joint
  for (const off of [0.005, 0.010]) {
    holes.push({ id: nxt('H'), barId: BA.id, jointId: J01.id, pos: off, face: 'top', dia: 0.0042 });
    holes.push({ id: nxt('H'), barId: BB.id, jointId: J01.id, pos: off, face: 'top', dia: 0.0042 });
  }

  for (const h of holes) {
    const b = bars.find(x => x.id === h.barId);
    if (h.pos < 0 || h.pos > b.len) errors.push({ code: 'HOLE_OUT', msg: `${h.id} pos ${h.pos*1000}mm outside ${b.id}` });
  }

  // ─── Babylon coords ───
  // Compute room bounding box center in spec coords
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of bars) {
    minX = Math.min(minX, b.sx); maxX = Math.max(maxX, b.ex);
    minY = Math.min(minY, b.sy); maxY = Math.max(maxY, b.ey);
    minZ = Math.min(minZ, b.sz); maxZ = Math.max(maxZ, b.ez);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;

  for (const b of bars) {
    // X-axis bar: runs X, thick Y, tall Z
    // Babylon: center.x = sx + len/2, center.y = sz + PH/2, center.z = -(sy + PW/2)
    // Y-axis bar: runs Y, thick X, tall Z
    // Babylon: center.x = sx + PW/2, center.y = sz + PH/2, center.z = -(sy + len/2)
    let bx, by, bz, bw, bd, bh;
    if (b.axis === 'X') {
      bx = b.sx + b.len/2;  // mid of length along X
      by = b.sz + PH/2;     // mid of height Z → Babylon Y
      bz = -(b.sy + PW/2);  // mid of thickness Y → Babylon Z (negated)
      bw = b.len; bd = PW; bh = PH;
    } else {
      bx = b.sx + PW/2;     // mid of thickness X
      by = b.sz + PH/2;     // mid of height Z → Babylon Y
      bz = -(b.sy + b.len/2); // mid of length Y → Babylon Z (negated)
      bw = PW; bd = b.len; bh = PH;
    }
    b.wC = { x: bx - cx, y: by - cz, z: bz + cy }; // center + un-negate Y for centering
    b.wW = bw; b.wD = bd; b.wH = bh;
  }

  for (const j of joints) {
    // Joint in Babylon: (specX - cx, specZ - cz, -(specY - cy))
    j.wX = j.x - cx;
    j.wY = j.z - cz;
    j.wZ = -(j.y - cy);
  }

  for (const h of holes) {
    const b = bars.find(x => x.id === h.barId);
    if (!b) continue;
    if (!b.wC) continue;
    // Compute hole direction along bar axis
    let t = 0;
    if (b.axis === 'X') t = h.pos / b.len;
    else if (b.axis === 'Y') t = h.pos / b.len;
    h.wX = b.wC.x + (b.axis === 'X' ? (t - 0.5) * b.wW : 0);
    h.wY = b.wC.y + b.wH / 2; // top face
    h.wZ = b.wC.z + (b.axis === 'Y' ? (t - 0.5) * b.wD : 0);
  }

  const audit = [];
  for (const b of bars) audit.push({ obj: 'BAR', id: b.id, ok: true, msg: `len ${b.len*1000}mm, corner (${b.sx*1000},${b.sy*1000},${b.sz*1000})` });
  for (const j of joints) audit.push({ obj: 'JNT', id: j.id, ok: true, msg: `${j.type} at (${j.x*1000},${j.y*1000},${j.z*1000})` });
  for (const h of holes) audit.push({ obj: 'HOL', id: h.id, ok: true, msg: `pos ${h.pos*1000}mm on ${h.barId}` });

  return { ok: errors.length === 0, bars, joints, holes, errors, audit, profile: { w: PW, h: PH }, display: { length: L, depth: L } };
}

// ─── GENERATE: exact spec match ───
export function generateBottomFrame(len_mm, dep_mm, crosses_mm) {
  _id = { b: 1, j: 1, h: 1 };
  const L = len_mm / 1000, D = dep_mm / 1000;
  const bars = [], joints = [], holes = [], errors = [];

  // EXACT spec centerlines:
  // B001 back_long_bar:  [0,0,0] → [L,0,0]
  // B002 front_long_bar: [0,-D,0] → [L,-D,0]
  // Cross bars: [x,0,0] → [x,-D,0], length = D

  function addBar(role, sx, sy, sz, ex, ey, ez, axis) {
    const id = nxt('B');
    const bar = { id, role, sx, sy, sz, ex, ey, ez, axis, len: 0 };
    bars.push(bar);
    return bar;
  }

  // 1. Back long bar: centerline at Y=0
  const B01 = addBar('back_long_bar', 0, 0, 0, L, 0, 0, 'X');

  // 2. Front long bar: centerline at Y=-D
  const B02 = addBar('front_long_bar', 0, -D, 0, L, -D, 0, 'X');

  function addCross(x, role) {
    return addBar(role, x, 0, 0, x, -D, 0, 'Y');
  }

  // 3. Left end cross (X=0)
  const B03 = addCross(0, 'left_end_cross');
  // 4. Right end cross (X=L)
  const B04 = addCross(L, 'right_end_cross');

  // 5-6. Middle crosses
  const crossBars = [];
  for (let i = 0; i < crosses_mm.length; i++) {
    const x = crosses_mm[i] / 1000;
    crossBars.push(addCross(x, 'middle_cross_' + (i+1)));
  }

  // ─── Validate bar lengths ───
  for (const b of bars) {
    b.len = Math.sqrt((b.ex-b.sx)**2 + (b.ey-b.sy)**2 + (b.ez-b.sz)**2);
    if (b.len < 0.001) errors.push({ code: 'ZERO_BAR', msg: `${b.id} zero length` });
  }

  // ─── Joints ───
  function addJoint(type, x, y, z, a, b) {
    const id = nxt('J');
    const j = { id, type, x, y, z, bars: [a.id, b.id] };
    // Validate: joint must be near both bars
    for (const bar of [a, b]) {
      // Convert joint to Babylon for distance check: (x, z, -y)
      const jw = { x, y: z, z: -y };
      const d = ptSeg(jw, bar.wS || { x: bar.sx, y: bar.sz, z: -bar.sy },
                           bar.wE || { x: bar.ex, y: bar.ez, z: -bar.ey });
      if (d > TOL) errors.push({ code: 'JOINT_OFF', msg: `${id} dist ${(d*1000).toFixed(2)}mm ${bar.id}` });
    }
    joints.push(j);
    return j;
  }

  // 4 L joints at corners
  addJoint('L', 0, 0, 0, B01, B03);     // J001
  addJoint('L', 0, -D, 0, B02, B03);    // J002
  addJoint('L', L, 0, 0, B01, B04);     // J003
  addJoint('L', L, -D, 0, B02, B04);    // J004

  // T joints for middle crosses
  for (const cb of crossBars) {
    addJoint('T', cb.sx, 0, 0, B01, cb);   // back
    addJoint('T', cb.sx, -D, 0, B02, cb);  // front
  }

  // ─── Holes: top face only ───
  // Rule: 2 holes per joint on cross bar only
  // Offsets: 25mm and 50mm from joint
  const rule = { off: [0.025, 0.050], dia: 0.0042, face: 'top' };
  const crossAll = [B03, B04, ...crossBars];

  for (const cb of crossAll) {
    const relJ = joints.filter(j => j.bars.includes(cb.id));
    for (const j of relJ) {
      const isBack = j.y === 0; // back joint at Y=0
      for (const off of rule.off) {
        const pos = isBack ? off : cb.len - off;
        const hid = nxt('H');
        holes.push({ id: hid, barId: cb.id, jointId: j.id, pos, face: rule.face, dia: rule.dia });
        if (pos < 0 || pos > cb.len) errors.push({ code: 'HOLE_OUT', msg: `${hid} pos ${(pos*1000).toFixed(1)}mm outside ${cb.id}` });
      }
    }
  }

  // ─── World coords + center ───
  const cx = L / 2, cz = D / 2;
  toWorld(bars, cx, cz);

  // ─── Hole world positions (top face = +PH/2 in Babylon Y) ───
  for (const h of holes) {
    const b = bars.find(x => x.id === h.barId);
    if (!b) continue;
    const t = b.len > 0 ? h.pos / b.len : 0;
    const c = lerp(b.wS, b.wE, t);
    h.wX = c.x; h.wY = c.y + PH/2; h.wZ = c.z;
  }

  // ─── Audit ───
  const audit = [];
  for (const b of bars) {
    const d = dist(b.wS, b.wE);
    audit.push({ obj: 'BAR', id: b.id, ok: Math.abs(d-b.len)<TOL, msg: `len ${(b.len*1000).toFixed(1)} vs dist ${(d*1000).toFixed(1)}` });
  }
  for (const j of joints) {
    for (const bid of j.bars) {
      const b = bars.find(x => x.id === bid);
      if (!b) continue;
      const jw = { x: j.x, y: j.z, z: -j.y };
      const d = ptSeg(jw, b.wS, b.wE);
      audit.push({ obj: 'JNT', id: j.id, ok: d<TOL, msg: `dist ${(d*1000).toFixed(2)} from ${bid}` });
    }
  }
  for (const h of holes) {
    const b = bars.find(x => x.id === h.barId);
    const ok = h.pos >= 0 && h.pos <= (b ? b.len : 0);
    audit.push({ obj: 'HOL', id: h.id, ok, msg: `pos ${(h.pos*1000).toFixed(1)} in ${h.barId}` });
  }

  return {
    ok: !errors.some(e => e.code === 'JOINT_OFF' || e.code === 'HOLE_OUT' || e.code === 'ZERO_BAR'),
    bars, joints, holes, errors, audit,
    profile: { w: PW, h: PH },
    display: { length: L, depth: D },
    spec: { len_mm, dep_mm, crosses_mm }
  };
}

export function generateFrame(project, modules) {
  return { skeleton: [], cladding: [], internal: [] };
}

export { PW, PH, TOL };
