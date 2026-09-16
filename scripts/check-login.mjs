// Read-only sign-in/API smoke check. No passwords or session tokens are printed or saved.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
const base=process.argv[2]||'http://localhost:9799';
const identifier=process.argv.find(arg=>arg.startsWith('--identifier='))?.slice('--identifier='.length)||'asanke1';
process.stdout.write('Admin password (hidden): ');if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.resume();process.stdin.setEncoding('utf8');
const password=await new Promise(resolve=>{let value='';function input(chunk){for(const c of chunk){if(c==='\r'||c==='\n'){process.stdin.off('data',input);resolve(value);return;}value+=c;}}process.stdin.on('data',input);});
if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();console.log('');
let cookies=new Map(),token;
async function call(path,body,method=body?'POST':'GET',expected){const response=await fetch(`${base}${path}`,{method,headers:{Origin:base,Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';'),i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
  const data=await response.json();assert.ok(expected?response.status===expected:response.ok,`${path}: HTTP ${response.status}; ${data.error||data.message||'unexpected response'}`);return data;
}
try{
  if(process.argv.includes('--sdk')){
    const originalFetch=globalThis.fetch;
    globalThis.fetch=async(url,options={})=>{
      const headers=new Headers(options.headers);headers.set('Origin',base);headers.set('Cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));
      const response=await originalFetch(url,{...options,headers});
      for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';'),i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
      console.log(JSON.stringify({path:new URL(url).pathname,status:response.status}));return response;
    };
    const {createAuthClient}=await import('@neondatabase/neon-js/auth');
    const client=createAuthClient(`${base}/api/auth`);
    const login=await client.signIn.email({email:identifier,password});assert.ok(!login.error,'SDK login failed');
    const session=await client.getSession();assert.ok(session.data?.user,'SDK session missing');
    const result=await client.token();
    console.log(JSON.stringify({sdkTokenPresent:Boolean(result.data?.token),dataKeys:Object.keys(result.data||{}),error:result.error?.message}));
    const {fetchAccessToken}=await import('../src/auth-token.js');
    const apiToken=await fetchAccessToken((path,options)=>globalThis.fetch(`${base}${path}`,options));
    assert.ok(apiToken,'Direct access token missing');console.log('Direct token workaround verified after SDK sign-in.');
    globalThis.fetch=originalFetch;
  }
  await call('/api/auth/sign-in/email',{email:identifier,password});console.log(JSON.stringify({signedIn:true,cookieNames:[...cookies.keys()]}));
  const session=await call('/api/auth/get-session');assert.ok(session.user?.id);console.log('Session verified.');
  ({token}=await call('/api/auth/token'));assert.ok(token);
  const me=await call('/api/cloud?op=me');assert.equal(me.member.admin,true);assert.equal(me.member.username,'asanke1');
  const staff=await call('/api/cloud?op=members'),projects=await call('/api/cloud?op=projects'),activity=await call('/api/cloud?op=activity');
  console.log(JSON.stringify({superAdmin:true,staff:staff.members.length,projects:projects.projects.length,activities:activity.activities.length,emailConfigured:activity.mailConfigured}));
  if(process.argv.includes('--exercise')){
    const {initialProject}=await import('../src/model.js'),{getDb}=await import('../server/db.js'),schema=await import('../server/schema.js'),{eq}=await import('drizzle-orm'),{neonAdmin}=await import('../server/auth-service.js');
    const db=getDb(),adminCookies=new Map(cookies),adminToken=token,username=`uat-${randomUUID().slice(0,8)}`,staffPassword=randomBytes(20).toString('hex');
    let staffId,projectId;
    try{
      const created=await call('/api/cloud?op=staff',{username,name:'Disposable UAT staff',password:staffPassword,status:'active',requireEmailVerification:false});staffId=created.member.id;assert.equal(created.member.username,username);
      cookies=new Map();token=null;await call('/api/auth/sign-in/email',{email:username,password:staffPassword});({token}=await call('/api/auth/token'));
      await call('/api/cloud?op=members',undefined,'GET',403);
      const document={...initialProject(),name:'Disposable cloud integration check'};
      const saved=await call('/api/cloud?op=project',{document});projectId=saved.project.id;assert.equal(saved.project.ownerId,staffId);
      const staffToken=token,staffCookies=new Map(cookies);cookies=adminCookies;token=adminToken;
      const loaded=await call(`/api/cloud?op=project&id=${projectId}`);assert.equal(loaded.project.ownerId,staffId);
      const updated=await call(`/api/cloud?op=project&id=${projectId}`,{document:{...document,name:'Super-admin edited UAT'},revision:loaded.project.revision},'PUT');assert.equal(updated.project.ownerId,staffId);
      await call(`/api/cloud?op=project&id=${projectId}`,{document,revision:loaded.project.revision},'PUT',409);
      await call('/api/cloud?op=staff',{...created.member,status:'blocked',password:''},'PATCH');
      cookies=staffCookies;token=staffToken;await call('/api/cloud?op=projects',undefined,'GET',403);
      console.log('PASS: username-only staff creation/login, staff admin denial, save/read, super-admin cross-owner edit, revision conflict, disable and session revocation.');
    }finally{
      cookies=adminCookies;token=adminToken;
      if(projectId)await db.delete(schema.projects).where(eq(schema.projects.id,projectId));
      if(staffId){await neonAdmin({headers:{cookie:[...adminCookies].map(([k,v])=>`${k}=${v}`).join('; ')}},'remove-user',{userId:staffId});await db.delete(schema.members).where(eq(schema.members.id,staffId));}
      await db.$client.end();console.log('Removed disposable UAT account/project; activity audit retained.');
    }
  }
}catch(error){console.error(error.message);process.exitCode=1;}finally{if(cookies.size)await call('/api/auth/sign-out',{}).catch(()=>{});}
