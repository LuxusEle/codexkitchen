import * as BABYLON from 'babylonjs';
import { generateBoxBar } from './coreUtils.js';
import { generateDoor } from './sashDoorGenerator.js';

export function buildCabinet(params) {
    const scene = params.scene;
    let totalLength = params.width || 1200;
    
    const isBase = params.isBaseCabinet !== undefined ? params.isBaseCabinet : true;
    const showLabels = params.showLabels !== undefined ? params.showLabels : false;
    const advancedMode = params.advancedMode !== undefined ? params.advancedMode : true;
    
    const T = 1.2; 
    const PW = 25.4; 
    const PH = 38.1; 
    
    const TK = isBase ? PH : 0; 
    const TK_RECESS = 50;
    const SIDE_THICKNESS = advancedMode ? 21.2 : 0; 
    const H = (params.height || 780) - TK;
    const D = params.depth || 580;
    const crossLen = D - PW * 2;
    const CL = 3;    
    
    const MAX_BAR_LENGTH = params.maxBarLength || 2440;
    const STD_SIZES = [1200, 1000, 900, 750, 600, 450, 350, 250];

    const frameMeshes = [];
    const claddingMeshes = [];
    const doors = [];
    const cncData = { panels: [], bars: [] };
    
    const frameMat = new BABYLON.StandardMaterial('frameMat', scene);
    frameMat.diffuseColor = BABYLON.Color3.FromHexString('#555555');
    const cm = new BABYLON.StandardMaterial('cm', scene);
    cm.diffuseColor = BABYLON.Color3.FromHexString('#e2e8f0'); 

    function addBar(bParams, typeGroup) {
        bParams.scene = scene;
        bParams.lift = (bParams.lift || 0) + TK;
        const b = generateBoxBar(bParams);
        b.meshes.forEach(m => {
            m.material = frameMat;
            frameMeshes.push(m);
        });
        cncData.bars.push({
            l: bParams.length / 1000, 
            id: typeGroup || 'BAR',
            isSash: (typeGroup === 'SASH'),
            customProfileName: b.part.customProfileName
        });
        return b;
    }
    
    function pnl(w, d, h, x, y, z, name, color) {
        const m = BABYLON.MeshBuilder.CreateBox('cld', {width: w / 1000, depth: d / 1000, height: h / 1000}, scene);
        m.position.set(x / 1000, (y + TK) / 1000, z / 1000);
        m.material = cm;
        if(color) {
            const mat = new BABYLON.StandardMaterial('pnlmat', scene);
            mat.diffuseColor = BABYLON.Color3.FromHexString(color);
            m.material = mat;
        }
        claddingMeshes.push(m);
    }

    const boxes = [totalLength];
    let startX = 0;
    let boxWidth = totalLength;
    let innerH = H - PH * 2;
    let railLen = boxWidth - (SIDE_THICKNESS * 2);
    let railStartX = startX + SIDE_THICKNESS;

    // Base Frame
    if (isBase) {
        addBar({id:`TK_FT`, length: boxWidth, width: PW, height: PH, originX: startX, originY: -PW - TK_RECESS, lift: -TK});
        addBar({id:`TK_BK`, length: boxWidth, width: PW, height: PH, originX: startX, originY: -D, lift: -TK});
    }

    // Rails
    addBar({id:`B_FT`, length: railLen, width: PW, height: PH, lift: 0, thickness: T, originX: railStartX, originY: -PW}, 'RAIL');
    addBar({id:`B_BK`, length: railLen, width: PW, height: PH, lift: 0, thickness: T, originX: railStartX, originY: -D}, 'RAIL');
    
    let shfH = H/2 - PH/2;
    addBar({id:`M_FT`, length: railLen, width: PW, height: PH, lift: shfH, thickness: T, originX: railStartX, originY: -PW}, 'RAIL');
    addBar({id:`M_BK`, length: railLen, width: PW, height: PH, lift: shfH, thickness: T, originX: railStartX, originY: -D}, 'RAIL');

    addBar({id:`T_FT`, length: railLen, width: PW, height: PH, lift: H - PH, thickness: T, originX: railStartX, originY: -PW}, 'RAIL');
    addBar({id:`T_BK`, length: railLen, width: PW, height: PH, lift: H - PH, thickness: T, originX: railStartX, originY: -D}, 'RAIL');

    // Posts
    let pLen = H - PH * 2;
    addBar({id:`P_FT_LFT`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: railStartX, originY: -PW}, 'POST');
    addBar({id:`P_BK_LFT`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: railStartX, originY: -D}, 'POST');
    
    addBar({id:`P_FT_RHT`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: railStartX + railLen - PW, originY: -PW}, 'POST');
    addBar({id:`P_BK_RHT`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: railStartX + railLen - PW, originY: -D}, 'POST');

    // Panels
    pnl(railLen, CL, innerH, railStartX + railLen/2, H/2, -D + PW + CL/2, 'BAK', '#e65100');
    cncData.panels.push({ name: `BAK`, w: railLen, d: innerH, color: '#e65100', type: 'acp' });

    cncData.panels.push({ name: `BTM`, w: railLen, d: D - PW*2, color: '#2196f3', type: 'acp' });
    cncData.panels.push({ name: `TOP`, w: railLen, d: D, color: '#ffa726', type: 'acp' });
    cncData.panels.push({ name: `SHF`, w: railLen, d: D - PW*2, color: '#4caf50', type: 'acp' });

    // Side Panels / Sash Doors
    const doorParams = { scene, width: 45, height: 21.2, thickness: 1.5, boxHeight: 16.2, uDepth: 5, uRetract: 0, uExtend: 10, uReturn: 2 };
    
    if (advancedMode) {
        // Left Side
        const dpL = { ...doorParams, doorWidth: D, doorHeight: H, panelType: 'acp', hingeBores: [] };
        const sL = generateDoor(dpL);
        sL.doorRoot.position.set((startX + SIDE_THICKNESS) / 1000, TK / 1000, -D / 1000);
        sL.doorRoot.rotation.y = -Math.PI / 2;
        doors.push(sL);
        cncData.panels.push({name: 'SIDE_L', w: D - 20, d: H - 20, type: 'acp', color: '#607d8b'});
        
        // Right Side
        const dpR = { ...doorParams, doorWidth: D, doorHeight: H, panelType: 'acp', hingeBores: [] };
        const sR = generateDoor(dpR);
        sR.doorRoot.position.set((startX + boxWidth - SIDE_THICKNESS) / 1000, TK / 1000, 0);
        sR.doorRoot.rotation.y = Math.PI / 2;
        doors.push(sR);
        cncData.panels.push({name: 'SIDE_R', w: D - 20, d: H - 20, type: 'acp', color: '#607d8b'});
    }

    // Front Doors
    const gap = 2;
    const doorHeight = H - gap * 2;
    let dWidth = (railLen / 2) - (gap * 1.5);
    
    const dpFront1 = { ...doorParams, doorWidth: dWidth, doorHeight: doorHeight, hingeBores: [{bar:'LFT', yPos: doorHeight*0.2}, {bar:'LFT', yPos: doorHeight*0.8}] };
    const door1 = generateDoor(dpFront1);
    door1.doorRoot.position.set((railStartX + gap) / 1000, (gap + TK) / 1000, 0);
    doors.push(door1);
    
    const dpFront2 = { ...doorParams, doorWidth: dWidth, doorHeight: doorHeight, hingeBores: [{bar:'RHT', yPos: doorHeight*0.2}, {bar:'RHT', yPos: doorHeight*0.8}] };
    const door2 = generateDoor(dpFront2);
    door2.doorRoot.position.set((railStartX + dWidth + gap*2) / 1000, (gap + TK) / 1000, 0);
    doors.push(door2);
    
    cncData.panels.push({name: `DOOR_1`, w: dWidth - 20, d: doorHeight - 20, type: 'glass', color: '#1e293b'});
    cncData.panels.push({name: `DOOR_2`, w: dWidth - 20, d: doorHeight - 20, type: 'glass', color: '#1e293b'});

    return { frameMeshes, claddingMeshes, doors, cncData };
}
