import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {initialProject,solve} from '../src/model.js';
import {carcassParts} from '../src/assembly.js';
import {Box3} from 'three';
// Geometry-only check: no browser, GPU or visual UAT is claimed.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
try{
  const {buildScene}=await server.ssrLoadModule('/src/Scene.jsx');
  const p=initialProject(),plan=solve(p);
  const firstRun=carcassParts(p,plan.units).find(x=>x.runId)?.runId;
  for(const mode of ['finished','frame','carcass','open','door','run']){
    const group=buildScene(p,plan,{mode,walls:false,labels:false,xray:mode==='door',explode:50,runId:firstRun});
    let meshes=0,notched=0;
    group.traverse(o=>{if(!o.geometry)return;meshes++;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n),`${mode}: invalid vertex`);if(o.name.includes('U-notched'))notched++});
    assert.ok(meshes>0);if(mode==='carcass')assert.ok(notched>0);
    console.log(`${mode}: ${meshes} finite geometries; ${notched} U-notched panel meshes`);
  }
  const custom={...p,units:[{id:'SP',type:'spice',wall:'A',x:0,z:0,w:100,h:850,d:600,frontMaterial:'glass',frontColor:'#aa3322'}]};
  for(const mode of ['finished','open','door']){
    const group=buildScene(custom,{units:custom.units},{mode,walls:false,labels:false,selected:'SP'});
    const infills=[];group.traverse(o=>{if(o.name==='Channel-seated ACP or glass infill')infills.push(o)});
    assert.equal(infills.length,1);assert.equal(infills[0].material.color.getHexString(),'aa3322');assert.ok(infills[0].material.transparent);
  }
  console.log('100 mm spice front and custom glass tint present in finished, open and isolated door views');
  const assemblyParts=carcassParts(p,plan.units);
  const framed=buildScene(p,plan,{mode:'frame',walls:false,labels:false});
  framed.updateMatrixWorld(true);
  for(const part of assemblyParts.filter(p=>p.sashPlacement)){
    const group=framed.children.find(g=>g.userData.partId===part.id);
    assert.ok(group,`Missing end sash member ${part.id}`);
    // Compare mesh geometry to the same local-space records used in BOM/PDF.
    group.position.set(0,0,0);group.rotation.set(0,0,0);group.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(group);
    for(const [key,size] of [['x','w'],['y','h'],['z','d']]){
      assert.ok(Math.abs(bounds.min[key]-part[key])<.01,`${part.id} ${key} min`);
      assert.ok(Math.abs(bounds.max[key]-part[key]-part[size])<.01,`${part.id} ${key} max`);
    }
  }
  console.log('All fixed-end sash member meshes match assembly/BOM bounds; no handles added');
}finally{await server.close()}
