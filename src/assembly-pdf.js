import { jsPDF } from 'jspdf';

const mm=n=>Number(n.toFixed(1)).toString();
const clean=s=>String(s??'').replace(/[^\x20-\x7e]/g,' ').trim();
export function assemblyRuns(job){
  return [...new Set(job.bars.map(b=>b.runId).filter(Boolean))].map(id=>({
    id,bars:job.bars.filter(b=>b.runId===id),panels:job.panels.filter(p=>p.runId===id),
  }));
}

// Vector-only PDF: same physical member records as 3D and the stock cut list.
// Local coordinates: X along wall, Y up from floor, Z out from wall.
export function assemblyPdf(job,runId='all'){
  const runs=assemblyRuns(job).filter(r=>runId==='all'||r.id===runId);
  if(!runs.length)throw Error('No frame assembly is available for this selection.');
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  let page=0;
  const text=(s,x,y,size=9)=>{doc.setFontSize(size);doc.text(clean(s),x,y);};
  function header(run,title){
    if(page++)doc.addPage();
    doc.setFillColor('#163d43');doc.rect(0,0,297,27,'F');doc.setTextColor('#ffffff');
    text(`CODEX KITCHEN / ${run.id} / WALL ${run.bars[0].wall}`,12,11,15);
    text(title,12,21,10);doc.setTextColor('#163d43');
    text(`Units: ${run.bars[0].unitIds.join(', ')}`,12,35,9);
    doc.setTextColor('#9b4a19');
    text(job.errors.length||job.rejected.length?'INCOMPLETE DESIGN - PREVIEW ONLY':'ENGINEERING REVIEW - NOT FOR MACHINING',12,198,10);
    doc.setTextColor('#526b6a');text(`mm | Not to scale | Sheet ${page}`,237,198,8);
    doc.setTextColor('#163d43');
  }
  function view(bars,project,box){
    const vertices=b=>[[0,0,0],[b.w,0,0],[b.w,b.h,0],[0,b.h,0],[0,0,b.d],[b.w,0,b.d],[b.w,b.h,b.d],[0,b.h,b.d]].map(([x,y,z])=>project(b.x+x,b.y+y,b.z+z));
    const all=bars.flatMap(vertices),lo=[Math.min(...all.map(p=>p[0])),Math.min(...all.map(p=>p[1]))],hi=[Math.max(...all.map(p=>p[0])),Math.max(...all.map(p=>p[1]))];
    const scale=Math.min(box.w/(hi[0]-lo[0]),box.h/(hi[1]-lo[1]));
    const point=p=>[box.x+(box.w-(hi[0]-lo[0])*scale)/2+(p[0]-lo[0])*scale,box.y+(box.h-(hi[1]-lo[1])*scale)/2+(p[1]-lo[1])*scale];
    const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    doc.setLineWidth(.18);
    for(const b of bars){
      doc.setDrawColor(b.name.startsWith('Rear')?'#7ca3a5':'#294a50');
      const pts=vertices(b).map(point);
      for(const [a,c] of edges)doc.line(...pts[a],...pts[c]);
    }
  }
  const stockOf=id=>job.barNest.stocks.find(s=>s.cuts.some(c=>c.id===id))?.id||'Unnested';
  for(const run of runs){
    const bars=run.bars,x0=Math.min(...bars.map(b=>b.x)),x1=Math.max(...bars.map(b=>b.x+b.w)),y0=Math.min(...bars.map(b=>b.y)),y1=Math.max(...bars.map(b=>b.y+b.h)),z0=Math.min(...bars.map(b=>b.z)),z1=Math.max(...bars.map(b=>b.z+b.d));
    header(run,'CONTINUOUS FRAME / ASSEMBLY OVERVIEW');
    text(`Metal envelope: ${mm(x1-x0)} W x ${mm(y1-y0)} H x ${mm(z1-z0)} D`,12,43,10);
    text('ISOMETRIC / frame only',12,54,10);
    view(bars,(x,y,z)=>[x+.55*z,-y+.3*z],{x:12,y:60,w:170,h:107});
    text('FRONT ELEVATION / box frame',196,54,9);
    const boxBars=bars.filter(b=>!b.sashPlacement),frontPlane=Math.max(...boxBars.map(b=>b.z+b.d)),rearPlane=Math.min(...boxBars.map(b=>b.z));
    const front=boxBars.filter(b=>Math.abs(b.z+b.d-frontPlane)<.01);
    view(front,(x,y)=>[x,-y],{x:196,y:60,w:88,h:49});
    text('REAR ELEVATION / independent posts',196,121,8);
    const rear=boxBars.filter(b=>Math.abs(b.z-rearPlane)<.01);
    view(rear,(x,y)=>[x,-y],{x:196,y:127,w:88,h:40});
    text('1. Assemble exposed/shared fixed sash ends.  2. Terminate continuous rails into the owning sash.',12,178,9);
    text('3. Fit internal front posts only at cabinet boundaries.  4. Fit the independently selected rear supports.',12,185,9);
    // Separate member locator sheets keep dense assemblies readable.
    for(let offset=0;offset<bars.length;offset+=18){
      header(run,'FRAME MEMBERS / CUT AND PLACEMENT SCHEDULE');
      text('Datum: X offset from run start; Y above floor; Z out from wall. Position = lower corner of member.',12,43,8);
      text('Box bars: square cuts. Structural end sash: 45/45 mitres, no handle. No duplicate box upright at a sash end.',12,49,8);
      const cols=[12,39,101,120,143,165,187,208,253];
      doc.setFillColor('#e2efec');doc.rect(12,54,273,8,'F');
      ['Part ID','Member','Axis','Cut mm','X mm','Y mm','Z mm','Section mm','Stock'].forEach((s,i)=>text(s,cols[i],59,8));
      bars.slice(offset,offset+18).forEach((b,i)=>{
        const y=69+i*6.3;
        if(i%2===0){doc.setFillColor('#f4f7f5');doc.rect(12,y-4,273,6.3,'F');}
        const section=[b.w,b.h,b.d].filter((_,i)=>i!=={x:0,y:1,z:2}[b.axis]);
        [b.id,b.name,b.axis,mm(b.length),mm(b.x-x0),mm(b.y),mm(b.z),section.map(mm).join(' x '),stockOf(b.id)].forEach((s,i)=>text(s,cols[i],y,8));
      });
      text('IDs match nested bar stock and the review ZIP. No duplicate rear post is implied by a front division.',12,188,8);
    }
    for(let offset=0;offset<run.panels.length;offset+=18){
      header(run,'LINER / CLADDING SCHEDULE');
      text('U-cuts: 1 mm clearance per edge. Rear liner is physical ACP; end infills are seated inside fixed sash.',12,43,8);
      text('Rear posts are turned 38.1 across x 25.4 deep; ACP is flush behind them. No ACP top on bottom units.',12,49,8);
      const cols=[12,41,112,142,166,187,209,236];
      doc.setFillColor('#e2efec');doc.rect(12,54,273,8,'F');
      ['Part ID','Panel','Blank W','Blank H','X mm','Y mm','Z mm','U-cut depth'].forEach((s,i)=>text(s,cols[i],59,8));
      run.panels.slice(offset,offset+18).forEach((b,i)=>{
        const y=69+i*6.3;
        if(i%2===0){doc.setFillColor('#f4f7f5');doc.rect(12,y-4,273,6.3,'F');}
        [b.id,b.name,mm(b.cutW),mm(b.cutH),mm(b.x-x0),mm(b.y),mm(b.z),b.outline?mm(b.notchDepth):'-'].forEach((s,i)=>text(s,cols[i],y,8));
      });
      text('Use nested SVG contours in the review ZIP for U-cut locations. Blanks are conservatively nested.',12,183,8);
      text('Confirm fixings, cut-edge clearance and assembly sequence on a physical sample before production.',12,189,8);
    }
  }
  return doc;
}
