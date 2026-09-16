import React,{useEffect,useState} from 'react';
import {cloudRequest} from './cloud-client.js';
const empty={username:'',name:'',email:'',password:'',status:'active',requireEmailVerification:false};
export default function AdminPanel(){
  const [members,setMembers]=useState([]),[activity,setActivity]=useState([]),[mail,setMail]=useState(false),[form,setForm]=useState(empty),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const field=(key,value)=>setForm(s=>({...s,[key]:value}));
  async function refresh(){const [users,events]=await Promise.all([cloudRequest('members'),cloudRequest('activity')]);setMembers(users.members);setActivity(events.activities);setMail(events.mailConfigured);}
  async function run(task){setBusy(true);setMessage('');try{await task();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
  useEffect(()=>{run(refresh);},[]);
  return <section className="cloud-admin"><h3>Super-admin · Staff & activity</h3><p>You can manage staff and open/edit every saved cloud project in the project list above.</p>
    <button className="secondary compact" disabled={busy} onClick={()=>run(refresh)}>Refresh activity</button>
    {message&&<p role="status" className="cloud-message">{message}</p>}
    <div className="cloud-list">{members.map(m=><button key={m.id} onClick={()=>setForm({...m,email:m.requireEmailVerification?m.email:'',password:''})}><strong>{m.username||m.email}</strong><small>{m.name} · {m.status} · {m.requireEmailVerification?'email verification on':'username only'}</small></button>)}</div>
    <h3>{form.id?'Edit staff account':'Create staff account'}</h3>
    <form onSubmit={e=>{e.preventDefault();run(async()=>{await cloudRequest('staff',{method:form.id?'PATCH':'POST',body:form});setForm(empty);await refresh();setMessage('Staff account saved.');});}}>
      <label className="field">Username<input required value={form.username||''} onChange={e=>field('username',e.target.value)} autoComplete="off" minLength={3} maxLength={40}/></label>
      <label className="field">Name<input value={form.name} onChange={e=>field('name',e.target.value)} maxLength={80}/></label>
      <label className="field">{form.id?'New password (leave blank to keep)':'Password'}<input type="password" required={!form.id} minLength={8} maxLength={128} value={form.password} onChange={e=>field('password',e.target.value)} autoComplete="new-password"/></label>
      <label className="field">Access<select value={form.status} onChange={e=>field('status',e.target.value)}><option value="active">Active</option><option value="blocked">Disabled</option><option value="pending">Pending</option></select></label>
      <label className="row"><input type="checkbox" checked={form.requireEmailVerification} onChange={e=>field('requireEmailVerification',e.target.checked)}/>Require email verification</label>
      {form.requireEmailVerification&&<label className="field">Staff email<input type="email" required value={form.email} onChange={e=>field('email',e.target.value)}/></label>}
      <div className="row"><button className="primary compact" disabled={busy}>Save staff account</button><button type="button" className="secondary compact" onClick={()=>setForm(empty)}>New account</button></div>
    </form>
    <h3>Operator activity</h3><p>{mail?'Email sender configured.':'Email sender not connected. Login alerts remain pending; activity is recorded below.'}</p>
    <button className="secondary compact" disabled={busy||!mail} onClick={()=>run(async()=>{const r=await cloudRequest('activity',{method:'POST',body:{}});await refresh();setMessage(`${r.sent} pending alerts sent.`);})}>Send pending login alerts</button>
    <div className="cloud-list">{activity.map(a=><div className="cloud-member" key={a.id}><strong>{a.username} · {a.action.replaceAll('_',' ')}</strong><small>{new Date(a.createdAt).toLocaleString()} · {a.target||''}{a.action==='login'?` · email ${a.status}`:''}</small></div>)}</div>
  </section>;
}
