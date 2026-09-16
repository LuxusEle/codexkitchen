// Uses only the existing isolated UAT database branch. Production Auth supplies a short-lived session.
import '../server/env.js';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
const databaseUrl=new URL(process.env.DATABASE_URL);
assert.equal(databaseUrl.hostname,'ep-icy-haze-b4vslqyf-pooler.c-6.us-east-2.aws.neon.tech');
databaseUrl.hostname='ep-rough-union-b47yzm7l-pooler.c-6.us-east-2.aws.neon.tech';
process.env.DATABASE_URL=databaseUrl.href;
const {default:cloud}=await import('../server/cloud.js'),{getDb}=await import('../server/db.js'),{projects}=await import('../server/schema.js'),{newProject,detachedProject}=await import('../src/project-workspace.js');
process.stdout.write('Admin password (hidden): ');if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
const password=await new Promise(resolve=>{let value='';function input(chunk){for(const c of chunk){if(c==='\r'||c==='\n'){process.stdin.off('data',input);resolve(value);return;}value+=c;}}process.stdin.on('data',input);});
if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();console.log('');
const base='https://codexkitchen.vercel.app',cookies=new Map(),created=[];let token;
async function auth(path,body){const r=await fetch(base+'/api/auth/'+path,{method:body?'POST':'GET',headers:{Origin:base,Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}const data=await r.json();assert.ok(r.ok,'Authentication failed: '+r.status);return data;}
async function call(op,method='GET',body,params='',expected=200){let data;const res={headersSent:false,setHeader(){},end(v){data=JSON.parse(v);}};await cloud({url:'/api/cloud?op='+op+params,method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body},res);assert.equal(res.statusCode,expected,data?.error||op);return data;}
try{
  await auth('sign-in/email',{email:'asanke1',password});({token}=await auth('token'));
  const name='Disposable dashboard check '+randomUUID().slice(0,8);
  let {project}=await call('project','POST',{document:newProject(name)},'',201);created.push(project.id);
  const id='&id='+project.id;
  assert.ok((await call('projects')).projects.some(p=>p.id===project.id));
  const opened=(await call('project','GET',undefined,id)).project;assert.equal(opened.name,name);
  project=(await call('project','PUT',{document:{...opened.document,notes:'Workflow verification'},revision:opened.revision},id)).project;
  await call('project','PATCH',{action:'rename',name:'stale',revision:opened.revision},id,409);
  project=(await call('project','PATCH',{action:'rename',name:name+' renamed',revision:project.revision},id)).project;
  assert.equal(project.document.notes,'Workflow verification');
  const duplicate=(await call('project','POST',{document:detachedProject(project.document,name+' copy')},'',201)).project;created.push(duplicate.id);assert.notEqual(duplicate.id,project.id);
  project=(await call('project','PATCH',{action:'trash',revision:project.revision},id)).project;
  assert.ok(!(await call('projects')).projects.some(p=>p.id===project.id));assert.ok((await call('projects','GET',undefined,'&trash=true')).projects.some(p=>p.id===project.id));
  await call('project','GET',undefined,id,409);
  await call('project','PUT',{document:opened.document,revision:project.revision},id,409);
  project=(await call('project','PATCH',{action:'restore',revision:project.revision},id)).project;
  assert.equal(project.document.notes,'Workflow verification');assert.ok((await call('projects')).projects.some(p=>p.id===project.id));
  console.log('PASS: isolated branch create, list, open, update, rename, stale revision, duplicate, trash, blocked trashed edit, restore.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{
  const db=getDb();for(const id of created)await db.delete(projects).where(eq(projects.id,id));await db.$client.end();
  if(cookies.size)await auth('sign-out',{}).catch(()=>{});
  console.log('Removed only disposable test projects from the isolated UAT branch.');
}
