import test from 'node:test';
import assert from 'node:assert/strict';
import {hoodType,hoodParts} from '../src/hood.js';
import {initialProject,solve,parseProject,renderingPrompt} from '../src/model.js';
test('Cassette is the default; column alone has an exposed tall chimney',()=>{
 const cooker={type:'cooker',w:600};assert.equal(hoodType(cooker),'cassette');
 assert.ok(hoodParts(cooker).every(p=>p.h<=65));
 const parts=hoodParts({...cooker,hoodType:'column'});assert.ok(parts.some(p=>p.name==='Hood chimney'&&p.h===450));assert.equal(parts[0].w,600);
});
test('Hood style round trips without changing placement and appears in AI prompt',()=>{
 const p=initialProject();p.openings=[];p.units=solve(p).units;const c=p.units.find(u=>u.type==='cooker');assert.ok(c);
 const before=p.units.map(u=>[u.id,u.x,u.w,u.h,u.wall]);c.hoodType='column';
 const loaded=parseProject(JSON.stringify(p));assert.equal(loaded.units.find(u=>u.id===c.id).hoodType,'column');assert.deepEqual(loaded.units.map(u=>[u.id,u.x,u.w,u.h,u.wall]),before);
 assert.match(renderingPrompt(loaded,solve(loaded)),/column\/chimney cooker hood/);
 delete c.hoodType;assert.match(renderingPrompt(p,solve(p)),/slim cassette cooker hood; no exposed vertical chimney/);
 c.hoodType='invalid';assert.throws(()=>parseProject(JSON.stringify(p)),/hood style/);
});
