// ═══════════════════════════════════════════════════════════════
//  generateBoxBar — Box Bar Core Generator
//  Creates a hollow aluminum box bar (tube) in a Babylon.js scene
//  Returns: { meshes, outerEdges, part }
//    meshes[]    — Babylon.js wall meshes
//    outerEdges[] — Babylon.js edge lines
//    part        — measured coordinate data (origin, end, dimensions, vertices)
//
//  Coordinate system: X=length, Y=depth, Z=height (universal)
//  Tube open on X ends (or Y ends with orientation='Y')
//
//  Params:
//    length      — mm, along main axis (X by default)
//    width       — mm, along Y (depth)
//    height      — mm, along Z (height)
//    thickness   — mm, wall thickness
//    lift        — mm, Z elevation from floor
//    orientation — 'X' (default) or 'Y'
//    originX,Y,Z — mm, world origin corner
//    id, label   — for part identification
// ═══════════════════════════════════════════════════════════════

function generateBoxBar(params) {
  const orient = params.orientation || 'X';
  const uL = (params.length  || 350)  / 1000;
  const uW = (params.width   || 25.4) / 1000;
  const uH = (params.height  || 38.1) / 1000;
  const T  = (params.thickness || 2)  / 1000;
  const ox = (params.originX || 0)    / 1000;
  const oy = (params.originY || 0)    / 1000;
  const oz = (params.lift    || 0)    / 1000;
  const L = uL, W = uW, H = uH;
  const BX = L/2, BY = H/2, BZ = W/2;

  // Check for custom profiles
  let customProfile = null;
  let customProfileName = null;
  if (typeof localStorage !== 'undefined') {
      const savedProfiles = JSON.parse(localStorage.getItem('customProfiles') || '{}');
      for (const [name, prof] of Object.entries(savedProfiles)) {
          if (prof.usage === 'all' || 
             (prof.usage === 'horizontal' && orient === 'X') || 
             (prof.usage === 'vertical' && orient === 'Z') || 
             (prof.usage === 'strut' && orient === 'Y')) {
              customProfile = prof;
              customProfileName = name;
              break;
          }
      }
  }

  // ─── WALLS OR CUSTOM MESH ───
  const meshes = [];
  if (customProfile && window.generateCustomBar) {
      // Generate the custom extrusion
      // GenerateCustomBar assumes XZ plane extrusion along Y.
      const m = window.generateCustomBar(customProfileName, params.length, null, scene, earcut);
      // Center it similar to the box walls so it aligns with pivot logic
      const mD = m.customProfileData;
      // We need to shift it so its bounding box center aligns with BX, BY, BZ
      // Wait, normal walls are placed around (BX, BY, BZ).
      m.position.set(BX, BY - (mD.height/1000)/2, BZ - (mD.width/1000)/2);
      m.rotation.z = -Math.PI / 2; // Orient along X
      m.rotation.x = -Math.PI / 2;
      meshes.push(m);
      
      // Override params so the bounding box part data calculation uses the custom profile size!
      params.width = mD.width;
      params.height = mD.height;
  } else {
      function wall(name, w, d, h, dx, dy, dz) {
        const m = new BABYLON.MeshBuilder.CreateBox(name, {width:w, depth:d, height:h}, scene);
        m.position.set(BX + dx, BY + dy, BZ + dz);
        meshes.push(m);
      }
      wall('f', L, T, H, 0, 0,  W/2 - T/2);  // Y+ face
      wall('b', L, T, H, 0, 0, -W/2 + T/2);  // Y- face
      wall('m', L, W, T, 0, -H/2 + T/2, 0);  // Z- face
      wall('t', L, W, T, 0,  H/2 - T/2, 0);  // Z+ face
  }

  // ─── POSITION & ROTATE ───
  const pivot = new BABYLON.TransformNode('pvt_'+params.id, scene);
  pivot.position.x = ox;
  pivot.position.y = oz;   // spec Z → Babylon Y
  pivot.position.z = oy;   // spec Y → Babylon Z
  if (orient === 'Y') {
    pivot.rotation.y = Math.PI / 2;  // local X→-Z, local Z→+X
    pivot.position.z = oy + L;       // local X=0→Z=oy+L, X=L→Z=oy
  }
  if (orient === 'Z') {
    pivot.rotation.z = -Math.PI / 2; // local X→-Y, local Y→+X, local Z→Z
    pivot.position.y = oz + L;       // local X→-Y: X=0→Y=oz+L, X=L→Y=oz
  }
  meshes.forEach(m => m.parent = pivot);
  // Force world matrix computation on parent AND children
  pivot.computeWorldMatrix(true);

  // ─── COMPUTE BOUNDING BOX DIRECTLY FROM PARAMS + PIVOT TRANSFORM ───
  // Bar spec corners: [specX, specY, specZ] where W=depth, H=height
  const localCorners = [
    [0,0,0],[L,0,0],[L,W,0],[0,W,0],
    [0,0,H],[L,0,H],[L,W,H],[0,W,H]
  ];
  const allW = localCorners.map(p => {
    const local = new BABYLON.Vector3(p[0], p[2], p[1]); // Babylon: (specX, specZ, specY)
    const w = BABYLON.Vector3.TransformCoordinates(local, pivot.getWorldMatrix());
    return {x:w.x, y:w.y, z:w.z};
  });
  let bMin = {x:Infinity,y:Infinity,z:Infinity}, bMax = {x:-Infinity,y:-Infinity,z:-Infinity};
  for (const p of allW) {
    bMin.x = Math.min(bMin.x, p.x); bMin.y = Math.min(bMin.y, p.y); bMin.z = Math.min(bMin.z, p.z);
    bMax.x = Math.max(bMax.x, p.x); bMax.y = Math.max(bMax.y, p.y); bMax.z = Math.max(bMax.z, p.z);
  }
  const mm = (v) => +(v*1000).toFixed(2);

  // ─── 8 VERTICES FROM BOUNDING BOX CORNERS (reconstructed from min/max) ───
  const c = [
    [bMin.x,bMin.y,bMin.z],[bMax.x,bMin.y,bMin.z],[bMax.x,bMax.y,bMin.z],[bMin.x,bMax.y,bMin.z],
    [bMin.x,bMin.y,bMax.z],[bMax.x,bMin.y,bMax.z],[bMax.x,bMax.y,bMax.z],[bMin.x,bMax.y,bMax.z]
  ];
  const verts = c.map(p => ({x_mm:mm(p[0]), y_mm:mm(p[2]), z_mm:mm(p[1])}));

  // ─── INNER VERTICES (inset by wall thickness for cavity visualization) ───
  const T_2 = T / 2;
  const ci = [
    [bMin.x+T_2,bMin.y+T_2,bMin.z+T_2],[bMax.x-T_2,bMin.y+T_2,bMin.z+T_2],[bMax.x-T_2,bMax.y-T_2,bMin.z+T_2],[bMin.x+T_2,bMax.y-T_2,bMin.z+T_2],
    [bMin.x+T_2,bMin.y+T_2,bMax.z-T_2],[bMax.x-T_2,bMin.y+T_2,bMax.z-T_2],[bMax.x-T_2,bMax.y-T_2,bMax.z-T_2],[bMin.x+T_2,bMax.y-T_2,bMax.z-T_2]
  ];
  const iVerts = ci.map(p => ({x_mm:mm(p[0]), y_mm:mm(p[2]), z_mm:mm(p[1])}));

  // ─── PART DATA (source of truth for joints) ───
  const part = {
    id: params.id || 'BAR',
    label: params.label || 'box_bar',
    customProfileName: customProfileName,
    origin_WORLD_mm: {x:mm(bMin.x), y:mm(bMin.z), z:mm(bMin.y)},
    end_WORLD_mm:    {x:mm(bMax.x), y:mm(bMax.z), z:mm(bMax.y)},
    dimensions: {
      length_X_mm: mm(bMax.x - bMin.x),
      width_Y_mm:  mm(bMax.z - bMin.z),
      height_Z_mm: mm(bMax.y - bMin.y)
    },
    vertices: verts.map((v,i) => ({id:`V${i+1}`, ...v}))
  };

  // ─── EDGE LINES FROM VERTICES ───
  const eIdx = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const toBab = (v) => new BABYLON.Vector3(v.x_mm/1000, v.z_mm/1000, v.y_mm/1000);
  const outerEdges = eIdx.map(([a,b]) => [toBab(verts[a]), toBab(verts[b])]);
  const innerEdges = eIdx.map(([a,b]) => [toBab(iVerts[a]), toBab(iVerts[b])]);

  return { meshes, outerEdges, innerEdges, part };
}
