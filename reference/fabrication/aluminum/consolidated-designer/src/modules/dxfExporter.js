import { DxfWriter, LWPolylineFlags } from '@tarikjabiri/dxf';

export function exportDxf(cncData) {
    const writer = new DxfWriter();
    const modelSpace = writer.document.modelSpace;
    
    let curX = 0;
    let curY = 0;
    const SPACING = 50;
    
    // Add layers
    writer.document.tables.addLayer('PANEL', DxfWriter.ACI.BLUE, 'CONTINUOUS');
    writer.document.tables.addLayer('LABELS', DxfWriter.ACI.WHITE, 'CONTINUOUS');
    
    cncData.panels.forEach(p => {
        const w = p.w;
        const d = p.d;
        
        // Draw Panel Box
        const points = [
            { point: { x: curX, y: curY } },
            { point: { x: curX + w, y: curY } },
            { point: { x: curX + w, y: curY + d } },
            { point: { x: curX, y: curY + d } }
        ];
        modelSpace.addLWPolyline(points, { flags: LWPolylineFlags.Closed, layerName: 'PANEL' });
        
        // Add Label
        modelSpace.addText(curX + w/2, curY + d/2, 30, p.name || 'PANEL', { layerName: 'LABELS' });
        
        curX += w + SPACING;
        if (curX > 2000) {
            curX = 0;
            curY += d + SPACING + 200;
        }
    });

    return writer.stringify();
}

export function triggerDxfDownload(dxfString, filename = 'AluKitchen_Cuts.dxf') {
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}
