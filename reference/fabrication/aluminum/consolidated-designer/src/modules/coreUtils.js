import * as BABYLON from 'babylonjs';

export function generateBoxBar(params) {
  const scene = params.scene;
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

  let customProfile = null;
  let customProfileName = null;
  
  const meshes = [];
  function wall(name, w, d, h, dx, dy, dz) {
    const m = BABYLON.MeshBuilder.CreateBox(name, {width:w, depth:d, height:h}, scene);
    m.position.set(BX + dx, BY + dy, BZ + dz);
    meshes.push(m);
  }
  wall('f', L, T, H, 0, 0,  W/2 - T/2);  // Y+ face
  wall('b', L, T, H, 0, 0, -W/2 + T/2);  // Y- face
  wall('m', L, W, T, 0, -H/2 + T/2, 0);  // Z- face
  wall('t', L, W, T, 0,  H/2 - T/2, 0);  // Z+ face

  const pivot = new BABYLON.TransformNode('pvt_'+params.id, scene);
  pivot.position.x = ox;
  pivot.position.y = oz;
  pivot.position.z = oy;
  if (orient === 'Y') {
    pivot.rotation.y = Math.PI / 2;
    pivot.position.z = oy + L;
  }
  if (orient === 'Z') {
    pivot.rotation.z = -Math.PI / 2;
    pivot.position.y = oz + L;
  }
  meshes.forEach(m => m.parent = pivot);
  pivot.computeWorldMatrix(true);

  const localCorners = [
    [0,0,0],[L,0,0],[L,W,0],[0,W,0],
    [0,0,H],[L,0,H],[L,W,H],[0,W,H]
  ];
  const allW = localCorners.map(p => {
    const local = new BABYLON.Vector3(p[0], p[2], p[1]);
    const w = BABYLON.Vector3.TransformCoordinates(local, pivot.getWorldMatrix());
    return {x:w.x, y:w.y, z:w.z};
  });
  
  let bMin = {x:Infinity,y:Infinity,z:Infinity}, bMax = {x:-Infinity,y:-Infinity,z:-Infinity};
  for (const p of allW) {
    bMin.x = Math.min(bMin.x, p.x); bMin.y = Math.min(bMin.y, p.y); bMin.z = Math.min(bMin.z, p.z);
    bMax.x = Math.max(bMax.x, p.x); bMax.y = Math.max(bMax.y, p.y); bMax.z = Math.max(bMax.z, p.z);
  }
  const mm = (v) => +(v*1000).toFixed(2);

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
    }
  };

  return { meshes, part };
}
