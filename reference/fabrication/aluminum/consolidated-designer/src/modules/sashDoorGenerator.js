import * as BABYLON from 'babylonjs';
import { generateBoxBar } from './coreUtils.js';

export function generateSashBar(params) {
  // We use generateBoxBar for the base mesh of the sash
  // In sashdoor.js, generateSashBar returns {meshes, ...}
  // To avoid circular or missing dependencies, we wrap it properly.
  const bParams = { ...params };
  bParams.thickness = params.thickness || 2;
  const bar = generateBoxBar(bParams);
  return bar;
}

export function applyMiterCSG(barMeshes, barLength, profWidth, profHeight, scene) {
  const W = profWidth / 1000; 
  const L = barLength / 1000;
  const sSize = W * 3;
  
  const sStart = BABYLON.MeshBuilder.CreateBox("sStart", {size: sSize}, scene);
  sStart.position.set(0, 0, 0);
  sStart.rotation.y = -Math.PI / 4;
  const shiftStart = (W / 2) / Math.SQRT2 - sSize / 2;
  sStart.translate(BABYLON.Axis.X, shiftStart, BABYLON.Space.LOCAL);
  const csgStart = BABYLON.CSG.FromMesh(sStart);
  
  const sEnd = BABYLON.MeshBuilder.CreateBox("sEnd", {size: sSize}, scene);
  sEnd.position.set(L, 0, 0);
  sEnd.rotation.y = Math.PI / 4;
  const shiftEnd = sSize / 2 - (W / 2) / Math.SQRT2;
  sEnd.translate(BABYLON.Axis.X, shiftEnd, BABYLON.Space.LOCAL);
  const csgEnd = BABYLON.CSG.FromMesh(sEnd);
  
  const newMeshes = [];
  barMeshes.forEach(m => {
    let csgM = BABYLON.CSG.FromMesh(m);
    csgM = csgM.subtract(csgStart);
    csgM = csgM.subtract(csgEnd);
    const newM = csgM.toMesh(m.name + "_m", m.material, scene);
    newM.parent = m.parent;
    newMeshes.push(newM);
    m.dispose();
  });
  
  sStart.dispose();
  sEnd.dispose();
  return newMeshes;
}

export function applyHingeCSG(barMeshes, barLength, profWidth, profHeight, bores, scene) {
  if (!bores || bores.length === 0) return barMeshes;
  let currentMeshes = barMeshes;
  
  bores.forEach(bore => {
      const bitHeight = 16 / 1000;
      const bit = BABYLON.MeshBuilder.CreateCylinder("drill", { diameter: (bore.diameter || 35) / 1000, height: bitHeight }, scene);
      bit.position.set(bore.yPos / 1000, (bitHeight / 2) - 0.001, (bore.offset || 22.5) / 1000);
      
      const bitMat = new BABYLON.StandardMaterial("bitMat", scene);
      bitMat.diffuseColor = new BABYLON.Color3(1, 0.15, 0.15); // Red CSG Drill
      bit.material = bitMat;
      
      const csgBit = BABYLON.CSG.FromMesh(bit);
      
      const newMeshes = [];
      currentMeshes.forEach(m => {
          const origMat = m.material || new BABYLON.StandardMaterial("def", scene);
          let csgM = BABYLON.CSG.FromMesh(m);
          csgM = csgM.subtract(csgBit);
          
          const multiMat = new BABYLON.MultiMaterial(m.name + "_multiMat", scene);
          multiMat.subMaterials = [origMat, bitMat, bitMat];
          
          const newM = csgM.toMesh(m.name + "_h", multiMat, scene, true);
          newM.parent = m.parent;
          newMeshes.push(newM);
          m.dispose();
      });
      currentMeshes = newMeshes;
      bit.dispose();
  });
  
  return currentMeshes;
}

