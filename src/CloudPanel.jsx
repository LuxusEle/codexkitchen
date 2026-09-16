import React,{useEffect,useRef,useState} from 'react';
import {authClient,cloudRequest,uploadProjectFile} from './cloud-client.js';
import {parseProject} from './model.js';
import {download} from './exports.js';
import AdminPanel from './AdminPanel.jsx';
import './cloud.css';

export default function CloudPanel({project,onProject,onClose,pack,hasPreview}){
  const [account,setAccount]=useState(null),[projects,setProjects]=useState([]),[assets,setAssets]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[config,setConfig]=useState(null),[progress,setProgress]=useState(0);
  const fileInput=useRef(),current=useRef(project);current.current=project;
  const binding=account&&(account.member.admin||project.cloud?.ownerId===account.user.id)?project.cloud:null;
  async function listCloud(){setProjects((await cloudRequest('projects')).projects);}
  async function run(task){setBusy(true);setMessage('');try{await task();}catch(error){setMessage(error.message);}finally{setBusy(false);}}
  useEffect(()=>{run(async()=>{setAccount(await cloudRequest('me'));setConfig(await(await fetch('/api/cloud?op=config')).json());await listCloud();});},[]);
  useEffect(()=>{setAssets([]);if(binding?.id)cloudRequest('assets',{params:{projectId:binding.id}}).then(v=>setAssets(v.assets)).catch(e=>setMessage(e.message));},[binding?.id]);
  async function save(copy=false){
    if(hasPreview)throw Error('OK or Cancel the design preview before saving.');
    const snapshot=structuredClone(current.current),existing=!copy?binding:null;
    const {project:saved}=await cloudRequest('project',{method:existing?'PUT':'POST',params:existing?{id:existing.id}:{},body:{document:snapshot,revision:existing?.revision}});
    const unchanged=current.current===project;
    if(unchanged)onProject({...snapshot,cloud:{id:saved.id,ownerId:saved.ownerId,revision:saved.revision}});
    await listCloud();setMessage(unchanged?'Saved to Neon. Your administrator can view and edit this project.':'Snapshot saved. You edited meanwhile; open the saved cloud copy before updating it.');
  }
  async function open(id){
    if(hasPreview)throw Error('OK or Cancel the design preview first.');
    if(!window.confirm('Open this cloud project? Save any local changes first.'))return;
    const {project:saved}=await cloudRequest('project',{params:{id}});
    onProject({...parseProject(JSON.stringify(saved.document)),cloud:{id:saved.id,ownerId:saved.ownerId,revision:saved.revision}});setMessage('Cloud project opened.');
  }
  async function upload(file){
    if(!binding)throw Error('Save to Neon before attaching files.');
    setProgress(0);await uploadProjectFile(binding.id,file,value=>setProgress(Math.round(value.percentage)));
    setAssets((await cloudRequest('assets',{params:{projectId:binding.id}})).assets);setMessage('File uploaded to private storage.');
  }
  return <aside className="cloud-panel" aria-label={account?.member.admin?'Super-admin workspace':'Cloud workspace'}>
    <div className="row between"><h2>{account?.member.admin?'Super-admin workspace':'My cloud workspace'}</h2><button className="text" onClick={onClose}>Close</button></div>
    <p>Signed in: <strong>{account?.member.username||'Loading…'}</strong></p>
    <button className="secondary compact" disabled={busy} onClick={()=>run(async()=>{const r=await authClient.signOut();if(r.error)throw Error(r.error.message);window.dispatchEvent(new Event('kitchen-auth-change'));})}>Sign out</button>
    {message&&<p role="status" className="cloud-message">{message}</p>}
    <h3>Current project</h3><p>{project.name} · {binding?'cloud-linked':'local draft'}</p>
    <div className="row"><button className="primary compact" disabled={busy||hasPreview||!account} onClick={()=>run(()=>save())}>Save to Neon</button><button className="secondary compact" disabled={busy||hasPreview||!account} onClick={()=>run(()=>save(true))}>Save new copy</button></div>
    <h3>{account?.member.admin?'All operator projects':'My projects'}</h3><button className="text" disabled={busy} onClick={()=>run(listCloud)}>Refresh projects</button>
    <div className="cloud-list">{projects.map(p=><button key={p.id} disabled={busy} onClick={()=>run(()=>open(p.id))}><strong>{p.name}</strong><small>{p.owner||'Staff'} · revision {p.revision} · {new Date(p.updatedAt).toLocaleString()}</small></button>)}{!projects.length&&<p>No saved cloud projects.</p>}</div>
    <h3>Private files</h3><p>Images, PDFs and render ZIPs. Maximum 25 MB per file.</p>
    <input type="file" ref={fileInput} hidden accept=".png,.jpg,.jpeg,.webp,.pdf,.zip,.json,.txt" onChange={e=>{const file=e.target.files[0];e.target.value='';if(file)run(()=>upload(file));}}/>
    <div className="row"><button className="secondary compact" disabled={busy||!binding||!config?.storageConfigured} onClick={()=>fileInput.current.click()}>Upload file</button><button className="secondary compact" disabled={busy||!binding||!pack||!config?.storageConfigured} onClick={()=>run(()=>upload(new File([pack.zip],'kitchen-render-pack.zip',{type:'application/zip'})))}>Upload render ZIP</button></div>
    {busy&&progress>0&&<p>Upload: {progress}%</p>}
    <div className="cloud-list">{assets.map(a=><button key={a.id} disabled={busy} onClick={()=>run(async()=>{const response=await cloudRequest('asset',{params:{id:a.id},raw:true});download(await response.blob(),a.name);})}>{a.name}<small>{Math.round(a.size/1024)} KB · private</small></button>)}</div>
    {account?.member.admin&&<AdminPanel/>}
    {busy&&<p role="status">Working…</p>}
    <small>Local drafts stay on this browser. Save to Neon to share work with your administrator.</small>
  </aside>;
}
