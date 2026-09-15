function buildCabinet(params) {
    const scene = params.scene;
    let divisions = [];
    
    // Parse divisions input or use smart algorithm
    if (params.divisions && typeof params.divisions === 'string') {
        divisions = params.divisions.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n) && n > 0);
    }
    
    // Default smart splitting
    if (divisions.length === 0) divisions = [params.width || 800];
    
    const H = params.height || 780;
    const D = params.depth || 580;
    const PW = 25.4; 
    const PH = 38.1; 
    const T = 1.5;   
    const CL = 3;    
    
    const MAX_BAR_LENGTH = params.maxBarLength || 2440;
    
    const frameMeshes = [];
    const claddingMeshes = [];
    const frameMat = new BABYLON.StandardMaterial('frameMat', scene);
    frameMat.diffuseColor = BABYLON.Color3.FromHexString('#4fc3f7');
    
    const cm = new BABYLON.StandardMaterial('cm', scene);
    cm.diffuseColor = BABYLON.Color3.FromHexString('#e2e8f0'); 
    cm.backFaceCulling = false;

    function addBar(bParams, category, groupIndex) {
        const b = generateBoxBar(bParams);
        b.meshes.forEach(m => {
            m.material = frameMat;
            m.tagCategory = category || 'FrameBox';
            m.tagGroup = groupIndex;
            // Record physical length for nesting
            m.cutLength = bParams.length;
            frameMeshes.push(m);
        });
        return b;
    }
    
    function pnl(w, d, h, x, y, z, category, groupIndex) {
        const m = BABYLON.MeshBuilder.CreateBox('cld', {width: w / 1000, depth: d / 1000, height: h / 1000}, scene);
        m.position.set(x / 1000, y / 1000, z / 1000);
        m.material = cm;
        m.tagCategory = category || 'Cladding';
        m.tagGroup = groupIndex;
        // Record dimensions for sheet nesting
        m.sheetW = w; m.sheetH = (category === 'CladdingBack' || category === 'CladdingSide') ? h : d;
        claddingMeshes.push(m);
    }

    const doors = [];
    let currentX = 0;
    let boxIndex = 0;
    
    // We group divisions into "Long Boxes" up to MAX_BAR_LENGTH
    let i = 0;
    while (i < divisions.length) {
        let boxWidth = 0;
        let boxDivs = [];
        // Greedily add divisions until we hit MAX_BAR_LENGTH
        while (i < divisions.length && boxWidth + divisions[i] <= MAX_BAR_LENGTH) {
            boxDivs.push(divisions[i]);
            boxWidth += divisions[i];
            i++;
        }
        
        // If a single division is magically larger than MAX_BAR_LENGTH (e.g. user enters 3000 but max is 2440)
        if (boxDivs.length === 0) {
            // Force split it
            let forced = divisions[i];
            let piece = Math.min(forced, MAX_BAR_LENGTH);
            boxDivs.push(piece);
            boxWidth = piece;
            divisions[i] -= piece;
            if (divisions[i] <= 0) i++;
        }
        
        const startX = currentX;
        
        // --- ONE CONTINUOUS BOX FRAME ---
        addBar({id:`B_FT_${boxIndex}`, length: boxWidth, width: PW, height: PH, lift: 0, thickness: T, originX: startX, originY: -PW}, 'FrameBox', boxIndex);
        addBar({id:`B_BK_${boxIndex}`, length: boxWidth, width: PW, height: PH, lift: 0, thickness: T, originX: startX, originY: -D}, 'FrameBox', boxIndex);
        addBar({id:`T_FT_${boxIndex}`, length: boxWidth, width: PW, height: PH, lift: H - PH, thickness: T, originX: startX, originY: -PW}, 'FrameBox', boxIndex);
        addBar({id:`T_BK_${boxIndex}`, length: boxWidth, width: PW, height: PH, lift: H - PH, thickness: T, originX: startX, originY: -D}, 'FrameBox', boxIndex);
        
        // --- END STRUTS ---
        const crossLen = D - PW * 2;
        addBar({id:`B_LFT_${boxIndex}`, length: crossLen, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: startX, originY: -D + PW}, 'FrameBox', boxIndex);
        addBar({id:`T_LFT_${boxIndex}`, length: crossLen, width: PW, height: PH, lift: H - PH, thickness: T, orientation: 'Y', originX: startX, originY: -D + PW}, 'FrameBox', boxIndex);
        addBar({id:`B_RHT_${boxIndex}`, length: crossLen, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: startX + boxWidth - PH, originY: -D + PW}, 'FrameBox', boxIndex);
        addBar({id:`T_RHT_${boxIndex}`, length: crossLen, width: PW, height: PH, lift: H - PH, thickness: T, orientation: 'Y', originX: startX + boxWidth - PH, originY: -D + PW}, 'FrameBox', boxIndex);
        
        // --- UPRIGHTS (Single posts between divisions) ---
        const pLen = H - PH * 2;
        // Far left
        addBar({id:`P_BK_LFT_${boxIndex}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: startX, originY: -D}, 'FrameBox', boxIndex);
        addBar({id:`P_FT_LFT_${boxIndex}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: startX, originY: -PW}, 'FrameBox', boxIndex);
        
        let divX = startX;
        for (let j = 0; j < boxDivs.length - 1; j++) {
            divX += boxDivs[j];
            // Center the upright on the division line
            let px = divX - (PH / 2);
            addBar({id:`P_BK_MID_${boxIndex}_${j}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: px, originY: -D}, 'FrameBox', boxIndex);
            addBar({id:`P_FT_MID_${boxIndex}_${j}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: px, originY: -PW}, 'FrameBox', boxIndex);
        }
        
        // Far right
        addBar({id:`P_BK_RHT_${boxIndex}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: startX + boxWidth - PH, originY: -D}, 'FrameBox', boxIndex);
        addBar({id:`P_FT_RHT_${boxIndex}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: startX + boxWidth - PH, originY: -PW}, 'FrameBox', boxIndex);
        
        // --- CLADDING ---
        let innerH = H - PH * 2;
        pnl(boxWidth, D, CL, startX + boxWidth/2, PH + CL/2, -D/2, 'CladdingTopBot', boxIndex); // Bot
        pnl(boxWidth, D, CL, startX + boxWidth/2, H - PH - CL/2, -D/2, 'CladdingTopBot', boxIndex); // Top
        pnl(boxWidth - PH*2, CL, innerH, startX + boxWidth/2, H/2, -D + PW + CL/2, 'CladdingBack', boxIndex); // Back
        pnl(CL, D - PW*2, innerH, startX + PH + CL/2, H/2, -D/2, 'CladdingSide', boxIndex); // Left
        pnl(CL, D - PW*2, innerH, startX + boxWidth - PH - CL/2, H/2, -D/2, 'CladdingSide', boxIndex); // Right

        // --- DOORS ---
        let dStartX = startX;
        for (let j = 0; j < boxDivs.length; j++) {
            let modW = boxDivs[j];
            let dCount = (modW >= 750) ? 2 : 1;
            const gap = 2;
            const doorHeight = H - gap * 2;
            const hingePositions = [doorHeight * 0.2, doorHeight * 0.8]; 
            const hingeCupDiameter = 35;
            const hingeOffset = 22.5;
            
            const doorParams = {
                scene: scene,
                width: 45, height: 21.2, thickness: 1.5, boxHeight: 16.2, uDepth: 5, uRetract: 0, uExtend: 10, uReturn: 2,
                useMiter: params.useMiter !== undefined ? params.useMiter : true,
                panelType: params.panelType || 'glass',
                panelColor: params.panelColor || '#1e293b'
            };

            const attachDoor = (dWidth, hSide, px, isRightSwing) => {
                const dp = { ...doorParams, doorWidth: dWidth, doorHeight: doorHeight };
                dp.hingeBores = [
                    { bar: hSide, yPos: hingePositions[0], diameter: hingeCupDiameter, offset: hingeOffset },
                    { bar: hSide, yPos: hingePositions[1], diameter: hingeCupDiameter, offset: hingeOffset }
                ];
                const door = generateDoor(dp);
                
                // Flip & Fit
                // By rotating Y by Math.PI, local X is inverted. Local Z is inverted.
                // The door's FLAT face (originally Z=0) maps to Z=0.
                // The door's LIP face (originally Z=-21.2) maps to Z=+21.2.
                // We want the Lip face outside (Z<0) and Flat inside (Z=0).
                // So we rotate Y by Math.PI, then shift Z by +21.2? No.
                // Let's just rotate X by Math.PI. Then Z=0 stays Z=0, and Lip (-21.2) goes to +21.2.
                // We shift Z by +21.2 so Flat is at +21.2 and Lip is at 0? No, flat MUST BE AT 0.
                // If Flat is at 0, Lip is at +21.2 (which is towards the user).
                // Wait, if Z goes from 0 to -D, then Z>0 is OUTSIDE.
                // So if Lip is at Z=+21.2, Lip is OUTSIDE. Flat is at Z=0, Flat is INSIDE.
                // We don't even need to rotate if it natively puts Flat at 0 and Lip at +21.2!
                // Natively: Flat is Y=0. Lip is Y=21.2. Twist makes Y go to Z.
                // Let's explicitly do NO rotation, and just set Z=0.
                
                door.doorRoot.position.set(px / 1000, gap / 1000, 0);
                
                // Tagging children for nesting
                door.doorRoot.getChildMeshes().forEach(m => {
                    m.tagCategory = m.name.includes("panel") ? "DoorPanel" : "SashBar";
                    m.tagGroup = boxIndex;
                    if (m.tagCategory === 'SashBar') {
                        // Guess length based on name
                        m.cutLength = m.name.includes("TOP") || m.name.includes("BOT") ? dWidth : doorHeight;
                    }
                });
                
                door.cabinetStartX = px;
                door.doorWidth = dWidth;
                door.isRightHinged = isRightSwing;
                doors.push(door);
            };

            if (dCount === 1) {
                // Single door: hinges on LEFT. So we bore the LFT bar.
                attachDoor(modW - gap * 2, 'LFT', dStartX + gap, false);
            } else {
                let dWidth = (modW - gap * 3) / 2;
                attachDoor(dWidth, 'LFT', dStartX + gap, false);
                attachDoor(dWidth, 'RHT', dStartX + gap * 2 + dWidth, true);
            }
            dStartX += modW;
        }
        
        currentX += boxWidth;
        boxIndex++;
    }
    
    return { frameMeshes, claddingMeshes, doors, totalWidth: currentX };
}
