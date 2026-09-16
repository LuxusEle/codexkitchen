import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialProject,parseProject} from '../src/model.js';
import {newCustomerQuote,quoteTotals,quoteErrors,publicQuote,quoteFilename} from '../src/customer-quote.js';
import {customerQuotePdf} from '../src/customer-quote-pdf.js';
import {checkImageFile,drawLuxusWatermark} from '../src/quote-images.js';
const logo=`data:image/jpeg;base64,${readFileSync(new URL('../public/brand/luxus-logo.jpg',import.meta.url)).toString('base64')}`;
const images=[{url:logo,width:398,height:418,caption:'Test illustration'}];
const valid=()=>({...newCustomerQuote(initialProject(),{salesTotal:975000},new Date(2026,8,16)),customer:'Sample client',scope:'Cabinets and installation.',exclusions:'Sink and plumbing supplied by customer.',taxNote:'Included in stated price.'});
test('consolidated totals include only selected extras, and use rounded cents for payment split',()=>{
  const q={...valid(),baseAmount:100.01,advancePercent:85,options:[{title:'Selected',amount:10.02,selected:true},{title:'Optional',amount:900,selected:false}]};
  assert.deepEqual(quoteTotals(q),{base:100.01,extras:10.02,total:110.03,advance:93.53,balance:16.5});
  assert.equal(quoteErrors(q,images).length,0);
});
test('reject missing scope, invalid totals, dates, unsupported text and absent images',()=>{
  assert.ok(quoteErrors({...valid(),baseAmount:-1},images).some(e=>e.includes('Package price')));
  assert.ok(quoteErrors({...valid(),baseAmount:Infinity},images).length);
  assert.ok(quoteErrors({...valid(),advancePercent:101},images).length);
  assert.ok(quoteErrors({...valid(),scope:'',validUntil:'2026-02-30'},images).length>=2);
  assert.ok(quoteErrors(valid(),[]).length);
  assert.ok(quoteErrors({...valid(),customer:'客户'},images).some(e=>e.includes('English')));
});
test('public data projection excludes cost, project, credentials and private metadata',()=>{
  const q=publicQuote({...valid(),purchasing:[{secret:'PRIVATE'}],password:'SECRET',options:[{title:'Glass',amount:1000,selected:false,supplierRate:123}]},images);
  assert.equal(q.password,undefined);assert.equal(q.purchasing,undefined);assert.equal(q.options[0].supplierRate,undefined);
  assert.ok(!JSON.stringify(q).includes('PRIVATE'));assert.match(quoteFilename({...q,reference:'../../quote'}),/^-*-*-quote/);
});
test('saved project retains quote details without changing kitchen geometry',()=>{
  const p=initialProject(),loaded=parseProject(JSON.stringify({...p,customerQuote:valid()}));
  assert.deepEqual(loaded.room,p.room);assert.deepEqual(loaded.needs,p.needs);assert.equal(loaded.customerQuote.baseAmount,975000);
});
test('PDF includes quotation, options, image pages, not private costs; long terms paginate',()=>{
  const q={...valid(),terms:'A project-specific condition. '.repeat(300),options:[{title:'Glass display upgrade',amount:5000,selected:false}],supplierRate:987654321};
  const doc=customerQuotePdf(q,images,logo),raw=doc.output();
  assert.ok(doc.getNumberOfPages()>=4);assert.ok(raw.includes('CUSTOMER QUOTATION'));assert.ok(raw.includes('OPTIONAL - NOT INCLUDED'));
  assert.ok(!raw.includes('987654321'));assert.ok(!raw.includes('purchasing BOM'));assert.ok(raw.includes('Design impression'.toUpperCase()));
});
test('uploads reject oversized/unsupported files and watermark is light and canvas-baked',()=>{
  assert.throws(()=>checkImageFile({type:'image/svg+xml',size:10}));assert.throws(()=>checkImageFile({type:'image/png',size:16*1024*1024}));
  assert.doesNotThrow(()=>checkImageFile({type:'image/jpeg',size:100}));
  const calls=[],ctx={save(){},restore(){},translate(){},rotate(){},strokeText(t){calls.push([t,this.globalAlpha]);},fillText(t){calls.push([t,this.globalAlpha]);}};
  drawLuxusWatermark(ctx,1200,800);assert.ok(calls.some(([t,alpha])=>t==='LUXUS'&&alpha===.16));
});
