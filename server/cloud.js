import './env.js';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {and,eq,desc,sql} from 'drizzle-orm';
import {get as getBlob,head} from '@vercel/blob';
import {handleUpload} from '@vercel/blob/client';
import {getDb} from './db.js';
import {projects,assets,members,loginAlerts} from './schema.js';
import {staffInput,neonAdmin,enforceVerification,mailConfigured,deliverAlert,recordActivity} from './auth-service.js';
import {authenticate,HttpError,validId,fileInput,readJson,FILE_TYPES} from './security.js';
import {parseProject} from '../src/model.js';
import {projectAction} from './project-actions.js';

const json=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
export const owned=(table,user,id)=>user.admin?eq(table.id,validId(id)):and(eq(table.ownerId,user.id),eq(table.id,validId(id)));
const blobOptions=()=>({token:process.env.BLOB_READ_WRITE_TOKEN});
function requireStorage(){if(!process.env.BLOB_READ_WRITE_TOKEN)throw new HttpError(503,'Connect a PRIVATE Vercel Blob store and configure BLOB_READ_WRITE_TOKEN.');}
export function isAdmin(user){return process.env.ADMIN_USER_ID?user.id===process.env.ADMIN_USER_ID:Boolean(user.emailVerified&&process.env.ADMIN_EMAIL&&user.email.toLowerCase()===process.env.ADMIN_EMAIL.trim().toLowerCase());}
async function membership(db,user){
  await db.insert(members).values({id:user.id,email:user.email}).onConflictDoNothing();
  const [record]=await db.select().from(members).where(eq(members.id,user.id)).limit(1);
  return {...record,admin:isAdmin(user)};
}
async function approvedUser(db,req){
  const user=await authenticate(req),member=await membership(db,user);
  if(!member.admin&&member.status!=='active')throw new HttpError(403,'Your account needs administrator approval.');
  enforceVerification(member,user);return {...user,admin:member.admin};
}
async function projectFor(db,user,id,includeTrash=false){const [p]=await db.select().from(projects).where(owned(projects,user,id)).limit(1);if(!p)throw new HttpError(404,'Project not found.');if(p.document._workspace?.deletedAt&&!includeTrash)throw new HttpError(409,'Project is in Trash. Restore it from the dashboard first.');return p;}
async function assetFor(db,user,id){const [a]=await db.select().from(assets).where(owned(assets,user,id)).limit(1);if(!a)throw new HttpError(404,'File not found.');return a;}
function cleanProject(document){
  let clean;try{clean=parseProject(JSON.stringify(document));}catch(error){throw new HttpError(400,error.message);}
  delete clean.cloud;delete clean._workspace;return clean;
}
async function completeAsset(db,user,id){
  requireStorage();const asset=await assetFor(db,user,id);
  const meta=await head(asset.pathname,blobOptions());
  if(meta.pathname!==asset.pathname||meta.size!==asset.size||meta.contentType.split(';')[0]!==asset.contentType)
    throw new HttpError(400,'Uploaded file does not match the authorised file.');
  if(!new URL(meta.url).hostname.endsWith('.private.blob.vercel-storage.com'))throw new HttpError(503,'The Blob store must be PRIVATE.');
  const [saved]=await db.update(assets).set({status:'ready'}).where(owned(assets,user,id)).returning();return saved;
}

