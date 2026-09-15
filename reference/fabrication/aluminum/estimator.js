// estimator.js
// Handles BOM generation, costing, and PDF export for Alumatrix

const SETTINGS_KEY = 'alumatrix_settings';

const defaultSettings = {
    businessName: 'Alumatrix',
    logoBase64: '',
    labourRate: 5,       // LKR per mm
    transportCost: 3500, // Fixed
    marginPct: 35,       // Percentage
    boxPrice: 4500,      // per 6m
    sashPrice: 5500,     // per 6m
    acpPrice: 280,       // per sq.ft
    glassPrice: 220,     // per sq.ft
    cleatPrice: 45,      // per piece
    rivetPrice: 3,       // per piece
    beadPrice: 65        // per meter
};

let appSettings = { ...defaultSettings };
let currentEstimateData = null;

// Initialize and bind settings modal
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    bindSettingsUI();
    
    document.getElementById('btnExportPDF').addEventListener('click', async () => {
        if (!currentEstimateData) return;
        
        // Temporarily change button text
        const btn = document.getElementById('btnExportPDF');
        const oldText = btn.innerText;
        btn.innerText = "Capturing 3D Views...";
        btn.disabled = true;
        
        try {
            if (window.capture3DViews) {
                currentEstimateData.viewImages = await window.capture3DViews();
            }
            exportToPDF();
        } catch(e) {
            console.error(e);
            alert("Error exporting PDF");
        } finally {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    });
});

function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
        try {
            appSettings = { ...defaultSettings, ...JSON.parse(saved) };
        } catch(e) { console.error('Failed to parse settings'); }
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
}

function bindSettingsUI() {
    const modal = document.getElementById('settingsModal');
    const btnOpen = document.getElementById('btnSettings');
    const btnClose = document.getElementById('btnCloseSettings');
    const btnSave = document.getElementById('btnSaveSettings');
    
    // UI Elements
    const inpName = document.getElementById('inpBusinessName');
    const inpLogo = document.getElementById('inpLogoFile');
    const navTitle = document.getElementById('navTitle');
    const navLogo = document.getElementById('navLogo');
    
    // Apply initial settings to UI
    inpName.value = appSettings.businessName;
    navTitle.innerText = appSettings.businessName;
    if (appSettings.logoBase64) {
        navLogo.src = appSettings.logoBase64;
        navLogo.style.display = 'block';
    }
    
    document.getElementById('inpLabourRate').value = appSettings.labourRate;
    document.getElementById('inpTransportCost').value = appSettings.transportCost;
    document.getElementById('inpMargin').value = appSettings.marginPct;
    
    document.getElementById('setBoxPrice').value = appSettings.boxPrice;
    document.getElementById('setSashPrice').value = appSettings.sashPrice;
    document.getElementById('setAcpPrice').value = appSettings.acpPrice;
    document.getElementById('setGlassPrice').value = appSettings.glassPrice;
    document.getElementById('setCleatPrice').value = appSettings.cleatPrice;
    document.getElementById('setRivetPrice').value = appSettings.rivetPrice;
    document.getElementById('setBeadPrice').value = appSettings.beadPrice;

    btnOpen.addEventListener('click', () => modal.style.display = 'block');
    btnClose.addEventListener('click', () => modal.style.display = 'none');
    
    // Handle Logo Upload to Base64
    inpLogo.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                appSettings.logoBase64 = evt.target.result;
                navLogo.src = appSettings.logoBase64;
                navLogo.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    btnSave.addEventListener('click', () => {
        appSettings.businessName = inpName.value || 'Alumatrix';
        navTitle.innerText = appSettings.businessName;
        
        appSettings.labourRate = parseFloat(document.getElementById('inpLabourRate').value) || 0;
        appSettings.transportCost = parseFloat(document.getElementById('inpTransportCost').value) || 0;
        appSettings.marginPct = parseFloat(document.getElementById('inpMargin').value) || 0;
        
        appSettings.boxPrice = parseFloat(document.getElementById('setBoxPrice').value) || 0;
        appSettings.sashPrice = parseFloat(document.getElementById('setSashPrice').value) || 0;
        appSettings.acpPrice = parseFloat(document.getElementById('setAcpPrice').value) || 0;
        appSettings.glassPrice = parseFloat(document.getElementById('setGlassPrice').value) || 0;
        appSettings.cleatPrice = parseFloat(document.getElementById('setCleatPrice').value) || 0;
        appSettings.rivetPrice = parseFloat(document.getElementById('setRivetPrice').value) || 0;
        appSettings.beadPrice = parseFloat(document.getElementById('setBeadPrice').value) || 0;
        
        saveSettings();
        modal.style.display = 'none';
        
        // Re-run BOM if an assembly exists
        if (currentAssembly) {
            const w = parseFloat(document.getElementById('inpWidth').value);
            generateAndRenderBOM(currentAssembly, w);
        }
    });
}

