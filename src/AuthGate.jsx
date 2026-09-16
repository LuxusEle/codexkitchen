import React,{useEffect,useState} from 'react';
import {authClient,cloudRequest} from './cloud-client.js';
import './cloud.css';
export default function AuthGate({children}){
  const [account,setAccount]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
  async function refresh(){
    try{const result=await authClient.getSession();if(result.error)throw Error(result.error.message||'Sign-in service unavailable.');
      if(!result.data?.user){setAccount(null);return;}
      setAccount(await cloudRequest('me'));
    }catch(error){setAccount(null);setMessage(error.message);}finally{setLoading(false);}
  }
  useEffect(()=>{refresh();const timer=setInterval(refresh,30000);window.addEventListener('kitchen-auth-change',refresh);return()=>{clearInterval(timer);window.removeEventListener('kitchen-auth-change',refresh);};},[]);
  async function run(task){setBusy(true);setMessage('');try{await task();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
  const needsVerification=account?.member.requireEmailVerification&&!account.user.emailVerified;
  const allowed=account&&(account.member.admin||account.member.status==='active')&&!needsVerification;
  if(allowed)return children(account);
  return <main className="login-screen"><section className="login-card"><p className="eyebrow">CODEXKITCHEN · STAFF WORKSPACE</p><h1>Sign in to your kitchen studio</h1>
    <p>The editor is available only to authorised staff. Your administrator manages usernames and access.</p>
    {message&&<p role="alert" className="cloud-message">{message}</p>}
    {loading?<p>Checking your session…</p>:account?<>
      <p>{needsVerification?'Email verification is required for your account.':account.member.status==='blocked'?'This account is disabled. Contact asanke1.':'Your account is awaiting approval.'}</p>
      {needsVerification&&<form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await authClient.emailOtp.verifyEmail({email:account.user.email,otp});if(r.error)throw Error(r.error.message);setOtp('');await refresh();});}}>
        <button type="button" disabled={busy} onClick={()=>run(async()=>{const r=await authClient.emailOtp.sendVerificationOtp({email:account.user.email,type:'email-verification'});if(r.error)throw Error(r.error.message);setMessage('Code sent. Check your inbox.');})}>Send verification code</button>
        <label className="field">Email code<input required value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={12}/></label><button className="primary" disabled={busy}>Verify email</button>
      </form>}
      <button className="secondary" disabled={busy} onClick={()=>run(async()=>{await authClient.signOut();setAccount(null);})}>Sign out</button>
    </>:<form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await authClient.signIn.email({email:username.trim(),password});setPassword('');if(r.error)throw Error(r.error.message||'Sign in failed.');await refresh();});}}>
      <label className="field">Username<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required maxLength={254}/></label>
      <label className="field">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required maxLength={128}/></label>
      <button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form>}
    <small>Staff sign-in and saved-project activity are visible to the super-admin.</small>
  </section></main>;
}
