import React,{useEffect,useRef,useState} from 'react';
import {Plus,FolderOpen,Copy,Trash2,RotateCcw,Pencil,Upload,Search,HardDrive,Users,ArrowUpRight,ArrowRight,Layers,ShieldCheck} from 'lucide-react';
import UserMenu from './UserMenu.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import AdminPanel from './AdminPanel.jsx';
import {cloudRequest} from './cloud-client.js';
import {parseProject} from './model.js';
import {cloudDocument,detachedProject,newProject,readDrafts,recoverLegacyDrafts,removeDraft,writeDraft} from './project-workspace.js';
import './workspace.css';
import StudioBrand from './StudioBrand.jsx';
import KitchenArtwork from './KitchenArtwork.jsx';

function Dialog({title,children,onClose,busy}){
  const ref=useRef();useEffect(()=>{ref.current.showModal();},[]);
  return <dialog className="workspace-dialog" ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="row between"><h2>{title}</h2><button type="button" className="text" disabled={busy} onClick={onClose}>Close</button></div>{children}
  </dialog>;
}
export default function Dashboard({account,onOpen}){
  const [projects,setProjects]=useState([]),[drafts,setDrafts]=useState([]),[tab,setTab]=useState('projects'),[search,setSearch]=useState(''),[sort,setSort]=useState('recent'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[modal,setModal]=useState(null),[name,setName]=useState(''),[hasMore,setHasMore]=useState(false);
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
  useEffect(()=>{setProjects([]);setError('');if(tab==='projects'||tab==='trash')refresh().catch(e=>setError(e.message));else setLoading(false);return()=>{listGeneration.current++;};},[tab]);
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
    const {project}=await cloudRequest('project',{method:'POST',body:{document}});openDocument(cloudDocument(project));
  }
  async function action(row,action,name){
    const {project}=await cloudRequest('project',{method:'PATCH',params:{id:row.id},body:{action,name,revision:row.revision}});
    // Keep unsynced local work as a separate recoverable draft, never erase it on trash/rename.
    const draft=readDrafts(userId).find(d=>d.id===row.id);
    if(draft&&!draft.dirty)removeDraft(userId,row.id);
    localRefresh();setModal(null);setNotice(action==='trash'?'Moved to Trash. Project and attachments can be restored.':action==='restore'?'Project restored.':'Project renamed.');await refresh();return project;
  }
  async function importFile(file){if(file.size>2e6)throw Error('Project JSON must be smaller than 2 MB.');const p=detachedProject(parseProject(await file.text()));openDocument(p,true);}
  const unsynced=drafts.filter(d=>d.dirty||!d.document.cloud);
  const sections=[['projects',account.member.admin?'All projects':'My projects',FolderOpen],['drafts','Local recovery',HardDrive],['trash','Trash',Trash2],...(account.member.admin?[['admin','Users & activity',Users]]:[])];
  const rows=projects.filter(p=>`${p.name} ${p.owner||''}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):new Date(b.updatedAt)-new Date(a.updatedAt));
  const localRows=drafts.filter(d=>(d.dirty||!d.document.cloud)&&d.document.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="studio-shell">
    <aside className="studio-sidebar">
      <StudioBrand/>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="studio-nav" aria-label="Workspace sections">{sections.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} disabled={busy} onClick={()=>setTab(id)}><Icon size={19}/><span>{label}</span>{id==='drafts'&&unsynced.length>0&&<b>{unsynced.length}</b>}</button>)}</nav>
      <div className="studio-sidebar-note"><span className="sidebar-note-icon"><Layers size={20}/></span><strong>From idea to installation.</strong><p>One workspace for your layouts, estimates and fabrication review.</p><span className="studio-trial"><span/>Business trial</span></div>
      <div className="sidebar-foot"><ShieldCheck size={15}/>Staff workspace</div>
    </aside>
    <div className="studio-main">
      <header className="studio-topbar"><div className="studio-breadcrumb">Workspace <span>/</span> <strong>{sections.find(s=>s[0]===tab)?.[1]}</strong></div><div className="header-actions"><ThemeToggle/><UserMenu account={account}/></div></header>
      <main className="dashboard">
        <div className="dashboard-heading"><div><p className="eyebrow">YOUR DESIGN WORKSPACE</p><h1>{tab==='drafts'?'Pick up where you left off.':tab==='trash'?'A little room to recover.':tab==='admin'?'Your team, together.':'Good design starts here.'}</h1><p>{tab==='projects'?'Bring your next kitchen from a first idea to a finished plan.':tab==='drafts'?'Continue changes saved on this browser.':tab==='trash'?'Restore a project whenever you need it.':'Manage staff access and workspace activity.'}</p></div><button className="primary" disabled={busy} onClick={()=>{setName('');setError('');setModal({type:'new'});}}><Plus size={18}/>New project</button></div>
        <input ref={importer} type="file" accept=".json,application/json" hidden onChange={e=>{const f=e.target.files[0];e.target.value='';if(f)run(()=>importFile(f));}}/>
        {tab==='projects'&&<section className="studio-hero" aria-label="Start a kitchen design"><div className="studio-hero-copy"><span className="hero-label"><span/>MADE FOR YOUR NEXT BIG IDEA</span><h2>A space to create.<br/>A kitchen to remember.</h2><p>Plan the room. Shape the details.<br/>Bring everything together in 3D.</p><button className="hero-link" disabled={busy} onClick={()=>{setName('');setError('');setModal({type:'new'});}}>Start a new design<ArrowUpRight size={19}/></button></div><KitchenArtwork/><div className="hero-material"><span className="material-dot"/><div>Thoughtfully built.<small>Aluminum kitchen design</small></div></div></section>}
        {error&&!modal&&<div role="alert" className="workspace-alert">{error}</div>}{notice&&<p role="status" className="workspace-notice">{notice}</p>}
        {tab==='admin'?<section className="dashboard-admin"><AdminPanel/></section>:<>
          <div className="project-section-heading"><div><h2>{tab==='projects'?'Your projects':tab==='drafts'?'Local recovery':'Recently removed'}<span className="project-count">{tab==='drafts'?localRows.length:rows.length}{hasMore&&tab!=='drafts'?'+':''}</span></h2><p>{tab==='projects'?'Your next great space is taking shape.':tab==='drafts'?'Unsynced copies from this browser.':'Projects and attachments can be restored.'}</p></div><button className="text" disabled={busy} onClick={()=>importer.current.click()}><Upload size={16}/>Import project</button></div>
          <div className="dashboard-toolbar"><label className="studio-search"><Search size={18}/><span className="sr-only">Find a project</span><input type="search" placeholder="Search projects…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="toolbar-end">{tab!=='drafts'&&<label className="studio-sort"><span className="sr-only">Sort projects</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Recently updated</option><option value="name">Name A–Z</option></select></label>}<button className="secondary compact" aria-label="Refresh projects" disabled={busy||loading} onClick={()=>run(async()=>{localRefresh();if(tab!=='drafts')await refresh();})}><RotateCcw size={16}/></button></div></div>
          {tab==='drafts'?<><p className="workspace-help">Recovery copies belong to this account on this browser. Open one and choose Save project to sync it to the cloud.</p><div className="project-grid">{localRows.map(d=><article className="project-card" key={d.id}><div className="project-card-mark draft"><HardDrive size={25}/><span>LOCAL DRAFT</span></div><div className="project-card-content"><span className="project-status"><span/>Unsynced · this browser</span><h2>{d.document.name}</h2><p>{new Date(d.updatedAt).toLocaleString()}</p><button className="primary" disabled={busy} onClick={()=>run(async()=>openDocument(d.document,true))}>Resume draft<ArrowRight size={16}/></button></div></article>)}</div>{!localRows.length&&<div className="workspace-empty"><HardDrive size={32}/><h2>{search?'No matching drafts':'Everything is up to date'}</h2><p>Unsynced local recovery copies will appear here.</p></div>}</>:<>
            {loading&&<div className="project-loading" role="status"><span className="loading-dot"/>Loading your projects…</div>}
            <div className="project-grid">{rows.map(p=><article className="project-card" key={p.id}>
              <div className="project-card-mark"><Layers size={30} strokeWidth={1.3}/><span>KITCHEN PROJECT</span><span className="project-revision">r{p.revision}</span></div>
              <div className="project-card-content"><span className="project-status"><span/>{tab==='trash'?'In Trash':'Cloud saved'}</span><h2>{p.name}</h2><p className="project-meta">{p.owner||'Operator'}<span>Updated {new Date(p.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span></p>
              <div className="project-actions">{tab==='trash'?<button className="primary" disabled={busy} onClick={()=>run(()=>action(p,'restore'))}><RotateCcw size={16}/>Restore project</button>:<>
                <button className="project-open" disabled={busy} onClick={()=>run(()=>open(p))}>Open design<ArrowUpRight size={17}/></button>
                <div className="project-tools"><button className="icon" aria-label={`Rename ${p.name}`} title="Rename project" disabled={busy} onClick={()=>{setName(p.name);setError('');setModal({type:'rename',row:p});}}><Pencil size={15}/></button><button className="icon" aria-label={`Duplicate ${p.name}`} title="Duplicate project" disabled={busy} onClick={()=>{setName(`${p.name} — copy`.slice(0,100));setError('');setModal({type:'duplicate',row:p});}}><Copy size={15}/></button><button className="icon danger" aria-label={`Move ${p.name} to Trash`} title="Move to Trash" disabled={busy} onClick={()=>{setError('');setModal({type:'trash',row:p});}}><Trash2 size={15}/></button></div>
              </>}</div></div></article>)}</div>
            {!loading&&!rows.length&&<div className="workspace-empty"><FolderOpen size={36}/><h2>{search?'No matching projects':tab==='trash'?'Trash is empty':'Your first kitchen starts here'}</h2><p>{search?'Try a different project name or operator.':tab==='trash'?'Removed projects will remain recoverable here.':'Create a project or import an existing kitchen design.'}</p>{!search&&tab==='projects'&&<button className="primary" disabled={busy} onClick={()=>{setName('');setError('');setModal({type:'new'});}}><Plus size={17}/>Create your first project</button>}</div>}
            {hasMore&&<button className="secondary" disabled={busy||loading} onClick={()=>run(()=>refresh(true))}>Load more projects</button>}
          </>}
        </>}
        <div className="workspace-footnote"><ShieldCheck size={15}/><span>Check dimensions, construction and quotations before production.</span><span className="studio-version">CODEX KITCHEN · BUSINESS TRIAL</span></div>
      </main>
    </div>
    {modal&&<Dialog title={{new:'New kitchen project',rename:'Rename project',duplicate:'Duplicate project',trash:'Move project to Trash?',recover:'Unsynced work found'}[modal.type]} busy={busy} onClose={()=>{setModal(null);setError('');}}>
      {error&&<p role="alert" className="workspace-alert">{error}</p>}
      {modal.type==='trash'?<><p>“{modal.row.name}” and its attachments will be hidden from active projects. You can restore them from Trash.</p><button className="primary" disabled={busy} onClick={()=>run(()=>action(modal.row,'trash'))}>Move to Trash</button></>:modal.type==='recover'?<><p>This browser has changes that are not saved to the cloud.</p><div className="project-actions"><button className="primary" disabled={busy} onClick={()=>run(async()=>openDocument(modal.draft.document,true))}>Resume local changes</button><button className="secondary" disabled={busy} onClick={()=>run(async()=>{const {project}=await cloudRequest('project',{params:{id:modal.row.id}});const backup=detachedProject(modal.draft.document,`${modal.draft.document.name} — recovered`);writeDraft(userId,backup,true);openDocument(cloudDocument(project));})}>Open cloud; keep recovery copy</button></div></>:<form onSubmit={e=>{e.preventDefault();run(async()=>{
        if(modal.type==='rename')await action(modal.row,'rename',name);
        else if(modal.type==='duplicate'){const {project}=await cloudRequest('project',{params:{id:modal.row.id}});await create(detachedProject(project.document,name));}
        else await create(newProject(name));
      });}}><label className="field">Project name<input autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Silva residence · kitchen"/></label><p>{modal.type==='new'?'A new cloud project opens at Room setup. Add the actual site openings and measurements.':modal.type==='duplicate'?'Creates a new project owned by you. Attachments stay with the original.':''}</p><button className="primary" disabled={busy||!name.trim()}>{busy?'Saving…':modal.type==='rename'?'Save name':'Create & open'}</button></form>}
    </Dialog>}
  </div>;
}