// 2D Guillotine Bin Packing
class GuillotineBinPack {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.freeRectangles = [{ x: 0, y: 0, w: width, h: height }];
    }

    insert(w, h) {
        let bestScore = Infinity;
        let bestNodeIndex = -1;
        let bestFlipped = false;

        for (let i = 0; i < this.freeRectangles.length; i++) {
            const freeRect = this.freeRectangles[i];
            
            // Try unflipped
            if (freeRect.w >= w && freeRect.h >= h) {
                const score = Math.min(freeRect.w - w, freeRect.h - h);
                if (score < bestScore) {
                    bestNodeIndex = i;
                    bestScore = score;
                    bestFlipped = false;
                }
            }
            // Try flipped
            if (freeRect.w >= h && freeRect.h >= w) {
                const score = Math.min(freeRect.w - h, freeRect.h - w);
                if (score < bestScore) {
                    bestNodeIndex = i;
                    bestScore = score;
                    bestFlipped = true;
                }
            }
        }

        if (bestNodeIndex === -1) return null;

        const bestFreeRect = this.freeRectangles[bestNodeIndex];
        const newNode = {
            x: bestFreeRect.x,
            y: bestFreeRect.y,
            w: bestFlipped ? h : w,
            h: bestFlipped ? w : h,
            flipped: bestFlipped
        };

        this.splitFreeNode(bestFreeRect, newNode);
        this.freeRectangles.splice(bestNodeIndex, 1);
        
        return newNode;
    }

    splitFreeNode(freeRect, usedNode) {
        const w = freeRect.w - usedNode.w;
        const h = freeRect.h - usedNode.h;

        let rightRect, bottomRect;
        if (w <= h) {
            rightRect = { x: freeRect.x + usedNode.w, y: freeRect.y, w: freeRect.w - usedNode.w, h: usedNode.h };
            bottomRect = { x: freeRect.x, y: freeRect.y + usedNode.h, w: freeRect.w, h: freeRect.h - usedNode.h };
        } else {
            bottomRect = { x: freeRect.x, y: freeRect.y + usedNode.h, w: usedNode.w, h: freeRect.h - usedNode.h };
            rightRect = { x: freeRect.x + usedNode.w, y: freeRect.y, w: freeRect.w - usedNode.w, h: freeRect.h };
        }

        if (rightRect.w > 0 && rightRect.h > 0) this.freeRectangles.push(rightRect);
        if (bottomRect.w > 0 && bottomRect.h > 0) this.freeRectangles.push(bottomRect);
    }
}

