import {countertopPieces} from './construction.js';
const SQFT=92903.04;
// Union area of axis-aligned rectangles, with window/door areas removed once.
function area(rects,holes=[]){
 const xs=[...new Set([...rects,...holes].flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b);
 const ys=[...new Set([...rects,...holes].flatMap(r=>[r.bottom,r.bottom+r.height]))].sort((a,b)=>a-b);
 const covers=(rs,x,y)=>rs.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.bottom&&y<r.bottom+r.height);
 let a=0;for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){const x=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2;if(covers(rects,x,y)&&!covers(holes,x,y))a+=(xs[i]-xs[i-1])*(ys[j]-ys[j-1]);}return a;
}
export function surfaceTakeoff(p,units){
 const net=countertopPieces(p,units).reduce((s,r)=>s+r.w*r.d,0);
 const gross=countertopPieces(p,units.map(u=>u.type==='sink'?{...u,type:'base'}:u)).reduce((s,r)=>s+r.w*r.d,0);
 const configured=Array.isArray(p.surfaces?.backsplash);
 const rows=['A','B','C','D'].map(wall=>{
  const bands=(p.surfaces?.backsplash||[]).filter(r=>r.wall===wall);
  const holes=(p.openings||[]).filter(r=>r.wall===wall).map(r=>({x:r.x,w:r.w,bottom:r.sill,height:r.h}));
  const mm2=area(bands,holes);
  return {wall,label:p.siteWallLabels?.[wall]||wall,bands,mm2,sqft:mm2/SQFT};
 }).filter(r=>r.bands.length);
 return {graniteGrossSqft:gross/SQFT,graniteNetSqft:net/SQFT,backsplashSqft:rows.reduce((s,r)=>s+r.sqft,0),configured,rows,note:p.surfaces?.note||'Backsplash heights are not configured. Confirm the tiled area before quoting.'};
}
