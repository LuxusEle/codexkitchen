import test from 'node:test';
import assert from 'node:assert/strict';
import {PgDialect} from 'drizzle-orm/pg-core';
import {defaultBusiness,validateBusiness,businessProfile,attachBusiness,presenceLabel} from '../src/business.js';
import {businessOperation,chosenBusiness,ownProjectFilter} from '../server/business-service.js';
import {owned} from '../server/cloud.js';
import {assets} from '../server/schema.js';
import {newProject,cloudDocument} from '../src/project-workspace.js';
import {newCustomerQuote,quoteErrors} from '../src/customer-quote.js';
import {kitchenEstimate} from '../src/costing.js';
import {fabricationPlan} from '../src/fabrication.js';
const id='12345678-1234-4234-8234-123456789abc';
const staff={id:'staff-one',businessId:'devonly',admin:false};
const dialect=new PgDialect();
test('business profiles are independent; Devonly cannot inherit Luxus identity',()=>{
  const a=defaultBusiness('luxus'),b=defaultBusiness('devonly');b.salesRates.base=22222;
  assert.equal(a.salesRates.base,15500);assert.equal(b.brand.bank,'');assert.equal(b.brand.logo,'');assert.equal(b.terms,'');
  assert.doesNotThrow(()=>validateBusiness(b));b.brand.logo='/brand/luxus-logo.jpg';assert.throws(()=>validateBusiness(b));
  const hydrated=businessProfile({id:'devonly',name:'Devonly Holdings',revision:3,profile:{salesRates:{base:22222}}});
  assert.equal(hydrated.brand.name,'Devonly Holdings');assert.equal(hydrated.revision,3);assert.equal(hydrated.salesRates.upper,15500);
});
test('settings reject arbitrary formulas, remote logos and invalid prices',()=>{
  for(const change of [b=>b.formula.base='eval()',b=>b.brand.logo='https://untrusted.test/logo',b=>b.salesRates.base=-1,b=>b.salesRates.led=Infinity,b=>b.advancePercent=101]){const b=defaultBusiness();change(b);assert.throws(()=>validateBusiness(b));}
});
test('staff project and asset predicates require both owner and business, unassigned fails closed',()=>{
  const q=dialect.sqlToQuery(ownProjectFilter(staff,id));assert.match(q.sql,/owner_id/);assert.match(q.sql,/business_id/);assert.ok(q.params.includes('staff-one'));assert.ok(q.params.includes('devonly'));
  assert.ok(dialect.sqlToQuery(ownProjectFilter({id:'staff'})).params.includes('__unassigned__'));
  const asset=dialect.sqlToQuery(owned(assets,staff,id));assert.match(asset.sql,/exists/);assert.match(asset.sql,/project_id/);assert.ok(asset.params.includes('devonly'));
  assert.doesNotMatch(dialect.sqlToQuery(ownProjectFilter({admin:true},id)).sql,/owner_id|business_id/);
  assert.throws(()=>chosenBusiness(staff,'luxus'),e=>e.status===403);assert.equal(chosenBusiness(staff),'devonly');assert.equal(chosenBusiness({admin:true},'luxus'),'luxus');
});
test('staff cannot change business settings, inspect others activity or approve a design',async()=>{
  for(const [op,method] of [['businesses','PATCH'],['overview','GET'],['review','PATCH']])await assert.rejects(()=>businessOperation({db:null,user:staff,op,method}),e=>e.status===403);
});
test('presence checks requested project access before writing any heartbeat',async()=>{
  let checked=false;
  await assert.rejects(()=>businessOperation({db:null,user:staff,op:'presence',method:'POST',req:{headers:{'content-type':'application/json'},body:{projectId:id,active:true}},projectFor:async()=>{checked=true;throw Error('not allowed');}}),/not allowed/);
  assert.equal(checked,true);
});
test('review rejects a stale revision before writing',async()=>{
  await assert.rejects(()=>businessOperation({db:null,user:{admin:true},op:'review',method:'PATCH',req:{headers:{'content-type':'application/json'},body:{id,status:'approved',note:'Reviewed',revision:1}},projectFor:async()=>({id,revision:2})}),e=>e.status===409);
});
test('business reassignment for a copy clears old quotation and price overrides, not geometry',()=>{
  const original={...newProject('Customer'),customerQuote:{reference:'LUXUS'},costing:{salesRates:{base:42}}},copy=attachBusiness(original,defaultBusiness('devonly'),{fresh:true});
  assert.equal(copy.customerQuote,undefined);assert.deepEqual(copy.costing,{});assert.deepEqual(copy.room,original.room);assert.equal(original.customerQuote.reference,'LUXUS');
  const row=cloudDocument({id,ownerId:'owner',revision:1,businessId:'devonly',document:{...original,businessId:'luxus'}});assert.equal(row.businessId,'devonly');assert.equal(row.businessProfile.id,'devonly');
});
test('pricing uses business method/rates with explicit per-project overrides retained',()=>{
  const p=attachBusiness(newProject('Rates'),defaultBusiness('devonly')),plan={units:[{id:'B1',type:'base',wall:'A',x:0,z:0,w:1200,h:850,d:600},{id:'T1',type:'oven',wall:'A',x:1200,z:0,w:600,h:2100,d:600}],errors:[],unmet:[]};
  p.businessProfile.salesRates.base=20000;p.businessProfile.formula.base='front_sqft';p.businessProfile.formula.tall='width_ft';
  const job=fabricationPlan(p,plan),r=kitchenEstimate(p,plan,job),base=r.sales.find(x=>x.key==='base'),tall=r.sales.find(x=>x.key==='tall');
  assert.equal(base.quantity,10.98);assert.equal(base.rate,20000);assert.equal(tall.quantity,1.97);
  p.costing={salesRates:{base:21000}};assert.equal(kitchenEstimate(p,plan,job).sales.find(x=>x.key==='base').rate,21000);
});
test('incomplete Devonly profile cannot produce an issuable quotation',()=>{
  const q=newCustomerQuote(attachBusiness(newProject('Quote'),defaultBusiness('devonly')),{salesTotal:100});
  assert.equal(q.brand.name,'Devonly Holdings');assert.equal(q.bank,'');assert.equal(q.terms,'');assert.ok(quoteErrors(q,[]).length);
});
test('presence is explicitly approximate and expires rather than claiming continuous work',()=>{
  const now=Date.now();assert.equal(presenceLabel({lastSeen:new Date(now),lastActive:new Date(now)},now),'Active recently');assert.equal(presenceLabel({lastSeen:new Date(now)},now),'App open / idle');assert.equal(presenceLabel({lastSeen:new Date(now-120001)},now),'Offline / not recently seen');
});
