function generateSashFrame(params) {
  var scene = params.scene;
  var W = params.width || 300, H = params.height || 400;
  var BW = params.barWidth || 25.4, BH = params.barHeight || 38.1, T = params.thickness || 2;
  var lift = (params.lift || 0) / 1000;
  var Wm = W / 1000, Hm = H / 1000;
  var root = new BABYLON.TransformNode("door_root", scene);
  root.position.y = lift;

  function makeBar(id, len, x, y, z, rz) {
    var bar = generateBoxBar({
      id: id, length: len, width: BW, height: BH, thickness: T,
      lift: 0, originX: 0, originY: 0, orientation: "X"
    });
    var pvt = scene.getTransformNodeByName("pvt_" + id);
    pvt.rotation.z = rz;
    pvt.position.set(x, y, z);
    pvt.parent = root;
    return { pivot: pvt, meshes: bar.meshes, home: {x:x, y:y, z:z} };
  }

  var bars = {
    BOT: makeBar("BOT", W, 0,    0,    0, 0),
    RHT: makeBar("RHT", H, Wm,   0,    0, Math.PI / 2),
    TOP: makeBar("TOP", W, Wm,   Hm,   0, Math.PI),
    LFT: makeBar("LFT", H, 0,    Hm,   0, 3 * Math.PI / 2)
  };

  var panel = BABYLON.MeshBuilder.CreateBox("panel", {
    width: (W - 2 * BH) / 1000, height: (H - 2 * BH) / 1000, depth: 3 / 1000
  }, scene);
  panel.position.set(Wm / 2, Hm / 2, 0);
  panel.parent = root;

  var mat = new BABYLON.StandardMaterial("alm", scene);
  mat.diffuseColor = new BABYLON.Color3(0.55, 0.58, 0.62);
  var pmat = new BABYLON.StandardMaterial("hpl", scene);
  pmat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
  ["BOT","RHT","TOP","LFT"].forEach(function(id) {
    bars[id].pivot.getChildMeshes().forEach(function(m) { m.material = mat; });
  });
  panel.material = pmat;

  return { root: root, bars: bars, panel: panel, manufacturing: {doorW:W, doorH:H} };
}
