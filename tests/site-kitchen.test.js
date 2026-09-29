import test from 'node:test';
import assert from 'node:assert/strict';
import {siteKitchen} from '../src/site-kitchen.js';
import {solve,parseProject,validateUnits,closeRunGaps,initialProject} from '../src/model.js';
import {fabricationPlan} from '../src/fabrication.js';
import {updateRoomValue,cloudDocument,detachedProject} from '../src/project-workspace.js';
import {attachBusiness,defaultBusiness} from '../src/business.js';
test('measured site U kitchen has complete geometry, requirements and nested BOM',()=>{const p=siteKitchen(),r=solve(p),job=fabricationPlan(p,r);assert.deepEqual(r.errors,[]);assert.deepEqual(r.unmet,[]);assert.deepEqual(job.errors,[]);assert.deepEqual(job.rejected,[]);assert.ok(job.bom.length>5);assert.deepEqual(parseProject(JSON.stringify(p)).cabinetRuns,p.cabinetRuns);});
test('run repair respects the doorway-clear run end',()=>{const p=siteKitchen();const units=closeRunGaps(p,p.units.filter(u=>u.id!=='S06'));assert.ok(units.filter(u=>u.wall==='D'&&u.z<900).every(u=>u.x>=1325));assert.deepEqual(validateUnits(p,units),[]);});
test('invalid run lengths and cabinets beyond run limits cannot be imported',()=>{let p=siteKitchen();p.cabinetRuns.base.D=[0,9000];assert.throws(()=>parseProject(JSON.stringify(p)));p=siteKitchen();p.units.find(u=>u.id==='S06').x=1310;assert.throws(()=>parseProject(JSON.stringify(p)),/run limit/);});

test('user wall labels put fridge opposite sink and include above-hood cabinet',()=>{const p=siteKitchen(),fridge=p.units.find(u=>u.type==='fridge'),sink=p.units.find(u=>u.type==='sink'),hoodBox=p.units.find(u=>u.id==='S13');assert.equal(p.siteWallLabels[fridge.wall],'C');assert.equal(p.siteWallLabels[sink.wall],'A');assert.equal(fridge.w,762);assert.equal(fridge.x+fridge.w,2180);assert.equal(hoodBox.z,1640);assert.equal(hoodBox.h,530);assert.ok(!p.openings.some(o=>p.siteWallLabels[o.wall]==='D'));});

test('upper hood wall is one continuous stepped frame with full-length top rails',()=>{const p=siteKitchen(),job=fabricationPlan(p,solve(p)),upper=job.bars.filter(b=>b.wall==='A'&&b.y>=1450&&b.runId);assert.equal(new Set(upper.map(b=>b.runId)).size,1);const tops=upper.filter(b=>b.name==='Run rail'&&b.axis==='x'&&Math.abs(b.y-2131.9)<.1);assert.equal(tops.length,2);assert.ok(tops.every(b=>Math.abs(b.length-2857.6)<.1));assert.equal(upper.filter(b=>b.name==='End sash TOP').length,2);assert.equal(upper.filter(b=>b.name==='Hood raised sill rail').length,2);assert.ok(!upper.some(b=>b.x>1150&&b.x+b.w<1750&&b.y<1640));});

test('2900 mm automatic U can place the requested hob and sink without a blanket 3000 mm rejection',()=>{
 const p=initialProject();p.room={width:2900,depth:3190,height:2700,layout:'U'};p.openings=[];p.needs={sink:1,cooker:1,wall:3};p.preferences={cooker:'A',sink:'D'};
 const r=solve(p);assert.deepEqual(r.errors,[]);assert.deepEqual(r.unmet,[]);assert.equal(r.units.find(u=>u.type==='cooker').w,600);assert.equal(r.units.filter(u=>u.type==='corner').length,2);assert.deepEqual(fabricationPlan(p,r).rejected,[]);
});
test('placed design survives business attachment cloud loading and unchanged room controls',()=>{
 const draft=attachBusiness(detachedProject(siteKitchen()),defaultBusiness('luxus'),{fresh:true}),second=detachedProject(siteKitchen());assert.notEqual(draft.projectId,second.projectId);
 const p=cloudDocument({id:'saved-measured',ownerId:'test-owner',revision:1,document:draft});
 for(const [key,value] of Object.entries(p.room))assert.equal(updateRoomValue(p,key,value),p);
 const taller=updateRoomValue(p,'height',2800);assert.equal(taller.units,p.units);assert.deepEqual(solve(taller).errors,[]);
 assert.ok(solve(updateRoomValue(p,'width',2700)).errors.length);assert.equal(p.room.width,2900);
 const copy=detachedProject(p);assert.equal(copy.cloud,undefined);const r=solve(copy),job=fabricationPlan(copy,r);assert.deepEqual(r.errors,[]);assert.deepEqual(r.unmet,[]);assert.deepEqual(job.errors,[]);assert.deepEqual(job.rejected,[]);assert.equal(job.bars.length,186);assert.equal(job.panels.length,47);assert.equal(copy.units.find(u=>u.type==='fridge').w,762);
});