function pack2DPanels(panels, binW = 2440, binH = 1220, kerf = 4) {
    // Group by material
    const groups = { acp: [], glass: [] };
    panels.forEach(p => {
        if (p.type === 'acp') groups.acp.push(p);
        else if (p.type === 'glass') groups.glass.push(p);
    });

    const packedData = [];

    for (const [matType, parts] of Object.entries(groups)) {
        if (parts.length === 0) continue;
        
        // Sort by area descending for better packing
        parts.sort((a,b) => (b.w * b.d) - (a.w * a.d));
        
        let bins = [];
        for (const p of parts) {
            let placedNode = null;
            let binIndex = -1;
            
            // Try existing bins
            for (let i = 0; i < bins.length; i++) {
                placedNode = bins[i].packer.insert(p.w + kerf, p.d + kerf);
                if (placedNode) { binIndex = i; break; }
            }
            
            // Create new bin if doesn't fit
            if (!placedNode) {
                const newPacker = new GuillotineBinPack(binW, binH);
                placedNode = newPacker.insert(p.w + kerf, p.d + kerf);
                if (placedNode) {
                    bins.push({ packer: newPacker, rects: [] });
                    binIndex = bins.length - 1;
                }
            }
            
            if (placedNode) {
                bins[binIndex].rects.push({ ...p, x: placedNode.x, y: placedNode.y, pW: placedNode.w, pH: placedNode.h });
            } else {
                console.warn(`Panel ${p.name} too large for bin!`);
            }
        }
        
        packedData.push({ material: matType, bins });
    }
    return packedData;
}

// Draw nested 2D sheets to Canvas for PDF
function render2DNestingToImages(packedData, binW = 2440, binH = 1220) {
    const scale = 0.5; // Scale down for canvas size
    const canvas = document.createElement('canvas');
    canvas.width = binW * scale;
    canvas.height = binH * scale;
    const ctx = canvas.getContext('2d');
    
    const images = [];
    
    for (const group of packedData) {
        for (let i = 0; i < group.bins.length; i++) {
            const bin = group.bins[i];
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = group.material === 'acp' ? '#e2e8f0' : '#dbeafe'; // Light gray or light blue
            
            for (const r of bin.rects) {
                const rx = r.x * scale;
                const ry = r.y * scale;
                // Draw actual cut part (subtract kerf)
                const rw = (r.pW - 4) * scale; 
                const rh = (r.pH - 4) * scale;
                
                ctx.fillRect(rx, ry, rw, rh);
                ctx.strokeRect(rx, ry, rw, rh);
                
                // Text
                ctx.fillStyle = '#000';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const label = `${r.name || r.id}`;
                const dims = `${Math.round(r.pW - 4)}x${Math.round(r.pH - 4)}`;
                ctx.fillText(label, rx + rw/2, ry + rh/2 - 8);
                ctx.font = '12px Arial';
                ctx.fillText(dims, rx + rw/2, ry + rh/2 + 8);
                
                ctx.fillStyle = group.material === 'acp' ? '#e2e8f0' : '#dbeafe'; // reset
            }
            
            images.push({
                src: canvas.toDataURL('image/jpeg', 0.8),
                material: group.material,
                index: i + 1,
                total: group.bins.length
            });
        }
    }
    return images;
}

// Optimization for 1D Bar Nesting
function pack1DBars(lengths, stockLen = 6000, kerf = 4) {
    let stocks = []; // Array of arrays: [[len1, len2], [len3]]
    lengths.sort((a,b) => b-a).forEach(l => {
        let placed = false;
        for (let i=0; i<stocks.length; i++) {
            const sum = stocks[i].reduce((a,b)=>a+b+kerf, 0);
            if (sum + l <= stockLen) { stocks[i].push(l); placed = true; break; }
        }
        if (!placed) stocks.push([l]);
    });
    return stocks;
}

// Draw nested 1D Bars to Canvas for PDF
function render1DNestingToImages(packedBarsData, profileName, stockLen = 6000) {
    if (!packedBarsData || packedBarsData.length === 0) return [];
    
    const scale = 0.15; // 6000mm * 0.15 = 900px wide
    const canvas = document.createElement('canvas');
    canvas.width = stockLen * scale;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    const images = [];
    
    for (let i=0; i<packedBarsData.length; i++) {
        const bin = packedBarsData[i];
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the 6m stock background
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 20, canvas.width, 60);
        
        let currX = 0;
        for (let j=0; j<bin.length; j++) {
            const l = bin[j];
            const px = currX * scale;
            const pw = l * scale;
            
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(px, 20, pw, 60);
            ctx.strokeRect(px, 20, pw, 60);
            
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${l}mm`, px + pw/2, 50);
            
            currX += l + 4; // kerf
        }
        
        // Add Title
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${profileName} - Bar ${i+1} of ${packedBarsData.length}`, 5, 2);
        
        images.push(canvas.toDataURL('image/jpeg', 0.8));
    }
    
    return images;
}

