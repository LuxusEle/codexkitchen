import {initialProject,parseProject} from './model.js';

export const draftKey=userId=>`CODEXKITCHENAPP_DRAFTS_V2:${userId}`;
export function projectIdentity(p){return p.cloud?.id||p.projectId;}
export function projectContent(p){const {cloud,_workspace,...document}=p;return JSON.stringify(document);}
export function detachedProject(source,name=source.name){
  const p=parseProject(JSON.stringify(source));delete p.cloud;delete p._workspace;
  return {...p,projectId:crypto.randomUUID(),name:name.trim()||'Untitled kitchen'};
}
export function newProject(name){return detachedProject({...initialProject(),openings:[]},name);}
export function cloudDocument(row){return {...parseProject(JSON.stringify(row.document)),cloud:{id:row.id,ownerId:row.ownerId,revision:row.revision}};}
export function readDrafts(userId,storage=localStorage){
  const rows=JSON.parse(storage.getItem(draftKey(userId))||'[]');
  if(!Array.isArray(rows))throw Error('Local draft index is invalid. Export your browser data before clearing storage.');
  return rows;
}
export function writeDraft(userId,document,dirty=true,storage=localStorage){
  const id=projectIdentity(document);if(!id)throw Error('Project identity is missing.');
  const rows=readDrafts(userId,storage),entry={id,document,dirty,updatedAt:new Date().toISOString()};
  // Never silently evict another project when the browser is full.
  storage.setItem(draftKey(userId),JSON.stringify([entry,...rows.filter(r=>r.id!==id)]));return entry;
}
export function removeDraft(userId,id,storage=localStorage){storage.setItem(draftKey(userId),JSON.stringify(readDrafts(userId,storage).filter(r=>r.id!==id)));}
export function recoverLegacyDrafts(account,storage=localStorage){
  const marker=`${draftKey(account.user.id)}:legacy-imported`;if(storage.getItem(marker))return;
  const saved=JSON.parse(storage.getItem(`CODEXKITCHENAPP_SAVED_PROJECTS_V1:${account.user.id}`)||'[]');
  const last=storage.getItem(`CODEXKITCHENAPP_UAT1:${account.user.id}`)||(account.member.admin?storage.getItem('CODEXKITCHENAPP_UAT1'):null);
  const sources=[...(Array.isArray(saved)?saved.map(r=>r.project):[]),...(last?[JSON.parse(last)]:[])];
  for(const source of sources){
    const p=parseProject(JSON.stringify(source));p.projectId||=crypto.randomUUID();
    if(!readDrafts(account.user.id,storage).some(r=>r.id===projectIdentity(p)))writeDraft(account.user.id,p,true,storage);
  }
  storage.setItem(marker,'1'); // Original legacy keys remain untouched for recovery.
}