export default async function cloud(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    const url=new URL(req.url,'http://localhost'),op=url.searchParams.get('op'),method=req.method;
    if(op==='config'&&method==='GET')return json(res,200,{databaseConfigured:!!process.env.DATABASE_URL,authConfigured:!!process.env.NEON_AUTH_BASE_URL,storageConfigured:!!process.env.BLOB_READ_WRITE_TOKEN});
    if(!process.env.DATABASE_URL)throw new HttpError(503,'Cloud database is not configured. Local saving remains available.');
    const db=getDb();
    if(op==='blob-upload'&&method==='POST'){
      requireStorage();const body=await readJson(req,65536);
      const result=await handleUpload({body,request:req,...blobOptions(),
        onBeforeGenerateToken:async(pathname,clientPayload)=>{
          const user=await approvedUser(db,req);let input;try{input=JSON.parse(clientPayload||'{}');}catch{throw new HttpError(400,'Invalid upload payload.');}
          const asset=await assetFor(db,user,input.assetId);
          if(asset.status!=='pending'||asset.pathname!==pathname||Date.now()-new Date(asset.createdAt).getTime()>15*60000)throw new HttpError(400,'Upload authorisation expired or path is invalid.');
          return {allowedContentTypes:[asset.contentType],maximumSizeInBytes:asset.size,validUntil:Date.now()+10*60000,
            addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60,tokenPayload:JSON.stringify({id:asset.id,ownerId:asset.ownerId})};
        },
        onUploadCompleted:async({tokenPayload})=>{
          const input=JSON.parse(tokenPayload);await completeAsset(db,{id:input.ownerId},input.id);
        },
      });return json(res,200,result);
    }
    const user=await authenticate(req);
    const member=await membership(db,user);
    user.admin=member.admin;
    if(op==='me'&&method==='GET')return json(res,200,{user:{id:user.id,email:user.email,emailVerified:user.emailVerified},member});
    if(op==='members'){
      if(!member.admin)throw new HttpError(403,'Only the verified administrator can manage users.');
      if(method==='GET')return json(res,200,{members:await db.select().from(members).orderBy(desc(members.createdAt)).limit(200)});
      if(method==='PATCH'){
        const body=await readJson(req,4096);
        if(typeof body.id!=='string'||body.id===user.id||!['active','blocked','pending'].includes(body.status))throw new HttpError(400,'Choose another user and a valid access status.');
        const [saved]=await db.update(members).set({status:body.status,updatedAt:new Date()}).where(eq(members.id,body.id)).returning();
        if(!saved)throw new HttpError(404,'User not found.');await recordActivity(db,user,'staff_access_updated',saved.username||saved.id);return json(res,200,{member:saved});
      }
    }
    if(op==='staff'&&['POST','PATCH'].includes(method)){
      if(!member.admin)throw new HttpError(403,'Only the super-admin can edit staff.');
      const body=await readJson(req,8192),input=staffInput(body,method==='POST');
      const [duplicate]=await db.select().from(members).where(eq(members.username,input.username));
      if(duplicate&&duplicate.id!==body.id)throw new HttpError(409,'This username is already in use.');
      if(method==='POST'){
        const email=input.requireEmailVerification?input.email:`ck-${randomUUID()}@staff.invalid`;
        const created=await neonAdmin(req,'create-user',{email,password:input.password,name:input.name,role:'user'}),id=created.user?.id;
        if(!id)throw new HttpError(503,'Neon did not return the new account ID.');
        try{
          const [saved]=await db.insert(members).values({id,email,username:input.username,name:input.name,status:input.status,requireEmailVerification:input.requireEmailVerification}).returning();
          await recordActivity(db,user,'staff_created',input.username);return json(res,201,{member:saved});
        }catch(error){await neonAdmin(req,'remove-user',{userId:id}).catch(()=>{});throw error;}
      }
      const [existing]=await db.select().from(members).where(eq(members.id,String(body.id)));
      if(!existing)throw new HttpError(404,'Staff account not found.');
      if(existing.id===process.env.ADMIN_USER_ID&&(input.status!=='active'||input.requireEmailVerification))throw new HttpError(400,'The super-admin must stay active without an email-verification lock.');
      const email=input.requireEmailVerification?input.email:existing.email;
      const changedEmail=email!==existing.email;
      if(input.status==='blocked')await db.update(members).set({status:'blocked'}).where(eq(members.id,existing.id));
      await neonAdmin(req,'update-user',{userId:existing.id,data:{name:input.name,...(changedEmail?{email,emailVerified:false}:{})}});
      if(input.password)await neonAdmin(req,'set-user-password',{userId:existing.id,newPassword:input.password});
      if(input.password||changedEmail||input.status==='blocked')await neonAdmin(req,'revoke-user-sessions',{userId:existing.id});
      const [saved]=await db.update(members).set({email,username:input.username,name:input.name,status:input.status,requireEmailVerification:input.requireEmailVerification,updatedAt:new Date()}).where(eq(members.id,existing.id)).returning();
      await recordActivity(db,user,'staff_updated',input.username);return json(res,200,{member:saved});
    }
    if(op==='activity'){
      if(!member.admin)throw new HttpError(403,'Only the super-admin can view activity.');
      if(method==='GET')return json(res,200,{activities:await db.select().from(loginAlerts).orderBy(desc(loginAlerts.createdAt)).limit(200),mailConfigured:mailConfigured()});
      if(method==='POST'){
        if(!mailConfigured())throw new HttpError(503,'Connect an email sender first. Login events are recorded but emails are pending.');
        const pending=await db.select().from(loginAlerts).where(eq(loginAlerts.status,'pending')).orderBy(desc(loginAlerts.createdAt)).limit(10);
        let sent=0;for(const alert of pending)if(await deliverAlert(db,alert))sent++;return json(res,200,{sent});
      }
    }
    if(!member.admin&&member.status!=='active')throw new HttpError(403,'Your account needs administrator approval.');
    enforceVerification(member,user);
    if(op==='projects'&&method==='GET'){
      const trash=url.searchParams.get('trash')==='true',offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
      const archived=sql`${projects.document}->'_workspace'->>'deletedAt'`;
      const rows=await db.select({id:projects.id,ownerId:projects.ownerId,owner:members.username,name:projects.name,revision:projects.revision,updatedAt:projects.updatedAt}).from(projects).leftJoin(members,eq(projects.ownerId,members.id)).where(and(user.admin?undefined:eq(projects.ownerId,user.id),trash?sql`${archived} is not null`:sql`${archived} is null`)).orderBy(desc(projects.updatedAt),projects.id).limit(101).offset(Math.floor(offset));
      return json(res,200,{projects:rows.slice(0,100),hasMore:rows.length>100});
    }
    if(op==='project'&&method==='PATCH'){
      const id=validId(url.searchParams.get('id')),body=await readJson(req,4096),existing=await projectFor(db,user,id,true);
      const patch=projectAction(existing,body);
      const [saved]=await db.update(projects).set({...patch,revision:sql`${projects.revision}+1`,updatedAt:new Date()}).where(and(owned(projects,user,id),eq(projects.revision,body.revision))).returning();
      if(!saved)throw new HttpError(409,'Project changed. Refresh the dashboard and try again.');
      await recordActivity(db,user,`project_${body.action}`,id);return json(res,200,{project:saved});
    }
    if(op==='project'&&method==='GET'){const saved=await projectFor(db,user,url.searchParams.get('id'));await recordActivity(db,user,'project_opened',saved.id);return json(res,200,{project:saved});}
    if(op==='project'&&['POST','PUT'].includes(method)){
      const body=await readJson(req),document=cleanProject(body.document),name=String(document.name||'Untitled kitchen').slice(0,100);
      if(method==='POST'){
        const [saved]=await db.insert(projects).values({id:randomUUID(),ownerId:user.id,name,document}).returning();await recordActivity(db,user,'project_created',saved.id);return json(res,201,{project:saved});
      }
      const id=validId(url.searchParams.get('id'));await projectFor(db,user,id);
      if(!Number.isInteger(body.revision)||body.revision<1)throw new HttpError(400,'A project revision is required.');
      const [saved]=await db.update(projects).set({name,document,revision:sql`${projects.revision}+1`,updatedAt:new Date()})
        .where(and(owned(projects,user,id),eq(projects.revision,body.revision))).returning();
      if(!saved)throw new HttpError(409,'This project changed on another device. Open the cloud version or save a new copy. Your local work is untouched.');
      await recordActivity(db,user,'project_saved',saved.id);return json(res,200,{project:saved});
    }
    if(op==='assets'&&method==='GET'){
      const id=validId(url.searchParams.get('projectId'));await projectFor(db,user,id);
      return json(res,200,{assets:await db.select().from(assets).where(and(user.admin?undefined:eq(assets.ownerId,user.id),eq(assets.projectId,id),eq(assets.status,'ready'))).orderBy(desc(assets.createdAt)).limit(200)});
    }
    if(op==='asset-init'&&method==='POST'){
      requireStorage();const body=await readJson(req,4096),file=fileInput(body),projectId=validId(body.projectId),project=await projectFor(db,user,projectId);
      const [{total}]=await db.select({total:sql`count(*)::int`}).from(assets).where(and(eq(assets.ownerId,project.ownerId),eq(assets.projectId,projectId)));
      if(total>=200)throw new HttpError(429,'This project has reached its 200-file limit.');
      const id=randomUUID(),pathname=`kitchens/${encodeURIComponent(project.ownerId)}/${projectId}/${id}.${FILE_TYPES[file.contentType]}`;
      const [asset]=await db.insert(assets).values({id,projectId,ownerId:project.ownerId,pathname,...file}).returning();await recordActivity(db,user,'file_upload',projectId);return json(res,201,{asset});
    }
    if(op==='asset-complete'&&method==='POST'){
      const body=await readJson(req,4096);return json(res,200,{asset:await completeAsset(db,user,body.id)});
    }
    if(op==='asset'&&method==='GET'){
      requireStorage();const asset=await assetFor(db,user,url.searchParams.get('id'));
      if(asset.status!=='ready')throw new HttpError(404,'File is not ready.');
      const result=await getBlob(asset.pathname,{access:'private',...blobOptions()});
      if(result?.statusCode!==200)throw new HttpError(404,'File not found in storage.');
      res.setHeader('Content-Type',asset.contentType);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}`);
      return await pipeline(Readable.fromWeb(result.stream),res);
    }
    throw new HttpError(404,'Unknown cloud operation.');
  }catch(error){
    if(res.headersSent){res.destroy();return;}
    if(error instanceof HttpError)return json(res,error.status,{error:error.message});
    // SQL/JWT/provider errors can contain secrets; never echo them to clients or logs.
    if(error.code==='42P01'||error.code==='3F000'||error.cause?.code==='42P01')return json(res,503,{error:'Cloud tables are not installed yet. Run the reviewed database migration on your development branch.'});
    console.error('Kitchen cloud request failed.',{code:/^[A-Z0-9_]{2,40}$/.test(error.code||'')?error.code:'PROVIDER_ERROR'});
    return json(res,503,{error:'Cloud service is unavailable or not configured. Your local project is safe.'});
  }
}
