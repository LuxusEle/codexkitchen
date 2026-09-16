import './env.js';
import {createHash,randomUUID} from 'node:crypto';
import {and,eq,sql} from 'drizzle-orm';
import {authLimits,loginAlerts,members} from './schema.js';
import {HttpError} from './security.js';
import nodemailer from 'nodemailer';

export function usernameInput(value){
  const name=typeof value==='string'?value.trim().toLowerCase():'';
  if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(name))throw new HttpError(400,'Username: 3–40 letters, numbers, dots, underscores or hyphens.');
  return name;
}
export function staffInput(body,creating=false){
  const username=usernameInput(body.username),name=String(body.name||username).trim().slice(0,80),requireEmailVerification=body.requireEmailVerification===true;
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(requireEmailVerification&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Enter a real email address when email verification is ticked.');
  if(email.length>254)throw new HttpError(400,'Email address is too long.');
  if((creating||body.password)&&!(typeof body.password==='string'&&body.password.length>=8&&body.password.length<=128))throw new HttpError(400,'Choose a password of 8–128 characters.');
  if(!['active','blocked','pending'].includes(body.status||'active'))throw new HttpError(400,'Invalid access status.');
  return {username,name,requireEmailVerification,email,password:body.password||null,status:body.status||'active'};
}
export function appOrigin(req){
  if(process.env.APP_ORIGIN)return new URL(process.env.APP_ORIGIN).origin;
  if(!process.env.VERCEL)return 'http://localhost:9799';
  throw new HttpError(503,'APP_ORIGIN is not configured.');
}
export function checkOrigin(req){
  const origin=appOrigin(req);
  if(req.headers.origin&&req.headers.origin!==origin)throw new HttpError(403,'Use the kitchen app to sign in.');
  if(req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'Cross-site requests are not allowed.');
  return origin;
}
export const neonCookie=(raw='')=>raw.split(';').map(s=>s.trim()).filter(s=>/^(?:__Secure-|__Host-)?(?:neon-auth|better-auth)[._-]/.test(s)).join('; ');
export function browserCookie(raw){
  const parts=raw.split(';').map(s=>s.trim()).filter(s=>!/^Domain=|^Path=|^SameSite=|^Secure$/i.test(s));
  // __Secure- cookie names always require Secure, including localhost (a browser secure-context exception).
  return [...parts,'Path=/','SameSite=Lax','Secure'].join('; ');
}
export async function neonRequest(req,path,body,cookie){
  if(!process.env.NEON_AUTH_BASE_URL)throw new HttpError(503,'Neon Auth is not configured.');
  return fetch(`${process.env.NEON_AUTH_BASE_URL.replace(/\/$/,'')}/${path}`,{
    method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Origin:appOrigin(req),Cookie:neonCookie(cookie??req.headers.cookie),...(body!==undefined?{'Content-Type':'application/json'}:{})},
    body:body===undefined?undefined:JSON.stringify(body),
  });
}
export async function neonAdmin(req,path,body){
  const response=await neonRequest(req,`admin/${path}`,body),value=await response.json();
  if(!response.ok)throw new HttpError(response.status>=500?503:400,'Neon could not update this account. Check the details and sign in again as administrator.');
  return value;
}
export async function rateLimit(db,key,maximum=10){
  const bucket=Math.floor(Date.now()/900000),hash=createHash('sha256').update(`${bucket}:${key}`).digest('hex');
  const [row]=await db.insert(authLimits).values({key:hash,count:1,expiresAt:new Date((bucket+1)*900000)})
    .onConflictDoUpdate({target:authLimits.key,set:{count:sql`${authLimits.count}+1`}}).returning();
  if(row.count>maximum)throw new HttpError(429,'Too many attempts. Please try again in 15 minutes.');
  // Only expired throttle counters, never project or account data.
  await db.delete(authLimits).where(sql`${authLimits.expiresAt} < now()`);
}
export const mailConfigured=()=>Boolean(process.env.LOGIN_ALERT_TO&&((process.env.RESEND_API_KEY&&process.env.EMAIL_FROM)||(process.env.SMTP_USER&&process.env.SMTP_APP_PASSWORD)));
export async function deliverAlert(db,alert){
  if(!mailConfigured())return false;
  try{
    const message={to:process.env.LOGIN_ALERT_TO,subject:'CODEXKITCHEN staff login',text:`Username: ${alert.username}\nTime (UTC): ${new Date(alert.createdAt).toISOString()}\nA successful kitchen app sign-in was recorded. No passwords are included in this alert.`};
    if(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){
      const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`kitchen-login-${alert.id}`},body:JSON.stringify({...message,from:process.env.EMAIL_FROM})});
      if(!response.ok)return false;
    }else{
      const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_APP_PASSWORD},connectionTimeout:8000,socketTimeout:10000});
      await transport.sendMail({...message,from:process.env.SMTP_USER,messageId:`<kitchen-login-${alert.id}@codexkitchen.vercel.app>`});
    }
    await db.update(loginAlerts).set({status:'sent'}).where(eq(loginAlerts.id,alert.id));return true;
  }catch{return false;}
}
export async function recordLogin(db,user){
  const [member]=await db.select().from(members).where(eq(members.id,user.id));
  const [alert]=await db.insert(loginAlerts).values({id:randomUUID(),userId:user.id,username:member?.username||user.name||'Account'}).returning();
  await deliverAlert(db,alert);
}
export function enforceVerification(member,user){
  if(member.requireEmailVerification&&(!user.emailVerified||user.email.toLowerCase()!==member.email.toLowerCase()))throw new HttpError(403,'Verify your email before opening cloud projects.');
}
export async function recordActivity(db,user,action,target){
  const [member]=await db.select().from(members).where(eq(members.id,user.id));
  await db.insert(loginAlerts).values({id:randomUUID(),userId:user.id,username:member?.username||user.id,action,target:String(target||'').slice(0,200),status:'not_required'});
}
