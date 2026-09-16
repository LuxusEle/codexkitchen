// Visual proof uses labelled QA images, NOT a fabricated customer kitchen render.
// Pass the path of an installed @napi-rs/canvas module; no production dependency.
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {newCustomerQuote} from '../src/customer-quote.js';
import {customerQuotePdf} from '../src/customer-quote-pdf.js';
import {drawLuxusWatermark} from '../src/quote-images.js';
const require=createRequire(import.meta.url),{createCanvas}=require(process.argv[2]);
const logo=`data:image/jpeg;base64,${readFileSync('public/brand/luxus-logo.jpg').toString('base64')}`;
const images=[[1600,900],[800,1200]].map(([w,h],i)=>{
  const c=createCanvas(w,h),ctx=c.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#293b3e');gradient.addColorStop(1,'#e5ddc9');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='white';ctx.font=`${w*.035}px Arial`;ctx.fillText('PDF LAYOUT TEST - NOT A KITCHEN RENDER',w*.04,h*.12);
  ctx.font=`${w*.025}px Arial`;ctx.fillText('Uploaded customer images will appear here.',w*.04,h*.19);
  drawLuxusWatermark(ctx,w,h);
  return {url:c.toDataURL('image/jpeg',.88),width:w,height:h,caption:`Format proof ${i+1}: ${i?'portrait':'landscape'} image, aspect ratio preserved.`};
});
const q={...newCustomerQuote({name:'Kitchen proposal - FORMAT SAMPLE ONLY'},{salesTotal:975000}),reference:'QT-FORMAT-SAMPLE',customer:'Sample customer - not for issue',address:'Site address to be confirmed',contact:'Customer contact to be entered',
  scope:'Supplying and fixing aluminium kitchen cabinets in the approved layout.\nUpper fronts: gloss beige. Lower fronts: gloss grey.\nPackage includes the specified worktop, splashback and cabinet lighting. Final material samples and measured drawings require confirmation before manufacture.',
  exclusions:'Sink and plumbing accessories are customer supplied. Cooker not included. Unlisted appliances and additional accessories are excluded. This sample demonstrates layout only; amounts are not an offer.',
  taxNote:'Sample only - confirm tax treatment before issue.',options:[{title:'Additional display lighting upgrade',amount:18000,selected:true},{title:'Premium drawer hardware upgrade',amount:25000,selected:false}]};
const doc=customerQuotePdf(q,images,logo);
mkdirSync('output/pdf',{recursive:true});writeFileSync('output/pdf/luxus-quotation-format-preview.pdf',Buffer.from(doc.output('arraybuffer')));
console.log(`Quotation format proof: ${doc.getNumberOfPages()} pages, 2 embedded watermarked test images. No separate image downloads.`);
