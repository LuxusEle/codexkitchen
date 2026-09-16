import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Box,Check,SlidersHorizontal,X} from 'lucide-react';
import {BOX_TYPES,FIXED_WIDTH_TYPES,TYPES,activeWalls,cabinetDefaults,minimumCabinetWidth,maximumCabinetWidth} from './model.js';
import {boxBrief,toggleBriefBox,previewBoxBrief} from './box-brief.js';
import LengthInput,{MeasurementSwitch,checkLengthInputs} from './LengthInput.jsx';
import './box-chooser.css';

const groups=[['Worktop & base',['sink','cooker','drawers','base','spice','bottle','waste','dishwasher']],['Tall units',['oven','pantry','fridge']],['Upper row',['wall','glass','lift']]];

function BoxDialog({p,initial,onClose,onApply}) {
  const [draft,setDraft]=useState(initial),[acceptUnplaced,setAcceptUnplaced]=useState(false),ref=useRef();
  const {plan}=useMemo(()=>previewBoxBrief(p,draft),[p,draft]);
  const patch=(key,type,value)=>setDraft(old=>({...old,[key]:{...old[key],[type]:value}}));
  const dimensions=(type,key,value)=>setDraft(old=>({...old,unitDefaults:{...old.unitDefaults,[type]:{...old.unitDefaults[type],[key]:value}}}));
  useEffect(()=>{ref.current.showModal();},[]);
  useEffect(()=>setAcceptUnplaced(false),[draft]);
  return <dialog className="box-dialog" ref={ref} onCancel={onClose} onClose={onClose} aria-labelledby="box-title">
    <div className="box-dialog-heading"><div><p className="eyebrow">CABINET BRIEF</p><h2 id="box-title">Choose your boxes</h2></div><button className="secondary" onClick={onClose} aria-label="Close box chooser"><X size={18}/></button></div>
    <MeasurementSwitch/>
    <p className="length-help">Feet and inches accept decimals or fractions, e.g. 3 1/2 in. Final schedules and cutting stay in mm.</p>
    <p>Tick the boxes you need. Set their starting sizes and preferred walls, then review the proposed arrangement before OK.</p>
    {p.units&&<p className="box-notice">This rebuilds the arrangement, replacing manual moves and individual box edits. Cancel keeps your current design.</p>}
    <p className="muted">Unticked requirements are removed; ordinary storage still fills usable wall space. Appliance widths stay fixed. Storage may resize to close gaps—the final sizes are listed below.</p>
    <button className="secondary compact" onClick={()=>setDraft(old=>['oven','pantry','fridge'].reduce((next,type)=>toggleBriefBox(next,type,false),old))}>No tall units / fridge</button>
    {groups.map(([name,types])=><fieldset className="box-group" key={name}><legend>{name}</legend>
      {types.map(type=>{
        const t=cabinetDefaults({...p,...draft},type),on=(draft.needs[type]||0)>0,upper=!!TYPES[type].z;
        return <div className={`box-choice ${on?'chosen':''}`} key={type}>
          <label className="box-check"><input type="checkbox" checked={on} onChange={e=>setDraft(old=>toggleBriefBox(old,type,e.target.checked))}/><strong>{t.name}</strong></label>
          <div className="box-inputs">
            <label>Qty<input aria-label={`${t.name} quantity`} type="number" min="1" max={type==='base'?24:12} value={draft.needs[type]||draft.boxCounts[type]||1} disabled={!on} onChange={e=>{const value=Number(e.target.value);setDraft(old=>({...old,needs:{...old.needs,[type]:value},boxCounts:{...old.boxCounts,[type]:value}}));}}/></label>
            <div className="box-size-field"><span>Width {FIXED_WIDTH_TYPES.includes(type)&&<small>fixed</small>}</span><LengthInput label={`${t.name} default width`} step={10} min={minimumCabinetWidth({type})} max={maximumCabinetWidth({type})} disabled={!on||FIXED_WIDTH_TYPES.includes(type)} value={t.w} onChange={value=>dimensions(type,'w',value)}/></div>
            <div className="box-size-field"><span>Height</span><LengthInput label={`${t.name} default height`} step={10} min={upper?200:type==='oven'?1800:TYPES[type].h>1000?1600:600} max={upper?1200:TYPES[type].h>1000?3000:900} disabled={!on} value={t.h} onChange={value=>dimensions(type,'h',value)}/></div>
            <label>Wall<select aria-label={`${t.name} preferred wall`} disabled={!on} value={draft.preferences[type]||''} onChange={e=>patch('preferences',type,e.target.value)}><option value="">Auto</option>{activeWalls(p.room.layout).map(w=><option key={w} value={w}>{w}</option>)}</select></label>
            {!['fridge','dishwasher','oven','spice','bottle','waste'].includes(type)&&<label>Divisions<select aria-label={`${t.name} divisions`} value={t.doorDivisions} disabled={!on||t.frontLayout==='open'} onChange={e=>dimensions(type,'doorDivisions',Number(e.target.value))}><option value="0">Auto</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
            {['base','cooker','wall','glass'].includes(type)&&<label>Fronts<select aria-label={`${t.name} front arrangement`} disabled={!on} value={t.frontLayout} onChange={e=>dimensions(type,'frontLayout',e.target.value)}><option value="doors">Doors</option>{upper?<option value="open">Open shelves</option>:<option value="drawers">Drawers</option>}</select></label>}
          </div>
        </div>;
      })}
    </fieldset>)}
    <fieldset className="box-group"><legend>Walls with upper cabinets</legend><div className="box-wall-options">{activeWalls(p.room.layout).map(w=><label key={w}><input type="checkbox" checked={draft.upperWalls.includes(w)} onChange={e=>setDraft(old=>({...old,upperWalls:e.target.checked?[...old.upperWalls,w]:old.upperWalls.filter(x=>x!==w)}))}/> Wall {w}</label>)}</div><p className="muted">For your reference: cooker on A, sink on B, and upper cabinets on A only. Enter the measured window on B in Openings; sill = 1000 mm.</p></fieldset>
    <section className="box-preview" aria-label="Proposed cabinet arrangement">
      <h3>Review before applying · {plan.units.length} boxes / closures</h3>
      {plan.errors.length>0&&<div className="box-issues" role="alert"><strong>Resolve these before applying</strong><ul>{plan.errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
      {plan.unmet.length>0&&<div className="box-issues"><strong>Not enough space for:</strong><ul>{plan.unmet.map((e,i)=><li key={i}>{e}</li>)}</ul><label className="box-check"><input type="checkbox" checked={acceptUnplaced} onChange={e=>setAcceptUnplaced(e.target.checked)}/> Keep these as unplaced requirements for now</label></div>}
      {plan.units.length>0&&<details open><summary>Final widths, heights and divisions</summary><div className="box-schedule"><table><thead><tr><th>Box</th><th>Wall</th><th>Unit</th><th>W × H</th><th>Fronts</th></tr></thead><tbody>{plan.units.map(u=><tr key={u.id}><td>{u.id}</td><td>{u.wall}</td><td>{TYPES[u.type].name}{u.automatic?' · auto-fill':''}</td><td>{Math.round(u.w)} × {u.h}</td><td>{u.frontLayout==='open'?'Open':`${u.doorDivisions||'Auto'} ${u.type==='drawers'||u.frontLayout==='drawers'?'drawers':'doors'}`}</td></tr>)}</tbody></table></div></details>}
    </section>
    <div className="box-dialog-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={plan.errors.length>0||(!acceptUnplaced&&plan.unmet.length>0)} onClick={()=>{if(checkLengthInputs(ref.current))onApply({...draft,units:plan.units});}}><Check size={16}/>OK · apply boxes</button></div>
  </dialog>;
}

export default function BoxChooser({p,plan,selected,onSelect,disabled,onApply}) {
  const [draft,setDraft]=useState(null);
  const chips=BOX_TYPES.filter(t=>p.needs[t]>0||p.boxCounts?.[t]>0);
  return <section className="box-toolbar" aria-label="Cabinet requirements">
    <button className="secondary compact" disabled={disabled} onClick={()=>setDraft(boxBrief(p))}><SlidersHorizontal size={16}/>Choose boxes</button>
    <div className="box-chips">{chips.map(type=>{
      const on=p.needs[type]>0,t=cabinetDefaults(p,type);
      return <button key={type} className={`box-chip ${on?'active':''}`} disabled={disabled} aria-pressed={on} title={`${t.name}: ${t.w} × ${t.h} mm defaults. Click to review turning ${on?'off':'on'}.`} onClick={()=>setDraft(toggleBriefBox(boxBrief(p),type,!on))}><Box size={13}/>{t.name} <span>{on?`×${p.needs[type]}`:'Off'}</span></button>;
    })}</div>
    {plan?.units.length>0&&<div className="placed-boxes" aria-label="Select a placed cabinet"><span>Placed</span>{plan.units.filter(u=>u.type!=='filler').map(u=><button key={u.id} className={`box-chip ${selected===u.id?'active':''}`} aria-pressed={selected===u.id} disabled={disabled} title={`${TYPES[u.type].name} · wall ${u.wall} · ${Math.round(u.w)} × ${u.h} mm. Select to edit this box.`} onClick={()=>onSelect(u.id)}>{u.id} · {u.wall} · {Math.round(u.w)}</button>)}</div>}
    {draft&&<BoxDialog p={p} initial={draft} onClose={()=>setDraft(null)} onApply={patch=>{onApply(patch);setDraft(null);}}/>}
  </section>;
}
