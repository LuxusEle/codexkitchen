// ═══════════════════════════════════════════════════════════════
//  generateSashBar — Sash Bar Generator
//  Creates a U-channel sash bar with orientation + flipFace support
// ═══════════════════════════════════════════════════════════════

function generateSashBar(params) {
  const orient = params.orientation || 'X';
  const scene = params.scene;
  const uL = (params.length    || 350)  / 1000;
  const uW = (params.width     || 25.4) / 1000;
  const uH = (params.height    || 38.1) / 1000;
  const T  = (params.thickness || 2)    / 1000;
  const ox = (params.originX   || 0)    / 1000;
  const oy = (params.originY   || 0)    / 1000;
  const oz = (params.lift      || 0)    / 1000;
  const L = uL, W = uW, H = uH;
  const BX = L/2, BY = H/2, BZ = W/2;

  const boxH = (params.boxHeight || 25) / 1000;
  const uDepth   = (params.uDepth   !== undefined ? params.uDepth   / 1000 : H - boxH);
  const uRetract = (params.uRetract !== undefined ? params.uRetract / 1000 : 0);
  const uExtend  = (params.uExtend  !== undefined ? params.uExtend  / 1000 : params.lipWidth  ? params.lipWidth  / 1000 : 10 / 1000);
  const uReturn  = (params.uReturn  !== undefined ? params.uReturn  / 1000 : params.lipReturn ? params.lipReturn / 1000 : 4  / 1000);
  const uTop = boxH + uDepth;

  const meshes = [];
  function wall(name, w, d, h, dx, dy, dz) {
    const m = BABYLON.MeshBuilder.CreateBox(name, {width:w, depth:d, height:h}, scene);
    m.position.set(BX + dx, BY + dy, BZ + dz);
    meshes.push(m);
  }

  // 6 walls: bottom, left_short, right_tall, mid_shelf, top_lip_h, top_lip_v
  wall('bottom',     L, W, T,      0, -H/2 + T/2,   0);
  wall('left_short', L, T, boxH,   0, (boxH/2)-H/2, -W/2 + T/2);
  wall('right_tall', L, T, uTop,   0, (uTop/2)-H/2,  W/2 - T/2);
  wall('mid_shelf',  L, W, T,      0, (boxH-T/2)-H/2, 0);
  wall('top_lip_h',  L, uExtend, T, 0, (uTop-T/2)-H/2, W/2 - uRetract - uExtend/2);
  wall('top_lip_v',  L, T, uReturn, 0, (uTop-T-uReturn/2)-H/2, W/2 - uRetract - uExtend + T/2);

  // FlipFace mirroring
  if (params.flipFace === true) {
    meshes.forEach(function (m) { m.position.y = H - m.position.y; });
  }
  if (params.flipDepth === true) {
    meshes.forEach(function (m) { m.position.z = W - m.position.z; });
  }

  // Pivot
  const pivot = new BABYLON.TransformNode('pvt_'+params.id, scene);
  pivot.position.set(ox, oz, oy);
  if (orient === 'Y') { pivot.rotation.y = Math.PI / 2; pivot.position.z = oy + L; }
  if (orient === 'Z') { pivot.rotation.z = -Math.PI / 2; pivot.position.y = oz + L; }
  meshes.forEach(m => m.parent = pivot);
  pivot.computeWorldMatrix(true);

  // Channel metadata
  var channelMouthLocal = new BABYLON.Vector3(L/2, uTop - T - uReturn/2, W - uRetract - uExtend);
  var channelNormalLocal = new BABYLON.Vector3(0, 1, 0);
  if (params.flipFace === true) { channelNormalLocal = channelNormalLocal.scale(-1); }
  if (params.flipDepth === true) { channelMouthLocal.z = W - channelMouthLocal.z; }
  pivot.metadata = pivot.metadata || {};
  pivot.metadata.sash = { id: params.id || 'SASH', channelMouthLocal, channelNormalLocal, flipFace: params.flipFace === true, flipDepth: params.flipDepth === true };

  const mm = (v) => +(v * 1000).toFixed(2);
  const T_2 = T / 2;
  const startRad = Math.abs(BABYLON.Tools.ToRadians(params.miterStart || 0));
  const endRad   = Math.abs(BABYLON.Tools.ToRadians(params.miterEnd || 0));

  const localCorners = [
    [0,0,0],[L,0,0],[L,W,0],[0,W,0],
    [0,0,H],[L,0,H],[L,W,H],[0,W,H]
  ];
  const verts = localCorners.map(p => {
    let local = new BABYLON.Vector3(p[0], p[2], p[1]);
    if (p[0] === 0 && params.miterStart) local.x += (W - local.z) * Math.tan(startRad);
    if (p[0] === L && params.miterEnd) local.x -= (W - local.z) * Math.tan(endRad);
    const w = BABYLON.Vector3.TransformCoordinates(local, pivot.getWorldMatrix());
    return { x_mm: mm(w.x), y_mm: mm(w.z), z_mm: mm(w.y) };
  });

  const localInnerCorners = [
    [T_2, T_2, T_2], [L-T_2, T_2, T_2], [L-T_2, W-T_2, T_2], [T_2, W-T_2, T_2],
    [T_2, T_2, H-T_2], [L-T_2, T_2, H-T_2], [L-T_2, W-T_2, H-T_2], [T_2, W-T_2, H-T_2]
  ];
  const iVerts = localInnerCorners.map(p => {
    let localInner = new BABYLON.Vector3(p[0], p[2], p[1]);
    if (p[0] < L/2 && params.miterStart) localInner.x += (W - localInner.z) * Math.tan(startRad);
    if (p[0] > L/2 && params.miterEnd) localInner.x -= (W - localInner.z) * Math.tan(endRad);
    const wInner = BABYLON.Vector3.TransformCoordinates(localInner, pivot.getWorldMatrix());
    return { x_mm: mm(wInner.x), y_mm: mm(wInner.z), z_mm: mm(wInner.y) };
  });

  let bMin = { x:Infinity, y:Infinity, z:Infinity }, bMax = { x:-Infinity, y:-Infinity, z:-Infinity };
  localCorners.forEach(p => {
    const local = new BABYLON.Vector3(p[0], p[2], p[1]);
    const w = BABYLON.Vector3.TransformCoordinates(local, pivot.getWorldMatrix());
    bMin.x = Math.min(bMin.x,w.x); bMin.y = Math.min(bMin.y,w.y); bMin.z = Math.min(bMin.z,w.z);
    bMax.x = Math.max(bMax.x,w.x); bMax.y = Math.max(bMax.y,w.y); bMax.z = Math.max(bMax.z,w.z);
  });

  const part = {
    id: params.id || 'SASH', label: params.label || 'sash_bar',
    origin_WORLD_mm: { x: mm(bMin.x), y: mm(bMin.z), z: mm(bMin.y) },
    end_WORLD_mm:    { x: mm(bMax.x), y: mm(bMax.z), z: mm(bMax.y) },
    dimensions: { length_X_mm: mm(bMax.x-bMin.x), width_Y_mm: mm(bMax.z-bMin.z), height_Z_mm: mm(bMax.y-bMin.y) },
    vertices: verts.map((v,i) => ({ id:'V'+(i+1), ...v }))
  };

  const eIdx = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const toBab = (v) => new BABYLON.Vector3(v.x_mm/1000, v.z_mm/1000, v.y_mm/1000);
  const outerEdges = eIdx.map(([a,b]) => [toBab(verts[a]), toBab(verts[b])]);
  const innerEdges = eIdx.map(([a,b]) => [toBab(iVerts[a]), toBab(iVerts[b])]);

  return { meshes, outerEdges, innerEdges, part };
}
