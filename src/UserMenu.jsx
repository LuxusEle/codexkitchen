import React,{useState} from 'react';
import {authClient} from './cloud-client.js';
import './user-menu.css';

export default function UserMenu({account}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function signOut(){
    setBusy(true);setError('');
    try{
      const result=await authClient.signOut();
      if(result.error)throw Error(result.error.message||'Could not sign out. Please retry.');
      // A fresh page clears SDK caches and all mounted, account-specific editor state.
      // Saved projects remain in their existing per-user storage.
      window.location.reload();
    }catch(e){setError(e.message);setBusy(false);}
  }
  return <div className="user-menu" aria-label="Signed-in account">
    <div className="user-menu-identity"><strong>{account.member.username||account.user.email}</strong><small>{account.member.admin?'Super admin':'Operator'}</small></div>
    <button type="button" className="secondary compact" disabled={busy} onClick={signOut}>{busy?'Signing out…':'Sign out'}</button>
    {error&&<span role="alert" className="user-menu-error">{error}</span>}
  </div>;
}
