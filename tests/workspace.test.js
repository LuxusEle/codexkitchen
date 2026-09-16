import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,detachedProject,cloudDocument,writeDraft,readDrafts,recoverLegacyDrafts,removeDraft,projectContent} from '../src/project-workspace.js';
import {projectAction} from '../server/project-actions.js';
import {renderClipboardItem} from '../src/render-clipboard.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
test('new project has distinct identity and no fabricated site openings',()=>{
  const p=newProject('Client A');assert.equal(p.name,'Client A');assert.equal(p.openings.length,0);assert.notEqual(p.projectId,newProject('Client B').projectId);
});
test('duplicate/import detaches cloud identity and trash metadata',()=>{
  const p={...newProject('Original'),cloud:{id:'old'},_workspace:{deletedAt:'yesterday'}},copy=detachedProject(p,'Copy');
  assert.equal(copy.cloud,undefined);assert.equal(copy._workspace,undefined);assert.notEqual(copy.projectId,p.projectId);assert.equal(p.name,'Original');
});
test('drafts remain per-user and per-project; updating never evicts another',()=>{
  const s=memory(),a=newProject('A'),b=newProject('B');writeDraft('one',a,true,s);writeDraft('one',b,true,s);writeDraft('one',{...a,name:'Updated'},false,s);
  assert.equal(readDrafts('one',s).length,2);assert.equal(readDrafts('two',s).length,0);assert.equal(readDrafts('one',s)[0].dirty,false);
  removeDraft('one',a.projectId,s);assert.equal(readDrafts('one',s)[0].document.name,'B');
});
test('legacy drafts migrate once without deleting originals',()=>{
  const s=memory(),p=newProject('Legacy');s.setItem('CODEXKITCHENAPP_UAT1:user',JSON.stringify(p));const account={user:{id:'user'},member:{admin:false}};
  recoverLegacyDrafts(account,s);recoverLegacyDrafts(account,s);assert.equal(readDrafts('user',s).length,1);assert.ok(s.getItem('CODEXKITCHENAPP_UAT1:user'));
});
test('cloud document retains owner and revision while content excludes binding',()=>{
  const p=newProject('Cloud'),d=cloudDocument({id:'id',ownerId:'owner',revision:4,document:p});assert.equal(d.cloud.ownerId,'owner');assert.equal(d.cloud.revision,4);assert.equal(projectContent(d),projectContent(p));
});
test('rename, recoverable trash and restore retain all design data',()=>{
  const p=newProject('A'),row={revision:3,document:p};const renamed=projectAction(row,{revision:3,action:'rename',name:'B'});
  assert.equal(renamed.name,'B');assert.deepEqual(renamed.document.room,p.room);
  const trash=projectAction(row,{revision:3,action:'trash'},new Date('2026-09-16T00:00:00Z'));
  assert.ok(trash.document._workspace.deletedAt);assert.equal(p._workspace,undefined);
  const restored=projectAction({...row,document:trash.document},{revision:3,action:'restore'});assert.deepEqual(restored.document,p);
});
test('stale revisions and invalid project actions cannot change data',()=>{
  const row={revision:4,document:newProject('A')};
  for(const body of [{action:'trash',revision:3},{action:'trash'},{action:'rename',revision:4,name:' '},{action:'unknown',revision:4}])assert.throws(()=>projectAction(row,body));
});
test('clipboard combines prompt and image representations in one item',async()=>{
  class Item{constructor(data){this.data=data;}}
  const image=new Blob(['png'],{type:'image/png'}),item=renderClipboardItem({prompt:'Render this kitchen',clipboardSheet:image},Item);
  assert.deepEqual(Object.keys(item.data),['text/plain','image/png']);assert.equal(await item.data['text/plain'].text(),'Render this kitchen');assert.equal(item.data['image/png'],image);
});
