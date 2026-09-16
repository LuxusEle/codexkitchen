import {and,eq,desc,sql} from 'drizzle-orm';
import {businesses,members,projects,presence} from './schema.js';
import {businessProfile,validateBusiness,BUSINESS_IDS} from '../src/business.js';
import {HttpError,readJson,validId} from './security.js';
import {recordActivity} from './auth-service.js';
export function ownProjectFilter(user,id) {
  return and(id?eq(projects.id,validId(id)):undefined,user.admin?undefined:and(eq(projects.ownerId,user.id),eq(projects.businessId,user.businessId||'__unassigned__')));
}
export function chosenBusiness(user,id) {
  const selected=id||user.businessId;
  if(!BUSINESS_IDS.includes(selected))throw new HttpError(400,'Select a business.');
  if(!user.admin&&selected!==user.businessId)throw new HttpError(403,'This business is not assigned to you.');
  return selected;
}
export async function loadBusiness(db,id) {
  const [row]=await db.select().from(businesses).where(eq(businesses.id,id));
  if(!row)throw new HttpError(503,'Business setup migration is not installed.');
  return businessProfile(row);
}
// Returns undefined for unrelated operations. Authorization always runs before queries.
export async function businessOperation({db,user,op,method,req,url,projectFor}) {
  if(op==='businesses'&&method==='GET') {
    const rows=await db.select().from(businesses).where(user.admin?undefined:eq(businesses.id,user.businessId));
    return {businesses:rows.map(businessProfile)};
  }
  if(op==='businesses'&&method==='PATCH') {
    if(!user.admin)throw new HttpError(403,'Only the owner can change business settings.');
    const body=await readJson(req,500000);let profile;
    try{profile=validateBusiness(body);}catch(e){throw new HttpError(400,e.message);}
    if(!Number.isInteger(body.revision)||body.revision<1)throw new HttpError(400,'Refresh business settings before saving.');
    const [saved]=await db.update(businesses).set({name:body.name.trim(),profile,revision:sql`${businesses.revision}+1`,updatedAt:new Date()}).where(and(eq(businesses.id,body.id),eq(businesses.revision,body.revision))).returning();
    if(!saved)throw new HttpError(409,'Business settings changed. Refresh and retry.');
    await recordActivity(db,user,'business_updated',body.id);return {business:businessProfile(saved)};
  }
  if(op==='presence'&&method==='POST') {
    const body=await readJson(req,1024);let projectId=null;
    if(body.projectId){const p=await projectFor(db,user,body.projectId);projectId=p.id;}
    const now=new Date(),active=body.active===true;
    await db.insert(presence).values({userId:user.id,projectId,lastSeen:now,lastActive:active?now:null}).onConflictDoUpdate({target:presence.userId,set:{projectId,lastSeen:now,...(active?{lastActive:now}:{})}});
    return {ok:true};
  }
  if(op==='overview'&&method==='GET') {
    if(!user.admin)throw new HttpError(403,'Only the owner can see staff activity.');
    const period=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new HttpError(400,'Choose a month.');
    const start=new Date(`${period}-01T00:00:00+05:30`),[year,month]=period.split('-').map(Number),end=new Date(Date.UTC(year,month,1)-330*60000);
    const visible=sql`${projects.document}->'_workspace'->>'deletedAt' is null`;
    const stats=await db.select({ownerId:projects.ownerId,businessId:projects.businessId,total:sql`count(*)::int`,created:sql`count(*) filter (where ${projects.createdAt} >= ${start} and ${projects.createdAt} < ${end})::int`,approved:sql`count(*) filter (where ${projects.reviewStatus} = 'approved' and ${projects.reviewedRevision} = ${projects.revision} and ${projects.reviewedAt} >= ${start} and ${projects.reviewedAt} < ${end})::int`}).from(projects).where(visible).groupBy(projects.ownerId,projects.businessId);
    const staff=await db.select({id:members.id,username:members.username,name:members.name,status:members.status,businessId:members.businessId,monthlyTarget:members.monthlyTarget,barTokens:members.barTokens,lastSeen:presence.lastSeen,lastActive:presence.lastActive,projectId:presence.projectId}).from(members).leftJoin(presence,eq(members.id,presence.userId));
    return {month:period,staff,stats,serverTime:new Date().toISOString()};
  }
  if(op==='review'&&method==='PATCH') {
    if(!user.admin)throw new HttpError(403,'Only the owner can review project quality.');
    const body=await readJson(req,10000),p=await projectFor(db,user,body.id);
    if(!['draft','changes_requested','approved'].includes(body.status)||typeof body.note!=='string'||body.note.length>6000||body.revision!==p.revision)throw new HttpError(409,'Review the latest saved revision and choose a valid status.');
    const [saved]=await db.update(projects).set({reviewStatus:body.status,reviewNote:body.note,reviewedRevision:p.revision,reviewedAt:new Date()}).where(and(eq(projects.id,p.id),eq(projects.ownerId,p.ownerId),eq(projects.revision,p.revision))).returning();
    if(!saved)throw new HttpError(409,'Project changed while being reviewed. Reopen the latest revision.');
    await recordActivity(db,user,'quality_review',`${p.id}: ${body.status} revision ${p.revision}`);return {project:saved};
  }
}
