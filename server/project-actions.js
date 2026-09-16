import {HttpError} from './security.js';
export function projectAction(existing,body,now=new Date()){
  if(!Number.isInteger(body.revision)||body.revision!==existing.revision)throw new HttpError(409,'Project changed. Refresh the dashboard before trying again.');
  const document=structuredClone(existing.document);
  if(body.action==='trash')document._workspace={deletedAt:now.toISOString()};
  else if(body.action==='restore')delete document._workspace;
  else if(body.action==='rename'){
    if(document._workspace?.deletedAt)throw new HttpError(409,'Restore this project before renaming.');
    const name=typeof body.name==='string'?body.name.trim():'';
    if(!name||name.length>100)throw new HttpError(400,'Project name must be 1–100 characters.');
    document.name=name;
  }else throw new HttpError(400,'Unknown project action.');
  return {name:document.name,document};
}
