import React,{useEffect,useState} from 'react';
import {cloudRequest} from './cloud-client.js';
export default function ActivityPresence({projectId=null}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let lastAction=0,stopped=false,inFlight=false;
    const action=()=>{lastAction=Date.now();};
    const ping=async()=>{
      if(stopped||inFlight||document.visibilityState!=='visible')return;
      inFlight=true;try{await cloudRequest('presence',{method:'POST',body:{projectId,active:Date.now()-lastAction<120000}});if(!stopped)setFailed(false);}catch{if(!stopped)setFailed(true);}finally{inFlight=false;}
    };
    for(const event of ['pointerdown','keydown','scroll'])window.addEventListener(event,action,{passive:true});
    document.addEventListener('visibilitychange',ping);ping();const timer=setInterval(ping,45000);
    return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',ping);for(const event of ['pointerdown','keydown','scroll'])window.removeEventListener(event,action);};
  },[projectId]);
  return <small className="saved">{failed?'Activity sync unavailable':'App activity / saved-project updates visible to owner'}</small>;
}
