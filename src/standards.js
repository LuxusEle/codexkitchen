// Shop standards: the shop owns the numbers (base height, wall height).
// Stored per device; applied to NEW projects only, so the app matches the
// workshop instead of the workshop bending to the app. Existing projects
// keep their measurements until the user resets a cabinet explicitly.
import {TYPES} from './model.js';

const KEY='codex-shop-standards';
const BASE_TYPES=['sink','cooker','drawers','spice','bottle','waste','dishwasher','base','open','corner','filler'];
const WALL_TYPES=['wall','glass','wallCorner'];

export const DEFAULT_STANDARDS={baseH:850,wallH:720};
export const STANDARD_RANGES={baseH:[600,900],wallH:[200,1200]};

function storageOrNull(storage){try{return storage||globalThis.localStorage||null;}catch{return null;}}
function clamp(n,range,fallback){const v=Number(n);return Number.isFinite(v)?Math.min(range[1],Math.max(range[0],Math.round(v))):fallback;}

export function hasShopStandards(storage){
  const s=storageOrNull(storage);if(!s)return false;
  try{return !!s.getItem(KEY);}catch{return false;}
}
export function readShopStandards(storage){
  const fallback={...DEFAULT_STANDARDS};const s=storageOrNull(storage);
  if(!s)return fallback;
  try{
    const raw=JSON.parse(s.getItem(KEY)||'null');
    if(!raw||typeof raw!=='object')return fallback;
    return {baseH:clamp(raw.baseH,STANDARD_RANGES.baseH,fallback.baseH),wallH:clamp(raw.wallH,STANDARD_RANGES.wallH,fallback.wallH)};
  }catch{return fallback;}
}
export function writeShopStandards(next,storage){
  const s=storageOrNull(storage);if(!s)throw Error('Shop standards need browser storage.');
  const clean={baseH:clamp(next&&next.baseH,STANDARD_RANGES.baseH,DEFAULT_STANDARDS.baseH),wallH:clamp(next&&next.wallH,STANDARD_RANGES.wallH,DEFAULT_STANDARDS.wallH)};
  s.setItem(KEY,JSON.stringify(clean));return clean;
}
export function applyShopStandards(p,standards){
  const defaults={...(p.unitDefaults||{})};
  for(const type of BASE_TYPES)defaults[type]={...defaults[type],h:standards.baseH};
  for(const type of WALL_TYPES)defaults[type]={...defaults[type],h:standards.wallH};
  return {...p,unitDefaults:defaults};
}
export function applyShopStandardsIfSet(p,storage){
  try{return hasShopStandards(storage)?applyShopStandards(p,readShopStandards(storage)):p;}catch{return p;}
}
export function standardHeightFor(type){
  if(!TYPES[type])return null;
  if(WALL_TYPES.includes(type))return readShopStandards().wallH;
  if(BASE_TYPES.includes(type))return readShopStandards().baseH;
  return null;
}
