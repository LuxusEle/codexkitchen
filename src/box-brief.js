import {BOX_TYPES,activeWalls,solve} from './model.js';

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
export function previewBoxBrief(p,draft) {
  const project={...p,...draft,units:null};
  return {project,plan:solve(project)};
}