// Convert mm^2 to sq.ft
function mm2ToSqFt(mm2) {
    // 1 sq mm = 0.0000107639 sq ft
    return mm2 * 0.0000107639;
}

// Main BOM Generation Logic
function generateAndRenderBOM(assembly, cabinetWidth_mm) {
    currentAssembly = assembly; // global ref
    const bomContainer = document.getElementById('bomContent');
    const btnPdf = document.getElementById('btnExportPDF');
    if (!assembly || !assembly.cncData || !assembly.cncData.bars) {
        bomContainer.innerHTML = '<p style="color:#94a3b8;">Generate a cabinet to view materials and costs.</p>';
        btnPdf.style.display = 'none';
        return;
    }
    
    btnPdf.style.display = 'block';

    const partsMap = {};
    let totalGlassAreaSqFt = 0;
    let totalAcpAreaSqFt = 0;
    
    let totalCrossAndRailsCount = 0;
    let totalDoorPerimeter_m = 0;
    
    // Process Bars
    assembly.cncData.bars.forEach(b => {
        let type = 'BOX 1x1.5';
        if (b.isSash) type = 'Sash Profile';
        
        if (b.id === 'CROSS' || b.id === 'RAIL') {
            totalCrossAndRailsCount++;
        }
        
        const len = Math.round(b.l * 1000);
        const key = type + '|' + len;
        if (!partsMap[key]) partsMap[key] = { type: type, length: len, count: 0 };
        partsMap[key].count++;
    });
    
    // Hardware Estimates
    // Each Cross/Rail typically connects at 2 ends to posts.
    // 1 Cleat/L-Bracket + 4 Rivets per connection end.
    const estimatedJoints = totalCrossAndRailsCount * 2;
    const estimatedCleats = estimatedJoints;
    const estimatedRivets = estimatedJoints * 4;
    
    // Process Panels (for ACP / Glass area)
    if (assembly.cncData.panels) {
        assembly.cncData.panels.forEach(p => {
            const area_mm2 = p.w * p.d;
            const area_sqft = mm2ToSqFt(area_mm2);
            if (p.type === 'acp') totalAcpAreaSqFt += area_sqft;
            if (p.type === 'glass') totalGlassAreaSqFt += area_sqft;
        });
    }
    
    // Process Doors for Rubber Bead
    if (assembly.doors) {
        assembly.doors.forEach(d => {
            // d.doorWidth and d.doorHeight in mm
            if (d.doorWidth && d.doorHeight) {
                totalDoorPerimeter_m += ((d.doorWidth * 2) + (d.doorHeight * 2)) / 1000;
                
                // Add Door Inner Panels to area
                // Approximate inner glass size = door size - (45mm profile * 2)
                const innerW = Math.max(0, d.doorWidth - 90);
                const innerH = Math.max(0, d.doorHeight - 90);
                const area_sqft = mm2ToSqFt(innerW * innerH);
                
                // Determine panel type from main settings (or passed via door info)
                // For now, check if the global panelType is acp or glass
                const gPanelType = document.getElementById('selPanelType').value;
                if (gPanelType === 'glass') totalGlassAreaSqFt += area_sqft;
                else totalAcpAreaSqFt += area_sqft;
            }
        });
    }
    
    // Generate Table HTML
    let html = '<details><summary style="cursor:pointer; color:#94a3b8; font-size:0.85rem; margin-bottom:5px;">Show Detailed Cut-List</summary>';
    html += '<table class="bom-table">';
    html += '<tr><th>Type</th><th>Len (mm)</th><th>Qty</th></tr>';
    
    const sortedKeys = Object.keys(partsMap).sort((a,b) => partsMap[b].length - partsMap[a].length);
    let boxLengths = [];
    let sashLengths = [];
    let customProfileLengths = {}; // { 'ProfileName': [len1, len2...] }
    
    const listForPdf = [];
    
    sortedKeys.forEach(k => {
        const p = partsMap[k];
        html += `<tr><td>${p.type}</td><td>${p.length}</td><td>${p.count}</td></tr>`;
        listForPdf.push([p.type, p.length + ' mm', p.count]);
        
        for(let i=0; i<p.count; i++) {
            if (p.type === 'BOX 1x1.5') {
                boxLengths.push(p.length);
            } else if (p.type === 'Sash Profile') {
                sashLengths.push(p.length);
            } else {
                if (!customProfileLengths[p.type]) customProfileLengths[p.type] = [];
                customProfileLengths[p.type].push(p.length);
            }
        }
    });
    html += '</table></details>';
    
    // Calculate required 6m Bars
    const boxBarsPacked = pack1DBars(boxLengths);
    const boxBarsCount = boxBarsPacked.length;
    
    const sashBarsPacked = pack1DBars(sashLengths);
    const sashBarsCount = sashBarsPacked.length;
    
    const barImages1D = [];
    barImages1D.push(...render1DNestingToImages(boxBarsPacked, 'BOX 1x1.5'));
    barImages1D.push(...render1DNestingToImages(sashBarsPacked, 'Sash Profile'));
    
    // Calculate Costs & Custom Profiles
    let customProfilesCost = 0;
    const customProfilesSummary = [];
    const savedCustomProfiles = JSON.parse(localStorage.getItem('customProfiles') || '{}');
    
    for (const [profName, lengths] of Object.entries(customProfileLengths)) {
        const packed = pack1DBars(lengths);
        const barsNeeded = packed.length;
        const price = savedCustomProfiles[profName] ? savedCustomProfiles[profName].price : 5000;
        customProfilesCost += barsNeeded * price;
        customProfilesSummary.push({ name: profName, count: barsNeeded, price: price });
        
        barImages1D.push(...render1DNestingToImages(packed, profName));
    }
    
    // Process 2D Panel Nesting
    const packed2DData = pack2DPanels(assembly.cncData.panels || []);
    const sheetImages2D = render2DNestingToImages(packed2DData);
    
    // Recalculate sqft based on number of full sheets needed (optional, keeping old sqft for now)
    
    const cBox = boxBarsCount * appSettings.boxPrice;
    const cSash = sashBarsCount * appSettings.sashPrice;
    const cAcp = totalAcpAreaSqFt * appSettings.acpPrice;
    const cGlass = totalGlassAreaSqFt * appSettings.glassPrice;
    const cCleat = estimatedCleats * appSettings.cleatPrice;
    const cRivet = estimatedRivets * appSettings.rivetPrice;
    const cBead = totalDoorPerimeter_m * appSettings.beadPrice;
    
    const rawMaterialCost = cBox + cSash + customProfilesCost + cAcp + cGlass + cCleat + cRivet + cBead;
    const labourCost = cabinetWidth_mm * appSettings.labourRate;
    const transportCost = appSettings.transportCost;
    
    const subtotal = rawMaterialCost + labourCost + transportCost;
    const marginAmount = subtotal * (appSettings.marginPct / 100);
    const grandTotal = subtotal + marginAmount;
    
    // Format Currency
    const fmt = (num) => 'LKR ' + num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    html += `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #334155; font-size: 0.85rem; color: #cbd5e1;">`;
    html += `<strong style="color:white; font-size: 0.95rem;">Material Summaries</strong><br>`;
    html += `<table style="width:100%; margin-top:8px;">`;
    if (boxBarsCount > 0) html += `<tr><td>BOX 1x1.5 (6m)</td><td style="text-align:right;">${boxBarsCount}</td></tr>`;
    if (sashBarsCount > 0) html += `<tr><td>Sash Profile (6m)</td><td style="text-align:right;">${sashBarsCount}</td></tr>`;
    
    customProfilesSummary.forEach(cp => {
        html += `<tr><td>${cp.name} (6m)</td><td style="text-align:right;">${cp.count}</td></tr>`;
    });
    
    if (totalAcpAreaSqFt > 0) html += `<tr><td>ACP Panel</td><td style="text-align:right;">${totalAcpAreaSqFt.toFixed(1)} Sq.ft</td></tr>`;
    if (totalGlassAreaSqFt > 0) html += `<tr><td>Glass Panel</td><td style="text-align:right;">${totalGlassAreaSqFt.toFixed(1)} Sq.ft</td></tr>`;
    html += `<tr><td>L-Brackets/Cleats</td><td style="text-align:right;">${estimatedCleats}</td></tr>`;
    html += `<tr><td>Rivets</td><td style="text-align:right;">${estimatedRivets}</td></tr>`;
    if (totalDoorPerimeter_m > 0) html += `<tr><td>Rubber Bead</td><td style="text-align:right;">${totalDoorPerimeter_m.toFixed(1)} m</td></tr>`;
    html += `</table></div>`;

    html += `<div style="margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">`;
    html += `<div style="display:flex; flex-direction:column; gap: 8px;">`;
    
    html += `<div style="display:flex; justify-content:space-between; font-size: 0.85rem;"><span>Raw Materials</span><span>${fmt(rawMaterialCost)}</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; font-size: 0.85rem;"><span>Labour (${cabinetWidth_mm}mm)</span><span>${fmt(labourCost)}</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; font-size: 0.85rem;"><span>Transport</span><span>${fmt(transportCost)}</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; font-size: 0.85rem; color:#94a3b8; border-bottom: 1px solid #334155; padding-bottom: 5px;"><span>Margin (${appSettings.marginPct}%)</span><span>${fmt(marginAmount)}</span></div>`;
    
    html += `<div style="display:flex; justify-content:space-between; margin-top:5px;">
                <span style="font-size: 1rem; color:white; font-weight: 600;">GRAND TOTAL</span>
                <strong style="color: #4ade80; font-size: 1.2rem;">${fmt(grandTotal)}</strong>
             </div>`;
    html += `</div></div>`;
    
    bomContainer.innerHTML = html;
    
    // Save data for PDF
    currentEstimateData = {
        date: new Date().toLocaleDateString(),
        cabinetWidth: cabinetWidth_mm,
        listForPdf,
        barImages1D,
        sheetImages2D,
        summaries: [
            ['BOX 1x1.5 (6m bars)', boxBarsCount.toString(), fmt(cBox)],
            ['Sash Profile (6m bars)', sashBarsCount.toString(), fmt(cSash)],
            ['ACP Panel (Sq.ft)', totalAcpAreaSqFt.toFixed(2), fmt(cAcp)],
            ['Glass Panel (Sq.ft)', totalGlassAreaSqFt.toFixed(2), fmt(cGlass)],
            ['L-Brackets / Cleats', estimatedCleats.toString(), fmt(cCleat)],
            ['Rivets', estimatedRivets.toString(), fmt(cRivet)],
            ['Rubber Bead (m)', totalDoorPerimeter_m.toFixed(2), fmt(cBead)]
        ],
        rawMaterialCost, labourCost, transportCost, marginAmount, grandTotal
    };
}

