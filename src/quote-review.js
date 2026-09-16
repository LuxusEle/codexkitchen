export function quoteReviewIssues(project,plan,job,estimate){
  const issues=[...plan.errors,...plan.unmet.map(name=>`Unplaced: ${name}`)];
  if(!project.checks?.includes('Confirm all wall measurements'))issues.push('Confirm the site measurements before committing the quote.');
  const unpriced=estimate.purchasing.filter(line=>line.quantity>0&&line.rate<=0);
  if(unpriced.length)issues.push(`${unpriced.length} purchasing item(s) have no positive price.`);
  if([...estimate.sales,...estimate.purchasing].some(line=>!Number.isFinite(line.quantity)||!Number.isFinite(line.rate)||line.quantity<0||line.rate<0))issues.push('Correct invalid or negative quantities / rates.');
  if(Object.keys(project.costing?.salesQuantities||{}).length||Object.keys(project.costing?.bomQuantities||{}).length)issues.push('Manual quantity overrides are active. Recheck them after design changes.');
  if(job.rejected.length||job.errors.length)issues.push('Manufacturing / stock preview is incomplete; the purchasing BOM may be partial.');
  if(estimate.salesTotal<estimate.purchasingTotal)issues.push('The selling estimate is below the material / hardware reference cost, before other business costs.');
  return [...new Set(issues)];
}
