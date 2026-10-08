import React,{useEffect,useState} from 'react';
import {authClient,cloudRequest} from './cloud-client.js';
import './cloud.css';
import ThemeToggle from './ThemeToggle.jsx';
import StudioBrand from './StudioBrand.jsx';
import KitchenArtwork from './KitchenArtwork.jsx';
import {ArrowRight,ShieldCheck,Eye,EyeOff} from 'lucide-react';
export default function AuthGate({children}){
  const [account,setAccount]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState(''),[showPassword,setShowPassword]=useState(false);
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
  return <main className="studio-login">
    <section className="login-showcase" aria-label="Codex Kitchen design studio"><StudioBrand subtitle="ALUMINUM DESIGN STUDIO"/><div className="login-story"><span className="hero-label"><span/>FROM FIRST SKETCH TO FINAL DETAIL</span><h2>Beautiful kitchens.<br/>Thoughtfully designed.</h2><p>Your ideas, measurements and materials.<br/>One connected design workspace.</p></div><KitchenArtwork/><div className="login-showcase-foot"><span>PLAN</span><span>DESIGN</span><span>ESTIMATE</span><span>CREATE</span></div></section>
    <div className="login-form-side"><div className="login-appearance"><ThemeToggle/></div><section className="login-card"><div className="login-welcome-mark"><ShieldCheck size={25}/></div><p className="eyebrow">WELCOME TO YOUR STUDIO</p><h1>Make room for<br/>your next idea.</h1>
    <p>Sign in to continue your kitchen projects.</p>
    {message&&<p role="alert" className="cloud-message">{message}</p>}
    {loading?<p role="status">Checking your session…</p>:account?<>
      <p>{needsVerification?'Email verification is required for your account.':account.member.status==='blocked'?'This account is disabled. Contact asanke1.':'Your account is awaiting approval.'}</p>
      {needsVerification&&<form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await authClient.emailOtp.verifyEmail({email:account.user.email,otp});if(r.error)throw Error(r.error.message);setOtp('');await refresh();});}}>
        <button type="button" disabled={busy} onClick={()=>run(async()=>{const r=await authClient.emailOtp.sendVerificationOtp({email:account.user.email,type:'email-verification'});if(r.error)throw Error(r.error.message);setMessage('Code sent. Check your inbox.');})}>Send verification code</button>
        <label className="field">Email code<input required value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={12}/></label><button className="primary" disabled={busy}>Verify email</button>
      </form>}
      <button className="secondary" disabled={busy} onClick={()=>run(async()=>{await authClient.signOut();setAccount(null);})}>Sign out</button>
    </>:<form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await authClient.signIn.email({email:username.trim(),password});setPassword('');if(r.error)throw Error(r.error.message||'Sign in failed.');await refresh();});}}>
      <label className="field">Username<input placeholder="Your staff username" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required maxLength={254}/></label>
      <label className="field" htmlFor="studio-password">Password</label><div className="password-field"><input id="studio-password" placeholder="Enter your password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required maxLength={128}/><button type="button" className="icon" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
      <button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in to your studio'}<ArrowRight size={17}/></button>
    </form>}
    <div className="login-access-note"><ShieldCheck size={17}/><p>Access is managed by your administrator.<small>Staff sign-in and saved-project activity are visible to the super-admin.</small></p></div>
  </section><span className="login-copyright">CODEX KITCHEN · BUILT FOR THE WAY YOU CREATE</span></div></main>;
}
