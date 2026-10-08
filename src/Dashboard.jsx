import React,{useEffect,useRef,useState} from 'react';
import {Box,Plus,FolderOpen,Copy,Trash2,RotateCcw,Pencil,Upload,Settings2} from 'lucide-react';
import UserMenu from './UserMenu.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import AdminPanel from './AdminPanel.jsx';
import {cloudRequest} from './cloud-client.js';
import {parseProject} from './model.js';
import {cloudDocument,detachedProject,newProject,templateProject,readDrafts,recoverLegacyDrafts,removeDraft,writeDraft} from './project-workspace.js';
import {DEFAULT_STANDARDS,readShopStandards,writeShopStandards} from './standards.js';
import './workspace.css';

function Dialog({title,children,onClose,busy}){
  const ref=useRef();useEffect(()=>{ref.current.showModal();},[]);
  return <dialog className="workspace-dialog" ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="row between"><h2>{title}</h2><button type="button" className="text" disabled={busy} onClick={onClose}>Close</button></div>{children}
  </dialog>;
}
export default function Dashboard({account,onOpen}){
  const [projects,setProjects]=useState([]),[drafts,setDrafts]=useState([]),[tab,setTab]=useState('projects'),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[modal,setModal]=useState(null),[name,setName]=useState(''),[hasMore,setHasMore]=useState(false),[shopStd,setShopStd]=useState(DEFAULT_STANDARDS),[template,setTemplate]=useState('L');
  const importer=useRef(),listGeneration=useRef(0),userId=account.user.id;
  const localRefresh=()=>setDrafts(readDrafts(userId));
  async function refresh(append=false){
    const gen=++listGeneration.current;setLoading(true);
    try{
      const data=await cloudRequest('projects',{params:{trash:String(tab==='trash'),offset:String(append?projects.length:0)}});
      if(gen!==listGeneration.current)return;
      setProjects(old=>append?[...new Map([...old,...data.projects].map(p=>[p.id,p])).values()]:data.projects);setHasMore(data.hasMore);
    }finally{if(gen===listGeneration.current)setLoading(false);}
  }
  async function run(task){setBusy(true);setError('');setNotice('');try{await task();}catch(e){setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{try{recoverLegacyDrafts(account);localRefresh();}catch(e){setError(`Draft recovery: ${e.message}`);}},[]);
  useEffect(()=>{
    setProjects([]);setError('');
    if(tab==='projects'||tab==='trash'){
      cloudRequest('config').then(cfg=>{
        if(!cfg.databaseConfigured){setLoading(false);setNotice('Cloud storage is not set up on this copy — projects stay on this device. Use Drafts on this device, or start a New project.');setTab('drafts');return;}
        return refresh();
      }).catch(e=>setError(e.message));
    }else setLoading(false);
    return()=>{listGeneration.current++;};
  },[tab]);
  function openDocument(document,dirty=false){
    try{writeDraft(userId,document,dirty);}catch(e){if(dirty)throw e;}
    onOpen({document,dirty});
  }
  async function open(row){
    const draft=readDrafts(userId).find(d=>d.id===row.id&&d.dirty);
    if(draft){setModal({type:'recover',row,draft});return;}
    const {project}=await cloudRequest('project',{params:{id:row.id}});openDocument(cloudDocument(project));
  }
  async function create(document){
    try{const {project}=await cloudRequest('project',{method:'POST',body:{document}});openDocument(cloudDocument(project));}
    catch(e){
      // Device-only copy (cloud database not configured): keep working as a local draft.
      if(/not configured|unavailable|503/i.test(e.message)){openDocument(detachedProject(document),true);return;}
      throw e;
    }
  }
  async function action(row,action,name){
    const {project}=await cloudRequest('project',{method:'PATCH',params:{id:row.id},body:{action,name,revision:row.revision}});
    // Keep unsynced local work as a separate recoverable draft, never erase it on trash/rename.
    const draft=readDrafts(userId).find(d=>d.id===row.id);
    if(draft&&!draft.dirty)removeDraft(userId,row.id);
    localRefresh();setModal(null);setNotice(action==='trash'?'Moved to Trash. Project and attachments can be restored.':action==='restore'?'Project restored.':'Project renamed.');await refresh();return project;
  }
  async function importFile(file){if(file.size>2e6)throw Error('Project JSON must be smaller than 2 MB.');const p=detachedProject(parseProject(await file.text()));openDocument(p,true);}
  const rows=projects.filter(p=>`${p.name} ${p.owner||''}`.toLowerCase().includes(search.toLowerCase()));
  const localRows=drafts.filter(d=>(d.dirty||!d.document.cloud)&&d.document.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="workspace">
    <header className="workspace-header"><div className="brand"><span className="brand-icon"><Box size={24}/></span><span>CODEX<span className="brand-light">KITCHEN</span><small>PROJECT WORKSPACE</small></span></div><div className="header-actions"><ThemeToggle/><UserMenu account={account}/></div></header>
    <main className="dashboard">
      <div className="dashboard-heading"><div><p className="eyebrow">BUSINESS TRIAL · PROJECTS FIRST</p><h1>Your kitchen projects</h1><p>Start a new project or continue a saved design.</p></div><div className="row"><button className="secondary" disabled={busy} onClick={()=>{setError('');setShopStd(readShopStandards());setModal({type:'standards'});}}><Settings2 size={17}/>Shop standards</button><button className="secondary" disabled={busy} onClick={()=>importer.current.click()}><Upload size={17}/>Import JSON</button><button className="primary" disabled={busy} onClick={()=>{setName('');setError('');setModal({type:'new'});}}><Plus size={18}/>New project</button></div></div>
      <input ref={importer} type="file" accept=".json,application/json" hidden onChange={e=>{const f=e.target.files[0];e.target.value='';if(f)run(()=>importFile(f));}}/>
      <nav className="workspace-tabs" aria-label="Workspace sections">{[['projects',account.member.admin?'All projects':'My projects'],['drafts','Drafts on this device'],['trash','Trash'],...(account.member.admin?[['admin','Users & activity']]:[])].map(([id,label])=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} disabled={busy} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      {error&&!modal&&<div role="alert" className="workspace-alert">{error}</div>}{notice&&<p role="status" className="workspace-notice">{notice}</p>}
      {tab==='admin'?<section className="dashboard-admin"><AdminPanel/></section>:<>
        <div className="dashboard-toolbar"><label>Find a project<input type="search" placeholder="Search name or operator" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="secondary compact" disabled={busy||loading} onClick={()=>run(async()=>{localRefresh();if(tab!=='drafts')await refresh();})}>Refresh</button></div>
        {tab==='drafts'?<><p className="workspace-help">Drafts stay on this computer under this account. They are not cloud backups. Open one and choose Save project to sync it when cloud storage is available.</p><div className="project-grid">{localRows.map(d=><article className="project-card" key={d.id}><span className="project-status">Saved on this computer</span><h2>{d.document.name}</h2><p>{new Date(d.updatedAt).toLocaleString()}</p><div className="project-actions"><button className="primary" disabled={busy} onClick={()=>run(async()=>openDocument(d.document,true))}>Resume draft</button><button className="secondary" disabled={busy} onClick={()=>run(async()=>{const copy=detachedProject(d.document,`${d.document.name} — copy`.slice(0,100));writeDraft(userId,copy,true);localRefresh();setNotice('Draft duplicated on this computer.');})}><Copy size={15}/>Duplicate</button></div></article>)}</div>{!localRows.length&&<div className="workspace-empty"><h2>No drafts on this device</h2><p>Start one with New project — it will be saved here.</p></div>}</>:<>
          {loading&&<p role="status">Loading projects…</p>}
          <div className="project-grid">{rows.map(p=><article className="project-card" key={p.id}>
            <span className="project-status">{tab==='trash'?'In Trash':'Cloud saved'} · revision {p.revision}</span><h2>{p.name}</h2><p>{p.owner||'Operator'} · {new Date(p.updatedAt).toLocaleString()}</p>
            <div className="project-actions">{tab==='trash'?<button className="primary" disabled={busy} onClick={()=>run(()=>action(p,'restore'))}><RotateCcw size={16}/>Restore</button>:<>
              <button className="primary" disabled={busy} onClick={()=>run(()=>open(p))}><FolderOpen size={16}/>Open design</button>
              <button className="secondary" disabled={busy} onClick={()=>{setName(p.name);setError('');setModal({type:'rename',row:p});}}><Pencil size={15}/>Rename</button>
              <button className="secondary" disabled={busy} onClick={()=>{setName(`${p.name} — copy`.slice(0,100));setError('');setModal({type:'duplicate',row:p});}}><Copy size={15}/>Duplicate</button>
              <button className="text danger" disabled={busy} onClick={()=>{setError('');setModal({type:'trash',row:p});}}><Trash2 size={15}/>Move to Trash</button>
            </>}</div></article>)}</div>
          {!loading&&!rows.length&&<div className="workspace-empty"><FolderOpen size={36}/><h2>{search?'No matching projects':tab==='trash'?'Trash is empty':'No cloud projects yet'}</h2><p>{tab==='trash'?'Deleted projects will remain recoverable here.':'Choose New project or import an existing project JSON.'}</p></div>}
          {hasMore&&<button className="secondary" disabled={busy||loading} onClick={()=>run(()=>refresh(true))}>Load more projects</button>}
        </>}
      </>}
      <p className="workspace-footnote">Parallel business trial · Check dimensions, construction and quotations before issuing work to production.</p>
    </main>
    {modal&&<Dialog title={{new:'New kitchen project',rename:'Rename project',duplicate:'Duplicate project',trash:'Move project to Trash?',recover:'Unsynced work found',standards:'Shop standards'}[modal.type]} busy={busy} onClose={()=>{setModal(null);setError('');}}>
      {error&&<p role="alert" className="workspace-alert">{error}</p>}
      {modal.type==='standards'?<form onSubmit={e=>{e.preventDefault();run(async()=>{writeShopStandards(shopStd);setModal(null);setNotice('Shop standards saved. New projects will start at these heights.');});}}><p>Heights used for every new project, so the app matches the workshop. Existing projects keep their measurements until you reset a cabinet.</p><div className="two"><label className="field">Base cabinet height (mm)<input type="number" min="600" max="900" step="5" value={shopStd.baseH} onChange={e=>setShopStd({...shopStd,baseH:Number(e.target.value)})}/></label><label className="field">Wall cabinet height (mm)<input type="number" min="200" max="1200" step="5" value={shopStd.wallH} onChange={e=>setShopStd({...shopStd,wallH:Number(e.target.value)})}/></label></div><p className="small">Base row: base, sink, cooker, drawers, corner and fillers. Wall row: wall, glass and upper corner. Tall and appliance towers keep their own heights.</p><div className="row"><button type="button" className="secondary compact" onClick={()=>setShopStd({...shopStd,baseH:870})}>Use 870 mm base (workshop standard)</button><button type="button" className="secondary compact" onClick={()=>setShopStd(DEFAULT_STANDARDS)}>Use app defaults</button></div><button className="primary" disabled={busy}>Save standards</button></form>:modal.type==='trash'?<><p>“{modal.row.name}” and its attachments will be hidden from active projects. You can restore them from Trash.</p><button className="primary" disabled={busy} onClick={()=>run(()=>action(modal.row,'trash'))}>Move to Trash</button></>:modal.type==='recover'?<><p>This browser has changes that are not saved to the cloud.</p><div className="project-actions"><button className="primary" disabled={busy} onClick={()=>run(async()=>openDocument(modal.draft.document,true))}>Resume local changes</button><button className="secondary" disabled={busy} onClick={()=>run(async()=>{const {project}=await cloudRequest('project',{params:{id:modal.row.id}});const backup=detachedProject(modal.draft.document,`${modal.draft.document.name} — recovered`);writeDraft(userId,backup,true);openDocument(cloudDocument(project));})}>Open cloud; keep recovery copy</button></div></>:<form onSubmit={e=>{e.preventDefault();run(async()=>{
        if(modal.type==='rename')await action(modal.row,'rename',name);
        else if(modal.type==='duplicate'){const {project}=await cloudRequest('project',{params:{id:modal.row.id}});await create(detachedProject(project.document,name));}
        else await create(templateProject(name,template));
      });}}><label className="field">Project name<input autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Silva residence · kitchen"/></label>{modal.type==='new'&&<label className="field">Starting point<select value={template} onChange={e=>setTemplate(e.target.value)}><option value="L">L-shaped kitchen (standard)</option><option value="U">U-shaped kitchen</option><option value="GALLEY">Galley kitchen</option><option value="I">Straight run (one wall)</option></select></label>}<p>{modal.type==='new'?'A new project opens at Room setup. With cloud storage it saves to your account; otherwise it is saved on this computer. Add the actual site openings and measurements.':modal.type==='duplicate'?'Creates a new project owned by you. Attachments stay with the original.':''}</p><button className="primary" disabled={busy||!name.trim()}>{busy?'Saving…':modal.type==='rename'?'Save name':'Create & open'}</button></form>}
    </Dialog>}
  </div>;
}
