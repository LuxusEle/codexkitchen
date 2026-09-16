import React,{useEffect,useState} from 'react';
import {Building2,Coins,UserPlus} from 'lucide-react';
import {cloudRequest} from './cloud-client.js';
import BusinessAdmin from './BusinessAdmin.jsx';

const companies=[['luxus','Luxus Elemente'],['devonly','Devonly Holdings']];
const empty={username:'',name:'',email:'',password:'',status:'active',requireEmailVerification:false,businessId:'luxus',monthlyTarget:0,barTokens:0};

export default function AdminPanel({onOpenProject}){
  const [members,setMembers]=useState([]),[activity,setActivity]=useState([]),[mail,setMail]=useState(false),[form,setForm]=useState(empty),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const field=(key,value)=>setForm(s=>({...s,[key]:value}));
  async function refresh(){const [users,events]=await Promise.all([cloudRequest('members'),cloudRequest('activity')]);setMembers(users.members);setActivity(events.activities);setMail(events.mailConfigured);}
  async function run(task){setBusy(true);setMessage('');try{await task();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
  useEffect(()=>{run(refresh);},[]);
  const choose=m=>setForm({...m,email:m.requireEmailVerification?m.email:'',password:'',barTokens:m.barTokens??0});
  return <section className="cloud-admin admin-control-grid">
    <BusinessAdmin onOpenProject={onOpenProject}/>
    <section className="admin-card staff-control">
      <div className="admin-section-heading"><div><p className="eyebrow">PEOPLE & ACCESS</p><h2>Users by company</h2></div><button className="primary compact" onClick={()=>setForm(empty)}><UserPlus size={15}/>New operator</button></div>
      <p>Operators see only their own projects inside their assigned company. You retain access to both companies and every project.</p>
      <button className="secondary compact" disabled={busy} onClick={()=>run(refresh)}>Refresh users & activity</button>
      {message&&<p role="status" className="cloud-message">{message}</p>}
      <div className="company-user-grid">{companies.map(([id,name])=><section className="company-user-card" key={id}>
        <h3><Building2 size={16}/>{name}</h3>
        <div className="company-users">{members.filter(m=>m.businessId===id).map(m=><button key={m.id} className={form.id===m.id?'selected':''} onClick={()=>choose(m)}><strong>{m.username||m.email}</strong><small>{m.name||'No display name'} · {m.status}</small><span><Coins size={13}/>{m.barTokens??0} bar tokens · target {m.monthlyTarget||0}</span></button>)}</div>
        {!members.some(m=>m.businessId===id)&&<p className="muted">No operators assigned.</p>}
      </section>)}</div>
    </section>
    <section className="admin-card staff-editor">
      <p className="eyebrow">{form.id?'EDIT OPERATOR':'CREATE OPERATOR'}</p><h2>{form.id?'Account controls':'New staff account'}</h2>
      <form onSubmit={e=>{e.preventDefault();run(async()=>{await cloudRequest('staff',{method:form.id?'PATCH':'POST',body:form});setForm(empty);await refresh();setMessage('Staff account saved.');});}}>
        <label className="field">Username<input required value={form.username||''} onChange={e=>field('username',e.target.value)} autoComplete="off" minLength={3} maxLength={40}/></label>
        <label className="field">Name<input value={form.name} onChange={e=>field('name',e.target.value)} maxLength={80}/></label>
        <label className="field">Assigned business<select value={form.businessId||'luxus'} onChange={e=>field('businessId',e.target.value)}>{companies.map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>
        <div className="business-fields"><label className="field">Monthly approved-project target<input type="number" min="0" max="10000" required value={form.monthlyTarget??0} onChange={e=>field('monthlyTarget',Number(e.target.value))}/></label><label className="field">Bar tokens<input type="number" min="0" max="1000000" step="1" required value={form.barTokens??0} onChange={e=>field('barTokens',Number(e.target.value))}/><small>1 token = 1 full stock bar. Allocation is tracked; project saves do not consume tokens automatically.</small></label></div>
        <p>Reassignment does not transfer existing projects. Only the owner retains access to projects in the previous business.</p>
        <label className="field">{form.id?'New password (leave blank to keep)':'Password'}<input type="password" required={!form.id} minLength={8} maxLength={128} value={form.password} onChange={e=>field('password',e.target.value)} autoComplete="new-password"/></label>
        <label className="field">Access<select value={form.status} onChange={e=>field('status',e.target.value)}><option value="active">Active</option><option value="blocked">Disabled</option><option value="pending">Pending</option></select></label>
        <label className="row"><input type="checkbox" checked={form.requireEmailVerification} onChange={e=>field('requireEmailVerification',e.target.checked)}/>Require email verification</label>
        {form.requireEmailVerification&&<label className="field">Staff email<input type="email" required value={form.email} onChange={e=>field('email',e.target.value)}/></label>}
        <div className="row"><button className="primary compact" disabled={busy}>Save staff account</button><button type="button" className="secondary compact" onClick={()=>setForm(empty)}>Clear</button></div>
      </form>
    </section>
    <section className="admin-card activity-ledger">
      <p className="eyebrow">AUDIT TRAIL</p><h2>Operator activity</h2><p>{mail?'Email sender configured.':'Email sender not connected. Login alerts remain pending; activity is still recorded here.'}</p>
      <button className="secondary compact" disabled={busy||!mail} onClick={()=>run(async()=>{const r=await cloudRequest('activity',{method:'POST',body:{}});await refresh();setMessage(`${r.sent} pending alerts sent.`);})}>Send pending login alerts</button>
      <div className="activity-list">{activity.map(a=><div className="cloud-member" key={a.id}><strong>{a.username} · {a.action.replaceAll('_',' ')}</strong><small>{new Date(a.createdAt).toLocaleString()} · {a.target||''}{a.action==='login'?` · email ${a.status}`:''}</small></div>)}</div>
    </section>
  </section>;
}
