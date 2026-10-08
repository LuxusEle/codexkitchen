import React,{useMemo,useState} from 'react';
import {kitchenEstimate} from './costing.js';
import {quoteReviewIssues} from './quote-review.js';
const money=value=>`LKR ${Number(value||0).toLocaleString('en-LK',{maximumFractionDigits:0})}`;
export default function QuoteSummary({project,plan,job,onOpen}){
  const estimate=useMemo(()=>kitchenEstimate(project,plan,job),[project,plan,job]);
  const issues=quoteReviewIssues(project,plan,job,estimate);
  const [view,setView]=useState('sales');
  const sales=view==='sales';
  return <section className="quote-strip" aria-label="Live provisional quote">
    <div className="segmented quote-toggle" role="tablist" aria-label="Which total to show">
      <button type="button" role="tab" aria-selected={sales} className={sales?'active':''} onClick={()=>setView('sales')}>Customer price</button>
      <button type="button" role="tab" aria-selected={!sales} className={!sales?'active':''} onClick={()=>setView('bom')}>Shop cost</button>
    </div>
    {sales
      ?<div><span>Customer estimate · provisional</span><strong>{money(estimate.salesTotal)}</strong></div>
      :<div><span>Material / hardware reference · internal only</span><strong>{money(estimate.purchasingTotal)}</strong></div>}
    <button className="secondary compact" onClick={onOpen}>Edit price sheet</button>
    {issues.length>0&&<details className="quote-review-list"><summary className="quote-alert">{issues.length} quote check(s) need review</summary><ul>{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}
    <p className="quote-caution">{sales
      ?'One number at a time: this is what the customer pays. Shop cost stays in its own tab — never add the two together.'
      :'Shop cost is the internal purchasing reference — never show it on a customer quote. One number at a time.'} Confirm supplier prices, labour, installation, delivery, overhead and contingency. Cutting / assembly remain engineering previews.</p>
  </section>;
}
