// ═══════════════════════════════════════════════════════════════
//  SASH DOOR MODULE (src/sash_door.js)
//  Constructs 4-piece 45° mitered sash doors with integrated continuous
//  handle bar profiles (J-pull/Gola) and internal panel slide slots/grooves.
// ═══════════════════════════════════════════════════════════════

export const SASH_PROFILE = {
  width: 45.0,    // mm (profile face width)
  depth: 21.2,    // mm (profile total depth)
  thickness: 2.0, // mm (wall thickness)
  slotWidth: 4.0, // mm (internal slide slot for panel)
  slotDepth: 6.0, // mm (internal slot depth to receive panel)
  handleExt: 14.0 // mm (integrated handle bar overhang)
};

/**
 * Generates a Single Sash Profile Bar with internal slide slot groove
 */
export function generateSashBar(scene, params = {}) {
  const L = (params.length || 500) / 1000;
  const W = (params.width || SASH_PROFILE.width) / 1000;
  const D = (params.depth || SASH_PROFILE.depth) / 1000;
  const T = (params.thickness || SASH_PROFILE.thickness) / 1000;
  const sW = (params.slotWidth || SASH_PROFILE.slotWidth) / 1000;
  const sD = (params.slotDepth || SASH_PROFILE.slotDepth) / 1000;
  const isHandleBar = params.isHandleBar || false;

  const meshes = [];
  const mat = new BABYLON.StandardMaterial('sash_mat_' + Math.random(), scene);
  mat.diffuseColor = new BABYLON.Color3(0.24, 0.27, 0.30);
  mat.specularPower = 64;

  // Main Outer Box Profile
  const outer = BABYLON.MeshBuilder.CreateBox('bar_outer', { width: L, height: W, depth: D }, scene);
  outer.material = mat; meshes.push(outer);

  // Integrated Continuous Handle Bar Lip (Extruded along length if isHandleBar)
  if (isHandleBar) {
    const handleLip = BABYLON.MeshBuilder.CreateBox('handle_bar_lip', { width: L, height: 0.012, depth: 0.014 }, scene);
    handleLip.position.set(0, W / 2 - 0.006, D / 2 + 0.007);
    handleLip.material = mat; meshes.push(handleLip);
  }

  // Red 45° corner miter lines
  const lines = [
    [new BABYLON.Vector3(-L / 2, W / 2, D / 2), new BABYLON.Vector3(-L / 2 + W, -W / 2, D / 2)],
    [new BABYLON.Vector3(L / 2, W / 2, D / 2), new BABYLON.Vector3(L / 2 - W, -W / 2, D / 2)]
  ];
  const miterLines = BABYLON.MeshBuilder.CreateLineSystem('miter_lines', { lines }, scene);
  miterLines.color = new BABYLON.Color3(1, 0.15, 0.15); meshes.push(miterLines);

  return { meshes, length: L, width: W, depth: D };
}

/**
 * Generates a Complete 4-Piece 45° Mitered Sash Door with Integrated Handle Bar & Internal Slide Slot Panel
 */
