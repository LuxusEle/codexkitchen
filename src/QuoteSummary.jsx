import React,{useMemo} from 'react';
import {kitchenEstimate} from './costing.js';
import {quoteReviewIssues} from './quote-review.js';
const money=value=>`LKR ${Number(value||0).toLocaleString('en-LK',{maximumFractionDigits:0})}`;
export default function QuoteSummary({project,plan,job,onOpen}){
  const estimate=useMemo(()=>kitchenEstimate(project,plan,job),[project,plan,job]);
  const issues=quoteReviewIssues(project,plan,job,estimate);
  return <section className="quote-strip" aria-label="Live provisional quote">
    <div><span>Customer estimate · provisional</span><strong>{money(estimate.salesTotal)}</strong></div>
    <div><span>Material / hardware reference</span><strong>{money(estimate.purchasingTotal)}</strong></div>
    <button className="secondary compact" onClick={onOpen}>Edit quote & BOM</button>
    {issues.length>0&&<details className="quote-review-list"><summary className="quote-alert">{issues.length} quote check(s) need review</summary><ul>{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}
    <p className="quote-caution">Difference is not profit. Confirm supplier prices, labour, installation, delivery, overhead and contingency. Cutting / assembly remain engineering previews.</p>
  </section>;
}
