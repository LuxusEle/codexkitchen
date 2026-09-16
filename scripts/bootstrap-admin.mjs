// Explicit one-time operator task. Password is read without terminal echo, never written.
import '../server/env.js';
import {getDb} from '../server/db.js';
import {members} from '../server/schema.js';
import {eq} from 'drizzle-orm';
import {neonRequest} from '../server/auth-service.js';
const db=getDb(),req={headers:{}};
if(!process.env.ADMIN_EMAIL)throw Error('Set ADMIN_EMAIL in the private environment.');
process.stdout.write('Enter the requested admin password (hidden), then Enter: ');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.resume();process.stdin.setEncoding('utf8');
const password=await new Promise((resolve,reject)=>{let value='';function onData(chunk){for(const c of chunk){if(c==='\u0003'){reject(Error('Cancelled.'));return;}if(c==='\r'||c==='\n'){process.stdin.off('data',onData);resolve(value);return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else value+=c;}}process.stdin.on('data',onData);});
if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();console.log('');
try{
  if(password.length<8||password.length>128)throw Error('Password must be 8–128 characters.');
  let response=await neonRequest(req,'sign-in/email',{email:process.env.ADMIN_EMAIL,password});
  if(!response.ok)response=await neonRequest(req,'sign-up/email',{email:process.env.ADMIN_EMAIL,password,name:'Asanke'});
  const data=await response.json();
  if(!response.ok||!data.user?.id||data.user.email.toLowerCase()!==process.env.ADMIN_EMAIL.toLowerCase())throw Error('Cannot create or sign in to admin. Existing accounts are not reset.');
  const id=data.user.id;
  const [existing]=await db.select().from(members).where(eq(members.username,'asanke1'));
  if(existing&&existing.id!==id)throw Error('The requested username belongs to a different account.');
  await db.insert(members).values({id,email:process.env.ADMIN_EMAIL,username:'asanke1',name:'Asanke',status:'active',requireEmailVerification:false}).onConflictDoUpdate({target:members.id,set:{username:'asanke1',name:'Asanke',status:'active',requireEmailVerification:false}});
  console.log(JSON.stringify({adminUserId:id,username:'asanke1',next:'Set ADMIN_USER_ID and grant this exact Neon Auth user the admin role.'}));
}catch(error){console.error(error.message);process.exitCode=1;}finally{await db.$client.end();}
