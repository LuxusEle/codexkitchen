import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,X} from 'lucide-react';
import LengthInput,{MeasurementSwitch,checkLengthInputs} from './LengthInput.jsx';
import {islandSettings} from './model.js';
import './breakfast-wizard.css';

const treatments=[
  ['none','Open end','No rack and no upper cabinets above the bar.'],
  ['openRack','Open display rack','Add a real open rack at one end; it appears in 3D, elevations and BOM.'],
  ['upperReturn','Continue top row','Run upper cabinets perpendicular to the wall, above the bar, to its outer edge.'],
];

export default function BreakfastBarWizard({project,onClose,onApply}){
  const [step,setStep]=useState(0),[draft,setDraft]=useState(()=>({...islandSettings({...project,islandConfig:{...project.islandConfig,kind:'breakfast'}}),kind:'breakfast'})),ref=useRef();
  useEffect(()=>ref.current.showModal(),[]);
  const set=(key,value)=>setDraft(old=>({...old,[key]:value}));
  const finish=()=>{if(checkLengthInputs(ref.current))onApply({kind:'breakfast',width:draft.width,depth:draft.depth,overhang:draft.overhang,pendants:draft.pendants,slatted:draft.slatted,endTreatment:draft.endTreatment,featureEnd:draft.featureEnd,rackWidth:draft.rackWidth,x:null,y:null});};
  return <dialog className="bar-wizard" ref={ref} onCancel={onClose} aria-labelledby="bar-wizard-title">
    <div className="bar-wizard-head"><div><p className="eyebrow">BREAKFAST BAR · STEP {step+1} OF 3</p><h2 id="bar-wizard-title">{['Set the counter','Choose the bar end','Finish and confirm'][step]}</h2></div><button className="icon" aria-label="Close breakfast bar setup" onClick={onClose}><X size={18}/></button></div>
    <div className="bar-progress">{[0,1,2].map(n=><i key={n} className={n<=step?'done':''}/>)}</div>
    {step===0&&<section><MeasurementSwitch/><p className="intro">Enter the manufactured counter size. You can rotate and drag it in the room plan after creation.</p><div className="bar-size-grid"><label>Bar length<LengthInput label="Breakfast bar length" value={draft.width} min={600} max={3000} step={50} onChange={v=>set('width',v)}/></label><label>Cabinet depth<LengthInput label="Breakfast bar cabinet depth" value={draft.depth} min={450} max={900} step={25} onChange={v=>set('depth',v)}/></label><label>Seating overhang<LengthInput label="Breakfast bar seating overhang" value={draft.overhang} min={0} max={600} step={25} onChange={v=>set('overhang',v)}/></label></div><p className="bar-total">Overall top: <strong>{Math.round(draft.width)} × {Math.round(draft.depth+draft.overhang)} mm</strong></p></section>}
    {step===1&&<section><p className="intro">How should the breakfast-bar end connect visually to the kitchen?</p><div className="bar-treatment-grid">{treatments.map(([value,title,help])=><button key={value} className={draft.endTreatment===value?'chosen':''} onClick={()=>set('endTreatment',value)}><strong>{title}</strong><span>{help}</span></button>)}</div>{draft.endTreatment==='openRack'&&<div className="bar-options"><label>Rack end<select value={draft.featureEnd} onChange={e=>set('featureEnd',e.target.value)}><option value="start">Start end</option><option value="end">Far end</option></select></label><label>Rack width<LengthInput label="Open rack width" value={draft.rackWidth} min={250} max={600} step={25} onChange={v=>set('rackWidth',v)}/></label></div>}{draft.endTreatment==='upperReturn'&&<p className="bar-callout">The upper row will use the bar length and standard 350 mm upper depth. It will be included as real cabinet units, not decoration.</p>}</section>}
    {step===2&&<section><p className="intro">Confirm the presentation details. Structural and cabinet items flow into the design and review BOM.</p><div className="bar-options"><label>Pendant lights<select value={draft.pendants} onChange={e=>set('pendants',Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label><label className="bar-check"><input type="checkbox" checked={draft.slatted} onChange={e=>set('slatted',e.target.checked)}/> Timber-slat public face</label></div><div className="bar-review"><span>Top<strong>{Math.round(draft.width)} × {Math.round(draft.depth+draft.overhang)} mm</strong></span><span>End treatment<strong>{treatments.find(x=>x[0]===draft.endTreatment)?.[1]}</strong></span><span>Lighting<strong>{draft.pendants} pendants</strong></span></div><p className="muted">After Create, rotate or drag the bar in Room plan. The overall dimension lines remain visible around the room.</p></section>}
    <div className="bar-wizard-actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(n=>n-1)}><ArrowLeft size={16}/>Back</button>{step<2?<button className="primary" onClick={()=>{if(checkLengthInputs(ref.current))setStep(n=>n+1)}}>Next<ArrowRight size={16}/></button>:<button className="primary" onClick={finish}><Check size={16}/>Create breakfast bar</button>}</div>
  </dialog>;
}
