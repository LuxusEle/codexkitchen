import { PROFILE, wallPoint } from "./model.js";

// Canonical frame-run grouping used by the renderer and regression checks.
export function frameRuns(units) {
  const groups = new Map();
  for (const u of units) {
    if (["fridge", "dishwasher"].includes(u.type)) continue;
    if (u.wall === "Island") {
      groups.set(u.id, [u]);
      continue;
    }
    const key = [u.wall, u.z, u.h, u.d].join("/");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }
  const result = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.x - b.x);
    let run;
    for (const u of list) {
      if (run && Math.abs(run.end - u.x) < 0.1) {
        run.end = u.x + u.w;
        run.units.push(u);
      } else {
        run = {
          wall: u.wall,
          start: u.x,
          end: u.x + u.w,
          z: u.z,
          h: u.h,
          d: u.d,
          units: [u],
        };
        result.push(run);
      }
    }
  }
  return result.filter((r) => r.units.some((u) => u.type !== "filler"));
}
export function frontDivision(width, count) {
  const gap = PROFILE.reveal,
    leaf = (width - count * gap) / count;
  return Array.from({ length: count }, (_, i) => ({
    x: gap / 2 + i * (leaf + gap),
    w: leaf,
  }));
}
function difference(a, b) {
  const x0 = Math.max(a.x, b.x),
    x1 = Math.min(a.x + a.w, b.x + b.w),
    y0 = Math.max(a.y, b.y),
    y1 = Math.min(a.y + a.d, b.y + b.d);
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return [a];
  return [
    { ...a, w: x0 - a.x },
    { ...a, x: x1, w: a.x + a.w - x1 },
    { ...a, x: x0, w: x1 - x0, d: y0 - a.y },
    { ...a, x: x0, y: y1, w: x1 - x0, d: a.y + a.d - y1 },
  ].filter((r) => r.w > 0.01 && r.d > 0.01);
}
// Countertop pieces close fillers and turns, preserve sink cutouts and butt
// perpendicular worktops together rather than leaving or overlapping a strip.
export function countertopPieces(p, units) {
  const pieces = [];
  const sorted = [...units].sort(
    (a, b) => (a.type === "corner" ? 0 : 1) - (b.type === "corner" ? 0 : 1),
  );
  for (const u of sorted) {
    if (u.z !== 0 || u.h >= 1000 || u.type === "fridge") continue;
    const isIsland=u.wall==='Island',overhang=isIsland&&u.featureKind==='breakfast'?(p.islandConfig?.overhang??300):25,
      spaceKey=isIsland?`island:${u.islandX??u.ix}:${u.islandY??u.iy}:${u.islandRotation||0}`:'room';
    let rects = [{ x: 0, y: 0, w: u.w, d: u.d + overhang }];
    if (u.type === "sink") {
      const w = Math.min(500, u.w - 100);
      rects = rects.flatMap((r) =>
        difference(r, { x: (u.w - w) / 2, y: 120, w, d: 320 }),
      );
    }
    for (const rect of rects) {
      const a = isIsland
          ? [u.x + rect.x, rect.y]
          : wallPoint(p.room, u.wall, u.x + rect.x, rect.y),
        b = isIsland
          ? [a[0] + rect.w, a[1] + rect.d]
          : wallPoint(p.room, u.wall, u.x + rect.x + rect.w, rect.y + rect.d);
      let remaining = [
        {
          unitId: u.id,
          x: Math.min(a[0], b[0]),
          y: Math.min(a[1], b[1]),
          w: Math.abs(a[0] - b[0]),
          d: Math.abs(a[1] - b[1]),
          z: u.h,
          t: 25,
          spaceKey,
          ...(isIsland?{island:true,islandX:u.islandX??u.ix,islandY:u.islandY??u.iy,islandRotation:u.islandRotation||0,islandDepth:u.d,islandOverhang:u.islandOverhang,islandPhysicalDepth:u.islandPhysicalDepth,featureKind:u.featureKind}:{}),
        },
      ];
      for (const prior of pieces.filter((s) => s.z === u.h&&s.spaceKey===spaceKey))
        remaining = remaining.flatMap((r) => difference(r, prior));
      pieces.push(...remaining);
    }
  }
  return pieces;
}