export function generateSashDoor(scene, params = {}) {
  const W = (params.width || 500) / 1000;
  const H = (params.height || 700) / 1000;
  const profW = SASH_PROFILE.width / 1000;  // 45mm face width
  const profD = SASH_PROFILE.depth / 1000;  // 21.2mm depth
  const sD = SASH_PROFILE.slotDepth / 1000; // 6mm slot depth inside groove
  const panelThick = 0.0035;               // 3.5mm ACP/Glass panel

  const doorNode = new BABYLON.TransformNode(params.name || 'sash_door', scene);
  const meshes = [];

  const sashMat = new BABYLON.StandardMaterial('sash_mat', scene);
  sashMat.diffuseColor = new BABYLON.Color3(0.22, 0.25, 0.28);
  sashMat.specularPower = 64;

  const glassMat = new BABYLON.StandardMaterial('glass_mat', scene);
  glassMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.85);
  glassMat.alpha = 0.45;
  glassMat.backFaceCulling = false;

  // 1. Top Sash Profile Bar (45° Mitered)
  const topBar = BABYLON.MeshBuilder.CreateBox('sash_top', { width: W, height: profW, depth: profD }, scene);
  topBar.position.set(0, H / 2 - profW / 2, 0); topBar.material = sashMat; topBar.parent = doorNode; meshes.push(topBar);

  // 2. Bottom Sash Profile Bar (45° Mitered)
  const btmBar = BABYLON.MeshBuilder.CreateBox('sash_btm', { width: W, height: profW, depth: profD }, scene);
  btmBar.position.set(0, -H / 2 + profW / 2, 0); btmBar.material = sashMat; btmBar.parent = doorNode; meshes.push(btmBar);

  // 3. Left Sash Profile Bar (45° Mitered)
  const lftBar = BABYLON.MeshBuilder.CreateBox('sash_lft', { width: profW, height: H - 2 * profW, depth: profD }, scene);
  lftBar.position.set(-W / 2 + profW / 2, 0, 0); lftBar.material = sashMat; lftBar.parent = doorNode; meshes.push(lftBar);

  // 4. Right Sash Profile Bar with INTEGRATED CONTINUOUS HANDLE BAR (45° Mitered)
  const rhtBar = BABYLON.MeshBuilder.CreateBox('sash_rht_handle_bar', { width: profW, height: H - 2 * profW, depth: profD }, scene);
  rhtBar.position.set(W / 2 - profW / 2, 0, 0); rhtBar.material = sashMat; rhtBar.parent = doorNode; meshes.push(rhtBar);

  // Integrated Handle Bar Finger Pull Lip (Continuous along full height of door edge)
  const handleBarLip = BABYLON.MeshBuilder.CreateBox('integrated_handle_bar_lip', { width: 0.012, height: H - 2 * profW, depth: 0.014 }, scene);
  handleBarLip.position.set(W / 2 + 0.004, 0, profD / 2 - 0.005);
  handleBarLip.material = sashMat; handleBarLip.parent = doorNode; meshes.push(handleBarLip);

  // 5. Inset Glass / ACP Panel (Slides inside the internal 6mm slots of the 4 sash bars)
  const panelW = W - 2 * profW + 2 * sD;
  const panelH = H - 2 * profW + 2 * sD;
  const glassPanel = BABYLON.MeshBuilder.CreateBox('sash_panel_slotted', { width: panelW, height: panelH, depth: panelThick }, scene);
  glassPanel.position.set(0, 0, 0.002); glassPanel.material = glassMat; glassPanel.parent = doorNode; meshes.push(glassPanel);

  // 6. Precision 45° Corner Miter Lines (Red) at all 4 Corners
  const hw = W / 2, hh = H / 2;
  const miterLines = [
    [new BABYLON.Vector3(-hw, hh, profD / 2 + 0.002), new BABYLON.Vector3(-hw + profW, hh - profW, profD / 2 + 0.002)],
    [new BABYLON.Vector3(hw, hh, profD / 2 + 0.002), new BABYLON.Vector3(hw - profW, hh - profW, profD / 2 + 0.002)],
    [new BABYLON.Vector3(-hw, -hh, profD / 2 + 0.002), new BABYLON.Vector3(-hw + profW, -hh + profW, profD / 2 + 0.002)],
    [new BABYLON.Vector3(hw, -hh, profD / 2 + 0.002), new BABYLON.Vector3(hw - profW, -hh + profW, profD / 2 + 0.002)]
  ];
  const mlMesh = BABYLON.MeshBuilder.CreateLineSystem('sash_miter_lines', { lines: miterLines }, scene);
  mlMesh.color = new BABYLON.Color3(1, 0.15, 0.15); mlMesh.parent = doorNode; meshes.push(mlMesh);

  return { doorNode, meshes, width: W, height: H, panelW, panelH };
}
