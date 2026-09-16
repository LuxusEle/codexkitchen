// Public quotation data is deliberately allowlisted. Never pass project/BOM to PDF.
export const BRAND = Object.freeze({
  name: 'Luxus Elemente', address: 'Katuwawala Road, Borelesgamuwa, Western Province, Sri Lanka',
  phone: '0777163564', email: 'luxuselemente@gmail.com',
  payee: 'INFINITY KITCHEN DESIGNERS (PVT) LTD', bank: 'SEYLAN BANK', account: '021 013 279 542 001',
});
export const DEFAULT_TERMS = [
  'The advance shown in the payment summary is required to commence the project. The advance is non-refundable after the project starts, as stated in our standard commercial terms.',
  'Production starts after receipt of the signed design and quotation, the required payment and final clarification of special requests. Allow 30 days for production from that confirmation; installation dates are agreed separately.',
  'The customer must provide uninterrupted site access and complete necessary site preparation. Access or readiness delays may change the agreed schedule.',
  'Materials, finishes and design are confirmed before production. Later changes require a written variation and agreed additional price and timing before work proceeds.',
  'Quoted accessories require full payment before their production or procurement. Customer-supplied appliances and accessories must be available for measurement and coordination before production.',
  'The balance is payable before production completion, in accordance with the accepted payment arrangement. Any alternative milestones must be stated in the agreed quotation.',
  'Only the work listed under Included scope and Selected extras is included. Installation, worktops, fittings, wiring, plumbing, transport and handling are included only when expressly listed. Project-specific scope takes precedence over general terms.',
  'The customer arranges electrical, gas, water, waste and hood-ventilation work unless expressly included in the agreed scope. Appliance specifications and site dimensions must be confirmed before manufacture.',
  'Prices are valid until the stated date. After expiry, material or currency changes may require a revised quotation for customer acceptance before proceeding.',
  'Rendered images illustrate the design intent. Colours, reflections and AI-generated details can differ from actual materials. Confirm physical samples and the agreed drawing revision before manufacture; images are not cutting instructions.',
].join('\n\n');
const dateOnly = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function newCustomerQuote(project, estimate, now = new Date()) {
  const expiry = new Date(now); expiry.setDate(expiry.getDate()+14);
  const profile=project.businessProfile,brand=profile?.brand||BRAND;
  return {reference:`QT-DRAFT-${now.getTime().toString(36).toUpperCase()}`, revision:'01',
    date:dateOnly(now), validUntil:dateOnly(expiry), customer:'', address:'', contact:'',
    subject:project.name || 'Kitchen design proposal', scope:'', exclusions:'',
    baseAmount:estimate.salesTotal, taxNote:'', options:[], terms:profile?profile.terms:DEFAULT_TERMS,
    brand:{...brand},businessId:project.businessId||'luxus',businessRevision:profile?.revision||1,
    advancePercent:profile?.advancePercent??85, paymentNote:'Balance payable before production completion.',
    payee:brand.payee, bank:brand.bank, account:brand.account,
  };
}
export const money = value => `LKR ${Number(value).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const cents = value => Math.round(Number(value)*100);
const amountOK = value => value !== '' && value !== null && Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<=1e9;
export function quoteTotals(draft) {
  const base=cents(draft.baseAmount), extras=(Array.isArray(draft.options)?draft.options:[]).filter(o=>o?.selected).reduce((sum,o)=>sum+cents(o.amount),0);
  const total=base+extras, advance=Math.round(total*Number(draft.advancePercent)/100);
  return {base:base/100,extras:extras/100,total:total/100,advance:advance/100,balance:(total-advance)/100};
}
export function quoteErrors(draft, images=[]) {
  const errors=[];
  if(draft.brand)for(const k of ['name','address','phone','email'])if(typeof draft.brand[k]!=='string'||!draft.brand[k].trim()||draft.brand[k].length>300)errors.push(`Complete the business ${k} in owner settings.`);
  for(const [key,label,max] of [['reference','Quote reference',70],['revision','Revision',20],['customer','Customer name',150],['subject','Project title',200],['scope','Included scope',6000],['exclusions','Exclusions / customer supply (write None if none)',4000],['taxNote','Tax treatment',500],['terms','Conditions',14000],['paymentNote','Payment arrangement',1500],['payee','Account holder',200],['bank','Bank name',100],['account','Bank account',100]]) {
    if(typeof draft[key]!=='string'||!draft[key].trim()||draft[key].length>max)errors.push(`${label} is required (maximum ${max} characters).`);
  }
  for(const key of ['address','contact'])if(typeof draft[key]!=='string'||draft[key].length>800)errors.push(`Invalid ${key}.`);
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if(!validDate(draft.date)||!validDate(draft.validUntil)||draft.validUntil<draft.date)errors.push('Enter valid issue and expiry dates; expiry cannot precede issue.');
  if(!amountOK(draft.baseAmount)||Number(draft.baseAmount)<=0)errors.push('Package price must be positive and no more than LKR 1 billion.');
  if(!amountOK(draft.advancePercent)||Number(draft.advancePercent)>100)errors.push('Advance percentage must be from 0 to 100.');
  if(!Array.isArray(draft.options)||draft.options.length>12)errors.push('Use at most 12 optional extras.');
  else for(const option of draft.options)if(!option||typeof option.title!=='string'||!option.title.trim()||option.title.length>300||!amountOK(option.amount)||typeof option.selected!=='boolean')errors.push('Each option needs a description and a non-negative price.');
  if(!images.length||images.length>8)errors.push('Add 1 to 8 rendered images.');
  if(images.some(i=>typeof i.url!=='string'||!i.url.startsWith('data:image/jpeg;base64,')||!Number.isFinite(i.width)||!Number.isFinite(i.height)||i.width<=0||i.height<=0))errors.push('An image could not be prepared. Remove it and upload again.');
  const textValues=[...Object.values(draft).filter(v=>typeof v==='string'),...Object.values(draft.brand||{}).filter(v=>typeof v==='string'&&!v.startsWith('data:image/')),...(Array.isArray(draft.options)?draft.options:[]).map(o=>o?.title||''),...images.map(i=>i.caption||'')];
  if(textValues.some(s=>/[^\x09\x0a\x0d\x20-\x7e\u2013\u2014\u2018\u2019\u201c\u201d\u2022]/.test(s)))errors.push('This PDF version supports English text. Replace unsupported characters before exporting.');
  if(images.some(i=>(i.caption||'').length>300))errors.push('Image captions must be 300 characters or fewer.');
  return [...new Set(errors)];
}
export function publicQuote(draft, images) {
  const errors=quoteErrors(draft,images); if(errors.length)throw Error(errors.join('\n'));
  const allowed=['reference','revision','date','validUntil','customer','address','contact','subject','scope','exclusions','taxNote','terms','paymentNote','payee','bank','account'];
  const brand=draft.brand||BRAND;
  return {...Object.fromEntries(allowed.map(k=>[k,draft[k].trim()])),brand:Object.fromEntries(['name','address','phone','email'].map(k=>[k,brand[k]])),baseAmount:Number(draft.baseAmount),advancePercent:Number(draft.advancePercent),
    options:draft.options.map(o=>({title:o.title.trim(),amount:Number(o.amount),selected:o.selected})),totals:quoteTotals(draft)};
}
export const quoteFilename = quote => `${String(quote.reference).replace(/[^a-z0-9_-]/gi,'-').slice(0,70)}-R${String(quote.revision).replace(/[^a-z0-9_-]/gi,'-').slice(0,20)}`;
