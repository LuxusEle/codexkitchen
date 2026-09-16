export const MM_PER_INCH=25.4;
export const MM_PER_FOOT=304.8;
const fractionGlyphs={'½':'1/2','¼':'1/4','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};

export function parseInches(raw) {
  if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0?raw:null;
  const text=String(raw??'').trim().replace(/(?:inches|inch|in|["″])$/i,'').trim()
    .replace(/[½¼¾⅛⅜⅝⅞]/g,c=>` ${fractionGlyphs[c]}`).trim();
  if(text==='')return 0;
  if(/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return Number.isFinite(Number(text))?Number(text):null;
  const fraction=text.match(/^(?:(\d+)(?:\s+|-))?(\d+)\s*\/\s*(\d+)$/);
  if(!fraction||Number(fraction[3])===0)return null;
  const value=Number(fraction[1]||0)+Number(fraction[2])/Number(fraction[3]);
  return Number.isFinite(value)?value:null;
}
export function feetInchesToMm(feet,inches) {
  const ft=String(feet??'').trim().replace(/(?:ft|['′])$/i,'').trim(),inch=parseInches(inches);
  if((ft!==''&&!/^\d+$/.test(ft))||inch===null)return null;
  const mm=Number(ft||0)*MM_PER_FOOT+inch*MM_PER_INCH;
  return Number.isFinite(mm)?Math.round(mm*1e6)/1e6:null;
}
export function splitMillimetres(mm) {
  if(!Number.isFinite(mm)||mm<0)return {feet:'',inches:'',remainderMm:0};
  let feet=Math.floor(mm/MM_PER_FOOT+1e-10),remainderMm=Math.max(0,mm-feet*MM_PER_FOOT);
  let inches=Math.round(remainderMm/MM_PER_INCH*1000)/1000;
  if(inches>=12){feet++;inches=0;remainderMm=mm-feet*MM_PER_FOOT;}
  return {feet:String(feet),inches:String(inches),remainderMm};
}
export function imperialEditMm(entry) {
  // Editing only feet must preserve the exact metric remainder, not round
  // it through the three-decimal inch display.
  if(!entry.inchEdited){
    const whole=feetInchesToMm(entry.feet,0);
    return whole===null?null:Math.round((whole+entry.remainderMm)*1e6)/1e6;
  }
  return feetInchesToMm(entry.feet,entry.inches);
}
