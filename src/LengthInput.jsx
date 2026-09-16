import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {imperialEditMm,splitMillimetres} from './length-units.js';
import './length-input.css';

const MeasurementContext=createContext({unit:'mm',setUnit:()=>{}});
export function MeasurementProvider({children}) {
  const [unit,setUnit]=useState(()=>{try{return localStorage.getItem('codex-kitchen-input-unit')==='imperial'?'imperial':'mm';}catch{return 'mm';}});
  const change=next=>{setUnit(next);try{localStorage.setItem('codex-kitchen-input-unit',next);}catch{/* Preference is optional. */}};
  return <MeasurementContext.Provider value={{unit,setUnit:change}}>{children}</MeasurementContext.Provider>;
}
export function MeasurementSwitch(){
  const {unit,setUnit}=useContext(MeasurementContext);
  return <label className="measurement-switch">Input units<select aria-label="Measurement input units" value={unit} onChange={e=>setUnit(e.target.value)}><option value="mm">Millimetres (mm)</option><option value="imperial">Feet + inches (ft / in)</option></select></label>;
}
export function checkLengthInputs(container=document){
  const invalid=[...container.querySelectorAll('[data-length-input]')].find(input=>!input.disabled&&input.validity.customError);
  if(invalid){invalid.focus();invalid.reportValidity();return false;}
  return true;
}
export default function LengthInput({label,value,onChange,min=0,max=12000,step=50,disabled=false}) {
  const {unit}=useContext(MeasurementContext),[entry,setEntry]=useState(null),inchesRef=useRef();
  const draft=entry||{...splitMillimetres(value),inchEdited:false};
  const parsed=entry?imperialEditMm(entry):value;
  const error=entry&&parsed===null?'Not applied: use whole feet and inches such as 3.5 or 3 1/2.':'';
  useEffect(()=>setEntry(null),[unit,disabled]);
  useEffect(()=>{inchesRef.current?.setCustomValidity(error);},[error,unit]);
  const change=(key,text)=>{
    const next={...draft,[key]:text,inchEdited:draft.inchEdited||key==='inches'};
    setEntry(next);
    const mm=imperialEditMm(next);
    if(mm!==null&&(!Number.isFinite(value)||Math.abs(mm-value)>1e-7))onChange(mm);
  };
  if(unit==='mm')return <div className="number-wrap length-metric"><input aria-label={label} data-length-input type="number" value={Number.isFinite(value)?Math.round(value*1000)/1000:''} min={min} max={max} step={step} disabled={disabled} onChange={e=>onChange(e.target.value===''?0:Number(e.target.value))}/><span>mm</span></div>;
  return <div className="length-imperial" role="group" aria-label={label} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)&&!error)setEntry(null);}}>
    <div className="feet-inch-pair">
      <div><input aria-label={`${label} feet`} type="number" min="0" step="1" disabled={disabled} value={draft.feet} onChange={e=>change('feet',e.target.value)}/><span>ft</span></div>
      <div><input ref={inchesRef} aria-label={`${label} inches`} data-length-input type="text" disabled={disabled} value={draft.inches} aria-invalid={!!error} title="Inches: decimal or fraction, e.g. 3.5 or 3 1/2" onChange={e=>change('inches',e.target.value)}/><span>in</span></div>
    </div>
    <small className="length-equivalent">{Number.isFinite(value)?`${Math.round(value*1000)/1000} mm`:''}</small>
    {error&&<small className="length-error" role="alert">{error}</small>}
  </div>;
}
