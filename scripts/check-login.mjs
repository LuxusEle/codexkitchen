// Read-only sign-in/API smoke check. No passwords or session tokens are printed or saved.
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:9799';
process.stdout.write('Admin password (hidden): ');if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.resume();process.stdin.setEncoding('utf8');
const password=await new Promise(resolve=>{let value='';function input(chunk){for(const c of chunk){if(c==='\r'||c==='\n'){process.stdin.off('data',input);resolve(value);return;}value+=c;}}process.stdin.on('data',input);});
if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();console.log('');
const cookies=new Map();let token;
async function call(path,body){const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{Origin:base,Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';'),i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
  const data=await response.json();assert.equal(response.status,200,`${path}: HTTP ${response.status}; ${data.error||data.message||'unexpected response'}`);return data;
}
try{
  await call('/api/auth/sign-in/email',{email:'asanke1',password});console.log(JSON.stringify({signedIn:true,cookieNames:[...cookies.keys()]}));
  const session=await call('/api/auth/get-session');assert.ok(session.user?.id);console.log('Session verified.');
  ({token}=await call('/api/auth/token'));assert.ok(token);
  const me=await call('/api/cloud?op=me');assert.equal(me.member.admin,true);assert.equal(me.member.username,'asanke1');
  const staff=await call('/api/cloud?op=members'),projects=await call('/api/cloud?op=projects'),activity=await call('/api/cloud?op=activity');
  console.log(JSON.stringify({superAdmin:true,staff:staff.members.length,projects:projects.projects.length,activities:activity.activities.length,emailConfigured:activity.mailConfigured}));
}catch(error){console.error(error.message);process.exitCode=1;}finally{if(cookies.size)await call('/api/auth/sign-out',{}).catch(()=>{});}
