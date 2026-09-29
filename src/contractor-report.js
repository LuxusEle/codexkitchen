import {editableBomPdf} from './editable-bom-pdf.js';
import {jsPDF} from 'jspdf';
import {assemblyRuns} from './assembly-pdf.js';
import {frontSpecs} from './assembly.js';
import {placedOutline} from './fabrication.js';
import {surfaceTakeoff} from './surface-takeoff.js';
import {SASH_PROFILE,HANDLE_PROFILE} from './sash-profile.js';
const clean=s=>String(s??'').replace(/[^\x20-\x7e]/g,' ');
const mm=n=>Number(Number(n).toFixed(1)).toString();
const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
export function contractorReport(p,plan,job,images=[],options={}){
 const kind=options.kind||'full',visual=kind==='visual'||kind==='full',cuts=kind==='cuts'||kind==='full';
 if(kind==='bom')return editableBomPdf(p,plan,job);
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true}),W=420,H=297,M=15;
 const runs=assemblyRuns(job),s=surfaceTakeoff(p,plan.units),wall=w=>p.siteWallLabels?.[w]||w;
 let pages=0;const issued=new Date().toISOString().slice(0,10);
 function text(t,x,y,size=10,color='#173e39'){doc.setTextColor(color);doc.setFontSize(size);doc.text(clean(t),x,y);}
 function para(t,x,y,width=390,size=10){doc.setFontSize(size);const ls=doc.splitTextToSize(clean(t),width);doc.setTextColor('#526b62');doc.text(ls,x,y);return y+ls.length*size*.43;}
 function page(title,sub=''){
  if(pages++)doc.addPage('a3','landscape');doc.setFillColor('#173e39');doc.rect(0,0,W,4,'F');
  text('CODEX KITCHEN / CONTRACTOR REVIEW',M,14,9);text(issued,370,14,9);text(title,M,29,23);para(sub,M,39,390,10);
  doc.setDrawColor('#cedbd5');doc.line(M,281,W-M,281);text('REVIEW BEFORE FABRICATION / mm unless noted / do not scale',M,289,8);
 }
 function table(headers,rows,widths,y=59,rowh=9){
  doc.setFillColor('#173e39');doc.rect(M,y-6,390,9,'F');let x=M;
  headers.forEach((h,i)=>{text(h,x+2,y,8,'#ffffff');x+=widths[i];});y+=rowh+3;
  rows.forEach((r,idx)=>{if(idx%2===0){doc.setFillColor('#eef3ed');doc.rect(M,y-5,390,rowh,'F');}let xx=M;r.forEach((v,i)=>{const t=clean(v),font=Math.min(9,(widths[i]-4)/Math.max(doc.getStringUnitWidth(t),1)*2.83);text(t,xx+2,y,font);xx+=widths[i];});y+=rowh;});return y;
 }
 function schedules(title,headers,rows,widths,n=21){for(let off=0;off<rows.length;off+=n){page(title,`Schedule ${Math.floor(off/n)+1} of ${Math.ceil(rows.length/n)}`);table(headers,rows.slice(off,off+n),widths);}}
 function path(points,color='#b9d3cd'){
  if(!points.length)return;doc.setDrawColor('#294a40');doc.setFillColor(color);doc.setLineWidth(.22);
  const rel=points.slice(1).map((pt,i)=>[pt[0]-points[i][0],pt[1]-points[i][1]]);doc.lines(rel,points[0][0],points[0][1],[1,1],'FD',true);
 }
 function frame(bars,mode,box){
  if(!bars.length)return;
  const project=(x,y,z)=>mode==='iso'?[x-.6*z,-y+.32*z]:mode==='side'?[z,-y]:mode==='right'?[-z,-y]:[x,-y];
  const verts=b=>[[0,0,0],[b.w,0,0],[b.w,b.h,0],[0,b.h,0],[0,0,b.d],[b.w,0,b.d],[b.w,b.h,b.d],[0,b.h,b.d]].map(([x,y,z])=>project(b.x+x,b.y+y,b.z+z));
  const points=bars.flatMap(verts),x0=Math.min(...points.map(p=>p[0])),y0=Math.min(...points.map(p=>p[1])),dx=Math.max(...points.map(p=>p[0]))-x0,dy=Math.max(...points.map(p=>p[1]))-y0,sc=Math.min(box.w/Math.max(1,dx),box.h/Math.max(1,dy));
  const convert=([x,y])=>[box.x+(box.w-dx*sc)/2+(x-x0)*sc,box.y+(box.h-dy*sc)/2+(y-y0)*sc];
  for(const b of bars){doc.setDrawColor(b.name.startsWith('Rear')?'#729c91':'#173e39');doc.setLineWidth(.17);const pts=verts(b).map(convert);for(const [a,c] of edges)doc.line(...pts[a],...pts[c]);}
 }
 if(visual){
 page('Kitchen / complete contractor report',`${p.name} | Generated from the current design and fabrication data`);
 const hero=images.find(i=>i.name.includes('perspective'));if(hero)doc.addImage(hero.url,hero.url.startsWith('data:image/jpeg')?'JPEG':'PNG',M,52,267,178);
 else para('Model images were not supplied. Geometry, quantities and cutting plans follow on the next pages.',M,75,255,15);
 for(const [i,line] of [`${runs.length} continuous frame assemblies`,`${job.bars.length} bar cuts / ${job.panels.length} panels`,`${job.barNest.stocks.length} bars / ${job.sheetNest.sheets.length} sheets`,`Granite gross: ${s.graniteGrossSqft.toFixed(2)} sq ft`,s.configured?`Backsplash: ${s.backsplashSqft.toFixed(2)} sq ft`:'Backsplash height: to confirm'].entries())text(line,295,70+i*19,12);
 para('Model captures preserve the actual front divisions. Frame drawings and cut lists share the same current member records. Appliance fit, profile samples, fixings and site measurements remain subject to contractor review.',M,249);
 const issues=[...(job.errors||[]),...(job.rejected||[]).map(r=>r.reason),...(plan.unmet||[])];
 if(issues.length){page('Incomplete design / checks to resolve');para(issues.join(' | '),M,60,390,12);}
 // Every prepared view is embedded; no AI picture can replace the design data.
 for(const img of images){page(img.name.replace(/\.(png|jpg)$/,'').replace(/^\d+-/,'').replaceAll('-',' '),'Current app model / dimensions and fabrication schedules govern construction');doc.addImage(img.url,img.url.startsWith('data:image/jpeg')?'JPEG':'PNG',47,49,326,217);}
 }
 if(visual)schedules('Cabinet / separate front schedule',['ID','Wall','Use','Offset','W','H','D','Bottom'],plan.units.map(u=>[u.id,wall(u.wall),u.type,mm(u.x),mm(u.w),mm(u.h),mm(u.d),mm(u.z)]),[40,25,75,50,50,50,50,50]);
 const fronts=plan.units.flatMap(u=>frontSpecs(u).map(f=>({...f,wall:u.wall})));
 if(visual)schedules('Door and drawer leaves',['Front ID','Wall','Kind','Width','Height','Grip edge'],fronts.map(f=>[f.id,wall(f.wall),f.kind,mm(f.w),mm(f.h),f.handleSide]),[95,35,70,60,60,70]);
 const stockMap=new Map(job.barNest.stocks.flatMap(stock=>stock.cuts.map(c=>[c.id,{stock:stock.id,offset:c.offset}])));
 for(const r of runs){
  const b=r.bars,x0=Math.min(...b.map(x=>x.x)),x1=Math.max(...b.map(x=>x.x+x.w)),y0=Math.min(...b.map(x=>x.y)),y1=Math.max(...b.map(x=>x.y+x.h)),z0=Math.min(...b.map(x=>x.z)),z1=Math.max(...b.map(x=>x.z+x.d));
  if(visual){
  page(`${r.id} / wall ${wall(b[0].wall)} / continuous frame`,`Envelope ${mm(x1-x0)} W x ${mm(y1-y0)} H x ${mm(z1-z0)} D | Cabinets ${b[0].unitIds.join(', ')}`);
  text('ISOMETRIC',M,58,11);frame(b,'iso',{x:M,y:65,w:248,h:171});
  text('FRONT',280,58,11);frame(b,'front',{x:280,y:64,w:124,h:65});
  const rear=b.filter(v=>Math.abs(v.z-z0)<1);text('REAR SUPPORTS',280,149,11);frame(rear,'front',{x:280,y:156,w:124,h:72});
  para('One shared structure with separate fronts. Member envelopes show placement; actual extrusion contours and joinery require supplier approval.',M,256);
  page(`${r.id} / side and end views`,'Looking along the run. Left and right end assemblies are isolated; the centre view projects all depth members.');
  text('LEFT END',38,61,12);frame(b.filter(v=>v.x<x0+46),'side',{x:28,y:74,w:95,h:160});
  text('FULL DEPTH PROJECTION',151,61,12);frame(b,'side',{x:157,y:74,w:95,h:160});
  text('RIGHT END',309,61,12);frame(b.filter(v=>v.x+v.w>x1-46),'right',{x:293,y:74,w:95,h:160});
  para(`Depth ${mm(z1-z0)} mm; height envelope ${mm(y1-y0)} mm. Projection overlays members along the run; use the placement table for each exact location.`,M,255);
  }
  if(cuts)schedules(`${r.id} / member placements`,['Cut ID','Member','Axis','Length','X from start','Y','Z','Stock'],b.map(v=>[v.id,v.name,v.axis,mm(v.length),mm(v.x-x0),mm(v.y),mm(v.z),stockMap.get(v.id)?.stock||'Unnested']),[45,105,20,40,45,40,40,55]);
 }
 if(visual){
 page('Granite and tiled backsplash','Areas exclude waste. Granite is gross before sink cutouts; backsplash deducts intersecting recorded openings.');
 text(`GRANITE GROSS  ${s.graniteGrossSqft.toFixed(2)} sq ft`,M,65,21);text(`AFTER SINK  ${s.graniteNetSqft.toFixed(2)} sq ft`,225,65,21);
 text(s.configured?`BACKSPLASH  ${s.backsplashSqft.toFixed(2)} sq ft`:'BACKSPLASH / HEIGHTS TO CONFIRM',M,89,19);
 table(['Wall','Band dimensions (width x height mm)','Area sq ft'],s.rows.map(r=>[r.label,r.bands.map(b=>`${mm(b.w)} x ${mm(b.height)}`).join(' + '),r.sqft.toFixed(2)]),[50,260,80],114,13);
 para(s.note,M,190,390,12);para('Granite slab yield, seams, polishing, sink/hob machining and fitting are supplier pricing items. No hob cutout has been deducted. Verify openings and tile termination on site.',M,225,390,11);
 }
 if(cuts){
 schedules('Bill of materials / stock to procure',['Category','Item / specification','Quantity','Unit'],job.bom.map(b=>[b.category,b.item,b.quantity,b.unit]),[65,240,40,45]);
 // All cuts, including front sash members outside run frames.
 schedules('All bar cuts / stock lookup',['Cut ID','Profile','Cut mm','Ends','Stock','Stock offset'],job.bars.map(b=>[b.id,b.profile,mm(b.length),`${b.miterStart}/${b.miterEnd}`,stockMap.get(b.id)?.stock||'Unnested',mm(stockMap.get(b.id)?.offset||0)]),[65,165,40,35,45,40]);
 for(let off=0;off<job.barNest.stocks.length;off+=4){page('Bar stock / cutting plans','Individual cuts link to the member IDs. Kerf, trims and stock lengths follow the current fabrication settings.');
  job.barNest.stocks.slice(off,off+4).forEach((st,n)=>{const y=60+n*49,sc=390/st.length;text(`${st.id} / ${st.profile} / ${st.length} mm`,M,y,10);doc.setFillColor('#e5e8df');doc.rect(M,y+5,390,10,'F');
   st.cuts.forEach((b,i)=>{doc.setFillColor(i%2?'#4a7972':'#173e39');doc.rect(M+b.offset*sc,y+5,b.length*sc,10,'F');if(b.length*sc>6)text(i+1,M+(b.offset+b.length/2)*sc,y+12,8,'#ffffff');});
   para(st.cuts.map((b,i)=>`${i+1}: ${b.id} = ${mm(b.length)}`).join(' | '),M,y+23,390,8);
  });
 }
 for(const sh of job.sheetNest.sheets){page(`${sh.id} / ACP sheet cutting plan`,`${sh.finish} / ${sh.width} x ${sh.height} x ${sh.thickness} mm | origin top-left | rotation shown below`);
  const sc=Math.min(390/sh.width,125/sh.height),ox=(420-sh.width*sc)/2,oy=51;doc.setFillColor('#edf1e8');doc.rect(ox,oy,sh.width*sc,sh.height*sc,'F');
  sh.placements.forEach((v,i)=>{path(placedOutline(v).map(([x,y])=>[ox+x*sc,oy+y*sc]));text(i+1,ox+(v.x+v.w/2)*sc,oy+(v.y+v.h/2)*sc,8);});
  const rows=sh.placements.map((v,i)=>[i+1,v.id,v.name,`${mm(v.cutW)} x ${mm(v.cutH)}`,mm(v.x),mm(v.y),v.rotated?'90 deg':'0 deg']);
  table(['#','Part ID','Panel','Blank W x H','X','Y','Rotation'],rows.slice(0,10),[15,65,115,65,40,40,50],192,7);
  if(rows.length>10)schedules(`${sh.id} / additional placements`,['#','Part ID','Panel','Blank W x H','X','Y','Rotation'],rows.slice(10),[15,65,115,65,40,40,50]);
 }
 const panelRows=job.panels.map(v=>[v.id,v.name,mm(v.cutW),mm(v.cutH),v.finish,job.sheetNest.sheets.find(sh=>sh.placements.some(a=>a.id===v.id))?.id||'Unnested']);
 schedules('All panels / sheet lookup',['Panel ID','Name','Blank W','Blank H','Finish','Sheet'],panelRows,[65,130,50,50,45,50]);
 for(const v of job.panels.filter(v=>v.notchDepth>0&&v.outline)){page(`${v.id} / notch geometry`,`${v.name} | Unrotated blank ${mm(v.cutW)} x ${mm(v.cutH)} | coordinate origin bottom-left`);const sc=Math.min(248/v.cutW,171/v.cutH);path(v.outline.map(([x,y])=>[M+x*sc,243-y*sc]));para(v.outline.map(([x,y],i)=>`${i+1}: (${mm(x)}, ${mm(y)})`).join(' / '),285,67,118,11);para('Coordinates define the model outline. Confirm actual extrusion fit and clearance before machining; match the part ID and rotation to the nested sheet.',M,263,390,10);}
 page('Profile cross-sections / connection review','Physical member dimensions and supplier fit must be verified before manufacturing.');
 text('BOX TUBE 38.1 x 25.4 x 1.2',M,64,12);doc.setFillColor('#173e39');doc.rect(38,84,25.4*2,38.1*2,'F');doc.setFillColor('#ffffff');doc.rect(40.4,86.4,23*2,35.7*2,'F');
 const prof=(x,grip)=>{path(SASH_PROFILE.outer.map(([a,b])=>[x+a*2.1,181-b*2.1]),'#173e39');path(SASH_PROFILE.inner.map(([a,b])=>[x+a*2.1,181-b*2.1]),'#ffffff');if(grip)path(HANDLE_PROFILE.outer.map(([a,b])=>[x+a*2.1,181-b*2.1]),'#be9659');};
 text('DETAILED SASH',159,64,12);prof(181,false);text('SASH + GRIP / VERIFY SUPPLY',283,64,12);prof(326,true);
 para('The integrated grip is a review profile, not confirmed supplier stock. Obtain samples and agree corner joints, wall anchors, screws, hinge positions, heat clearances and installation tolerances. Do not fabricate from a rendered image.',M,250,390,11);
 }
 if(kind==='full')editableBomPdf(p,plan,job,doc);
 for(let i=1;i<=doc.getNumberOfPages();i++){doc.setPage(i);text(`${i} / ${doc.getNumberOfPages()}`,380,289,8);}
 doc.setProperties({title:`${p.name} - Contractor report`,subject:'Current model views, frame details, materials and cut plans',author:'CODEX KITCHEN'});return doc;
}
