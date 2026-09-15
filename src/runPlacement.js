import { legalRunSpans, subtract, widthAdjustmentPolicy, validateUnits, auditCabinetSpace } from './model.js';

const upper = u => u.z >= 900;
const anchor = u => ['corner', 'wallCorner', 'filler', 'oven', 'fridge', 'pantry'].includes(u.type);
const round = n => Math.round(n * 1000) / 1000;
const overlaps = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > .1;
const changed = (a, b) => Math.abs(a.x-b.x) > .1 || Math.abs(a.w-b.w) > .1;

// Connected, usable row only: never push a neighbour through a door, corner or tall bay.
export function movableRun(p, units, id) {
  const selected = units.find(u => u.id === id);
  if (!selected || selected.wall === 'Island' || anchor(selected)) return null;
  let domains = legalRunSpans(p, units, selected.wall, upper(selected));
  const row = units.filter(u => u.wall === selected.wall &&
    overlaps([u.z, u.z+u.h], [selected.z, selected.z+selected.h]));
  for (const u of row.filter(anchor)) domains = subtract(domains, [u.x, u.x+u.w]);
  const domain = domains.find(([a,b]) => selected.x >= a-.1 && selected.x+selected.w <= b+.1);
  if (!domain) return null;
  const boxes = row.filter(u => !anchor(u) && u.x >= domain[0]-.1 && u.x+u.w <= domain[1]+.1).sort((a,b) => a.x-b.x);
  return { domain, boxes, selected, wall: selected.wall, row: upper(selected) ? 'upper' : 'base' };
}

function hoodErrors(units) {
  return units.filter(u => u.type === 'cooker' && u.wall !== 'Island').flatMap(c =>
    units.filter(u => upper(u) && u.wall === c.wall && overlaps([u.x,u.x+u.w],[c.x,c.x+c.w]))
      .map(u => `${u.id} occupies the hood space above ${c.id}.`));
}
export function placementErrors(p, units) { return [...validateUnits(p, units), ...hoodErrors(units)]; }

// Exhaust each tier before touching the next; sink is opt-in, never an automatic fallback.
function fitWidths(boxes, length, editableIds) {
  let delta = round(length-boxes.reduce((sum,u) => sum+u.w, 0));
  const allowed = editableIds == null ? null : new Set(editableIds);
  for (const priority of [1,2,3,4]) {
    const eligible = boxes.filter(u => {
      const policy = widthAdjustmentPolicy(u);
      return policy?.priority === priority && (allowed ? allowed.has(u.id) : !policy.lastResort);
    });
    // Equal sharing within a tier, including redistribution when a box reaches its limit.
    for (let pass=0; pass<=eligible.length && Math.abs(delta)>.1; pass++) {
      const candidates = eligible.filter(u => {
        const policy = widthAdjustmentPolicy(u);
        return delta > 0 ? u.w < policy.max-.1 : u.w > policy.min+.1;
      });
      if (!candidates.length) break;
      const share = delta/candidates.length;
      for (const u of candidates) {
        const policy = widthAdjustmentPolicy(u), next = round(Math.max(policy.min, Math.min(policy.max, u.w+share)));
        if (u.type === 'sink' && Math.abs(next-u.w)>.1) u.widthAdjustmentApproved = true;
        delta = round(delta-(next-u.w)); u.w = next;
      }
    }
  }
  return delta;
}

