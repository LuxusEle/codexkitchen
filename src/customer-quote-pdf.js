import { jsPDF } from 'jspdf';
import { BRAND, publicQuote, money } from './customer-quote.js';

const clean=text=>String(text??'').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2022/g,'-');
// This accepts only a quotation draft and processed images, never the project or BOM.
export function customerQuotePdf(draft,images,logo) {
  const q=publicQuote(draft,images),doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setProperties({title:`${q.reference} R${q.revision} - ${q.subject}`,author:BRAND.name,subject:'Customer quotation and design impressions'});
  let y=0;
  const text=(value,x,yy,size=10,bold=false,options={})=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.text(clean(value),x,yy,options);};
  function header(first=false) {
    doc.setFillColor('#303330');doc.rect(0,0,210,first?46:27,'F');doc.setTextColor('#ffffff');
    if(first){
      if(logo)doc.addImage(logo,'JPEG',14,5,32,33.6);
      text('LUXUS ELEMENTE',56,13,16,true);text('CUSTOMER QUOTATION',56,22,10);
      text(BRAND.address,56,29,8,false,{maxWidth:140});text(`${BRAND.phone}  |  ${BRAND.email}`,56,40,8);
    }else{
      if(logo)doc.addImage(logo,'JPEG',14,4,18,18.9);
      text('LUXUS ELEMENTE',38,12,12,true);text(`${BRAND.phone}  |  ${BRAND.email}`,38,20,8);
      text('QUOTATION',196,12,9,false,{align:'right'});
    }
    doc.setTextColor('#303330');y=first?56:37;
    if(!first){doc.setFontSize(9);const lines=doc.splitTextToSize(clean(`${q.reference}  /  Revision ${q.revision}`),182);text(lines.join('\n'),14,y,9,true);y+=lines.length*4.2+6;}
  }
  function next(){doc.addPage();header();}
  function keep(h){if(y+h>272)next();}
  function paragraph(value,size=10,bold=false) {
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
    // Split paragraphs AND unbroken tokens so long imported text cannot escape margins.
    const lines=doc.splitTextToSize(clean(value),182),lineHeight=size*.46;
    for(const line of lines){keep(lineHeight);text(line,14,y,size,bold);y+=lineHeight;}
    y+=3;
  }
  function heading(label){keep(17);y+=2;doc.setTextColor('#866331');paragraph(label.toUpperCase(),11,true);doc.setTextColor('#303330');}
  function amountRow(label,value,bold=false){keep(10);text(label,14,y,10,bold);text(money(value),196,y,11,bold,{align:'right'});y+=9;}
  header(true);
  paragraph(q.subject,17,true);
  paragraph(`${q.reference}  |  Revision ${q.revision}  |  Issued ${q.date}  |  Valid until ${q.validUntil}`,9);
  heading('Prepared for');paragraph(q.customer,12,true);
  if(q.address)paragraph(q.address);if(q.contact)paragraph(q.contact);
  heading('Your investment');amountRow('Consolidated package',q.totals.base);
  if(q.options.some(o=>o.selected))amountRow('Selected extras',q.totals.extras);
  keep(22);doc.setFillColor('#f0ece4');doc.rect(14,y-5,182,17,'F');text('QUOTATION TOTAL',18,y+5,11,true);text(money(q.totals.total),192,y+5,16,true,{align:'right'});y+=20;
  paragraph(`Tax treatment: ${q.taxNote}`,9);
  heading('Included scope');paragraph(q.scope);
  heading('Exclusions / customer supply');paragraph(q.exclusions);
  if(q.options.length){
    heading('Options & upgrades');
    paragraph('Selected extras are included in the quotation total. Unselected options below are not included. Options are additional to the package and must not duplicate an included item.',9);
    for(const [i,o] of q.options.entries()){
      keep(22);paragraph(`${i+1}. ${o.selected?'SELECTED':'OPTIONAL - NOT INCLUDED'} | ${money(o.amount)}`,10,true);paragraph(o.title);
    }
  }
  heading('Payment summary');amountRow(`Advance (${q.advancePercent}%)`,q.totals.advance);amountRow('Remaining balance',q.totals.balance);paragraph(q.paymentNote);
  paragraph(`Account holder: ${q.payee}\nBank: ${q.bank}\nAccount: ${q.account}`,9);
  heading('Conditions of quotation');
  const clauses=q.terms.split(/\n\s*\n/).filter(Boolean);
  clauses.forEach((clause,i)=>paragraph(`${i+1}. ${clause}`,9.5));
  const beforeAcceptance=doc.getNumberOfPages();
  keep(29);heading('Customer acceptance');paragraph(`Accepted quotation: ${q.reference} / Revision ${q.revision}`,9);
  paragraph('Name / signature: _________________________    Date: ______________',9);
  const acceptanceOnFreshPage=doc.getNumberOfPages()>beforeAcceptance;
  for(const [i,img] of images.entries()){
    // Avoid an almost-empty signature page: use its remaining space for first render.
    if(i!==0||!acceptanceOnFreshPage)next();
    heading(`Design impression ${i+1} of ${images.length}`);
    paragraph(img.caption||`Rendered view ${i+1}`,11,true);
    const maxH=244-y,scale=Math.min(182/img.width,maxH/img.height),w=img.width*scale,h=img.height*scale;
    doc.addImage(img.url,'JPEG',14+(182-w)/2,y+(maxH-h)/2,w,h,undefined,'FAST');y=254;
    paragraph('Illustrative render - not a manufacturing drawing. Confirm finishes, dimensions and appliances against the approved design. LUXUS watermark applied to the supplied image.',9);
  }
  const count=doc.getNumberOfPages();
  for(let page=1;page<=count;page++){
    doc.setPage(page);doc.setDrawColor('#cfc6b8');doc.line(14,281,196,281);doc.setTextColor('#6f706c');
    doc.setFontSize(8);const shortRef=doc.splitTextToSize(clean(`${q.reference} / R${q.revision}`),105)[0];
    text(shortRef,14,287,8);text(`Luxus Elemente  |  ${page} / ${count}`,196,287,8,false,{align:'right'});
  }
  return doc;
}
