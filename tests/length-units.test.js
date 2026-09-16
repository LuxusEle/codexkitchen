import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInches,feetInchesToMm,splitMillimetres,imperialEditMm} from '../src/length-units.js';
import {initialProject,parseProject} from '../src/model.js';

test('Feet/inches convert to canonical mm, with fractional inches and familiar symbols',()=>{
  assert.equal(feetInchesToMm('7','3'),2209.8);
  for(const value of ['3.5','3 1/2','3-1/2','3½','3 ½','3.5"','3 1/2 in'])assert.equal(feetInchesToMm('7',value),2222.5,value);
  assert.equal(feetInchesToMm("8'",'0'),2438.4);
  assert.equal(feetInchesToMm('','1/8'),3.175);
  assert.equal(feetInchesToMm('0','½'),12.7);
});
test('Invalid fractions and non-integer feet are rejected, never evaluated as expressions',()=>{
  for(const value of ['-1','2/0','3 1/','1+2','alert(1)','1e3','hello'])assert.equal(parseInches(value),null,value);
  for(const feet of ['-1','1.5','NaN','Infinity'])assert.equal(feetInchesToMm(feet,'3'),null);
  assert.equal(parseInches(Infinity),null);
});
test('Excess inches normalize on display and switching display does not change the mm data',()=>{
  assert.equal(feetInchesToMm('7','15'),2514.6);
  assert.deepEqual({...splitMillimetres(2514.6),remainderMm:0},{feet:'8',inches:'3',remainderMm:0});
  const project=initialProject();project.openings=[];project.room.width=2210;
  const snapshot=JSON.stringify(project);
  for(let i=0;i<100;i++)assert.equal(splitMillimetres(project.room.width).inches,'3.008');
  assert.equal(JSON.stringify(project),snapshot);
  assert.equal(parseProject(snapshot).room.width,2210);
});
test('Editing feet alone preserves the unrounded mm remainder',()=>{
  const original=splitMillimetres(2210);
  assert.equal(imperialEditMm({...original,feet:'8',inchEdited:false}),2514.8);
  assert.equal(imperialEditMm({...original,feet:'7',inches:'3 1/2',inchEdited:true}),2222.5);
  assert.equal(imperialEditMm({...original,feet:'7',inches:'3 /',inchEdited:true}),null);
});
