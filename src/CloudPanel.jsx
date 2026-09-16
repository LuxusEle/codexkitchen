import React,{useEffect,useRef,useState} from 'react';
import {cloudRequest,uploadProjectFile} from './cloud-client.js';
import {download} from './exports.js';
import './cloud.css';
export default function CloudPanel({project,onClose,pack}){
  const [assets,setAssets]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[config,setConfig]=useState(null),[progress,setProgress]=useState(0);
  const fileInput=useRef(),binding=project.cloud;
  async function run(task){setBusy(true);setMessage('');try{await task();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
  useEffect(()=>{run(async()=>{setConfig(await(await fetch('/api/cloud?op=config')).json());if(binding?.id)setAssets((await cloudRequest('assets',{params:{projectId:binding.id}})).assets);});},[binding?.id]);
  async function upload(file){setProgress(0);await uploadProjectFile(binding.id,file,v=>setProgress(Math.round(v.percentage)));setAssets((await cloudRequest('assets',{params:{projectId:binding.id}})).assets);setMessage('Private file uploaded.');}
  return <aside className="cloud-panel" aria-label="Project files"><div className="row between"><h2>Project files</h2><button className="text" onClick={onClose}>Close</button></div><h3>{project.name}</h3>
    {!binding&&<p>Save project to the cloud before attaching files.</p>}
    <p>Private images, PDFs and render ZIPs. Maximum 25 MB per file.</p>
    {message&&<p role="status" className="cloud-message">{message}</p>}
    <input type="file" ref={fileInput} hidden accept=".png,.jpg,.jpeg,.webp,.pdf,.zip,.json,.txt" onChange={e=>{const f=e.target.files[0];e.target.value='';if(f)run(()=>upload(f));}}/>
    <div className="row"><button className="secondary compact" disabled={busy||!binding||!config?.storageConfigured} onClick={()=>fileInput.current.click()}>Upload file</button><button className="secondary compact" disabled={busy||!binding||!pack||!config?.storageConfigured} onClick={()=>run(()=>upload(new File([pack.zip],'kitchen-render-pack.zip',{type:'application/zip'})))}>Upload render ZIP</button></div>
    {busy&&<p role="status">Working… {progress>0?progress+'%':''}</p>}
    <div className="cloud-list">{assets.map(a=><button key={a.id} disabled={busy} onClick={()=>run(async()=>{const r=await cloudRequest('asset',{params:{id:a.id},raw:true});download(await r.blob(),a.name);})}>{a.name}<small>{Math.round(a.size/1024)} KB · private</small></button>)}</div>
  </aside>;
}
