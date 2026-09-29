import React,{useEffect,useRef,useState} from 'react';
import {reportImages} from './report-images.js';
import {surfaceTakeoff} from './surface-takeoff.js';
import {barSVG,sheetSVG} from './fabrication.js';
export default function ReportingPanel({project,plan,job,sceneRef}){
 const [kind,setKind]=useState('visual');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[view,setView]=useState('views');
 const [images,setImages]=useState([]),[renderBusy,setRenderBusy]=useState(false),[renderError,setRenderError]=useState('');
 const current=useRef(),preview=useRef();const signature=JSON.stringify(project);current.current=signature;
 function ensureImages(){
  if(preview.current?.signature===signature)return preview.current.promise;
  const promise=reportImages(project,plan,sceneRef.current);
  preview.current={signature,promise};
  promise.catch(()=>{if(preview.current?.promise===promise)preview.current=null;});
  return promise;
 }
 async function showRenders(){
  setView('views');setRenderBusy(true);setRenderError('');
  try{const next=await ensureImages();if(current.current===signature)setImages(next);}
  catch(e){if(current.current===signature)setRenderError(e.message);}
  finally{if(current.current===signature)setRenderBusy(false);}
 }
 useEffect(()=>{
  let cancelled=false;setResult(null);setError('');setImages([]);setView('views');setRenderBusy(true);setRenderError('');
  // Wait for the sibling 3D scene to mount; previews do not require a PDF.
  const timer=setTimeout(()=>{
   ensureImages().then(next=>{if(!cancelled)setImages(next);})
    .catch(e=>{if(!cancelled)setRenderError(e.message);})
    .finally(()=>{if(!cancelled)setRenderBusy(false);});
  },40);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[signature,sceneRef]);
 useEffect(()=>()=>{if(result)URL.revokeObjectURL(result.url);},[result]);
 const surfaces=surfaceTakeoff(project,plan.units);
 async function generate(){setBusy(true);setError('');try{
  await new Promise(resolve=>setTimeout(resolve,30));
  const {contractorReport}=await import('./contractor-report.js');
  const reportViews=['visual','full'].includes(kind)?await ensureImages():[];
  const doc=contractorReport(project,plan,job,reportViews,{kind});
  if(current.current!==signature)return;
  const blob=new Blob([doc.output('arraybuffer')],{type:'application/pdf'});
  if(reportViews.length)setImages(reportViews);
  setResult({url:URL.createObjectURL(blob),kind,pages:doc.getNumberOfPages()});setView(reportViews.length?'views':'pdf');
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="reporting-panel card" aria-label="Contractor reports">
  <h2>Contractor reports</h2><p>Renders load automatically. Choose a report to download, or use the tabs to view the frames and cutting plans.</p>
  <div className="report-metrics"><strong>Granite {surfaces.graniteGrossSqft.toFixed(2)} sq ft</strong><strong>Backsplash {surfaces.configured?surfaces.backsplashSqft.toFixed(2)+' sq ft':'height needed'}</strong><span>{job.bars.length} cuts · {job.panels.length} panels</span></div>
  <p>{surfaces.note} Areas exclude waste.</p>
  <label style={{display:'block',margin:'14px 0'}}>Report <select aria-label="Report type" value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);setResult(null);if(view==='pdf')setView('views');}} style={{padding:12,marginLeft:12,maxWidth:'100%'}}><option value="bom">1 · Editable BOM & estimate</option><option value="visual">2 · Renders, frames & isometrics</option><option value="cuts">3 · Cut plans & cut lists</option><option value="full">4 · Full report — all inclusive</option></select></label><button className="primary" disabled={busy||renderBusy||!plan.units.length} onClick={generate}>{busy?'Preparing report…':'Generate selected PDF'}</button>
  {error&&<p role="alert">{error}</p>}
  <div className="report-tabs">{['views','summary','frames','cuts',...(result?['pdf']:[])].map(v=><button key={v} aria-pressed={view===v} onClick={()=>v==='views'&&!images.length?showRenders():setView(v)}>{v==='pdf'?'PDF preview':v==='views'?'Renders':v}</button>)}</div>
  {view==='summary'&&<table><thead><tr><th>Wall</th><th>Tile height</th><th>Area sq ft</th></tr></thead><tbody>{surfaces.rows.map(r=><tr key={r.wall}><td>{r.label}</td><td>{[...new Set(r.bands.map(b=>b.height))].join(' / ')} mm</td><td>{r.sqft.toFixed(2)}</td></tr>)}</tbody></table>}
  {view==='frames'&&<div>{[...new Set(job.bars.map(b=>b.runId).filter(Boolean))].map(id=>{const bars=job.bars.filter(b=>b.runId===id);return <details key={id}><summary>{id} · wall {project.siteWallLabels?.[bars[0].wall]||bars[0].wall} · {bars.length} frame members</summary><div className="report-scroll"><table><thead><tr><th>ID</th><th>Member</th><th>Cut mm</th><th>X / Y / Z mm</th></tr></thead><tbody>{bars.map(b=><tr key={b.id}><td>{b.id}</td><td>{b.name}</td><td>{b.length.toFixed(1)}</td><td>{[b.x,b.y,b.z].map(n=>n.toFixed(1)).join(' / ')}</td></tr>)}</tbody></table></div></details>})}</div>}
  {view==='cuts'&&<div><h3>Bar cutting plans</h3>{job.barNest.stocks.map(s=><details key={s.id}><summary>{s.id} · {s.profile} · {s.length} mm</summary><div dangerouslySetInnerHTML={{__html:barSVG(s)}}/><p>{s.cuts.map(c=>`${c.id}: ${c.length.toFixed(1)} mm`).join(' | ')}</p></details>)}<h3>Sheet cutting plans</h3>{job.sheetNest.sheets.map(s=><details key={s.id}><summary>{s.id} · {s.finish} · {s.width} × {s.height} mm</summary><div dangerouslySetInnerHTML={{__html:sheetSVG(s)}}/></details>)}</div>}
  {result&&<p><a href={result.url} download={`kitchen-${result.kind}-report.pdf`}>Download current {result.pages}-page PDF</a></p>}
  {view==='views'&&<>{renderBusy&&<p role="status">Preparing kitchen renders…</p>}{renderError&&<p role="alert">{renderError} <button onClick={showRenders} disabled={renderBusy}>Retry renders</button></p>}<div className="report-gallery">{images.map(i=><figure key={i.name}><img src={i.url} alt={i.name}/><figcaption>{i.name.replace(/\.(png|jpg)$/,'').replaceAll('-',' ')}</figcaption><a href={i.url} download={i.name}>Save {i.name}</a></figure>)}</div></>}
  {view==='pdf'&&result&&<><p>If this browser does not display PDF files, download and open the report in a PDF reader. Editable estimate fields calculate in Adobe Acrobat Reader.</p><iframe title="Contractor PDF preview" src={result.url} style={{width:'100%',height:760,border:'1px solid #cedbd5'}}/></>}
  <style>{`.reporting-panel{margin-top:18px}.report-tabs,.report-metrics{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.report-metrics>*{padding:12px;background:#eef3ed;border-radius:6px}.report-tabs button{padding:8px 14px}.report-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px}.report-gallery figure{margin:0}.report-gallery img{width:100%}.reporting-panel details{margin:12px 0;padding:12px;border:1px solid #cedbd5;border-radius:6px}.reporting-panel summary{cursor:pointer}.reporting-panel svg{width:100%;max-height:500px}.report-scroll{overflow:auto}.reporting-panel table{width:100%;border-collapse:collapse}.reporting-panel th,.reporting-panel td{text-align:left;padding:8px;border-bottom:1px solid #dde5df}`}</style>
 </section>;
}