export function moveCabinetRun(p, source, id, targetX, options={}) {
  const run = movableRun(p, source, id);
  if (!run) return { units: source, changedIds: [], candidates: [], valid: false,
    reason: 'Corner and tall end bays stay anchored. Move a door, drawer, spice, sink or cooker bay within its row.' };
  const {domain:[start,end], selected} = run;
  const candidates = run.boxes.filter(u => widthAdjustmentPolicy(u)).map(u => ({...u, ...widthAdjustmentPolicy(u)}));
  const other = run.boxes.filter(u => u.id !== id);
  const centre = Math.max(start, Math.min(end, targetX+selected.w/2));
  let insertion = other.findIndex(u => centre < u.x+u.w/2);
  if (insertion < 0) insertion = other.length;
  const ordered = [...other]; ordered.splice(insertion,0,selected);
  const fitted = ordered.map(u => ({...u}));
  const remainder = fitWidths(fitted, end-start, options.editableIds);
  let cursor = start;
  for (const u of fitted) { u.x = round(cursor); cursor += u.w; }
  const map = new Map(fitted.map(u => [u.id,u]));
  const units = source.map(u => map.has(u.id) && changed(u,map.get(u.id)) ? {...map.get(u.id), automatic: false} : {...u});
  const previousErrors = new Set(placementErrors(p,source));
  const errors = placementErrors(p, units).filter(e => !previousErrors.has(e));
  const changedIds = units.filter((u,i) => changed(u, source[i])).map(u => u.id);
  const widths = units.filter((u,i) => Math.abs(u.w-source[i].w)>.1).map(u => ({id:u.id, before:source.find(v=>v.id===u.id).w, after:u.w}));
  const reason = errors[0] || (Math.abs(remainder)>.1
    ? `${Math.round(Math.abs(remainder))} mm ${remainder>0?'space remains':'more space is needed'}. Choose editable boxes; fixed appliances will not resize.`
    : 'Neighbours snapped together. Review the blue boxes, then OK to keep this layout.');
  return {units, changedIds, widths, candidates, valid: !errors.length && Math.abs(remainder)<=.1,
    errors, remainder, reason, run, audit: auditCabinetSpace(p,units)};
}

// IDs are deliberately excluded: shuffling identical door boxes is not a new design.
export function designSignature(units) {
  return JSON.stringify([...units].sort((a,b)=>a.wall.localeCompare(b.wall)||a.z-b.z||a.x-b.x)
    .map(u=>[u.wall,u.type,round(u.x),round(u.w),u.z,u.frontColor,u.frontMaterial,u.doorDivisions]));
}
export function shuffleDesign(p, source, seed=1, seen=[]) {
  let state = seed >>> 0 || 1;
  const random = () => { state = (Math.imul(1664525,state)+1013904223)>>>0; return state/4294967296; };
  const excluded = new Set([designSignature(source), ...seen]);
  const eligible = source.filter(u => !anchor(u) && u.wall !== 'Island' && !['sink','cooker'].includes(u.type));
  const baseline = new Set(placementErrors(p,source));
  for (let attempt=0; attempt<100 && eligible.length; attempt++) {
    let units = source.map(u=>({...u}));
    for(let step=0; step<1+attempt%4; step++) {
      const u = eligible[Math.floor(random()*eligible.length)], run = movableRun(p,units,u.id);
      if (!run || run.boxes.length<2) continue;
      const target = run.boxes[Math.floor(random()*run.boxes.length)];
      const result = moveCabinetRun(p,units,u.id,target.x+(target.w-u.w)/2);
      // Services and hood stay in place while storage sequences vary.
      if(result.valid && source.filter(v=>['sink','cooker'].includes(v.type)).every(v=>{
        const next=result.units.find(n=>n.id===v.id);return next && !changed(v,next);
      })) units=result.units;
    }
    const signature=designSignature(units);
    if(!excluded.has(signature) && !placementErrors(p,units).some(e=>!baseline.has(e)))
      return {units,signature,seed,changedIds:units.filter((u,i)=>changed(u,source[i])).map(u=>u.id),audit:auditCabinetSpace(p,units)};
  }
  return {units:source,reason:'No further distinct storage sequence fits these fixed services, openings and widths. Try another wall or edit which boxes can change.'};
}

export function saveDesignSlot(p, units, slot) {
  if(!Number.isInteger(slot)||slot<0||slot>3) throw Error('Choose one of the four design slots.');
  const {designVariants, ...snapshot} = p;
  const slots = Array.from({length:4},(_,i)=>designVariants?.[i]||null);
  slots[slot] = {name:`Design ${slot+1}`, savedAt:new Date().toISOString(), project: structuredClone({...snapshot,units})};
  return {...p,designVariants:slots};
}
export function restoreDesignSlot(p, slot) {
  const saved = p.designVariants?.[slot];
  if(!saved?.project) throw Error('This design slot is empty.');
  return {...structuredClone(saved.project),designVariants:p.designVariants,projectId:p.projectId};
}
