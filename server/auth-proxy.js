import {eq} from 'drizzle-orm';
import {getDb} from './db.js';
import {members} from './schema.js';
import {HttpError,readJson} from './security.js';
import {browserCookie,checkOrigin,neonRequest,rateLimit,recordLogin,usernameInput} from './auth-service.js';

const routes={'sign-in/email':'POST','sign-out':'POST','get-session':'GET','token':'GET','email-otp/send-verification-otp':'POST','email-otp/verify-email':'POST'};
export default async function authProxy(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    checkOrigin(req);
    const url=new URL(req.url,'http://localhost'),path=url.searchParams.get('path')||url.pathname.replace(/^\/api\/auth\/?/,'');
    if(routes[path]!==req.method)throw new HttpError(404,'Unknown sign-in operation.');
    let body=req.method==='POST'?await readJson(req,16384):undefined;
    const db=getDb();
    if(path==='sign-in/email'){
      const adminAlias=process.env.ADMIN_USER_ID&&String(body.email).toLowerCase()===process.env.ADMIN_EMAIL?.toLowerCase();
      const username=adminAlias?'admin-email-alias':usernameInput(body.email);
      if(typeof body.password!=='string'||body.password.length>128)throw new HttpError(400,'Enter your username and password.');
      await rateLimit(db,`login:${username}`);
      const [member]=await db.select().from(members).where(adminAlias?eq(members.id,process.env.ADMIN_USER_ID):eq(members.username,username)).limit(1);
      if(!member||member.status==='blocked')throw new HttpError(401,'Invalid username or password.');
      body={email:member.email,password:body.password};
    }
    if(path.startsWith('email-otp/')){
      const current=await neonRequest(req,'get-session'),session=await current.json();
      if(!current.ok||!session?.user)throw new HttpError(401,'Sign in first.');
      const [member]=await db.select().from(members).where(eq(members.id,session.user.id));
      if(!member?.requireEmailVerification||member.status==='blocked')throw new HttpError(403,'Email verification is not enabled for this account.');
      await rateLimit(db,`otp:${session.user.id}`,10);
      body=path.endsWith('send-verification-otp')?{email:member.email,type:'email-verification'}:{email:member.email,otp:String(body.otp||'').slice(0,12)};
    }
    const upstream=await neonRequest(req,path,body),data=await upstream.json();
    if(upstream.ok&&path==='sign-in/email'&&data.user){
      try{await recordLogin(db,data.user);}catch{console.error('Could not record kitchen login alert.');}
    }
    const cookies=upstream.headers.getSetCookie().map(browserCookie);if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.statusCode=upstream.status;
    if(!upstream.ok){res.end(JSON.stringify({message:path==='sign-in/email'?'Invalid username or password.':data.message||'Sign-in service rejected the request.'}));return;}
    res.end(JSON.stringify(data));
  }catch(error){res.statusCode=error instanceof HttpError?error.status:503;res.end(JSON.stringify({message:error instanceof HttpError?error.message:'Sign-in service is unavailable.'}));}
}
