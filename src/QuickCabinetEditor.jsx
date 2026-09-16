import React,{useEffect,useRef,useState} from 'react';
import {X,Trash2,Move,SlidersHorizontal} from 'lucide-react';
import LengthInput,{checkLengthInputs} from './LengthInput.jsx';
import {TYPES,minimumCabinetWidth,maximumCabinetWidth} from './model.js';
import './quick-cabinet.css';

export default function QuickCabinetEditor({unit,anchor,project,issues,onEdit,onClose,onDelete,onMove,onMore,onFit}) {
  const ref=useRef(),[screen,setScreen]=useState(()=>({w:globalThis.innerWidth||1200,h:globalThis.innerHeight||800})),[dimensions,setDimensions]=useState({w:unit.w,h:unit.h});
  useEffect(()=>setDimensions(old=>({...old,w:unit.w})),[unit.w]);
  useEffect(()=>setDimensions(old=>({...old,h:unit.h})),[unit.h]);
  useEffect(()=>{const resize=()=>setScreen({w:window.innerWidth,h:window.innerHeight});window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  useEffect(()=>{const escape=e=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',escape);ref.current?.focus({preventScroll:true});return()=>window.removeEventListener('keydown',escape);},[unit.id]);
  const field=(name,key,min,max,locked=false)=>{const invalid=!Number.isFinite(dimensions[key])||dimensions[key]<min||dimensions[key]>max;return <div className="field"><span>{name}</span><LengthInput label={`${unit.id} ${name}`} value={dimensions[key]} min={min} max={max} disabled={locked} onChange={value=>{setDimensions(old=>({...old,[key]:value}));if(Number.isFinite(value)&&value>=min&&value<=max)onEdit(key,value);}}/>{invalid&&<small className="length-error">Not applied: allowed {min}–{max} mm.</small>}</div>;};
  const style=screen.w>600?{left:Math.max(12,Math.min(anchor.x+14,screen.w-352)),top:Math.max(12,Math.min(anchor.y-25,screen.h-Math.min(570,screen.h-24)-12))}:{};
  const close=()=>{if(checkLengthInputs(ref.current))onClose();};
  const upper=unit.z>=900,tall=TYPES[unit.type]?.h>1000;
  const heightMin=unit.type==='filler'?100:upper?200:unit.type==='oven'?1800:tall?1600:600;
  const heightMax=Math.min(project.room.height-unit.z,unit.type==='filler'?project.room.height:upper?1200:tall?3000:900);
  return <section ref={ref} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="quick-box-title" className="quick-cabinet" style={style}>
    <div className="quick-heading"><div><span className="eyebrow">{unit.id} · {unit.wall==='Island'?'ISLAND':`WALL ${unit.wall}`} · {unit.z>=900?'UPPER':'BASE / TALL'}</span><h3 id="quick-box-title">{TYPES[unit.type]?.name}</h3></div><button className="icon" aria-label="Close cabinet editor" onClick={close}><X size={18}/></button></div>
    <p className="quick-help">Changes update the design and estimate immediately.</p>
    <div className="two">
      {field('Width','w',minimumCabinetWidth(unit),maximumCabinetWidth(unit),['sink','cooker'].includes(unit.type))}
      {field('Height','h',heightMin,heightMax)}
    </div>
    {['sink','cooker'].includes(unit.type)&&<p className="quick-help">Appliance width protected. Sink exceptions use the approved gap resolver.</p>}
    {!['filler','fridge','dishwasher','open'].includes(unit.type)&&<div className="quick-fronts">
      {['base','cooker','wall','glass'].includes(unit.type)&&<label className="field">Fronts<select value={unit.frontLayout||'doors'} onChange={e=>onEdit('frontLayout',e.target.value)}><option value="doors">Doors</option>{unit.z>=900?<option value="open">Open shelves</option>:<option value="drawers">Drawers</option>}</select></label>}
      {!['spice','bottle','waste','oven'].includes(unit.type)&&<label className="field">{unit.type==='drawers'||unit.frontLayout==='drawers'?'Drawer fronts':'Door leaves'}<select value={unit.doorDivisions||0} disabled={unit.frontLayout==='open'} onChange={e=>onEdit('doorDivisions',Number(e.target.value))}><option value="0">Automatic</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
      <label className="field">Infill<select value={unit.frontMaterial||(unit.type==='glass'?'glass':'acp')} disabled={unit.frontLayout==='open'} onChange={e=>onEdit('frontMaterial',e.target.value)}><option value="acp">ACP</option><option value="glass">Glass</option></select></label>
      <label className="field">Front colour<input type="color" value={unit.frontColor||project.style.front} disabled={unit.frontLayout==='open'} onChange={e=>onEdit('frontColor',e.target.value)}/></label>
    </div>}
    {!!issues.length&&<div className="quick-issues"><strong>Layout needs review</strong><p>{issues[0]}</p>{issues.length>1&&<small>{issues.length-1} more issue(s) in Layout check.</small>}<button className="secondary compact" onClick={onFit}>Review / close gaps</button></div>}
    <div className="quick-actions"><button className="secondary compact" onClick={onMove}><Move size={15}/>Move</button><button className="secondary compact" onClick={onMore}><SlidersHorizontal size={15}/>More</button><button className="secondary compact danger" onClick={onDelete}><Trash2 size={15}/>{unit.wall==='Island'?'Delete island':'Delete'}</button></div>
    <p className="quick-help">Delete leaves space for review. Undo is available until the next layout change.</p>
  </section>;
}
