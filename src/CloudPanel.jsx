import React,{useEffect,useRef,useState} from 'react';
import {authClient,cloudRequest,uploadProjectFile} from './cloud-client.js';
import {parseProject} from './model.js';
import {download} from './exports.js';
import './cloud.css';

export default function CloudPanel({project,onProject,onClose,pack,hasPreview}){
  const [session,setSession]=useState(null),[member,setMember]=useState(null),[projects,setProjects]=useState([]),[assets,setAssets]=useState([]),
    [members,setMembers]=useState([]),[email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),
    [signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[config,setConfig]=useState(null),[progress,setProgress]=useState(0),[otp,setOtp]=useState('');
  const fileInput=useRef(),current=useRef(project);current.current=project;
  const binding=project.cloud?.ownerId===session?.user?.id?project.cloud:null;
  async function listCloud(){const value=await cloudRequest('projects');setProjects(value.projects);}
  async function refresh(){
    const result=await authClient.getSession();if(result.error)throw Error(result.error.message||'Sign-in service unavailable.');
    setSession(result.data);setMember(null);setProjects([]);setMembers([]);setAssets([]);
    if(result.data?.user){const me=await cloudRequest('me');setMember(me.member);
      if(me.member.admin||me.member.status==='active'){await listCloud();if(me.member.admin)setMembers((await cloudRequest('members')).members);}
    }
  }
  async function run(task){setBusy(true);setMessage('');try{await task();}catch(error){setMessage(error.message);}finally{setBusy(false);}}
  useEffect(()=>{fetch('/api/cloud?op=config').then(r=>r.json()).then(setConfig).catch(()=>setMessage('Cloud API unavailable. Local projects still work.'));
    if(authClient)run(refresh);},[]);
  useEffect(()=>{setAssets([]);if(binding?.id&&(member?.admin||member?.status==='active'))
    cloudRequest('assets',{params:{projectId:binding.id}}).then(v=>setAssets(v.assets)).catch(e=>setMessage(e.message));
  },[binding?.id,member?.status,member?.admin]);
  async function submit(e){e.preventDefault();await run(async()=>{
    const result=signup?await authClient.signUp.email({name:name.trim()||email.split('@')[0],email,password}):await authClient.signIn.email({email,password});
    setPassword('');if(result.error)throw Error(result.error.message||'Sign in failed.');await refresh();
    if(signup)setMessage('Account created. Use Send verification code below to verify your email. New users require admin approval.');
  });}
  async function sendCode(){
    const result=await authClient.emailOtp.sendVerificationOtp({email:session.user.email,type:'email-verification'});
    if(result.error)throw Error(result.error.message||'Could not send verification code.');
    setMessage('Verification code sent. Check your email and spam folder.');
  }
  async function verifyCode(e){e.preventDefault();await run(async()=>{
    const result=await authClient.emailOtp.verifyEmail({email:session.user.email,otp:otp.trim()});
    if(result.error)throw Error(result.error.message||'Verification failed.');
    setOtp('');await refresh();setMessage('Email verified. If admin access has not refreshed, sign out and sign in again.');
  });}
  async function save(copy=false){
    if(hasPreview)throw Error('OK or Cancel the current design preview before saving to cloud.');
    const snapshot=structuredClone(current.current),existing=!copy&&snapshot.cloud?.ownerId===session.user.id?snapshot.cloud:null;
    const {project:saved}=await cloudRequest('project',{method:existing?'PUT':'POST',params:existing?{id:existing.id}:{},body:{document:snapshot,revision:existing?.revision}});
    // Do not overwrite edits made while the network request was pending.
    const unchanged=current.current===project;
    if(unchanged)onProject({...snapshot,cloud:{id:saved.id,ownerId:session.user.id,revision:saved.revision}});
    await listCloud();setMessage(unchanged?'Project saved to Neon, including all four design slots.':'Snapshot saved. You edited meanwhile; open the saved cloud copy before updating it.');
  }
  async function open(id){
    if(hasPreview)throw Error('OK or Cancel the current design preview first.');
    if(!window.confirm('Open this cloud project? Save any local changes first.'))return;
    const {project:saved}=await cloudRequest('project',{params:{id}});
    onProject({...parseProject(JSON.stringify(saved.document)),cloud:{id:saved.id,ownerId:session.user.id,revision:saved.revision}});setMessage('Cloud project opened.');
  }
  async function upload(file){
    if(!binding)throw Error('Save this project to Neon before attaching files.');
    setProgress(0);await uploadProjectFile(binding.id,file,value=>setProgress(Math.round(value.percentage)));
    setAssets((await cloudRequest('assets',{params:{projectId:binding.id}})).assets);setMessage('File uploaded to private Vercel Blob storage.');
  }
  const active=member?.admin||member?.status==='active';
  return <aside className="cloud-panel" aria-label="Cloud projects and account">
    <div className="row between"><h2>Cloud workspace</h2><button className="text" onClick={onClose} aria-label="Close cloud workspace">Close</button></div>
    <p>Neon projects & sign-in · private Vercel files</p>
    {config&&<small>DB: {config.databaseConfigured?'configured':'missing'} · Auth: {config.authConfigured?'configured':'missing'} · Files: {config.storageConfigured?'configured':'token needed'}</small>}
    {message&&<p className="cloud-message" role="status">{message}</p>}
    {!authClient?<p>Set VITE_NEON_AUTH_URL to enable sign-in. Local saving remains available.</p>:!session?.user?<form onSubmit={submit}>
      <h3>{signup?'Create account':'Sign in'}</h3>
      {signup&&<label className="field">Display name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required maxLength={80}/></label>}
      <label className="field">Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label>
      <label className="field">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={signup?'new-password':'current-password'} minLength={signup?8:undefined} required/></label>
      <button className="primary" disabled={busy}>{signup?'Create account':'Sign in'}</button>
      <button type="button" className="text" disabled={busy} onClick={()=>{setSignup(!signup);setPassword('');}}>{signup?'Already registered? Sign in':'Create a new account'}</button>
      <p>New accounts need administrator approval. Passwords go directly to Neon Auth; they are not saved in this app.</p>
    </form>:<>
      <p>Signed in: <strong>{session.user.email}</strong></p>
      {!session.user.emailVerified&&<form onSubmit={verifyCode}>
        <h3>Verify your email</h3><p>Admin access requires a verified email address.</p>
        <button type="button" className="secondary compact" disabled={busy} onClick={()=>run(sendCode)}>Send verification code</button>
        <label className="field">Email verification code<input value={otp} onChange={e=>setOtp(e.target.value)} autoComplete="one-time-code" inputMode="numeric" required maxLength={12}/></label>
        <button className="primary compact" disabled={busy||!otp.trim()}>Verify email</button>
      </form>}
      <div className="row"><button className="secondary compact" disabled={busy} onClick={()=>run(refresh)}>Refresh access</button><button className="text" disabled={busy} onClick={()=>run(async()=>{const r=await authClient.signOut();if(r.error)throw Error(r.error.message);setSession(null);setMember(null);setAssets([]);setMembers([]);setProjects([]);})}>Sign out</button></div>
      {!active&&<p className="cloud-message">{member?.status==='blocked'?'Access is blocked. Contact the administrator.':'Awaiting administrator approval. Verify your email before using the admin account.'}</p>}
      {active&&<>
        <h3>Current project</h3><p>{project.name}{binding?' · linked to cloud':' · local only'}</p>
        <div className="row"><button className="primary compact" disabled={busy||hasPreview} onClick={()=>run(()=>save())}>Save to Neon</button><button className="secondary compact" disabled={busy||hasPreview} onClick={()=>run(()=>save(true))}>Save new copy</button></div>
        <h3>Cloud projects</h3>
        <div className="cloud-list">{projects.map(p=><button key={p.id} disabled={busy} onClick={()=>run(()=>open(p.id))}><strong>{p.name}</strong><small>Revision {p.revision} · {new Date(p.updatedAt).toLocaleString()}</small></button>)}{!projects.length&&<p>No cloud projects yet. Existing local projects are not uploaded automatically.</p>}</div>
        <h3>Private files</h3><p>Reference images, PDFs and render packs. Maximum 25 MB per file.</p>
        <input type="file" ref={fileInput} hidden accept=".png,.jpg,.jpeg,.webp,.pdf,.zip,.json,.txt" onChange={e=>{const file=e.target.files[0];e.target.value='';if(file)run(()=>upload(file));}}/>
        <div className="row"><button className="secondary compact" disabled={busy||!binding||!config?.storageConfigured} onClick={()=>fileInput.current.click()}>Upload file</button>
        <button className="secondary compact" disabled={busy||!binding||!pack||!config?.storageConfigured} onClick={()=>run(()=>upload(new File([pack.zip],'kitchen-render-pack.zip',{type:'application/zip'})))}>Upload prepared render ZIP</button></div>
        {busy&&progress>0&&<p>Upload: {progress}%</p>}
        <div className="cloud-list">{assets.map(a=><button key={a.id} disabled={busy} onClick={()=>run(async()=>{const response=await cloudRequest('asset',{params:{id:a.id},raw:true});download(await response.blob(),a.name);})}>{a.name}<small>{Math.round(a.size/1024)} KB · private</small></button>)}</div>
      </>}
      {member?.admin&&<section className="cloud-admin"><h3>Admin · User approvals</h3><p>Only you can approve or block cloud access. Users register with Neon first.</p>
        {members.filter(m=>m.id!==session.user.id).map(m=><div className="cloud-member" key={m.id}><strong>{m.email}</strong><small>{m.status}</small><div className="row">{['active','blocked'].map(status=><button key={status} disabled={busy||m.status===status} className="secondary compact" onClick={()=>run(async()=>{await cloudRequest('members',{method:'PATCH',body:{id:m.id,status}});setMembers((await cloudRequest('members')).members);})}>{status==='active'?'Approve':'Block'}</button>)}</div></div>)}
      </section>}
    </>}
    {busy&&<p role="status">Working…</p>}
    <small>Device autosave is separate. Cloud saves happen only when you choose Save to Neon.</small>
  </aside>;
}