// PDF Export Functionality using jsPDF
function exportToPDF() {
    if (!currentEstimateData || !window.jspdf) {
        alert("Estimation data not ready or PDF library not loaded.");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = currentEstimateData;
    const fmt = (num) => 'LKR ' + num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // Header
    if (appSettings.logoBase64) {
        try {
            // Need to determine image type
            let imgType = 'PNG';
            if (appSettings.logoBase64.includes('jpeg') || appSettings.logoBase64.includes('jpg')) imgType = 'JPEG';
            doc.addImage(appSettings.logoBase64, imgType, 14, 10, 30, 30, undefined, 'FAST');
        } catch(e) { console.error("Error adding logo to PDF", e); }
    }
    
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(appSettings.businessName, 50, 25);
    
    doc.setFontSize(14);
    doc.text("Cabinet Estimate & Bill of Materials", 14, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Date: " + data.date, 14, 58);
    doc.text("Cabinet Total Length: " + data.cabinetWidth + " mm", 14, 64);
    
    // Materials Summary Table (Now on Page 1)
    let finalY = 75;
    
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text("Materials Summary", 14, finalY);
    
    // Filter out zero quantities for summary
    const activeSummaries = data.summaries.filter(s => parseFloat(s[1]) > 0);
    
    doc.autoTable({
        startY: finalY + 5,
        head: [['Material / Profile', 'Quantity / Area', 'Est. Cost']],
        body: activeSummaries,
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
    });
    
    finalY = doc.lastAutoTable.finalY + 15;
    
    // Financial Summary
    doc.setFontSize(14);
    doc.text("Cost Breakdown", 14, finalY);
    
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text("Raw Materials:", 14, finalY + 10);
    doc.text(fmt(data.rawMaterialCost), 100, finalY + 10, { align: 'right' });
    
    doc.text("Labour:", 14, finalY + 18);
    doc.text(fmt(data.labourCost), 100, finalY + 18, { align: 'right' });
    
    doc.text("Transport:", 14, finalY + 26);
    doc.text(fmt(data.transportCost), 100, finalY + 26, { align: 'right' });
    
    doc.text(`Margin (${appSettings.marginPct}%):`, 14, finalY + 34);
    doc.text(fmt(data.marginAmount), 100, finalY + 34, { align: 'right' });
    
    // Grand Total Box
    doc.setDrawColor(59, 130, 246);
    doc.setFillColor(240, 248, 255);
    doc.rect(14, finalY + 42, 90, 15, 'FD');
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("GRAND TOTAL", 18, finalY + 52);
    doc.text(fmt(data.grandTotal), 100, finalY + 52, { align: 'right' });
    
    // Footer Page 1
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by " + appSettings.businessName + " Modular Kitchen Designer", 105, 290, { align: 'center' });
    
    // PAGE 2: Detailed Cut List (Appendix)
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.text("Appendix: Detailed Cut-List", 14, 20);
    
    doc.autoTable({
        startY: 30,
        head: [['Profile Type', 'Cut Length', 'Quantity']],
        body: data.listForPdf,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { bottom: 20 }
    });
    
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by " + appSettings.businessName + " Modular Kitchen Designer", 105, 290, { align: 'center' });
    
    // Add 1D Bar Nesting Images
    if (data.barImages1D && data.barImages1D.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.text("1D Bar Nesting Layouts", 14, 20);
        
        let y = 30;
        data.barImages1D.forEach(imgData => {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.addImage(imgData, 'JPEG', 14, y, 180, 20);
            y += 25;
        });
    }
    
    // Add 2D Sheet Nesting Images
    if (data.sheetImages2D && data.sheetImages2D.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.text("2D Panel Nesting Layouts", 14, 20);
        
        let y = 30;
        // Group images by 2 on a page
        for (let i = 0; i < data.sheetImages2D.length; i++) {
            if (y > 200) { doc.addPage(); y = 20; }
            const imgInfo = data.sheetImages2D[i];
            
            doc.setFontSize(12);
            doc.text(`${imgInfo.material.toUpperCase()} Sheet ${imgInfo.index} of ${imgInfo.total}`, 14, y);
            y += 5;
            
            doc.addImage(imgInfo.src, 'JPEG', 14, y, 180, 90);
            y += 95;
        }
    }
    
    // Add 3D Render Views
    if (data.viewImages && data.viewImages.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.text("3D Renderings & Exploded Views", 14, 20);
        
        let y = 30;
        for (let i = 0; i < data.viewImages.length; i++) {
            if (y > 200) { doc.addPage(); y = 20; }
            const v = data.viewImages[i];
            
            doc.setFontSize(12);
            doc.text(v.name + " View", 14, y);
            y += 5;
            
            // Image comes as Data URL from BabylonJS (PNG format by default)
            doc.addImage(v.image, 'PNG', 14, y, 120, 90);
            y += 95;
        }
    }

    doc.save("Estimate_" + appSettings.businessName.split(' ').join('_') + "_" + data.date.split('/').join('-') + ".pdf");
}