export function generateDoor(params) {
  const scene = params.scene;
  const width = params.doorWidth || 600;
  const height = params.doorHeight || 800;
  
  const doorRoot = new BABYLON.TransformNode('doorRoot_' + (params.id || 'door'), scene);
  const meshes = [];
  const bars = [];

  const p = { ...params, scene, miterStart: 45, miterEnd: 45, flipDepth: false };
  const profW = params.width || 45;   
  const profH = params.height || 21.2; 
  const twist = Math.PI / 2; 

  function attachHandleLipIfSelected(barId, barLength, parentNode) {
    if (params.handleBar === barId) {
      const lip = BABYLON.MeshBuilder.CreateBox(barId + '_handle_lip', {
        width: barLength / 1000, height: 0.012, depth: 0.014
      }, scene);
      lip.material = new BABYLON.StandardMaterial(barId + '_lip_mat', scene);
      lip.material.diffuseColor = new BABYLON.Color3(0.18, 0.20, 0.24);
      lip.material.specularPower = 64;
      lip.parent = parentNode;
      lip.position.set((barLength / 2) / 1000, 0.006, 0.014);
      meshes.push(lip);
    }
  }

  // BOT
  p.id = 'BOT'; p.length = width;
  const bot = generateSashBar(p);
  if (p.useMiter !== false) bot.meshes = applyMiterCSG(bot.meshes, width, profW, profH, scene);
  const botBores = (params.hingeBores || []).filter(b => b.bar === 'BOT');
  if (botBores.length > 0) bot.meshes = applyHingeCSG(bot.meshes, width, profW, profH, botBores, scene);
  bars.push(bot);
  const fBot = new BABYLON.TransformNode('fBot', scene);
  fBot.parent = doorRoot; fBot.rotation.z = 0; fBot.position.set(0, profW / 1000, 0);
  bot.meshes.forEach(m => { m.parent.parent = fBot; m.parent.rotation.x = twist; meshes.push(m); });
  attachHandleLipIfSelected('BOT', width, fBot);

  // RHT
  p.id = 'RHT'; p.length = height;
  const rht = generateSashBar(p);
  if (p.useMiter !== false) rht.meshes = applyMiterCSG(rht.meshes, height, profW, profH, scene);
  const rhtBores = (params.hingeBores || []).filter(b => b.bar === 'RHT');
  if (rhtBores.length > 0) rht.meshes = applyHingeCSG(rht.meshes, height, profW, profH, rhtBores, scene);
  bars.push(rht);
  const fRht = new BABYLON.TransformNode('fRht', scene);
  fRht.parent = doorRoot; fRht.rotation.z = Math.PI / 2; fRht.position.set((width - profW) / 1000, 0, 0);
  rht.meshes.forEach(m => { m.parent.parent = fRht; m.parent.rotation.x = twist; meshes.push(m); });
  attachHandleLipIfSelected('RHT', height, fRht);

  // TOP
  p.id = 'TOP'; p.length = width;
  const top = generateSashBar(p);
  if (p.useMiter !== false) top.meshes = applyMiterCSG(top.meshes, width, profW, profH, scene);
  const topBores = (params.hingeBores || []).filter(b => b.bar === 'TOP');
  if (topBores.length > 0) top.meshes = applyHingeCSG(top.meshes, width, profW, profH, topBores, scene);
  bars.push(top);
  const fTop = new BABYLON.TransformNode('fTop', scene);
  fTop.parent = doorRoot; fTop.rotation.z = Math.PI; fTop.position.set(width / 1000, (height - profW) / 1000, 0);
  top.meshes.forEach(m => { m.parent.parent = fTop; m.parent.rotation.x = twist; meshes.push(m); });
  attachHandleLipIfSelected('TOP', width, fTop);

  // LFT
  p.id = 'LFT'; p.length = height;
  const lft = generateSashBar(p);
  if (p.useMiter !== false) lft.meshes = applyMiterCSG(lft.meshes, height, profW, profH, scene);
  const lftBores = (params.hingeBores || []).filter(b => b.bar === 'LFT');
  if (lftBores.length > 0) lft.meshes = applyHingeCSG(lft.meshes, height, profW, profH, lftBores, scene);
  bars.push(lft);
  const fLft = new BABYLON.TransformNode('fLft', scene);
  fLft.parent = doorRoot; fLft.rotation.z = Math.PI * 1.5; fLft.position.set(profW / 1000, height / 1000, 0);
  lft.meshes.forEach(m => { m.parent.parent = fLft; m.parent.rotation.x = twist; meshes.push(m); });
  attachHandleLipIfSelected('LFT', height, fLft);

  // Panel
  const panelThick = 3;
  const uExtend = (params.uExtend || 10);
  const uRetract = (params.uRetract || 0);
  const glassWidth = width - 2 * (uExtend + uRetract);
  const glassHeight = height - 2 * (uExtend + uRetract);
  const boxH = (params.boxHeight || 15);
  const uDepth = (params.uDepth !== undefined ? params.uDepth : profH - boxH);
  const glassZ = (boxH + uDepth - panelThick / 2) / 1000;
  
  const glassMat = new BABYLON.StandardMaterial('glassMat', scene);
  glassMat.diffuseColor = BABYLON.Color3.FromHexString(params.panelColor || '#1e293b');
  glassMat.alpha = params.panelType === 'glass' ? 0.5 : 1.0;
  
  const panelMesh = BABYLON.MeshBuilder.CreateBox('panel', { width: glassWidth / 1000, height: glassHeight / 1000, depth: panelThick / 1000 }, scene);
  panelMesh.parent = doorRoot;
  panelMesh.position.set(width / 2000, height / 2000, glassZ);
  panelMesh.material = glassMat;
  meshes.push(panelMesh);

  return { doorRoot, meshes, bars, panelMesh };
}
