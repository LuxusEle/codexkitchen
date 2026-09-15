import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { initialProject } from '../src/model.js';

const browserPath='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port=9331,profile='tmp/edge-i-uat';
const child=spawn(browserPath,[
  '--headless=new','--disable-gpu',`--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,'--window-size=1600,950','http://localhost:9799'
],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function targets(){
  for(let i=0;i<40;i++){
    try{return await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();}catch{await wait(150);}
  }
  throw Error('Edge debugging endpoint did not start');
}
try{
  const target=(await targets()).find(t=>t.type==='page'&&t.url.includes('localhost:9799'));
  if(!target)throw Error('Local app tab was not found');
  const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result)}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});ws.send(JSON.stringify({id:call,method,params}))});
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:950,deviceScaleFactor:1,mobile:false});
  const p=initialProject();p.room={width:4350,depth:2400,height:2700,layout:'I'};
  const serialized=JSON.stringify(p);
  await send('Runtime.evaluate',{expression:`localStorage.setItem('CODEXKITCHENAPP_UAT1',${JSON.stringify(serialized)});location.reload();`});
  await wait(3500);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  mkdirSync('tmp/uat',{recursive:true});
  writeFileSync('tmp/uat/i-4350.png',Buffer.from(shot.data,'base64'));
  ws.close();
  console.log('Captured tmp/uat/i-4350.png');
}finally{
  child.kill();
}
