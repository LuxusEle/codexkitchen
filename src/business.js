import {BRAND,DEFAULT_TERMS} from './customer-quote.js';
export const BUSINESS_IDS=['luxus','devonly'];
export const RATE_DEFAULTS={base:15500,upper:15500,tall:15000,granite:3000,splash:1250,led:1260,services:35000};
export function defaultBusiness(id='luxus') {
  if(!BUSINESS_IDS.includes(id))throw Error('Unknown business.');
  const luxus=id==='luxus';
  return {id,name:luxus?'Luxus Elemente':'Devonly Holdings',revision:1,
    brand:luxus?{...BRAND,logo:'/brand/luxus-logo.jpg',watermark:'LUXUS'}:{name:'Devonly Holdings',address:'',phone:'',email:'',payee:'',bank:'',account:'',logo:'',watermark:'DEVONLY'},
    salesRates:{...RATE_DEFAULTS},formula:{base:'linear_ft',upper:'linear_ft',tall:'height_ft'},terms:luxus?DEFAULT_TERMS:'',advancePercent:85};
}
export function businessProfile(row) {
  const base=defaultBusiness(row.id),p=row.profile||{};
  return {...base,...p,id:row.id,name:row.name,revision:row.revision,brand:{...base.brand,...p.brand,name:row.name},salesRates:{...base.salesRates,...p.salesRates},formula:{...base.formula,...p.formula}};
}
export function validateBusiness(profile) {
  if(!profile||!BUSINESS_IDS.includes(profile.id))throw Error('Choose a valid business.');
  const text=(v,n=200)=>typeof v==='string'&&v.length<=n&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
  if(!text(profile.name,70)||!profile.name.trim())throw Error('Business name is required (70 characters maximum).');
  for(const k of ['address','phone','email','payee','bank','account','watermark'])if(!text(profile.brand?.[k],k==='address'?300:100))throw Error(`Invalid business ${k}.`);
  if(!profile.brand.watermark.trim())throw Error('Watermark text is required.');
  const logo=profile.brand.logo;
  if(typeof logo!=='string'||logo.length>400000||(logo!==''&&logo!=='/brand/luxus-logo.jpg'&&!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(logo)))throw Error('Use a small JPG/PNG logo (not a remote URL).');
  if(profile.id==='devonly'&&logo==='/brand/luxus-logo.jpg')throw Error('Upload Devonly branding; do not reuse the Luxus logo.');
  for(const k of Object.keys(RATE_DEFAULTS))if(typeof profile.salesRates?.[k]!=='number'||!Number.isFinite(profile.salesRates[k])||profile.salesRates[k]<0||profile.salesRates[k]>1e9)throw Error(`Invalid ${k} rate.`);
  if(!['linear_ft','front_sqft'].includes(profile.formula?.base)||!['linear_ft','front_sqft'].includes(profile.formula?.upper)||!['height_ft','width_ft'].includes(profile.formula?.tall))throw Error('Choose one of the supported calculation methods.');
  if(!text(profile.terms,14000)||!Number.isFinite(profile.advancePercent)||profile.advancePercent<0||profile.advancePercent>100)throw Error('Invalid conditions or advance percentage.');
  return {brand:{...Object.fromEntries(['address','phone','email','payee','bank','account','watermark','logo'].map(k=>[k,profile.brand[k]])),name:profile.name.trim()},salesRates:{...profile.salesRates},formula:{...profile.formula},terms:profile.terms,advancePercent:profile.advancePercent};
}
export const projectBusiness=p=>p.businessId||'luxus';
export function attachBusiness(document,profile,{fresh=false}={}) {
  const same=projectBusiness(document)===profile.id;
  return {...document,businessId:profile.id,businessProfile:profile,
    ...(fresh&&!same?{customerQuote:undefined,costing:{}}:{})};
}
export function presenceLabel(row,now=Date.now()) {
  if(!row?.lastSeen||now-new Date(row.lastSeen).getTime()>120000)return 'Offline / not recently seen';
  return row.lastActive&&now-new Date(row.lastActive).getTime()<120000?'Active recently':'App open / idle';
}
