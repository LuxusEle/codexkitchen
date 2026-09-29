import {jsPDF,AcroFormTextField} from 'jspdf';
import {surfaceTakeoff} from './surface-takeoff.js';
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
export function editableBomPdf(p,plan,job,existing){
 const d=existing||new jsPDF({orientation:'landscape',unit:'mm',format:'a3'});if(existing)d.addPage('a3','landscape');
 const s=surfaceTakeoff(p,plan.units),fields={},order=[];
 const text=(t,x,y,size=10)=>{d.setFontSize(size);d.setTextColor('#173e39');d.text(String(t).replace(/[^\x20-\x7e]/g,' '),x,y);};
 const helper="function n(k){var v=Number(String(this.getField(k).value).replace(/,/g,''));return isFinite(v)?v:0;} ";
 function field(name,x,y,w,value='',calc){
  const f=new AcroFormTextField();f.fieldName=name;f.Rect=[x,y,w,7];f.value=String(value);f.fontSize=10;f.maxLength=100;d.setFillColor(calc?'#eef3ed':'#eef5fc');d.rect(x,y,w,7,'F');d.addField(f);fields[name]=f;
  if(calc){Object.defineProperty(f,'AA',{value:`<< /C << /S /JavaScript /JS (${esc(helper+calc)}) >> >>`});order.push(f);}return f;
 }
 d.setFillColor('#173e39');d.rect(0,0,420,4,'F');text('EDITABLE BOM / COST & PROFIT ESTIMATE',15,20,21);
 text('Enter costs in the blue fields. Automatic totals require Adobe Acrobat Reader. Blank rates are unpriced.',15,30,10);
 text('Client / project',15,43);field('client',45,37,150,p.name);text('Currency',225,43);field('currency',249,37,50);text('Reference',318,43);field('reference',344,37,61);
 const rows=[...job.bom.map(b=>[b.item,b.quantity,b.unit]),['Granite / gross before sink / no waste',Number(s.graniteGrossSqft.toFixed(2)),'sq ft'],['Tiled backsplash / no waste',s.configured?Number(s.backsplashSqft.toFixed(2)):0,'sq ft'],['Fixings and sealants',1,'lot'],['Fabrication labour',1,'lot'],['Installation labour',1,'lot'],['Transport / delivery',1,'lot'],['Sink, tap, appliances (optional)',1,'lot'],['Other / services / site work',1,'lot']];
 text('ITEM / STOCK SPECIFICATION',15,56,9);text('QTY',240,56,9);text('UNIT',270,56,9);text('COST RATE',303,56,9);text('AMOUNT',354,56,9);
 // Purchasing lists larger than this site are paginated, preserving all rows.
 let y=60;
 rows.forEach(([label,qty,unit],i)=>{if(y>215){d.addPage('a3','landscape');text('EDITABLE BOM / CONTINUED',15,22,20);y=34;}
  const size=Math.min(10,215/Math.max(d.getStringUnitWidth(label),1)*2.83);text(label,15,y+5,size);field('q'+i,238,y,27,qty);text(unit,272,y+5,9);field('r'+i,300,y,48);field('a'+i,353,y,52,'0.00',`event.value=(n.call(this,'q${i}')*n.call(this,'r${i}')).toFixed(2);`);y+=9;
 });
 const footerY=Math.max(225,y+10);
 text('Gross profit margin %',15,footerY);field('margin',73,footerY-5,26,20);
 text('Tax %',120,footerY);field('tax_pct',141,footerY-5,26,0);
 text('Total cost',201,footerY);field('cost',237,footerY-5,59,'0.00',`var s=0;for(var i=0;i<${rows.length};i++)s+=n.call(this,'a'+i);event.value=s.toFixed(2);`);
 text('Selling price',309,footerY);field('price',353,footerY-5,52,'0.00',"var m=n.call(this,'margin');event.value=(m>=0&&m<100)?(n.call(this,'cost')/(1-m/100)).toFixed(2):'CHECK MARGIN';");
 text('Profit',201,footerY+12);field('profit',237,footerY+7,59,'0.00',"event.value=(n.call(this,'price')-n.call(this,'cost')).toFixed(2);");
 text('TOTAL WITH TAX',309,footerY+12,9);field('total',353,footerY+7,52,'0.00',"event.value=(n.call(this,'price')*(1+n.call(this,'tax_pct')/100)).toFixed(2);");
 text('Selling price = cost / (1 - margin / 100).',15,footerY+12,9);
 const note=d.splitTextToSize(s.note.replace(/[^\x20-\x7e]/g,' '),390);d.setFontSize(9);d.text(note,15,footerY+28);
 text('Add wastage to quantities as needed. Verify site dimensions, supplier rates and scope before issuing an estimate.',15,279,9);
 const root=d.internal.acroformPlugin.acroFormDictionaryRoot;
 Object.defineProperty(root,'CO',{get(){return '[ '+order.map(f=>`${f.objId} 0 R`).join(' ')+' ]';}});
 d.addJS('this.calculate=true;this.calculateNow();');return d;
}
