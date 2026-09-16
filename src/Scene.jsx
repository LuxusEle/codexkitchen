import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PROFILE, wallPoint, wallLength, TYPES, islandSettings, legalRunSpans } from "./model";
import { countertopPieces } from "./construction.js";
import { carcassParts, frontSpecs, hingePositions } from "./assembly.js";
import { SASH_PROFILE, HANDLE_PROFILE, doorBody } from "./sash-profile.js";
import {cabinetAtPoint} from './cabinet-actions.js';
const mat = (color, metalness = 0, roughness = 0.65) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
function box(g, w, h, d, x, y, z, m, name) {
  if (Math.min(w, h, d) <= 0) return;
  const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  o.position.set(x + w / 2, y + h / 2, z + d / 2);
  o.castShadow = true;
  o.receiveShadow = true;
  o.name = name || "Panel";
  g.add(o);
  return o;
}
function hollow(g, w, h, d, x, y, z, axis, m) {
  const t = PROFILE.wall;
  let shape = new T.Shape();
  const a = axis === "x" ? d : w,
    b = axis === "y" ? d : h,
    len = axis === "x" ? w : axis === "y" ? h : d;
  shape.moveTo(0, 0);
  shape.lineTo(a, 0);
  shape.lineTo(a, b);
  shape.lineTo(0, b);
  shape.closePath();
  let hole = new T.Path();
  hole.moveTo(t, t);
  hole.lineTo(t, b - t);
  hole.lineTo(a - t, b - t);
  hole.lineTo(a - t, t);
  hole.closePath();
  shape.holes.push(hole);
  let geo = new T.ExtrudeGeometry(shape, {
    depth: len,
    bevelEnabled: false,
    steps: 1,
  });
  if (axis === "x") {
    geo.rotateY(Math.PI / 2);
    geo.translate(0, 0, d);
  }
  if (axis === "y") {
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, d);
  }
  const o = new T.Mesh(geo, m);
  o.position.set(x, y, z);
  o.name = "Hollow aluminum box bar";
  o.castShadow = true;
  g.add(o);
  return o;
}
// Detailed copied web sash contour, with complementary 45-degree end planes.
function sashBar(length, m, profile = SASH_PROFILE, mitred = true) {
  const outer = profile.outer,
    inner = profile.inner || [],
    loops = inner.length ? [outer, inner] : [outer];
  const points = [...outer, ...inner],
    pos = [],
    idx = [];
  for (const end of [0, 1])
    for (const [d, f] of points)
      pos.push(end ? length - (mitred ? f : 0) : mitred ? f : 0, f, d);
  const N = points.length;
  const tris = T.ShapeUtils.triangulateShape(
    outer.map((p) => new T.Vector2(...p)),
    inner.length ? [inner.map((p) => new T.Vector2(...p))] : [],
  );
  for (const t of tris) {
    idx.push(t[2], t[1], t[0], t[0] + N, t[1] + N, t[2] + N);
  }
  let off = 0;
  for (const loop of loops) {
    for (let j = 0; j < loop.length; j++) {
      let a = off + j,
        b = off + ((j + 1) % loop.length);
      idx.push(a, b, b + N, a, b + N, a + N);
    }
    off += loop.length;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, m);
  mesh.castShadow = true;
  return mesh;
}
function sash(parent, w, totalH, m, infill, spec) {
  const { height: h, y } = doorBody(spec),
    g = new T.Group();
  g.position.y = y;
  parent.add(g);
  const e = spec.explode || 0;
  if (w <= 90 || h <= 90) return;
  const bottom = sashBar(w, m);
  bottom.position.y = -e;
  g.add(bottom);
  const top = sashBar(w, m);
  top.rotation.z = Math.PI;
  top.position.set(w, h + e, 0);
  g.add(top);
  const left = sashBar(h, m);
  left.rotation.z = -Math.PI / 2;
  left.position.set(-e, h, 0);
  g.add(left);
  const right = sashBar(h, m);
  right.rotation.z = Math.PI / 2;
  right.position.set(w + e, 0, 0);
  g.add(right);
  const lip = sashBar(w, m, HANDLE_PROFILE, false);
  lip.name = "Integrated handle lip — square ends";
  if (spec.handleSide === "top") {
    lip.rotation.z = Math.PI;
    lip.position.set(w, h + e, 0);
  } else lip.position.y = -e;
  g.add(lip);
  const { panelInset: i, panelThickness: t, panelDepth: d } = SASH_PROFILE;
  box(
    g,
    w - 2 * i,
    h - 2 * i,
    t,
    i,
    i,
    d + e,
    infill,
    "Channel-seated ACP or glass infill",
  );
}
function textSprite(label, size = 140, color = "#415b60") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.font = "600 55px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(label, 256, 85);
  const tx = new T.CanvasTexture(c),
    sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false }));
  sp.scale.set(size * 4, size, 1);
  return sp;
}
function wallGroup(p, wall) {
  const g = new T.Group();
  const [x, z] = wallPoint(p.room, wall, 0);
  g.position.set(x, 0, z);
  g.rotation.y = { A: 0, B: -Math.PI / 2, C: Math.PI, D: Math.PI / 2 }[wall];
  return g;
}
function placeIslandGroup(g,item){
  const x=item.islandX??item.ix??0,y=item.islandY??item.iy??0,rotation=item.islandRotation||0,d=item.islandPhysicalDepth??item.islandDepth??item.d??700;
  if(rotation===90){g.position.set(x+d,0,y);g.rotation.y=-Math.PI/2;}
  else g.position.set(x,0,y);
}
function createRoom(root, p, showWalls) {
  const floor = mat("#e1e5e2");
  box(root, p.room.width, 50, p.room.depth, 0, -50, 0, floor, "Room floor");
  const grid = new T.GridHelper(
    Math.max(p.room.width, p.room.depth),
    Math.ceil(Math.max(p.room.width, p.room.depth) / 300),
    "#bac6c4",
    "#d2dbd8",
  );
  grid.position.set(p.room.width / 2, 1, p.room.depth / 2);
  root.add(grid);
  for (const wall of ["A", "B", "C", "D"]) {
    const g = wallGroup(p, wall);
    root.add(g);
    const length = wallLength(p.room, wall);
    const m = mat(p.style.wall);
    m.transparent = true;
    m.opacity = showWalls ? 0.6 : 0.1;
    m.depthWrite = false;
    const os = p.openings
      .filter((o) => o.wall === wall)
      .sort((a, b) => a.x - b.x);
    const cuts = [0, length, ...os.flatMap((o) => [o.x, o.x + o.w])].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < cuts.length - 1; i++) {
      const x = cuts[i],
        w = cuts[i + 1] - x;
      if (w <= 0) continue;
      let intervals = [[0, p.room.height]];
      for (const o of os.filter((o) => o.x < x + w && o.x + o.w > x))
        intervals = intervals.flatMap(([a, b]) =>
          o.sill >= b || o.sill + o.h <= a
            ? [[a, b]]
            : [
                [a, Math.max(a, o.sill)],
                [Math.min(b, o.sill + o.h), b],
              ].filter(([a, b]) => b > a),
        );
      for (const [a, b] of intervals) box(g, w, b - a, 50, x, a, -50, m);
    }
    for (const o of os) {
      const om = mat(o.kind === "window" ? "#74bec9" : "#c18d51");
      for (const [w, h, x, y] of [
        [o.w, 25, o.x, o.sill],
        [o.w, 25, o.x, o.sill + o.h - 25],
        [25, o.h, o.x, o.sill],
        [25, o.h, o.x + o.w - 25, o.sill],
      ])
        box(g, w, h, 50, x, y, -30, om);
      if (o.kind === "window") {
        const glass = mat("#93cad7", 0.15, 0.1);
        glass.transparent = true;
        glass.opacity = 0.2;
        box(g, o.w - 50, o.h - 50, 4, o.x + 25, o.sill + 25, -15, glass);
        box(g, 20, o.h, 30, o.x + o.w / 2 - 10, o.sill, -30, om);
      }
    }
    let s = textSprite(`WALL ${wall} · ${Math.round(length)}`, 85);
    s.position.set(length / 2, 30, -130);
    g.add(s);
  }
}
function makeFrames(root, p, units, metal, acp, frameOnly, runId = "all") {
  const facing=mat(p.style.front);
  for (const part of carcassParts(p, units)) {
    if (runId !== "all" && part.runId !== runId) continue;
    if (frameOnly && part.kind !== "bar") continue;
    const g = part.wall === "Island" ? new T.Group() : wallGroup(p, part.wall);
    if (part.wall === "Island") placeIslandGroup(g,part);
    g.userData.partId = part.id;
    g.userData.unitIds = part.unitIds;
    root.add(g);
    const { w, h, d, x, y, z } = part;
    if(part.sashPlacement){
      const placement=part.sashPlacement,end=new T.Group();
      end.position.set(...placement.origin);end.rotation.y=placement.rotationY;
      const mesh=sashBar(part.length,metal,SASH_PROFILE,true);
      mesh.position.set(...placement.position);mesh.rotation.z=placement.rotationZ;
      mesh.name=part.name;mesh.userData.assemblyId=part.assemblyId;
      end.add(mesh);g.add(end);
    }
    else if (part.kind === "bar") hollow(g, w, h, d, x, y, z, part.axis, metal);
    else if (part.outline) {
      const shape = new T.Shape(
        part.outline.map(([a, b]) => new T.Vector2(a, -b)),
      );
      const geometry = new T.ExtrudeGeometry(shape, {
        depth: part.thickness,
        bevelEnabled: false,
      });
      geometry.rotateX(-Math.PI / 2);
      const mesh = new T.Mesh(geometry, acp);
      mesh.position.set(x, y, z);
      mesh.name = part.name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    } else box(g, w, h, d, x, y, z, part.material==='Front ACP'?facing:acp, part.name);
  }
}
function frontMaterial(spec,mats){
  const material=(spec.glass?mats.glass:mats.front).clone();
  if(spec.color)material.color.set(spec.color);
  return material;
}
function createUnit(root, p, u, settings, mats) {
  const g = u.wall === "Island" ? new T.Group() : wallGroup(p, u.wall);
  if (u.wall === "Island") {placeIslandGroup(g,u);g.translateX(u.x);}
  else g.translateX(u.x);
  g.userData.unitId = u.id;
  root.add(g);
  const { w, h, d, z } = u;
  const { metal, front, counter, dark, steel, glass } = mats;
  const frameOnly = settings.mode === "frame",
    carcassOnly = settings.mode === "carcass",
    open = settings.mode === "open";
  const body = mat("#e0e3df");
  let fy = z + 41,
    fh = h - 44;
  if (u.z > 0) {
    fy = z + 1.5;
    fh = h - 3;
  }
  if (u.type === "filler") {
    return;
  }
  if (u.type === "fridge") {
    if (!frameOnly && !carcassOnly) {
      // Keep only the normal 3 mm appliance reveal. The former 23 mm side
      // inset looked like an unfilled cabinet gap beside adjacent sash fronts.
      box(g, w - 6, h - 30, d - 20, 3, z, 0, steel);
      box(g, w - 6, h * 0.65, 20, 3, z + h * 0.35, d - 20, front);
      box(g, w - 6, h * 0.35 - 8, 20, 3, z, d - 20, front);
      box(g, 12, h * 0.25, 30, w - 28, z + h * 0.46, d - 15, dark);
    }
    return;
  }
  if (u.type === "dishwasher") {
    if (!frameOnly && !carcassOnly) {
      box(g, w - 6, h - 50, d - 35, 3, z + 40, 0, steel);
      box(g, w - 10, 60, 20, 5, z + h - 70, d - 35, dark);
      box(g, w - 10, h - 120, 20, 5, z + 40, d - 35, front);
    }
  } else if (!frameOnly && !carcassOnly && !(u.type === "open"&&u.z>=900)) {
    function frontPanel(spec) {
      const { x, y, w: ww, h: hh, glass: isGlass, kind, hand } = spec;
      const isDrawer = kind === "drawer",
        isRight = hand === "right";
      const door = new T.Group();
      const pivot = new T.Group();
      g.add(pivot);
      pivot.position.set(
        x + (isRight ? ww : 0),
        y + (kind === "lift" ? hh : 0),
        d,
      );
      door.position.set(isRight ? -ww : 0, kind === "lift" ? -hh : 0, 0);
      pivot.add(door);
      if (open) {
        if (isDrawer) pivot.position.z += 320;
        else if (kind === "lift") pivot.rotation.x = -Math.PI * 0.4;
        else pivot.rotation.y = (isRight ? 1 : -1) * Math.PI * 0.4;
      }
      door.userData.partId = spec.id;
      sash(door, ww, hh, metal, frontMaterial(spec,mats), spec);
      for (const pos of hingePositions(spec))
        box(
          door,
          25,
          45,
          18,
          isRight ? ww - 30 : 5,
          pos - 22.5,
          -18,
          steel,
          "Sash hinge + insert (review)",
        );
      if (isDrawer && open) {
        box(door, ww - 50, 12, d - 100, 25, 20, -d + 100, body);
        box(door, 12, 140, d - 100, 25, 20, -d + 100, body);
        box(door, 12, 140, d - 100, ww - 37, 20, -d + 100, body);
      }
    }
    for (const spec of frontSpecs(u)) frontPanel(spec);
    if (u.type === "oven") {
      for (const [yy, hh] of [
        [z + 600, 590],
        [z + 1220, 380],
      ]) {
        box(g, w - 30, hh, 35, 15, yy, d - 15, steel);
        box(g, w - 90, hh - 100, 8, 45, yy + 35, d + 20, dark);
        box(g, w - 120, 16, 25, 60, yy + hh - 55, d + 28, metal);
      }
    }
  }
  if (z === 0 && h < 1000 && !frameOnly && !carcassOnly) {
    if (u.type === "sink") {
      const cutW = Math.min(500, w - 100),
        cx = (w - cutW) / 2;
      box(g, cutW, 4, 320, cx, h - 110, 120, steel);
      box(g, 4, 110, 320, cx, h - 110, 120, steel);
      box(g, 4, 110, 320, cx + cutW - 4, h - 110, 120, steel);
      box(g, cutW, 110, 4, cx, h - 110, 120, steel);
      box(g, cutW, 110, 4, cx, h - 110, 436, steel);
      const tube = new T.Mesh(
        new T.TorusGeometry(65, 9, 8, 24, Math.PI),
        metal,
      );
      tube.position.set(w / 2, h + 130, 100);
      tube.rotation.y = Math.PI / 2;
      g.add(tube);
      box(g, 18, 130, 18, w / 2 - 9, h, 26, metal);
    }
    if (u.type === "cooker") {
      box(g, w - 60, 8, 470, 30, h + 25, 70, dark);
      for (let i = 0; i < 4; i++) {
        const burner = new T.Mesh(new T.TorusGeometry(60, 5, 8, 30), steel);
        burner.rotation.x = -Math.PI / 2;
        burner.position.set(
          w * 0.28 + (i % 2) * w * 0.44,
          h + 35,
          190 + Math.floor(i / 2) * 230,
        );
        g.add(burner);
      }
      box(g, w, 65, 450, 0, 1550, 0, steel, "Hood");
      box(g, 250, 450, 230, (w - 250) / 2, 1615, 0, steel, "Hood duct");
    }
  }
  if (settings.selected === u.id) {
    const bb = new T.Box3(
        new T.Vector3(0, z, 0),
        new T.Vector3(w, z + h, d + 25),
      ),
      helper = new T.Box3Helper(bb, "#d57931");
    g.add(helper);
  }
  if(settings.previewIds?.includes(u.id)){
    const geometry=new T.BoxGeometry(w+8,h+8,d+12),material=new T.MeshBasicMaterial({color:'#8fd7ff',transparent:true,opacity:.22,depthWrite:false});
    const ghost=new T.Mesh(geometry,material);ghost.position.set(w/2,z+h/2,d/2);ghost.raycast=()=>{};g.add(ghost);
    const outline=new T.Box3Helper(new T.Box3(new T.Vector3(-4,z-4,-6),new T.Vector3(w+4,z+h+4,d+6)),'#42b6ff');
    outline.material.depthTest=false;outline.material.transparent=true;outline.material.opacity=.9;outline.renderOrder=10;outline.raycast=()=>{};g.add(outline);
  }
  if (settings.labels) {
    const s = textSprite(`${u.id} / W${Math.round(w)}`, 58);
    s.position.set(w / 2, z + h + 105, d + 50);
    g.add(s);
  }
}
function createBreakfastBar(root,p,units,mats){
  const first=units.find(u=>u.wall==='Island');
  if(!first||first.featureKind!=='breakfast')return;
  const c={...islandSettings(p),x:first.islandX??first.ix,y:first.islandY??first.iy,rotation:first.islandRotation||0},g=new T.Group();
  placeIslandGroup(g,{islandX:c.x,islandY:c.y,islandRotation:c.rotation,islandPhysicalDepth:c.physicalDepth});root.add(g);
  const timber=mat('#6f3d22',0.05,.5),groove=mat('#2c211c',0,.8),warmGlass=mat('#e9c68f',.05,.12);
  warmGlass.transparent=true;warmGlass.opacity=.28;
  // Reference treatment: a warm, vertically slatted public face below the
  // stone overhang. The aluminum carcass remains behind this removable skin.
  box(g,c.width,760,22,0,45,c.depth+8,groove,'Breakfast bar backing');
  for(let x=8;x<c.width-8;x+=42)box(g,22,760,26,x,45,c.depth+29,timber,'Vertical timber slat');
  // A small ladder-like end detail repeats the open side rhythm in the photo.
  for(const x of [8,82])box(g,18,720,24,x,90,c.depth+58,timber,'Ladder side upright');
  for(let y=110;y<790;y+=170)box(g,92,18,24,8,y,c.depth+58,timber,'Ladder side rail');
  const cable=mat('#2b2420',.15,.4),ceiling=p.room.height;
  for(let i=0;i<c.pendants;i++){
    const x=c.width*(i+1)/(c.pendants+1),z=c.depth+Math.max(80,c.overhang*.55),drop=520+(i%2)*80;
    box(g,6,drop,6,x-3,ceiling-drop,z-3,cable,'Pendant cable');
    const shade=new T.Mesh(new T.SphereGeometry(88,20,14),warmGlass);shade.scale.y=1.2;shade.position.set(x,ceiling-drop-35,z);shade.name='Glass pendant';g.add(shade);
    const bulb=new T.PointLight('#ffc66f',1.8,1500,2);bulb.position.set(x,ceiling-drop-40,z);g.add(bulb);
  }
}
export function buildScene(p, plan, settings) {
  const group = new T.Group();
  if (!["door", "run"].includes(settings.mode)) createRoom(group, p, settings.walls);
  const mats = {
    metal: mat(p.style.frame, 0.7, 0.32),
    front: mat(p.style.front, 0.12, p.style.finish === "glossy" ? 0.18 : 0.65),
    counter: mat(p.style.counter, 0.05, 0.35),
    dark: mat("#1b292b", 0.25, 0.25),
    steel: mat("#a9b3b5", 0.75, 0.25),
    glass: mat("#769d9f", 0.3, 0.12),
  };
  mats.glass.transparent = true;
  mats.glass.opacity = 0.4;
  if (settings.mode === "door") {
    const unit =
      plan.units.find(
        (u) => u.id === settings.selected && frontSpecs(u).length,
      ) || plan.units.find((u) => frontSpecs(u).length);
    if (unit) {
      const front = frontSpecs(unit)[0];
      group.userData.unitId = unit.id;
      sash(group, front.w, front.h, mats.metal, frontMaterial(front,mats), {
        ...front,
        explode: settings.explode || 0,
      });
      const label = textSprite(
        `${front.id} / ${front.handleSide.toUpperCase()} HANDLE`,
        25,
      );
      label.position.set(front.w / 2, -90, 0);
      group.add(label);
    }
    if (settings.xray) applyXray(group);
    return group;
  }
  makeFrames(
    group,
    p,
    plan.units,
    mats.metal,
    mat("#dce2da"),
    ["frame", "run"].includes(settings.mode),
    settings.mode === "run" ? settings.runId : "all",
  );
  if (settings.mode === "run") {
    if (settings.xray) applyXray(group);
    return group;
  }
  for (const u of plan.units) createUnit(group, p, u, settings, mats);
  if (!["frame", "carcass"].includes(settings.mode))
    for (const piece of countertopPieces(p, plan.units)) {
      const holder=piece.island?new T.Group():group;
      if(piece.island){placeIslandGroup(holder,piece);group.add(holder);}
      const mesh = box(
        holder,
        piece.w,
        piece.t,
        piece.d,
        piece.x,
        piece.z,
        piece.y,
        mats.counter,
        "Continuous worktop",
      );
      if (mesh) mesh.userData.unitId = piece.unitId;
    }
  if (!["frame", "carcass"].includes(settings.mode))createBreakfastBar(group,p,plan.units,mats);
  if (settings.xray) applyXray(group);
  return group;
}
function applyXray(group) {
  const meshes = [];
  group.traverse((o) => {
    if (o.isMesh && o.name !== "Room floor") meshes.push(o);
  });
  for (const mesh of meshes) {
    mesh.material.transparent = true;
    mesh.material.opacity = mesh.name.includes("infill") ? 0.12 : 0.28;
    mesh.material.depthWrite = false;
    const edges = new T.LineSegments(
      new T.EdgesGeometry(mesh.geometry, 25),
      new T.LineBasicMaterial({
        color: "#24565e",
        transparent: true,
        opacity: 0.6,
      }),
    );
    mesh.add(edges);
  }
}
function dispose(root) {
  const geos = new Set(),
    materials = new Set();
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
  });
  geos.forEach((g) => g.dispose());
  materials.forEach((m) => {
    m.map?.dispose();
    m.dispose();
  });
}
const Scene = forwardRef(function Scene(
  { project, plan, settings, onSelect, onMoveUnit, onMoveStart, onMoveEnd, onError },
  ref,
) {
  const host = useRef(),
    runtime = useRef(),
    data = useRef({ project, plan, settings });
  data.current = { project, plan, settings };
  const select = useRef(onSelect);
  select.current = onSelect;
  const moveUnit=useRef(onMoveUnit),moveEnd=useRef(onMoveEnd),moveStart=useRef(onMoveStart);
  moveUnit.current=onMoveUnit;moveEnd.current=onMoveEnd;moveStart.current=onMoveStart;
  useEffect(() => {
    let renderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch (e) {
      onError(
        "3D needs WebGL. Try Chrome or Edge with graphics acceleration enabled.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor("#eef2ef");
    renderer.outputColorSpace = T.SRGBColorSpace;
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight("#ffffff", "#95a5a0", 2.3));
    const sun = new T.DirectionalLight("#fff5de", 3.2);
    sun.position.set(-3000, 6500, 5000);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -7500,
      right: 7500,
      top: 7500,
      bottom: -7500,
      near: 100,
      far: 20000,
    });
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    const camera = new T.PerspectiveCamera(40, 1, 10, 60000),
      controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 900;
    controls.maxDistance = 25000;
    host.current.appendChild(renderer.domElement);
    const rt = { renderer, scene, camera, controls, group: null };
    runtime.current = rt;
    const resize = () => {
      const { width, height } = host.current.getBoundingClientRect();
      if (width && height) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    resize();
    const p = data.current.project;
    camera.position.set(
      -p.room.width * 0.45,
      p.room.height * 1.65,
      p.room.depth * 1.8,
    );
    controls.target.set(p.room.width / 2, 800, p.room.depth / 2);
    controls.update();
    let frame;
    function animate() {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    const ray = new T.Raycaster();
    let down,dragging;
    const setRay=e=>{
      const b=renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new T.Vector2(((e.clientX-b.left)/b.width)*2-1,(-(e.clientY-b.top)/b.height)*2+1),camera);
    };
    const hitUnit=e=>{
      setRay(e);
      for(const h of ray.intersectObjects(rt.group?.children||[],true)){
        let o=h.object;
        while(o){
          const id=o.userData.unitIds?cabinetAtPoint(data.current.project,data.current.plan.units,o.userData.unitIds,h.point):o.userData.unitId;
          if(id)return {id,point:h.point};
          o=o.parent;
        }
      }
      return null;
    };
    const along=(wall,point)=>wall==='A'?point.x:wall==='B'?point.z:wall==='C'?data.current.project.room.width-point.x:data.current.project.room.depth-point.z;
    const snap=(value,candidates,grid=25)=>{
      const rounded=Math.round(value/grid)*grid,best=candidates.reduce((a,b)=>Math.abs(b-value)<Math.abs(a-value)?b:a,rounded);
      return Math.abs(best-value)<=90?best:rounded;
    };
    function pd(e) {
      down = [e.clientX, e.clientY];
      if(e.button!==0)return;
      if(!data.current.settings.moveEnabled||['door','run'].includes(data.current.settings.mode))return;
      const hit=hitUnit(e),u=hit&&data.current.plan.units.find(unit=>unit.id===hit.id);
      if(!u)return;
      e.stopPropagation();moveStart.current?.();
      select.current(u.id,{dragging:true});controls.enabled=false;renderer.domElement.setPointerCapture?.(e.pointerId);
      const normal=u.wall==='Island'?new T.Vector3(0,1,0):['A','C'].includes(u.wall)?new T.Vector3(0,0,1):new T.Vector3(1,0,0);
      const plane=new T.Plane().setFromNormalAndCoplanarPoint(normal,hit.point);
      dragging=u.wall==='Island'
        ? {id:u.id,pointerId:e.pointerId,plane,island:true,dx:hit.point.x-(u.islandX??u.ix??0),dz:hit.point.z-(u.islandY??u.iy??0)}
        : {id:u.id,pointerId:e.pointerId,plane,wall:u.wall,offset:along(u.wall,hit.point)-u.x};
    }
    function pointerMove(e){
      if(!dragging)return;
      if(Math.hypot(e.clientX-down[0],e.clientY-down[1])<5&&!dragging.moved)return;
      dragging.moved=true;
      const {project:p,plan:current}=data.current,u=current.units.find(unit=>unit.id===dragging.id);if(!u)return;
      setRay(e);const point=new T.Vector3();
      if(dragging.island){
        if(!ray.ray.intersectPlane(dragging.plane,point))return;
        const c=islandSettings(p),fw=c.footprintW,fd=c.footprintD,
          x=Math.max(0,Math.min(p.room.width-fw,snap(point.x-dragging.dx,[0,p.room.width-fw,p.room.width/2-fw/2],50))),
          y=Math.max(0,Math.min(p.room.depth-fd,snap(point.z-dragging.dz,[0,p.room.depth-fd,p.room.depth/2-fd/2],50)));
        moveUnit.current?.(u.id,{islandX:x,islandY:y});return;
      }
      if(!ray.ray.intersectPlane(dragging.plane,point))return;
      const L=wallLength(p.room,u.wall),raw=along(u.wall,point)-dragging.offset,
        candidates=[0,L-u.w,...current.units.filter(v=>v.id!==u.id&&v.wall===u.wall&&Math.min(v.z+v.h,u.z+u.h)-Math.max(v.z,u.z)>.1).flatMap(v=>[v.x+v.w,v.x-u.w]),...p.openings.filter(o=>o.wall===u.wall).flatMap(o=>[o.x-25-u.w,o.x+o.w+25])],
        cookerDomains=u.type==='cooker'?legalRunSpans(p,current.units,u.wall,false).filter(([a,b])=>b-a>=u.w+600):[],
        cookerDomain=cookerDomains.sort((a,b)=>Math.abs((a[0]+a[1]-u.w)/2-raw)-Math.abs((b[0]+b[1]-u.w)/2-raw))[0],
        x=u.type==='cooker'?(cookerDomain?Math.max(cookerDomain[0]+300,Math.min(cookerDomain[1]-u.w-300,snap(raw,[cookerDomain[0]+300,cookerDomain[1]-u.w-300,(cookerDomain[0]+cookerDomain[1]-u.w)/2]))):u.x):Math.max(0,Math.min(L-u.w,snap(raw,candidates)));
      moveUnit.current?.(u.id,{x});
    }
    function pointerEnd(e){
      if(!dragging)return;
      const finished=dragging;
      if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
      dragging=null;controls.enabled=true;moveEnd.current?.(e.type==='pointercancel');
      if(!finished.moved&&e.type!=='pointercancel')select.current(finished.id,{x:e.clientX,y:e.clientY});
    }
    function click(e) {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
        return;
      const hit=hitUnit(e);
      select.current(hit?.id||null,{x:e.clientX,y:e.clientY});
    }
    renderer.domElement.addEventListener("pointerdown", pd, true);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointercancel", pointerEnd);
    renderer.domElement.addEventListener("pointerup", click);
    renderer.domElement.addEventListener("pointerup", pointerEnd);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      if (rt.group) dispose(rt.group);
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    r.renderer.domElement.style.cursor=settings.moveEnabled?'grab':'default';
    if (r.group) {
      r.scene.remove(r.group);
      dispose(r.group);
    }
    r.group = buildScene(project, plan, settings);
    r.scene.add(r.group);
    if (["door", "run"].includes(settings.mode)) {
      r.controls.minDistance = 80;
      r.controls.maxPolarAngle = Math.PI;
      const bounds = new T.Box3().setFromObject(r.group),
        center = bounds.getCenter(new T.Vector3()),
        size = bounds.getSize(new T.Vector3());
      const distance =
        Math.max(size.x / Math.max(0.4, r.camera.aspect), size.y, 300) * 1.65;
      r.camera.position.set(
        center.x + distance * 0.3,
        center.y + distance * 0.15,
        distance,
      );
      r.controls.target.copy(center);
      r.controls.update();
    } else if (["door", "run"].includes(r.lastMode)) {
      r.controls.minDistance = 900;
      r.controls.maxPolarAngle = Math.PI * 0.495;
      r.camera.position.set(
        -project.room.width * 0.45,
        project.room.height * 1.65,
        project.room.depth * 1.8,
      );
      r.controls.target.set(
        project.room.width / 2,
        800,
        project.room.depth / 2,
      );
      r.controls.update();
    }
    r.lastMode = settings.mode;
  }, [project, plan, settings]);
  useImperativeHandle(
    ref,
    () => ({
      view(name) {
        const r = runtime.current;
        if (!r) return;
        const { width: w, depth: d, height: h } = data.current.project.room;
        const target = new T.Vector3(w / 2, 850, d / 2);
        let pos = {
          perspective: [-w * 0.45, h * 1.65, d * 1.8],
          top: [w / 2, Math.max(w, d) * 1.7, d / 2 + 1],
          A: [w / 2, 1300, d * 2],
          B: [-w, 1300, d / 2],
          C: [w / 2, 1300, -d],
          D: [w * 2, 1300, d / 2],
        }[name] || [-w * 0.45, h * 1.65, d * 1.8];
        r.camera.position.set(...pos);
        r.controls.target.copy(target);
        r.controls.update();
      },
      capture(name = "perspective", mode = "finished") {
        const r = runtime.current;
        if (!r) throw Error("3D renderer is unavailable.");
        const { project: p, plan } = data.current,
          { width: w, depth: d, height: h } = p.room;
        const scene = new T.Scene();
        scene.background = new T.Color("#f0f3f0");
        scene.add(new T.HemisphereLight("#ffffff", "#a5b5ad", 2.5));
        const light = new T.DirectionalLight("#fff6eb", 3);
        light.position.set(-4000, 7000, 5000);
        scene.add(light);
        const g = buildScene(p, plan, { mode, walls: false, labels: true });
        scene.add(g);
        let camera;
        if (["perspective", "iso"].includes(name)) {
          camera = new T.PerspectiveCamera(40, 1.5, 10, 60000);
          camera.position.set(...(name === "iso"
            ? [w * 1.45, h * 1.55, d * 1.45]
            : [-w * 0.45, h * 1.65, d * 1.8]));
          camera.lookAt(w / 2, 800, d / 2);
        } else {
          const span =
            name === "top"
              ? Math.max(w, d * 1.5) * 1.12
              : Math.max(w, d, h * 1.5) * 1.12;
          camera = new T.OrthographicCamera(
            -span / 2,
            span / 2,
            span / 3,
            -span / 3,
            1,
            60000,
          );
          const pos = {
            top: [w / 2, 20000, d / 2],
            A: [w / 2, h / 2, 20000],
            B: [-20000, h / 2, d / 2],
            C: [w / 2, h / 2, -20000],
            D: [20000, h / 2, d / 2],
          }[name];
          camera.position.set(...pos);
          if (name === "top") camera.up.set(0, 0, -1);
          camera.lookAt(w / 2, h / 2, d / 2);
        }
        const size = r.renderer.getSize(new T.Vector2()),
          ratio = r.renderer.getPixelRatio();
        r.renderer.setPixelRatio(1);
        r.renderer.setSize(1800, 1200, false);
        r.renderer.render(scene, camera);
        const url = r.renderer.domElement.toDataURL("image/png");
        r.renderer.setPixelRatio(ratio);
        r.renderer.setSize(size.x, size.y, false);
        dispose(g);
        r.renderer.render(r.scene, r.camera);
        return url;
      },
    }),
    [],
  );
  return (
    <div
      ref={host}
      className="scene"
      aria-label="Interactive aluminum kitchen 3D preview"
    />
  );
});
export default Scene;
