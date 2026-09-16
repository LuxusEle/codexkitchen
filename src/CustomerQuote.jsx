import React,{useEffect,useMemo,useRef,useState} from 'react';
import {newCustomerQuote,quoteTotals,quoteErrors,quoteFilename,money} from './customer-quote.js';
import {watermarkRender} from './quote-images.js';
import {customerQuotePdf} from './customer-quote-pdf.js';
import {kitchenEstimate} from './costing.js';
import {quoteReviewIssues} from './quote-review.js';
import {download} from './exports.js';
import './customer-quote.css';

const fileData=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read the company logo.'));reader.readAsDataURL(blob);});
export default function CustomerQuote({project,plan,job,onSave,onClose}) {
  const estimate=useMemo(()=>kitchenEstimate(project,plan,job),[project,plan,job]);
  const [draft,setDraft]=useState(()=>({...newCustomerQuote(project,estimate),...project.customerQuote,options:Array.isArray(project.customerQuote?.options)?project.customerQuote.options.filter(o=>o&&typeof o==='object').map(o=>({...o,id:o.id||crypto.randomUUID()})):[]}));
  const [images,setImages]=useState([]),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false),[result,setResult]=useState(null),[saved,setSaved]=useState(false);
  const dialog=useRef(),resultUrl=useRef(),initialFocus=useRef(),alive=useRef(true);
  const errors=quoteErrors(draft,images),totals=quoteTotals(draft);
  const issues=quoteReviewIssues(project,plan,job,{...estimate,salesTotal:totals.total});
  useEffect(()=>{alive.current=true;const previous=document.activeElement;dialog.current.showModal();initialFocus.current?.focus();return()=>{alive.current=false;if(resultUrl.current)URL.revokeObjectURL(resultUrl.current);previous?.focus?.();};},[]);
  const invalidate=()=>{setResult(null);setConfirmed(false);setSaved(false);if(resultUrl.current){URL.revokeObjectURL(resultUrl.current);resultUrl.current=null;}};
  const edit=(key,value)=>{invalidate();setDraft(old=>({...old,[key]:value}));};
  const imageEdit=(id,patch)=>{invalidate();setImages(old=>old.map(i=>i.id===id?{...i,...patch}:i));};
  const optionEdit=(id,patch)=>edit('options',draft.options.map(o=>o.id===id?{...o,...patch}:o));
  const close=()=>{if(busy)return;if((!saved||images.length)&&!window.confirm('Close quotation builder? Save quote details first if needed. Render uploads are session-only; download your PDF before closing.'))return;onClose();};
  async function upload(files){
    if(!files?.length)return;setError('');
    if(images.length+files.length>8){setError('Use at most eight renders per pack.');return;}
    setBusy(true);invalidate();const prepared=[],failures=[];
    for(const file of files){try{prepared.push(await watermarkRender(file));}catch(e){failures.push(e.message);}}
    if(alive.current){setImages(old=>[...old,...prepared]);setError(failures.join('\n'));setBusy(false);}
  }
  async function generate(){
    if(errors.length||!confirmed||busy)return;setBusy(true);setError('');setResult(null);
    try{
      const response=await fetch('/brand/luxus-logo.jpg');if(!response.ok)throw Error('Company logo is unavailable. Try again before issuing the quote.');
      const logo=await fileData(await response.blob()),doc=customerQuotePdf(draft,images,logo),stem=quoteFilename(draft);
      const pdfBytes=new Uint8Array(doc.output('arraybuffer')),pdf=new Blob([pdfBytes],{type:'application/pdf'});
      const files=[new File([pdf],`${stem}.pdf`,{type:'application/pdf'})];
      if(resultUrl.current)URL.revokeObjectURL(resultUrl.current);resultUrl.current=URL.createObjectURL(pdf);
      onSave(draft);setSaved(true);setResult({pdf,files,url:resultUrl.current,stem});
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function share(){
    try{if(!navigator.canShare?.({files:result.files})){setError('File sharing is unavailable here. Download the PDF and attach it in your messaging app.');return;}await navigator.share({files:result.files,title:`Luxus quotation ${draft.reference}`});}
    catch(e){if(e.name!=='AbortError')setError('Sharing failed. Download the PDF instead.');}
  }
  const field=(key,label,type='text',maxLength=200)=><label className="field" key={key}><span>{label}</span><input type={type} maxLength={maxLength} value={draft[key]??''} onChange={e=>edit(key,e.target.value)} {...(type==='number'?{min:0,step:key==='advancePercent'?'0.1':'0.01',max:key==='advancePercent'?100:1e9}:{})}/></label>;
  const area=(key,label,maxLength=6000)=><label className="field"><span>{label}</span><textarea rows={key==='terms'?12:4} maxLength={maxLength} value={draft[key]??''} onChange={e=>edit(key,e.target.value)}/></label>;
  return <dialog className="customer-quote" ref={dialog} aria-labelledby="customer-quote-title" onCancel={e=>{e.preventDefault();close();}}>
    <div className="cq-heading"><div><p className="eyebrow">LUXUS / CUSTOMER PACK</p><h2 id="customer-quote-title">One quote. Ready to share.</h2></div><button className="secondary" ref={initialFocus} disabled={busy} onClick={close}>Close</button></div>
    <p>One PDF with the consolidated selling price, optional upgrades and embedded, lightly watermarked renders. Internal BOM and supplier costs stay private.</p>
    <nav className="cq-steps" aria-label="Quotation steps">{['1 · Upload renders','2 · Quote & options','3 · Review & export'].map((label,i)=><button key={label} className={step===i?'primary':'secondary'} disabled={busy||(i>0&&!images.length)} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}>{label}</button>)}</nav>
    {error&&<p role="alert" className="cq-error">{error}</p>}
    <fieldset disabled={busy} className="cq-body">
      {step===0&&<>
        <h3>Upload the rendered kitchen images</h3><p>Choose 1–8 JPG, PNG or WebP files, up to 15 MB each. Originals are untouched. Images are resized to a maximum 2400 px edge and processed only in this browser; re-upload after reopening.</p>
        <label className="cq-upload">Choose rendered images<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{upload(Array.from(e.target.files));e.target.value='';}}/></label>
        <div className="cq-images">{images.map((img,i)=><article key={img.id}><img src={img.url} alt={`Watermarked render ${i+1}`}/><label className="field">View {i+1} caption<input maxLength={300} placeholder="e.g. Main kitchen - proposed finish" value={img.caption} onChange={e=>imageEdit(img.id,{caption:e.target.value})}/></label><div className="row"><button className="secondary" disabled={!i} onClick={()=>{invalidate();setImages(old=>{const next=[...old];[next[i-1],next[i]]=[next[i],next[i-1]];return next;});}}>Move earlier</button><button className="text" onClick={()=>{invalidate();setImages(old=>old.filter(x=>x.id!==img.id));}}>Remove</button></div></article>)}</div>
      </>}
      {step===1&&<>
        <h3>Customer and quotation</h3><p>English text is supported in this PDF version. The reference is a draft ID, not a reserved company sequence; enter your issued quotation number.</p>
        <div className="cq-grid">{field('reference','Quotation reference')}{field('revision','Revision')}{field('date','Issue date','date')}{field('validUntil','Valid until','date')}{field('customer','Customer name')}{field('contact','Phone / email')}{field('subject','Project title')}</div>
        {area('address','Customer / site address',800)}
        <h3>Consolidated package price</h3><p>Starts from the current selling estimate. Check that it covers the scope and your job costs; no per-cabinet or material rates appear in the customer pack.</p>
        <div className="cq-grid">{field('baseAmount','Package price (LKR)','number')}{field('taxNote','Tax treatment — e.g. included / excluded / not applicable','text',500)}</div>
        <button className="secondary" onClick={()=>{if(window.confirm('Replace the package price with the current selling estimate? Ensure optional extras are not already included.'))edit('baseAmount',estimate.salesTotal);}}>Use current estimate: {money(estimate.salesTotal)}</button>
        {area('scope','Included scope — cabinets, finishes, worktops, installation and services actually included')}
        {area('exclusions','Excluded / customer-supplied items — write None if none',4000)}
        <h3>Optional extras</h3><p>Add only amounts not already in the package. Tick an option to include it in the total. Unticked options remain separately offered.</p>
        {draft.options.map((o,i)=><div className="cq-option" key={o.id}><label><input type="checkbox" checked={o.selected} onChange={e=>optionEdit(o.id,{selected:e.target.checked})}/> Include option {i+1}</label><label className="field">Description<input maxLength={300} value={o.title} onChange={e=>optionEdit(o.id,{title:e.target.value})}/></label><label className="field">Additional price (LKR)<input type="number" min="0" max="1000000000" step="0.01" value={o.amount} onChange={e=>optionEdit(o.id,{amount:e.target.value})}/></label><button className="text" onClick={()=>edit('options',draft.options.filter(x=>x.id!==o.id))}>Remove option</button></div>)}
        <button className="secondary" disabled={draft.options.length>=12} onClick={()=>edit('options',[...draft.options,{id:crypto.randomUUID(),title:'',amount:'',selected:false}])}>Add optional extra</button>
      </>}
      {step===2&&<>
        <h3>Conditions and payment</h3><p>The 85% advance and 30-day production wording comes from your examples. These are editable commercial drafts: the owner must approve terms, bank details and tax treatment before business use.</p>
        <div className="cq-grid">{field('advancePercent','Advance (%)','number')}{field('payee','Account holder')}{field('bank','Bank')}{field('account','Account number')}</div>
        {area('paymentNote','Payment arrangement',1500)}{area('terms','Conditions — separate paragraphs become numbered clauses',14000)}
        <div className="cq-summary"><span>Customer total<strong>{Number.isFinite(totals.total)?money(totals.total):'Check amounts'}</strong></span><span>Advance<strong>{Number.isFinite(totals.advance)?money(totals.advance):'Check amounts'}</strong></span><span>Balance<strong>{Number.isFinite(totals.balance)?money(totals.balance):'Check amounts'}</strong></span></div>
        {!!issues.length&&<details open className="cq-warning"><summary>Internal review: {issues.length} checks (not printed)</summary><ul>{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}
        {!!errors.length&&<div className="cq-warning"><strong>Complete before generating:</strong><ul>{errors.map(e=><li key={e}>{e}</li>)}</ul></div>}
        <label className="cq-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I have reviewed the customer, scope, options, selling price, tax treatment, payment details and conditions. Renders match this design; unresolved assumptions are disclosed in the scope/exclusions. This is not a fabrication release.</label>
        <button className="primary" disabled={!!errors.length||!confirmed} onClick={generate}>Generate quotation PDF with images</button>
      </>}
    </fieldset>
    <div className="cq-footer"><button className="secondary" disabled={busy} onClick={()=>{onSave(draft);setSaved(true);}}>Save quote details</button><span role="status">{busy?'Preparing your PDF…':saved?'Details added to project. Use Save project for cloud. Renders remain session-only.':''}</span>{step<2&&<button className="primary" disabled={busy||!images.length} onClick={()=>setStep(step+1)}>Continue</button>}</div>
    {result&&<section className="cq-ready" aria-label="Generated customer PDF"><h3>Ready for your final check</h3><p>All watermarked renders are embedded in this PDF. Open it before sending; no separate image files, project JSON or internal pricing are shared.</p><div className="row"><a className="secondary" href={result.url} target="_blank" rel="noopener noreferrer">Preview PDF</a><button className="primary" onClick={()=>download(result.pdf,`${result.stem}.pdf`)}>Download PDF</button><button className="secondary" onClick={share}>Share PDF</button></div></section>}
  </dialog>;
}
