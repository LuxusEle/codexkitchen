function buildCabinet(params) {
    const scene = params.scene;
    let totalLength = params.width || 2100;
    
    const isBase = params.isBaseCabinet !== undefined ? params.isBaseCabinet : true;
    const showLabels = params.showLabels !== undefined ? params.showLabels : false;
    const advancedMode = params.advancedMode !== undefined ? params.advancedMode : true;
    const maxStrutDist = params.maxStrutDist || 600;
    
    const T = 1.2; // Extrusion thickness
    const PW = 25.4; // Profile Width (e.g. 1 inch)
    const PH = 38.1; // Profile Height (e.g. 1.5 inch)
    
    // The plinth (toe kick) is a base boxbar frame resting on the floor. 
    // The carcass sits ON TOP of it.
    const TK = isBase ? PH : 0; 
    const TK_RECESS = 50;
    const SIDE_THICKNESS = advancedMode ? 21.2 : 0; // Thickness of the Sash Profile
    const H = (params.height || 780) - TK;
    const D = params.depth || 580;
    const crossLen = D - PW * 2;
    const CL = 3;    
    
    const MAX_BAR_LENGTH = params.maxBarLength || 2440;
    const STD_SIZES = [1200, 1000, 900, 750, 600, 450, 350, 250];

    const frameMeshes = [];
    const claddingMeshes = [];
    const labelMeshes = [];
    const cncData = { panels: [], bars: [] };
    
    const frameMat = new BABYLON.StandardMaterial('frameMat', scene);
    frameMat.diffuseColor = BABYLON.Color3.FromHexString('#555555');
    
    const cm = new BABYLON.StandardMaterial('cm', scene);
    cm.diffuseColor = BABYLON.Color3.FromHexString('#e2e8f0'); 
    cm.backFaceCulling = false;

    function attachLabel(mesh, text, orientation, length) {
        if (!showLabels) return;
        const texW = Math.max(512, length * 2);
        const texH = 64; 
        
        const dynTex = new BABYLON.DynamicTexture("dynTex", {width: texW, height: texH}, scene, false);
        dynTex.drawText(text, null, null, "bold 40px Inter", "black", "transparent", true);
        dynTex.hasAlpha = true;
        
        const mat = new BABYLON.StandardMaterial("labelMat", scene);
        mat.diffuseTexture = dynTex;
        mat.useAlphaFromDiffuseTexture = true;
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        mat.zOffset = -1;
        
        let planeW = length / 1000;
        let planeH = PH / 1000; 
        
        const plane = BABYLON.MeshBuilder.CreatePlane("lbl", {width: planeW, height: planeH}, scene);
        plane.material = mat;
        plane.parent = mesh;
        
        if (orientation === 'X') {
            plane.position.y = (PH / 2) / 1000;
            plane.position.z = -0.001; 
        } else if (orientation === 'Y') {
            planeH = PW / 1000;
            plane.dispose();
            const p2 = BABYLON.MeshBuilder.CreatePlane("lbl", {width: planeW, height: planeH}, scene);
            p2.material = mat;
            p2.parent = mesh;
            p2.position.y = (PH + 0.001) / 1000; 
            p2.position.z = (length / 2) / 1000;
            p2.position.x = (PW / 2) / 1000;
            p2.rotation.x = Math.PI / 2; 
            p2.rotation.y = Math.PI / 2; 
            labelMeshes.push(p2);
            return;
        } else if (orientation === 'Z') {
            plane.position.x = (PW / 2) / 1000;
            plane.position.y = (length / 2) / 1000;
            plane.position.z = -0.001;
            plane.rotation.z = Math.PI / 2; 
        }
        labelMeshes.push(plane);
    }

    function addBar(bParams, labelText, typeGroup) {
        bParams.lift = (bParams.lift || 0) + TK;
        const b = generateBoxBar(bParams);
        b.meshes.forEach(m => {
            m.material = frameMat;
            frameMeshes.push(m);
            if (labelText) attachLabel(m, labelText, bParams.orientation || 'X', bParams.length);
        });
        cncData.bars.push({
            l: bParams.length / 1000, 
            id: typeGroup || 'BAR', 
            label: labelText || typeGroup,
            isSash: (typeGroup === 'SASH'),
            customProfileName: b.part.customProfileName
        });
        return b;
    }
    
    function addToeKickBar(bParams) {
        const b = generateBoxBar(bParams);
        b.meshes.forEach(m => {
            m.material = frameMat;
            frameMeshes.push(m);
        });
        cncData.bars.push({
            l: bParams.length / 1000, 
            id: 'TK', 
            label: 'ToeKick',
            customProfileName: b.part.customProfileName
        });
        return b;
    }

    function pnl(w, d, h, x, y, z) {
        const m = BABYLON.MeshBuilder.CreateBox('cld', {width: w / 1000, depth: d / 1000, height: h / 1000}, scene);
        m.position.set(x / 1000, (y + TK) / 1000, z / 1000);
        m.material = cm;
        claddingMeshes.push(m);
    }

    function pnlNotched(w, d, h, xCenter, y, hasCutout, cutoutW, cutoutD, side, isAdv) {
        const zStart = isAdv ? -PW : 0;
        const zEnd = isAdv ? -d + PW : -d;
        const panelD = Math.abs(zEnd - zStart);
        
        if (!hasCutout) {
            pnl(w, panelD, h, xCenter, y, (zStart + zEnd) / 2);
            return;
        }
        
        const panelCutoutD = Math.max(0, cutoutD - (isAdv ? PW : 0));
        if (panelCutoutD <= 0) {
            pnl(w, panelD, h, xCenter, y, (zStart + zEnd) / 2);
            return;
        }
        
        const frontD = panelD - panelCutoutD;
        const backD = panelCutoutD;
        
        const frontZ = zStart - frontD / 2;
        const backZ = zEnd + backD / 2;
        
        pnl(w, frontD, h, xCenter, y, frontZ);
        
        const backW = w - cutoutW;
        const backX = (side === 'left') ? xCenter + cutoutW / 2 : xCenter - cutoutW / 2;
        pnl(backW, backD, h, backX, y, backZ);
    }

    const boxes = [];
    if (params.cabinetType === 'blindCorner') {
        boxes.push(totalLength);
    } else {
        let remLength = totalLength;
        while (remLength > 0) {
            if (remLength > MAX_BAR_LENGTH) {
                let splitAt = MAX_BAR_LENGTH;
                if (remLength >= 2400) splitAt = 2400; 
                else splitAt = MAX_BAR_LENGTH;
                boxes.push(splitAt);
                remLength -= splitAt;
            } else {
                boxes.push(remLength);
                remLength = 0;
            }
        }
    }

    function getDivisions(w) {
        if (w <= 600) return [w];
        if (w === 2400) return [1200, 1200];
        if (w === 2100) return [1050, 1050]; 
        if (w === 1800) return [900, 900];
        if (w === 1500) return [750, 750];
        if (w === 1200) return [600, 600];
        if (w === 900) return [450, 450];
        
        let r = w;
        let divs = [];
        for (let s of STD_SIZES) {
            while (r >= s && r - s !== 100 && r - s !== 50) { 
                divs.push(s);
                r -= s;
            }
        }
        if (r > 0) {
            let count = Math.ceil(w / 600);
            let even = w / count;
            let arr = [];
            for (let i=0; i<count; i++) arr.push(even);
            return arr;
        }
        return divs;
    }

    let currentX = 0;
    const doors = [];
    let totalDivisions = 0;

    const boxDivisionsMap = [];
    for (let i = 0; i < boxes.length; i++) {
        let bw = boxes[i];
        let hasLeftAdvancedPanel = advancedMode && (i === 0);
        let hasRightAdvancedPanel = advancedMode && (i === boxes.length - 1);
        
        let interiorW = bw - (hasLeftAdvancedPanel ? SIDE_THICKNESS : 0) - (hasRightAdvancedPanel ? SIDE_THICKNESS : 0);
        let divs;
        if (params.cabinetType === 'blindCorner') {
            let blindW = params.blindPanelWidth || 500;
            blindW = Math.max(100, Math.min(interiorW - 100, blindW));
            if (params.blindCornerSide === 'left') {
                divs = [blindW, interiorW - blindW];
            } else {
                divs = [interiorW - blindW, blindW];
            }
        } else {
            divs = getDivisions(interiorW);
        }
        totalDivisions += divs.length;
        boxDivisionsMap.push(divs);
    }

    let globalDivIndex = 0;

    for (let i = 0; i < boxes.length; i++) {
        let boxWidth = boxes[i];
        let boxDivs = boxDivisionsMap[i];
        let startX = currentX;
        
        let hasLeftAdvancedPanel = advancedMode && (i === 0);
        let hasRightAdvancedPanel = advancedMode && (i === boxes.length - 1);
        
        let railStartX = startX + (hasLeftAdvancedPanel ? SIDE_THICKNESS : 0);
        let railLen = boxWidth - (hasLeftAdvancedPanel ? SIDE_THICKNESS : 0) - (hasRightAdvancedPanel ? SIDE_THICKNESS : 0);
        
        let leftDepth = D;
        let rightDepth = D;
        if (params.enableColumn) {
            if (params.blindCornerSide === 'left') {
                leftDepth = D - params.columnDepth;
            } else if (params.blindCornerSide === 'right') {
                rightDepth = D - params.columnDepth;
            }
        }

        if (isBase) {
            addToeKickBar({id:`TK_FT_${i}`, length: boxWidth, width: PW, height: PH, lift: 0, thickness: T, originX: startX, originY: -PW - TK_RECESS});
            
            let tkBkStartX = startX;
            let tkBkLen = boxWidth;
            if (params.enableColumn) {
                tkBkLen = boxWidth - params.columnWidth;
                if (params.blindCornerSide === 'left') {
                    tkBkStartX = startX + params.columnWidth;
                }
            }
            addToeKickBar({id:`TK_BK_${i}`, length: tkBkLen, width: PW, height: PH, lift: 0, thickness: T, originX: tkBkStartX, originY: -D});
            
            if (i === 0 || !advancedMode) {
                let tkLDepth = leftDepth - PW - TK_RECESS;
                addToeKickBar({id:`TK_LFT_${i}`, length: tkLDepth, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: startX, originY: -leftDepth + PW});
            }
            if (i === boxes.length - 1 || !advancedMode) {
                let tkRDepth = rightDepth - PW - TK_RECESS;
                addToeKickBar({id:`TK_RHT_${i}`, length: tkRDepth, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: startX + boxWidth - PW, originY: -rightDepth + PW});
            }
        }
        
        addBar({id:`B_FT_${i}`, length: railLen, width: PW, height: PH, lift: 0, thickness: T, originX: railStartX, originY: -PW}, `B-FT-${Math.round(railLen)}`, 'RAIL');
        
        let backRailStartX = railStartX;
        let backRailLen = railLen;
        if (params.enableColumn) {
            backRailLen = railLen - params.columnWidth;
            if (params.blindCornerSide === 'left') {
                backRailStartX = railStartX + params.columnWidth;
            }
        }
        addBar({id:`B_BK_${i}`, length: backRailLen, width: PW, height: PH, lift: 0, thickness: T, originX: backRailStartX, originY: -D}, `B-BK-${Math.round(backRailLen)}`, 'RAIL');
        
        let shfH = H/2 - PH/2;
        addBar({id:`T_FT_${i}`, length: railLen, width: PW, height: PH, lift: H - PH, thickness: T, originX: railStartX, originY: -PW}, `T-FT-${Math.round(railLen)}`, 'RAIL');
        addBar({id:`T_BK_${i}`, length: backRailLen, width: PW, height: PH, lift: H - PH, thickness: T, originX: backRailStartX, originY: -D}, `T-BK-${Math.round(backRailLen)}`, 'RAIL');
        
        if (!hasLeftAdvancedPanel) {
            const endStrutLen = leftDepth - PH * 2;
            const tbStrutLen = leftDepth - PW * 2;
            addBar({id:`B_LFT_${i}`, length: tbStrutLen, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: startX, originY: -leftDepth + PW}, `Cross-${tbStrutLen}`, 'CROSS');
            addBar({id:`M_LFT_${i}`, length: endStrutLen, width: PW, height: PH, lift: shfH, thickness: T, orientation: 'Y', originX: startX, originY: -leftDepth + PH}, `Cross-${endStrutLen}`, 'CROSS');
            addBar({id:`T_LFT_${i}`, length: tbStrutLen, width: PW, height: PH, lift: H - PH, thickness: T, orientation: 'Y', originX: startX, originY: -leftDepth + PW}, null, 'CROSS');
        }
        
        if (!hasRightAdvancedPanel) {
            const endStrutLen = rightDepth - PH * 2;
            const tbStrutLen = rightDepth - PW * 2;
            addBar({id:`B_RHT_${i}`, length: tbStrutLen, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: startX + boxWidth - PW, originY: -rightDepth + PW}, null, 'CROSS');
            addBar({id:`M_RHT_${i}`, length: endStrutLen, width: PW, height: PH, lift: shfH, thickness: T, orientation: 'Y', originX: startX + boxWidth - PW, originY: -rightDepth + PH}, null, 'CROSS');
            addBar({id:`T_RHT_${i}`, length: tbStrutLen, width: PW, height: PH, lift: H - PH, thickness: T, orientation: 'Y', originX: startX + boxWidth - PW, originY: -rightDepth + PW}, null, 'CROSS');
        }
        
        const pLen = H - PH * 2;
        
        if (!hasLeftAdvancedPanel) {
            addBar({id:`P_BK_LFT_${i}`, length: pLen, width: PH, height: PW, lift: PH, thickness: T, orientation: 'Z', originX: startX, originY: -leftDepth}, `UP-${pLen}`, 'POST');
            addBar({id:`P_FT_LFT_${i}`, length: pLen, width: PH, height: PW, lift: PH, thickness: T, orientation: 'Z', originX: startX, originY: -PH}, null, 'POST');
        }
        
        if (!hasRightAdvancedPanel) {
            addBar({id:`P_BK_RHT_${i}`, length: pLen, width: PH, height: PW, lift: PH, thickness: T, orientation: 'Z', originX: startX + boxWidth - PW, originY: -rightDepth}, null, 'POST');
            addBar({id:`P_FT_RHT_${i}`, length: pLen, width: PH, height: PW, lift: PH, thickness: T, orientation: 'Z', originX: startX + boxWidth - PW, originY: -PH}, null, 'POST');
        }
        
        if (params.enableColumn) {
            let cornerX = (params.blindCornerSide === 'left') ? railStartX + params.columnWidth : railStartX + railLen - params.columnWidth;
            
            addBar({id:`P_BK_RET_${i}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: cornerX - PW/2, originY: -D}, null, 'POST');
            addBar({id:`P_SIDE_RET_${i}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: cornerX - PW/2, originY: -D + params.columnDepth}, null, 'POST');
            
            let retBackStartX = (params.blindCornerSide === 'left') ? railStartX : cornerX;
            addBar({id:`B_RET_BK_${i}`, length: params.columnWidth, width: PW, height: PH, lift: 0, thickness: T, originX: retBackStartX, originY: -D + params.columnDepth}, null, 'RAIL');
            addBar({id:`T_RET_BK_${i}`, length: params.columnWidth, width: PW, height: PH, lift: H - PH, thickness: T, originX: retBackStartX, originY: -D + params.columnDepth}, null, 'RAIL');
            
            let retSideLen = params.columnDepth - PW;
            if (retSideLen > 0) {
                addBar({id:`B_RET_SD_${i}`, length: retSideLen, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: cornerX - PW/2, originY: -D + PW}, null, 'CROSS');
                addBar({id:`M_RET_SD_${i}`, length: retSideLen, width: PW, height: PH, lift: shfH, thickness: T, orientation: 'Y', originX: cornerX - PW/2, originY: -D + PW}, null, 'CROSS');
                addBar({id:`T_RET_SD_${i}`, length: retSideLen, width: PW, height: PH, lift: H - PH, thickness: T, orientation: 'Y', originX: cornerX - PW/2, originY: -D + PW}, null, 'CROSS');
            }
        }

        let divX = railStartX; 
        let postCentersX = advancedMode ? [] : [startX + PW/2]; // Leftmost post center
        let midShelfPieces = [];
        
        for (let j = 0; j < boxDivs.length; j++) {
            let leftUprightEdge = (j === 0 && advancedMode) ? railStartX : divX + (PH / 2);
            if (!advancedMode && j === 0) leftUprightEdge = startX + PW;
            
            divX += boxDivs[j];
            
            if (j === boxDivs.length - 1) {
                let finalRightEdge = advancedMode ? (startX + boxWidth - (hasRightAdvancedPanel ? SIDE_THICKNESS : PW)) : (startX + boxWidth - PW);
                midShelfPieces.push({start: leftUprightEdge, length: finalRightEdge - leftUprightEdge, lift: shfH});
            } else {
                let px = divX - (PH / 2); // Center the PH wide upright
                let rightUprightEdge = px;
                midShelfPieces.push({start: leftUprightEdge, length: rightUprightEdge - leftUprightEdge, lift: shfH});
                postCentersX.push(divX);
                
                addBar({id:`P_BK_MID_${i}_${j}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: px, originY: -D}, `UP-${pLen}`, 'POST');
                addBar({id:`P_FT_MID_${i}_${j}`, length: pLen, width: PW, height: PH, lift: PH, thickness: T, orientation: 'Z', originX: px, originY: -PW}, null, 'POST');
                
                let cx = divX - (PW / 2); // Center the PW wide cross strut
                addBar({id:`B_STRUT_${i}_${j}`, length: crossLen, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: cx, originY: -D + PW}, null, 'CROSS');
                addBar({id:`M_STRUT_${i}_${j}`, length: crossLen, width: PW, height: PH, lift: shfH, thickness: T, orientation: 'Y', originX: cx, originY: -D + PW}, null, 'CROSS');
                addBar({id:`T_STRUT_${i}_${j}`, length: crossLen, width: PW, height: PH, lift: H - PH, thickness: T, orientation: 'Y', originX: cx, originY: -D + PW}, null, 'CROSS');
            }
            
            let modW = boxDivs[j];
            if (modW > maxStrutDist && params.cabinetType !== 'blindCorner') {
                let parts = Math.ceil(modW / maxStrutDist);
                let step = modW / parts;
                for (let k = 1; k < parts; k++) {
                    let cx = (divX - modW) + (step * k) - (PW/2);
                    addBar({id:`B_XSTRUT_${i}_${j}_${k}`, length: crossLen, width: PW, height: PH, lift: 0, thickness: T, orientation: 'Y', originX: cx, originY: -D + PW}, null, 'CROSS');
                    addBar({id:`M_XSTRUT_${i}_${j}_${k}`, length: crossLen, width: PW, height: PH, lift: shfH, thickness: T, orientation: 'Y', originX: cx, originY: -D + PW}, null, 'CROSS');
                    addBar({id:`T_XSTRUT_${i}_${j}_${k}`, length: crossLen, width: PW, height: PH, lift: H - PH, thickness: T, orientation: 'Y', originX: cx, originY: -D + PW}, null, 'CROSS');
                }
            }
        }
        
        if (!advancedMode) postCentersX.push(startX + boxWidth - PW/2);
        
        for (let s = 0; s < midShelfPieces.length; s++) {
            let piece = midShelfPieces[s];
            if (piece.length > 0) {
                addBar({id:`M_FT_${i}_${s}`, length: piece.length, width: PW, height: PH, lift: piece.lift, thickness: T, originX: piece.start, originY: -PW}, `M-FT-${Math.round(piece.length)}`, 'RAIL');
                addBar({id:`M_BK_${i}_${s}`, length: piece.length, width: PW, height: PH, lift: piece.lift, thickness: T, originX: piece.start, originY: -D}, `M-BK-${Math.round(piece.length)}`, 'RAIL');
            }
        }
        
        let innerH = H - PH * 2;
        let cladStartX = advancedMode ? railStartX : startX;
        let backCuts = postCentersX.map(cx => ({ pos: cx - cladStartX, w: PW, depth: PW, dir: 'back' }));
        
        let colCuts = [];
        if (params.enableColumn) {
            colCuts.push({
                pos: (params.blindCornerSide === 'left') ? params.columnWidth / 2 : railLen - params.columnWidth / 2,
                w: params.columnWidth,
                depth: params.columnDepth,
                dir: 'back'
            });
        }
        let combinedCuts = [...backCuts, ...colCuts];
        let flatCuts = postCentersX.map(cx => ({ pos: cx - cladStartX, w: PW, depth: PW, dir: 'both' })); 
        let combinedFlatCuts = [...flatCuts, ...colCuts];

        let cladCenterX = railStartX + railLen / 2;
        
        let hasCutout = params.enableColumn;
        let cutoutW = params.columnWidth;
        let cutoutD = params.columnDepth;
        let side = params.blindCornerSide;

        if (advancedMode) {
            let backCladW = railLen;
            let backCladCenterX = cladCenterX;
            if (params.enableColumn) {
                backCladW = railLen - params.columnWidth;
                backCladCenterX = backRailStartX + backCladW / 2;
            }
            pnl(backCladW, CL, innerH, backCladCenterX, H/2, -D + PW + CL/2);
            
            pnlNotched(railLen, D, CL, cladCenterX, PH + CL/2, hasCutout, cutoutW, cutoutD, side, true); // Bot
            if (!isBase) pnlNotched(railLen, D, CL, cladCenterX, H - PH - CL/2, hasCutout, cutoutW, cutoutD, side, true); // Top
            pnlNotched(railLen, D, CL, cladCenterX, shfH + PH + CL/2, hasCutout, cutoutW, cutoutD, side, true); // Unified mid shelf
            
            cncData.panels.push({ name: `BAK_${i}`, w: backCladW, d: innerH, color: '#e65100', type: 'acp' });
            cncData.panels.push({ name: `BTM_${i}`, w: railLen, d: D - PW*2, color: '#2196f3', ucuts: combinedFlatCuts, type: 'acp' });
            if (!isBase) cncData.panels.push({ name: `TOP_${i}`, w: railLen, d: D, color: '#ffa726', ucuts: combinedFlatCuts, type: 'acp' });
            cncData.panels.push({ name: `SHF_${i}`, w: railLen, d: D - PW*2, color: '#4caf50', ucuts: combinedFlatCuts, type: 'acp' });
        } else {
            let backCladW = boxWidth;
            let backCladCenterX = startX + boxWidth/2;
            if (params.enableColumn) {
                backCladW = boxWidth - params.columnWidth;
                backCladCenterX = backRailStartX + backCladW / 2;
            }
            pnl(backCladW, CL, H, backCladCenterX, H/2, -D - CL/2);
            
            pnlNotched(boxWidth, D, CL, startX + boxWidth/2, PH + CL/2, hasCutout, cutoutW, cutoutD, side, false);
            if (!isBase) pnlNotched(boxWidth, D, CL, startX + boxWidth/2, H + CL/2, hasCutout, cutoutW, cutoutD, side, false);
            
            cncData.panels.push({ name: `BAK_${i}`, w: backCladW, d: H, color: '#e65100', type: 'acp' });
            cncData.panels.push({ name: `BTM_${i}`, w: boxWidth, d: D - PW*2, color: '#2196f3', ucuts: combinedFlatCuts, type: 'acp' });
            if (!isBase) cncData.panels.push({ name: `TOP_${i}`, w: boxWidth, d: D, color: '#ffa726', ucuts: combinedFlatCuts, type: 'acp' });
            
            pnl(CL, leftDepth, H, startX - CL/2, H/2, -leftDepth/2);
            pnl(CL, rightDepth, H, startX + boxWidth + CL/2, H/2, -rightDepth/2);
            cncData.panels.push({ name: `LFT_${i}`, w: leftDepth, d: H, color: '#9c27b0', type: 'acp' });
            cncData.panels.push({ name: `RHT_${i}`, w: rightDepth, d: H, color: '#9c27b0', type: 'acp' });
            
            pnlNotched(boxWidth, D, CL, startX + boxWidth/2, shfH + PH + CL/2, hasCutout, cutoutW, cutoutD, side, false); // Unified mid shelf
            cncData.panels.push({ name: `SHF_${i}`, w: boxWidth, d: D - PW*2, color: '#4caf50', ucuts: combinedFlatCuts, type: 'acp' });
        }

        if (params.enableColumn) {
            let cornerX = (params.blindCornerSide === 'left') ? railStartX + params.columnWidth : railStartX + railLen - params.columnWidth;
            pnl(CL, params.columnDepth, innerH, cornerX, H/2, -D + params.columnDepth/2);
            
            let retBackW = params.columnWidth;
            let retBackCenterX = (params.blindCornerSide === 'left') ? railStartX + retBackW/2 : railStartX + railLen - retBackW/2;
            pnl(retBackW, CL, innerH, retBackCenterX, H/2, -D + params.columnDepth - CL/2);
            
            cncData.panels.push({ name: `RET_SD_${i}`, w: params.columnDepth, d: innerH, color: '#9c27b0', type: 'acp' });
            cncData.panels.push({ name: `RET_BK_${i}`, w: retBackW, d: innerH, color: '#9c27b0', type: 'acp' });
        }

        const doorParams = {
            scene: scene, width: 45, height: 21.2, thickness: 1.5, boxHeight: 16.2, uDepth: 5, uRetract: 0, uExtend: 10, uReturn: 2,
            useMiter: params.useMiter !== undefined ? params.useMiter : true,
            panelType: params.panelType || 'glass', panelColor: params.panelColor || '#1e293b'
        };

        if (advancedMode) {
            if (hasLeftAdvancedPanel) {
                const dpL = { ...doorParams, doorWidth: leftDepth, doorHeight: H, panelType: 'acp', hingeBores: [] };
                const sL = generateDoor(dpL);
                sL.doorRoot.position.set((startX + SIDE_THICKNESS) / 1000, TK / 1000, -leftDepth / 1000);
                sL.doorRoot.rotation.y = -Math.PI / 2;
                doors.push(sL);
                cncData.bars.push({l: dpL.doorWidth / 1000, id: 'SRAIL', label: `SideSash`, isSash: true});
                cncData.bars.push({l: dpL.doorWidth / 1000, id: 'SRAIL', label: `SideSash`, isSash: true});
                cncData.bars.push({l: dpL.doorHeight / 1000, id: 'SRAIL', label: `SideSash`, isSash: true});
                cncData.bars.push({l: dpL.doorHeight / 1000, id: 'SRAIL', label: `SideSash`, isSash: true});
                let uE = dpL.uExtend || 10, uR = dpL.uRetract || 0;
                cncData.panels.push({name: 'SIDE_L', w: leftDepth - 2*(uE+uR), d: H - 2*(uE+uR), type: 'acp', color: '#607d8b'});
            }
            
            if (hasRightAdvancedPanel) {
                const dpR = { ...doorParams, doorWidth: rightDepth, doorHeight: H, panelType: 'acp', hingeBores: [] };
                const sR = generateDoor(dpR);
                sR.doorRoot.position.set((startX + boxWidth - SIDE_THICKNESS) / 1000, TK / 1000, 0);
                sR.doorRoot.rotation.y = Math.PI / 2;
                doors.push(sR);
                cncData.bars.push({l: dpR.doorWidth / 1000, id: 'SRAIL', label: `SideSash`, isSash: true});
                cncData.bars.push({l: dpR.doorWidth / 1000, id: 'SRAIL', label: `SideSash`, isSash: true});
                cncData.bars.push({l: dpR.doorHeight / 1000, id: 'SRAIL', label: `SideSash`, isSash: true});
                cncData.bars.push({l: dpR.doorHeight / 1000, id: 'SRAIL', label: `SideSash`, isSash: true});
                let uE = dpR.uExtend || 10, uR = dpR.uRetract || 0;
                cncData.panels.push({name: 'SIDE_R', w: rightDepth - 2*(uE+uR), d: H - 2*(uE+uR), type: 'acp', color: '#607d8b'});
            }
        }
        
        let dStartX = railStartX; // Doors start from inside boundary
        
        let totalDoorsInBox = 0;
        for (let j = 0; j < boxDivs.length; j++) {
            totalDoorsInBox += (boxDivs[j] > 600) ? 2 : 1;
        }
        
        let currentDoorInBox = 0;
        const gap = params.doorGap !== undefined ? params.doorGap : 2;
        const doorHeight = H - gap * 2;
        const hingePositions = [doorHeight * 0.2, doorHeight * 0.8]; 
        const hingeCupDiameter = 35;
        const hingeOffset = 22.5;
        
        const attachDoor = (dWidth, hSide, px, isRightSwing) => {
            const dp = { ...doorParams, doorWidth: dWidth, doorHeight: doorHeight };
            dp.hingeBores = [
                { bar: hSide, yPos: hingePositions[0], diameter: hingeCupDiameter, offset: hingeOffset },
                { bar: hSide, yPos: hingePositions[1], diameter: hingeCupDiameter, offset: hingeOffset }
            ];
            const door = generateDoor(dp);
            
            door.doorRoot.position.set(px / 1000, (gap + TK) / 1000, 0);
            
            cncData.bars.push({l: dWidth / 1000, id: 'SRAIL', label: `Sash-${Math.round(dWidth)}`, isSash: true});
            cncData.bars.push({l: dWidth / 1000, id: 'SRAIL', label: `Sash-${Math.round(dWidth)}`, isSash: true});
            cncData.bars.push({l: doorHeight / 1000, id: 'SRAIL', label: `Sash-${Math.round(doorHeight)}`, isSash: true});
            cncData.bars.push({l: doorHeight / 1000, id: 'SRAIL', label: `Sash-${Math.round(doorHeight)}`, isSash: true});

            door.bars.forEach(barInfo => {
                if (barInfo.meshes && barInfo.meshes.length > 0) {
                     let isHoriz = barInfo.part.id === 'TOP' || barInfo.part.id === 'BOT';
                     let l = isHoriz ? dWidth : doorHeight;
                     attachLabel(barInfo.meshes[0], `Sash-${Math.round(l)}`, 'X', l);
                }
            });

            door.cabinetStartX = px;
            door.doorWidth = dWidth;
            door.isRightHinged = isRightSwing;
            door.isFrontDoor = true; // For animation
            doors.push(door);
            
            const uE = doorParams.uExtend || 10;
            const uR = doorParams.uRetract || 0;
            cncData.panels.push({
                name: `DOOR_${Math.round(dWidth)}x${Math.round(doorHeight)}`,
                w: dWidth - 2 * (uE + uR),
                d: doorHeight - 2 * (uE + uR),
                type: doorParams.panelType || 'glass',
                color: doorParams.panelColor || '#1e293b'
            });
        };

        for (let j = 0; j < boxDivs.length; j++) {
            let modW = boxDivs[j];
            
            let isBlindDiv = false;
            if (params.cabinetType === 'blindCorner') {
                if (params.blindCornerSide === 'left' && j === 0) isBlindDiv = true;
                if (params.blindCornerSide === 'right' && j === 1) isBlindDiv = true;
            }

            if (isBlindDiv) {
                const blindW = modW - gap;
                const blindH = H - gap * 2;
                const blindDepth = CL; // 3mm ACP cladding, not a box
                const blindX = dStartX + blindW / 2 + (params.blindCornerSide === 'left' ? 0 : gap);
                const blindY = H / 2;
                const blindZ = blindDepth / 2;
                
                pnl(blindW, blindDepth, blindH, blindX, blindY, blindZ);
                
                cncData.panels.push({
                    name: `BLIND_${Math.round(blindW)}x${Math.round(blindH)}`,
                    w: blindW,
                    d: blindH,
                    type: 'acp',
                    color: params.panelColor || '#1e293b'
                });
            } else {
                if (params.cabinetType === 'blindCorner') {
                    let dWidth = modW - gap * 1.5;
                    let px = dStartX + (params.blindCornerSide === 'left' ? gap * 1.0 : gap * 0.5);
                    let isRightHinged = (params.blindCornerSide === 'right');
                    attachDoor(dWidth, isRightHinged ? 'RHT' : 'LFT', px, isRightHinged);
                } else {
                    let dCount = (modW > 600) ? 2 : 1; 
                    if (dCount === 1) {
                        let leftGap = (currentDoorInBox === 0) ? 0 : gap / 2;
                        let rightGap = (currentDoorInBox === totalDoorsInBox - 1) ? 0 : gap / 2;
                        
                        let extraWidthLeft = (currentDoorInBox === 0 && hasLeftAdvancedPanel) ? SIDE_THICKNESS : 0;
                        let extraWidthRight = (currentDoorInBox === totalDoorsInBox - 1 && hasRightAdvancedPanel) ? SIDE_THICKNESS : 0;
                        
                        let dWidth = modW + extraWidthLeft + extraWidthRight - leftGap - rightGap;
                        let px = dStartX - extraWidthLeft + leftGap;
                        
                        let isRightSwing = false;
                        if (currentDoorInBox === totalDoorsInBox - 1 && currentDoorInBox !== 0) {
                            isRightSwing = true;
                        } else if (currentDoorInBox > 0 && currentDoorInBox % 2 !== 0) {
                            isRightSwing = true;
                        }
                        
                        attachDoor(dWidth, isRightSwing ? 'RHT' : 'LFT', px, isRightSwing);
                        currentDoorInBox++;
                    } else {
                        let leftGap1 = (currentDoorInBox === 0) ? 0 : gap / 2;
                        let rightGap1 = gap / 2;
                        let extraWidthLeft1 = (currentDoorInBox === 0 && hasLeftAdvancedPanel) ? SIDE_THICKNESS : 0;
                        let dWidth1 = (modW / 2) + extraWidthLeft1 - leftGap1 - rightGap1;
                        let px1 = dStartX - extraWidthLeft1 + leftGap1;
                        attachDoor(dWidth1, 'LFT', px1, false);
                        currentDoorInBox++;
                        
                        let leftGap2 = gap / 2;
                        let rightGap2 = (currentDoorInBox === totalDoorsInBox - 1) ? 0 : gap / 2;
                        let extraWidthRight2 = (currentDoorInBox === totalDoorsInBox - 1 && hasRightAdvancedPanel) ? SIDE_THICKNESS : 0;
                        let dWidth2 = (modW / 2) + extraWidthRight2 - leftGap2 - rightGap2;
                        let px2 = dStartX + (modW / 2) + leftGap2;
                        attachDoor(dWidth2, 'RHT', px2, true);
                        currentDoorInBox++;
                    }
                }
            }
            dStartX += modW;
            globalDivIndex++;
        }

        currentX += boxWidth;
    }
    
    if (params.showBounds) {
        const boundsMat = new BABYLON.StandardMaterial("boundsMat", scene);
        boundsMat.wireframe = true;
        boundsMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
        boundsMat.disableLighting = true;
        
        const box = BABYLON.MeshBuilder.CreateBox("boundsBox", {
            width: currentX / 1000,
            height: (H + TK) / 1000,
            depth: D / 1000
        }, scene);
        
        box.position.set((currentX / 2) / 1000, (H + TK) / 2 / 1000, -D / 2 / 1000);
        box.material = boundsMat;
        frameMeshes.push(box);
    }
    
    return { frameMeshes, claddingMeshes, doors, labelMeshes, cncData, totalWidth: currentX };
}
