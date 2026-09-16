import {footprint} from './model.js';
export const cabinetStateKey=p=>JSON.stringify({units:p.units,needs:p.needs,island:p.island,room:p.room,openings:p.openings,preferences:p.preferences,unitDefaults:p.unitDefaults,upperWalls:p.upperWalls,islandConfig:p.islandConfig});
export function cabinetAtPoint(p,units,ids,point){
  const candidates=units.filter(u=>ids.includes(u.id));
  let best=null,distance=Infinity;
  for(const u of candidates){
    const [x0,z0,x1,z1]=footprint(p,u),dx=Math.max(x0-point.x,0,point.x-x1),dz=Math.max(z0-point.z,0,point.z-z1),dy=Math.max(u.z-point.y,0,point.y-u.z-u.h),score=dx*dx+dy*dy+dz*dz;
    if(score<distance){best=u.id;distance=score;}
  }
  return best;
}
export function removeCabinet(p,units,id) {
  const unit=units.find(u=>u.id===id);
  if(!unit)return null;
  const island=unit.wall==='Island',remaining=units.filter(u=>island?u.wall!=='Island':u.id!==id);
  const needs={...p.needs};
  const placed=remaining.filter(u=>u.type===unit.type&&!u.automatic&&u.wall!=='Island').length;
  if(!island&&!unit.automatic&&(needs[unit.type]||0)>placed)needs[unit.type]=Math.max(0,needs[unit.type]-1);
  const patch={units:remaining,needs,island:island?false:p.island};
  return {patch,label:island?'Island / breakfast bar':`${unit.id} · ${unit.type}`,
    undo:{before:{units:structuredClone(p.units),needs:{...p.needs},island:p.island},afterKey:cabinetStateKey({...p,...patch})}};
}
export const canUndoCabinet=(p,undo)=>!!undo&&cabinetStateKey(p)===undo.afterKey;
