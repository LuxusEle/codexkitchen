import {BOX_TYPES,activeWalls,solve} from './model.js';

const UPPER_TYPES=['wall','glass','lift'];

// The chooser edits a draft. Nothing in the saved project changes until OK.
export function boxBrief(p) {
  return {needs:{...p.needs},preferences:{...p.preferences},unitDefaults:structuredClone(p.unitDefaults||{}),
    upperWalls:[...(p.upperWalls||activeWalls(p.room.layout))],
    boxCounts:{...p.boxCounts,...Object.fromEntries(BOX_TYPES.filter(t=>p.needs[t]>0).map(t=>[t,p.needs[t]]))}};
}
export function toggleBriefBox(draft,type,on) {
  const count=draft.needs[type]||draft.boxCounts[type]||1;
  return {...draft,needs:{...draft.needs,[type]:on?count:0},boxCounts:{...draft.boxCounts,[type]:count}};
}
export function toggleUpperWall(draft,wall,on) {
  const current=[...draft.upperWalls],upperWalls=on?[...new Set([...current,wall])]:current.filter(value=>value!==wall),
    needs={...draft.needs},boxCounts={...draft.boxCounts};
  if(!upperWalls.length){
    for(const type of UPPER_TYPES){
      if(needs[type]>0)boxCounts[type]=needs[type];
      needs[type]=0;
    }
  }else if(!current.length&&on){
    for(const type of UPPER_TYPES)needs[type]=boxCounts[type]||0;
    if(!UPPER_TYPES.some(type=>needs[type]>0))needs.wall=boxCounts.wall=1;
  }
  return {...draft,upperWalls,needs,boxCounts};
}
export function previewBoxBrief(p,draft) {
  const project={...p,...draft,units:null};
  return {project,plan:solve(project)};
}
