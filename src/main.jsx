import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  Box,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Download,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Maximize,
  RotateCcw,
  FolderOpen,
  Save,
  Ruler,
  PanelTop,
  ClipboardCheck,
  Refrigerator,
  SlidersHorizontal,
  Sparkles,
  Layers,
  Calendar,
  ExternalLink,
  ChevronRight,
  MousePointer2,
} from "lucide-react";
import Scene from "./Scene";
import AuthGate from './AuthGate.jsx';
import UserMenu from './UserMenu.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Dashboard from './Dashboard.jsx';
import {cloudRequest} from './cloud-client.js';
import {projectIdentity,projectContent,writeDraft,removeDraft,detachedProject} from './project-workspace.js';
import {copyRenderPack,copyRenderImage,prepareClipboardSheet} from './render-clipboard.js';
import { moveCabinetRun, movableRun, shuffleDesign, designSignature, placementErrors, saveDesignSlot, restoreDesignSlot } from './runPlacement.js';
import {
  FabricationControls,
  FabricationResults,
  ProfileSection,
  CostingControls,
} from "./Fabrication.jsx";
import { fabricationPlan } from "./fabrication.js";
import {
  initialProject,
  solve,
  TYPES,
  CHECKS,
  wallPoint,
  wallLength,
  renderingPrompt,
  activeWalls,
  closeRunGaps,
  minimumCabinetWidth,
  maximumCabinetWidth,
  legalRunSpans,
  insertCabinet,
  auditCabinetSpace,
  repairCabinetSpace,
  gapResizeCandidates,
  resizeSelectedForCoverage,
  footprint,
  islandSettings,
} from "./model";
import { download, copyText, preparePack, reminderICS } from "./exports";
import "./style.css";
import './theme.css';
const CloudPanel=lazy(()=>import('./CloudPanel.jsx'));
const STEPS = [
  ["Room", Ruler],
  ["Openings", PanelTop],
  ["Site checklist", ClipboardCheck],
  ["Your kitchen", Refrigerator],
  ["Design", SlidersHorizontal],
  ["Cutting & BOM", Layers],
  ["Export", Sparkles],
];
function Num({ label, value, onChange, min = 0, max = 12000, step = 50, disabled=false }) {
  return (
    <label className="field">
      {label}
      <div className="number-wrap">
        <input
          aria-label={label}
          type="number"
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ""}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === "" ? 0 : Number(e.target.value))
          }
        />
        <span>mm</span>
      </div>
    </label>
  );
}
function Plan({ p, plan, selected, onSelect, onMoveUnit, onMoveOpening, onMoveStart, onMoveEnd, dragEnabled, rowFilter='all', previewIds=[] }) {
  const W = p.room.width || 4800,
    D = p.room.depth || 3600,
    pad = 400,
    svgRef=useRef(),drag=useRef(null);
  const point=e=>{
    const q=svgRef.current.createSVGPoint();q.x=e.clientX;q.y=e.clientY;
    return q.matrixTransform(svgRef.current.getScreenCTM().inverse());
  };
  const nearest=(value,candidates,grid=25)=>{
    const rounded=Math.round(value/grid)*grid,best=candidates.reduce((a,b)=>Math.abs(b-value)<Math.abs(a-value)?b:a,rounded);
    return Math.abs(best-value)<=90?best:rounded;
  };
  const startDrag=(e,kind,id)=>{
    if(!dragEnabled||e.button!==0)return;
    onMoveStart?.();
    const q=point(e),item=kind==='unit'?plan.units.find(u=>u.id===id):p.openings.find(o=>o.id===id);
    if(!item)return;
    const along=item.wall==='A'?q.x:item.wall==='B'?q.y:item.wall==='C'?W-q.x:D-q.y,c=islandSettings(p);
    e.preventDefault();e.stopPropagation();drag.current={kind,id,item,offset:along-item.x,dx:q.x-c.x,dy:q.y-c.y,clientX:e.clientX,clientY:e.clientY,pointerId:e.pointerId};svgRef.current.setPointerCapture(e.pointerId);
    if(kind==='unit')onSelect(id);
  };
  const move=e=>{
    const active=drag.current;if(!active)return;
    if(!active.moved&&Math.hypot(e.clientX-active.clientX,e.clientY-active.clientY)<5)return;
    active.moved=true;const q=point(e);
    if(active.kind==='opening'){
      const o=active.item;if(!o)return;
      const L=wallLength(p.room,o.wall),raw=(['A','C'].includes(o.wall)?(o.wall==='A'?q.x:W-q.x):(o.wall==='B'?q.y:D-q.y))-active.offset,
        candidates=[0,L-o.w,...p.openings.filter(x=>x.wall===o.wall&&x.id!==o.id).flatMap(x=>[x.x+x.w,x.x-o.w]),...plan.units.filter(u=>u.wall===o.wall).flatMap(u=>[u.x-25-o.w,u.x+u.w+25])];
      onMoveOpening(o.id,Math.max(0,Math.min(L-o.w,nearest(raw,candidates))));return;
    }
    const u=active.item;if(!u)return;
    if(u.wall==='Island'){
      const c=islandSettings(p),fw=c.footprintW,fd=c.footprintD,
        rawX=q.x-active.dx,rawY=q.y-active.dy,attached=c.kind==='breakfast',
        xs=[0,W-fw,W/2-fw/2,600+(attached?0:900),W-600-(attached?0:900)-fw],
        ys=[0,D-fd,D/2-fd/2,600+(attached?0:900),D-600-(attached?0:900)-fd];
      onMoveUnit(u.id,{islandX:Math.max(0,Math.min(W-fw,nearest(rawX,xs,50))),islandY:Math.max(0,Math.min(D-fd,nearest(rawY,ys,50)))});return;
    }
    const L=wallLength(p.room,u.wall),raw=(['A','C'].includes(u.wall)?(u.wall==='A'?q.x:W-q.x):(u.wall==='B'?q.y:D-q.y))-active.offset,
      candidates=[0,L-u.w,...plan.units.filter(v=>v.wall===u.wall&&v.id!==u.id&&Math.min(v.z+v.h,u.z+u.h)-Math.max(v.z,u.z)>.1).flatMap(v=>[v.x+v.w,v.x-u.w]),...p.openings.filter(o=>o.wall===u.wall).flatMap(o=>[o.x-25-u.w,o.x+o.w+25])];
    if(u.type==='cooker'){
      const domains=legalRunSpans(p,plan.units,u.wall,false).filter(([a,b])=>b-a>=u.w+600),domain=domains.sort((a,b)=>Math.abs((a[0]+a[1]-u.w)/2-raw)-Math.abs((b[0]+b[1]-u.w)/2-raw))[0];
      if(domain){const lo=domain[0]+300,hi=domain[1]-u.w-300;onMoveUnit(u.id,{x:Math.max(lo,Math.min(hi,nearest(raw,[lo,hi,(lo+hi)/2])))});}return;
    }
    onMoveUnit(u.id,{x:Math.max(0,Math.min(L-u.w,nearest(raw,candidates)))});
  };
  const end=e=>{const active=drag.current;if(active&&svgRef.current.hasPointerCapture(e.pointerId))svgRef.current.releasePointerCapture(e.pointerId);drag.current=null;if(active)onMoveEnd?.(e.type==='pointercancel');};
  return (
    <svg
      ref={svgRef}
      className="floorplan"
      viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${D + 2 * pad}`}
      aria-label="Room floor plan"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <defs>
        <pattern
          id="grid"
          width="300"
          height="300"
          patternUnits="userSpaceOnUse"
        >
          <path d="M300 0H0V300" fill="none" stroke="#d6e0dc" strokeWidth="5" />
        </pattern>
      </defs>
      <rect
        width={W}
        height={D}
        fill="url(#grid)"
        stroke="#526b6a"
        strokeWidth="35"
      />
      {[...plan.units]
        .filter(u=>rowFilter==='all'||(rowFilter==='upper'?u.z>=900:u.z<900))
        .sort((a,b)=>a.z-b.z)
        .map((u) => {
          const upper=u.z>=900;
          let a, b;
          if (u.wall === "Island") {
            const f=footprint(p,u);a=[f[0],f[1]];b=[f[2],f[3]];
          } else {
            a = wallPoint(p.room, u.wall, u.x);
            b = wallPoint(p.room, u.wall, u.x + u.w, u.d);
          }
          const x = Math.min(a[0], b[0]),
            y = Math.min(a[1], b[1]),
            w = Math.abs(b[0] - a[0]),
            d = Math.abs(b[1] - a[1]);
          return (
            <g
              key={u.id}
              onClick={() => onSelect(u.id)}
              onPointerDown={e=>startDrag(e,'unit',u.id)}
              role="button"
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(u.id);
              }}
              aria-label={`Select ${u.id} ${TYPES[u.type]?.name}`}
              style={{ cursor: dragEnabled ? "grab" : "pointer" }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={d}
                fill={previewIds.includes(u.id) ? '#a4ddff' : u.id === selected ? "#e4ad74" : p.style.front}
                stroke={u.id === selected ? "#ac5b1d" : "#668381"}
                strokeWidth="15"
                fillOpacity={upper ? 0.68 : 1}
                strokeDasharray={upper?"45 25":undefined}
              />
              <text
                x={x + w / 2}
                y={y + d / 2 + 35}
                fontSize="110"
                textAnchor="middle"
                fill="#1a464b"
              >
                {upper?`U·${u.id}`:u.id}
              </text>
            </g>
          );
        })}
      {p.openings.map((o) => {
        const a = wallPoint(p.room, o.wall, o.x),
          b = wallPoint(p.room, o.wall, o.x + o.w);
        return (
          <line
            key={o.id}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={o.kind === "window" ? "#3094a8" : "#d99451"}
            strokeWidth="65"
            onPointerDown={e=>startDrag(e,'opening',o.id)}
            style={{cursor:dragEnabled?'grab':'default'}}
          >
            <title>
              {o.kind} on {o.wall}
            </title>
          </line>
        );
      })}
      {[
        ["A", W / 2, -150],
        ["B", W + 180, D / 2],
        ["C", W / 2, D + 230],
        ["D", -180, D / 2],
      ].map(([w, x, y]) => (
        <text
          key={w}
          x={x}
          y={y}
          textAnchor="middle"
          fontSize="160"
          fill="#385b5e"
        >
          {w}
        </text>
      ))}
    </svg>
  );
}
function App({account,initialDocument,initialDirty,onDashboard}) {
  const [p, setP] = useState(initialDocument),
    [savedContent,setSavedContent]=useState(initialDirty?'':projectContent(initialDocument)),
    [saving,setSaving]=useState(false),
    [saveError,setSaveError]=useState(''),
    [step, setStep] = useState(0),
    [selected, setSelected] = useState(null),
    [mode, setMode] = useState("finished"),
    [frameRun, setFrameRun] = useState("all"),
    [xray, setXray] = useState(false),
    [explode, setExplode] = useState(0),
    [walls, setWalls] = useState(false),
    [labels, setLabels] = useState(false),
    [view, setView] = useState("perspective"),
    [toast, setToast] = useState(""),
    [saveState, setSaveState] = useState("Saved on this device"),
    [pack, setPack] = useState(null),
    [busy, setBusy] = useState(false),
    [sceneError, setSceneError] = useState(""),
    [addType, setAddType] = useState("base"),
    [dragEnabled, setDragEnabled] = useState(false),
    [gapFix, setGapFix] = useState(null),
    [gapSelection, setGapSelection] = useState([]),
    [changeApproval, setChangeApproval] = useState(null),
    [moveReview, setMoveReview] = useState(null),
    [reviewEditing, setReviewEditing] = useState(false),
    [editableBoxes, setEditableBoxes] = useState([]),
    [planRow, setPlanRow] = useState('all'),
    [cloudOpen,setCloudOpen] = useState(false);
  const dirty=projectContent(p)!==savedContent;
  const currentProject=useRef(p);currentProject.current=p;
  const scene = useRef(),
    dragSession=useRef(),reviewRef=useRef(),shuffleSeed=useRef(1),shuffleSeen=useRef([]);
  const plan = useMemo(() => solve(p), [p]);
  const displayProject=useMemo(()=>moveReview?{...p,...moveReview.projectPatch,units:moveReview.units}:p,[p,moveReview]);
  const displayPlan=useMemo(()=>moveReview?solve(displayProject):plan,[displayProject,plan,moveReview]);
  const previewIds=useMemo(()=>moveReview?moveReview.units.filter(u=>{
    const old=plan.units.find(v=>v.id===u.id);return !old||Math.abs(old.x-u.x)>.1||Math.abs(old.w-u.w)>.1||old.islandX!==u.islandX||old.islandY!==u.islandY;
  }).map(u=>u.id):[],[moveReview,plan]);
  const islandCfg=useMemo(()=>islandSettings(p),[p]);
  const spaceAudit=useMemo(()=>auditCabinetSpace(p,plan.units),[p,plan]);
  const fabrication = useMemo(() => fabricationPlan(p, plan), [p, plan]);
  const settings = useMemo(
    () => ({ mode, walls, labels, selected, xray, explode, runId: frameRun, moveEnabled:dragEnabled, previewIds }),
    [mode, walls, labels, selected, xray, explode, frameRun, dragEnabled, previewIds],
  );
  const frameRunIds = useMemo(() => [...new Set(fabrication.bars.map(b=>b.runId).filter(Boolean))], [fabrication]);
  const unit = plan.units.find((u) => u.id === selected);
  const prompt = useMemo(() => renderingPrompt(p, plan), [p, plan]);
  const update = (patch, regenerate = false) =>
    setP((old) => ({
      ...old,
      ...patch,
      ...(regenerate ? { units: null } : {}),
    }));
  const room = (k, v) =>
    setP((old) => ({ ...old, room: { ...old.room, [k]: v }, units: null }));
  const style = (k, v) =>
    setP((old) => ({ ...old, style: { ...old.style, [k]: v } }));
  useEffect(() => {
    try {
      writeDraft(account.user.id,p,dirty);
      setSaveState(dirty?"Unsynced changes · local recovery saved":"Saved to cloud");
    } catch {
      setSaveState("Storage full — save a project file");
    }
    setPack(null);
    reviewRef.current=null;dragSession.current=null;setMoveReview(null);setReviewEditing(false);
  }, [p,savedContent]);
  useEffect(()=>{const leave=e=>{if(dirty||saving){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[dirty,saving]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const ctx = document.modelContext;
    if (!ctx?.registerTool) return;
    const life = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: "read_kitchen_design",
          description:
            "Read the current room, requested units and validation results.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => ({
            room: p.room,
            units: plan.units,
            errors: plan.errors,
            unmet: plan.unmet,
          }),
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, [p, plan]);
  const select = (id) => {
    setSelected(id);
    setStep(4);
  };
  const editUnit = (k, v) => {
    update({
      units: plan.units.map((u) => (u.id === selected ? { ...u, [k]: v, automatic:false } : u)),
    });
  };
  const showReview=value=>{
    if(value?.valid){
      // A second drag must not turn an earlier invalid draft into the accepted baseline.
      const baseline=new Set(placementErrors(p,plan.units));
      const error=placementErrors({...p,...value.projectPatch},value.units).find(e=>!baseline.has(e));
      if(error)value={...value,valid:false,reason:error};
    }
    reviewRef.current=value;setMoveReview(value);
  };
  const beginMove=()=>{
    dragSession.current={p:displayProject,units:displayPlan.units};setReviewEditing(false);
  };
  const movePlanUnit=(id,patch)=>{
    const base=dragSession.current||{p,units:plan.units},target=base.units.find(u=>u.id===id);
    if(!target)return;
    const projectPatch=reviewRef.current?.projectPatch||{};
    if(target.wall==='Island'){
      const islandConfig={...base.p.islandConfig,x:patch.islandX,y:patch.islandY};
      const units=base.units.map(u=>u.wall==='Island'?{...u,islandX:patch.islandX,islandY:patch.islandY,ix:patch.islandX,iy:patch.islandY}:u);
      const errors=placementErrors({...base.p,islandConfig},units);
      showReview({units,projectPatch:{...projectPatch,islandConfig},phase:'drag',valid:!errors.length,candidates:[],reason:errors[0]||'Island snapped. OK keeps this position; Cancel restores it.'});
      return;
    }
    const result=moveCabinetRun(base.p,base.units,id,patch.x);
    showReview({...result,projectPatch,source:base.units,pSource:base.p,selectedId:id,targetX:patch.x,phase:'drag'});
    setEditableBoxes(result.candidates.filter(u=>!u.lastResort).map(u=>u.id));
  };
  const movePlanOpening=(id,x)=>{
    const base=dragSession.current||{p,units:plan.units},openings=base.p.openings.map(o=>o.id===id?{...o,x}:o);
    const next={...base.p,openings},result=repairCabinetSpace(next,base.units);
    showReview({...result,projectPatch:{...reviewRef.current?.projectPatch,openings},phase:'drag',candidates:[],valid:result.audit.complete,
      reason:result.audit.errors[0]||(result.audit.complete?'Opening moved; review the adjusted cabinets.':'Opening leaves unfilled space or conflicts. Cancel or choose another position.')});
  };
  const finishMove=(cancelled=false)=>{
    dragSession.current=null;
    if(cancelled){showReview(null);return;}
    if(reviewRef.current)showReview({...reviewRef.current,phase:'review'});
  };
  const toggleMove=()=>{setDragEnabled(value=>!value);if(['door','run'].includes(mode))setMode('finished');};
  const stepMove=direction=>{
    const run=movableRun(displayProject,displayPlan.units,selected),index=run?.boxes.findIndex(u=>u.id===selected),neighbour=run?.boxes[index+direction];
    if(!neighbour){setToast('This is the end of the movable run; openings and anchored end bays are stops.');return;}
    beginMove();movePlanUnit(selected,{x:neighbour.x+neighbour.w/2-run.selected.w/2+direction});finishMove();
  };
  const keepReview=()=>{
    const value=reviewRef.current;if(!value?.valid)return;
    setP(old=>({...old,...value.projectPatch,units:value.units}));showReview(null);setReviewEditing(false);
    setToast('Approved design saved on this device.');
  };
  const cancelReview=()=>{showReview(null);dragSession.current=null;setReviewEditing(false);};
  const previewSelectedWidths=()=>{
    const r=reviewRef.current;if(!r?.source)return;
    const result=moveCabinetRun(r.pSource,r.source,r.selectedId,r.targetX,{editableIds:editableBoxes});
    showReview({...r,...result,phase:'review'});
  };
  const shuffle=()=>{
    if(moveReview&&moveReview.kind!=='shuffle'){setToast('OK or Cancel the current preview before shuffling.');return;}
    const saved=(p.designVariants||[]).filter(Boolean).map(slot=>designSignature(slot.project.units||[]));
    const result=shuffleDesign(p,plan.units,shuffleSeed.current++,[...shuffleSeen.current,...saved]);
    if(result.reason){setToast(result.reason);return;}
    shuffleSeen.current=[...shuffleSeen.current,result.signature].slice(-30);
    showReview({...result,projectPatch:{},valid:true,candidates:[],phase:'review',kind:'shuffle',reason:'New storage sequence. Sink, cooker/hood, openings and tall ends stay fixed. OK keeps it; save it in a slot afterwards.'});
  };
  const saveSlot=slot=>{
    if(moveReview){setToast('Press OK to approve the preview before saving a design slot.');return;}
    const errors=placementErrors(p,plan.units);if(errors.length){setToast(`Fix this before saving a design slot: ${errors[0]}`);return;}
    if(p.designVariants?.[slot]&&!window.confirm(`Replace Design ${slot+1}?`))return;
    setP(old=>saveDesignSlot(old,plan.units,slot));setToast(`Design ${slot+1} saved with this project (on this device and in JSON).`);
  };
  const loadSlot=slot=>{
    if(moveReview){setToast('OK or Cancel the current preview before loading a saved design.');return;}
    const restored=restoreDesignSlot(p,slot);
    const {designVariants,...patch}=restored;
    showReview({units:restored.units,projectPatch:patch,valid:true,candidates:[],phase:'review',kind:'saved',reason:`Previewing saved Design ${slot+1}, including its room and openings. OK restores it; Cancel keeps the current design.`});
  };
  const rotateIsland=()=>setP(old=>{
    const rotation=islandSettings(old).rotation===90?0:90,islandConfig={...old.islandConfig,rotation};
    return {...old,islandConfig,units:old.units?.map(u=>u.wall==='Island'?{...u,islandRotation:rotation}:u)||null};
  });
  const saveNamedProject=async(copy=false)=>{
    if(saving)return;
    if(moveReview){setToast('OK or Cancel the design preview before saving.');return;}
    setSaving(true);setSaveError('');
    try{
      const snapshot=copy?detachedProject(currentProject.current,`${currentProject.current.name} — copy`.slice(0,100)):structuredClone(currentProject.current),binding=snapshot.cloud;
      const {project:saved}=await cloudRequest('project',{method:binding?'PUT':'POST',params:binding?{id:binding.id}:{},body:{document:snapshot,revision:binding?.revision}});
      if(!binding&&!copy){try{removeDraft(account.user.id,projectIdentity(snapshot));}catch{}}
      setP(old=>({...old,...(copy?{name:snapshot.name,projectId:snapshot.projectId}:{}),cloud:{id:saved.id,ownerId:saved.ownerId,revision:saved.revision}}));
      setSavedContent(projectContent(snapshot));setToast('Project saved to cloud.');
    }catch(e){setSaveError(e.message);setToast(e.message);}finally{setSaving(false);}
  };
  const backToDashboard=()=>{
    if(saving)return;
    if(moveReview&&!window.confirm('Cancel the unapproved layout preview and return to Projects?'))return;
    try{writeDraft(account.user.id,p,dirty);onDashboard();}catch{setToast('Local recovery storage is full. Save to cloud or download JSON before leaving.');}
  };
  const openGapChooser=(units,audit)=>{
    const candidates=gapResizeCandidates(p,units,audit.gaps);
    if(!candidates.length){
      setGapSelection([]);
      setGapFix({units,audit,candidates:[],blocked:true});
      setToast("A fixed appliance or specialist bay blocks the remaining gap. Move a cabinet or change the room/opening dimensions.");
      return;
    }
    setGapSelection([]);
    setGapFix({units,audit,candidates});
  };
  const describeSystemChanges=(before,after)=>{
    const prior=new Map(before.map(unit=>[unit.id,unit])),next=new Map(after.map(unit=>[unit.id,unit])),changes=[];
    for(const unit of after){
      const old=prior.get(unit.id);
      if(!old){changes.push(`${unit.id}: add ${TYPES[unit.type]?.name||unit.type}, ${Math.round(unit.w)} mm`);continue;}
      const edits=[];
      if(Math.abs(unit.w-old.w)>.1)edits.push(`width ${Math.round(old.w)}→${Math.round(unit.w)} mm`);
      if(Math.abs(unit.x-old.x)>.1)edits.push(`offset ${Math.round(old.x)}→${Math.round(unit.x)} mm`);
      if(unit.wall!==old.wall)edits.push(`wall ${old.wall}→${unit.wall}`);
      if(edits.length)changes.push(`${unit.id}: ${edits.join(', ')}`);
    }
    for(const unit of before)if(!next.has(unit.id))changes.push(`${unit.id}: remove ${TYPES[unit.type]?.name||unit.type}`);
    return changes;
  };
  const requestSystemChange=(before,result,title,selectId=null)=>{
    const changes=describeSystemChanges(before,result.units);
    if(!changes.length){
      if(result.audit.complete)setToast("Placement snapped correctly; no automatic width changes are needed.");
      else openGapChooser(result.units,result.audit);
      return;
    }
    setChangeApproval({title,units:result.units,audit:result.audit,changes,selectId});
  };
  const runGapAudit=()=>{
    const result=repairCabinetSpace(p,plan.units);
    requestSystemChange(plan.units,result,"Approve automatic run adjustment");
  };
  const applySelectedGapWidths=()=>{
    if(!gapFix||!gapSelection.length){setToast("Tick at least one cabinet that the system may resize.");return;}
    const result=resizeSelectedForCoverage(p,gapFix.units,gapSelection);
    if(result.audit.complete){
      setGapFix(null);setGapSelection([]);
      requestSystemChange(gapFix.units,result,"Approve selected width changes");
      return;
    }
    const candidates=gapResizeCandidates(p,result.units,result.audit.gaps);
    if(!candidates.length){
      setGapFix({units:result.units,audit:result.audit,candidates:[],blocked:true});setGapSelection([]);
      setToast(`${result.reason} The remaining space is bordered only by protected appliance or specialist units.`);
      return;
    }
    setGapFix(null);setGapSelection([]);
    requestSystemChange(gapFix.units,result,"Approve selected width changes");
  };
  const approveSystemChange=()=>{
    const approval=changeApproval;if(!approval)return;
    update({units:approval.units});setChangeApproval(null);
    if(approval.selectId)setSelected(approval.selectId);
    if(approval.audit.complete)setToast("Approved changes applied. No run spaces remain.");
    else setTimeout(()=>openGapChooser(approval.units,approval.audit),0);
  };
  const changeOpening = (id, k, v) =>
    update(
      {
        openings: p.openings.map((o) =>
          o.id === id
            ? {
                ...o,
                [k]: v,
                ...(k === "kind" && v === "door" ? { sill: 0, h: 2100 } : {}),
              }
            : o,
        ),
      },
      true,
    );
  const setNeed = (type, count) => {
    const needs={...p.needs,[type]:Math.max(0,Math.min(12,count))};
    const result=solve({...p,needs,units:null});
    update({needs},true);
    if(count>(p.needs[type]||0)){
      const placed=result.units.filter(u=>u.type===type&&!u.automatic).length;
      setToast(placed<needs[type]?`${TYPES[type].name}: ${placed} of ${needs[type]} fit. See unplaced items; free space or change the preferred wall.`:`${TYPES[type].name} placed. Wall space recalculated.`);
    }
  };
  async function prepare() {
    if (plan.errors.length || plan.unmet.length) {
      setToast("Resolve the layout issues before preparing a rendering pack.");
      return;
    }
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const result = preparePack(p, plan, scene.current);
      // A clipboard limitation must never prevent downloading the existing image pack.
      try{result.clipboardSheet=await prepareClipboardSheet(result.images);}catch{result.clipboardSheet=null;}
      if(currentProject.current!==p){setToast('Design changed while preparing images. Prepare the pack again.');return;}
      setPack(result);
      setToast("Images and prompt are ready. Download or share below.");
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!pack) return;
    try {
      const candidates = [pack.shareFiles, pack.shareFiles.slice(0, 1)];
      const files = candidates.find((files) => navigator.canShare?.({ files }));
      if (!navigator.share || !files) {
        setToast(
          "File sharing is unavailable here. Download the pack, then attach the PNGs and paste the prompt in ChatGPT.",
        );
        return;
      }
      await navigator.share({ title: p.name, files, text: pack.prompt });
    } catch (e) {
      if (e.name !== "AbortError")
        setToast(
          "Sharing failed. Download the images and copy the prompt instead.",
        );
    }
  }
  const problems = [
    ...plan.errors,
    ...plan.unmet.map((x) => "Needs placement: " + x),
  ];
  const total = Object.values(p.needs).reduce((a, b) => a + b, 0);
  const stepContent = [
    <>
      <p className="eyebrow">01 / THE SPACE</p>
      <h1>
        Make room for
        <br />
        your kitchen.
      </h1>
      <p className="intro">
        Start with the measured room. All dimensions are in millimeters.
      </p>
      <label className="field">
        Project name
        <input
          value={p.name}
          maxLength="100"
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>
      <div className="two">
        <Num
          label="Room width"
          value={p.room.width}
          min={1200}
          onChange={(v) => room("width", v)}
        />
        <Num
          label="Room depth"
          value={p.room.depth}
          min={1200}
          onChange={(v) => room("depth", v)}
        />
      </div>
      <Num
        label="Ceiling height"
        value={p.room.height}
        min={1800}
        max={4500}
        onChange={(v) => room("height", v)}
      />
      <span className="field-label">Kitchen arrangement</span>
      <div className="layouts">
        {[
          ["I", "Straight", "━"],
          ["L", "L-shaped", "┗"],
          ["U", "U-shaped", "⊔"],
          ["GALLEY", "Galley", "Ⅱ"],
        ].map(([key, name, glyph]) => (
          <button
            key={key}
            className={p.room.layout === key ? "chosen" : ""}
            onClick={() => room("layout", key)}
            aria-pressed={p.room.layout === key}
          >
            <span className="shape">{glyph}</span>
            {name}
          </button>
        ))}
      </div>
      <label className="field">Freestanding feature
        <select value={p.island?islandCfg.kind:'none'} onChange={e=>{const kind=e.target.value;update({island:kind!=='none',islandConfig:{...p.islandConfig,kind:kind==='breakfast'?'breakfast':'island'}},true)}}>
          <option value="none">None</option><option value="island">Kitchen island</option><option value="breakfast">Breakfast bar</option>
        </select>
      </label>
      {p.island&&<div className="feature-controls">
        <button className="secondary" onClick={rotateIsland}><RotateCcw size={16}/>Rotate 90°</button>
        <span>{islandCfg.width} × {islandCfg.depth} mm · drag in Room plan to position</span>
        {islandCfg.kind==='breakfast'&&<><Num label="Breakfast overhang" value={islandCfg.overhang} min={0} max={600} step={25} onChange={v=>update({islandConfig:{...p.islandConfig,overhang:v}})}/><label className="field">Pendant lights<select value={islandCfg.pendants} onChange={e=>update({islandConfig:{...p.islandConfig,pendants:Number(e.target.value)}})}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label><p className="muted">Breakfast mode adds the reference-style dark overhang, warm timber-slat outer face, ladder end detail and hanging glass lights.</p></>}
      </div>}
      <div className="tip">
        <Ruler size={18} />
        <p>
          Rectangular rooms for UAT 1. Wall A is the rear wall; B, C and D
          follow clockwise.
        </p>
      </div>
    </>,
    <>
      <p className="eyebrow">02 / WALL DETAILS</p>
      <h1>
        Let the room
        <br />
        lead the layout.
      </h1>
      <p className="intro">
        Add every door and window before placing cabinets. Offsets follow the
        clockwise wall direction.
      </p>
      {p.openings.map((o, i) => (
        <article className="opening" key={o.id}>
          <div className="row between">
            <strong>Opening {i + 1}</strong>
            <button
              className="icon danger"
              aria-label={`Remove opening ${i + 1}`}
              onClick={() =>
                update(
                  { openings: p.openings.filter((x) => x.id !== o.id) },
                  true,
                )
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="two">
            <label className="field">
              Type
              <select
                value={o.kind}
                onChange={(e) => changeOpening(o.id, "kind", e.target.value)}
              >
                <option value="window">Window</option>
                <option value="door">Door</option>
              </select>
            </label>
            <label className="field">
              Wall
              <select
                value={o.wall}
                onChange={(e) => changeOpening(o.id, "wall", e.target.value)}
              >
                {["A", "B", "C", "D"].map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="two">
            <Num
              label={`Opening ${i + 1} offset`}
              value={o.x}
              onChange={(v) => changeOpening(o.id, "x", v)}
            />
            <Num
              label={`Opening ${i + 1} width`}
              value={o.w}
              min={100}
              onChange={(v) => changeOpening(o.id, "w", v)}
            />
            <Num
              label={`Opening ${i + 1} height`}
              value={o.h}
              min={100}
              onChange={(v) => changeOpening(o.id, "h", v)}
            />
            <Num
              label={`Opening ${i + 1} sill`}
              value={o.sill}
              onChange={(v) => changeOpening(o.id, "sill", v)}
            />
          </div>
        </article>
      ))}
      <button
        className="secondary full"
        onClick={() =>
          update(
            {
              openings: [
                ...p.openings,
                {
                  id: crypto.randomUUID?.() || String(Date.now()),
                  kind: "window",
                  wall: "A",
                  x: 100,
                  w: 900,
                  h: 900,
                  sill: 1100,
                },
              ],
            },
            true,
          )
        }
      >
        <Plus size={17} />
        Add opening
      </button>
      <p className="muted">
        Openings reserve a 25 mm planning margin. Door swing space still needs a
        site review.
      </p>
    </>,
    <>
      <p className="eyebrow">03 / BEFORE DESIGN</p>
      <h1>
        A few things
        <br />
        to remember.
      </h1>
      <p className="intro">
        Check the site details now. Keep anything still to measure in your
        notes.
      </p>
      <div className="check-progress">
        <span>
          {p.checks.length} of {CHECKS.length} confirmed
        </span>
        <progress value={p.checks.length} max={CHECKS.length} />
      </div>
      {CHECKS.map((c) => (
        <label className="check-row" key={c}>
          <input
            type="checkbox"
            checked={p.checks.includes(c)}
            onChange={(e) =>
              update({
                checks: e.target.checked
                  ? [...p.checks, c]
                  : p.checks.filter((x) => x !== c),
              })
            }
          />
          <span>{c}</span>
        </label>
      ))}
      <label className="field">
        Site notes & service positions
        <textarea
          rows="4"
          placeholder="e.g. Water + waste: wall A, 1800 mm from left. Hood duct: wall B. Confirm fridge ventilation."
          value={p.notes}
          maxLength="4000"
          onChange={(e) => update({ notes: e.target.value })}
        />
      </label>
      <label className="field">
        Remind me to check the site
        <input
          aria-label="Reminder date and time"
          type="datetime-local"
          value={p.reminder}
          onChange={(e) => update({ reminder: e.target.value })}
        />
      </label>
      <button
        className="secondary full"
        disabled={!p.reminder}
        onClick={() => {
          try {
            download(reminderICS(p), "kitchen-site-reminder.ics");
            setToast(
              "Calendar event downloaded. Open it in your calendar to enable the reminder.",
            );
          } catch (e) {
            setToast(e.message);
          }
        }}
      >
        <Calendar size={17} />
        Download calendar reminder
      </button>
      <p className="muted">
        Your calendar sends the reminder after you import the event.
      </p>
    </>,
    <>
      <p className="eyebrow">04 / THE BRIEF</p>
      <h1>
        What belongs
        <br />
        in your kitchen?
      </h1>
      <p className="intro">
        Choose quantities and preferred walls. Empty spaces become useful base
        storage.
      </p>
      {[
        ["Everyday essentials", ["sink", "cooker", "drawers", "dishwasher"]],
        ["Tall units", ["fridge", "oven", "pantry"]],
        ["Special storage", ["spice", "bottle", "waste", "base"]],
        ["Above the worktop", ["wall", "glass", "lift"]],
      ].map(([title, keys]) => (
        <section className="need-group" key={title}>
          <h3>{title}</h3>
          {keys.map((k) => (
            <div className={`need ${p.needs[k] ? "active" : ""}`} key={k}>
              <div>
                <strong>{TYPES[k].name}</strong>
                <small>
                  {TYPES[k].w} × {TYPES[k].h} × {TYPES[k].d} mm
                </small>
                {!!p.needs[k] && (
                  <select
                    aria-label={`${TYPES[k].name} preferred wall`}
                    value={p.preferences[k] || ""}
                    onChange={(e) =>
                      update(
                        {
                          preferences: {
                            ...p.preferences,
                            [k]: e.target.value,
                          },
                        },
                        true,
                      )
                    }
                  >
                    <option value="">Best available wall</option>
                    {activeWalls(p.room.layout).map((w) => (
                      <option key={w} value={w}>
                        Wall {w}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="counter">
                <button
                  aria-label={`Remove ${TYPES[k].name}`}
                  onClick={() => setNeed(k, (p.needs[k] || 0) - 1)}
                  disabled={!p.needs[k]}
                >
                  <Minus size={14} />
                </button>
                <output>{p.needs[k] || 0}</output>
                <button
                  aria-label={`Add ${TYPES[k].name}`}
                  onClick={() => setNeed(k, (p.needs[k] || 0) + 1)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </section>
      ))}
      <div className="tip">
        <CheckCircle2 size={18} />
        <p>
          {total} requested items. Anything that cannot fit appears in the
          layout check.
        </p>
      </div>
    </>,
    <>
      <p className="eyebrow">05 / MAKE IT YOURS</p>
      <h1>
        Refine the
        <br />
        details.
      </h1>
      <p className="intro">
        Select a cabinet in the model or plan to edit its size and position.
      </p>
      <label className="field">
        Aluminum construction
        <select
          value={p.style.mode}
          onChange={(e) => style("mode", e.target.value)}
        >
          <option value="premium">Premium — rear ACP included</option>
          <option value="economy">Economy — rear frame exposed</option>
        </select>
      </label>
      <div className="color-grid">
        {[
          ["front", "ACP fronts"],
          ["frame", "Aluminum"],
          ["counter", "Countertop"],
          ["wall", "Room walls"],
        ].map(([key, label]) => (
          <label key={key} className="color-field">
            <input
              type="color"
              aria-label={label + " color"}
              value={p.style[key]}
              onChange={(e) => style(key, e.target.value)}
            />
            <span>
              {label}
              <small>{p.style[key]}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="swatches">
        {["#c2c9c6", "#123d43", "#e8e5da", "#52656e", "#303737", "#ad9575"].map(
          (c) => (
            <button
              key={c}
              style={{ background: c }}
              aria-label={`Front color ${c}`}
              onClick={() => style("front", c)}
            >
              {p.style.front === c && <Check size={16} />}
            </button>
          ),
        )}
      </div>
      <label className="field">
        Front finish
        <select
          value={p.style.finish}
          onChange={(e) => style("finish", e.target.value)}
        >
          <option>matte</option>
          <option>glossy</option>
          <option>brushed</option>
        </select>
      </label>
      <div className="unit-editor">
        <div className="row between">
          <h3>
            {unit ? `${unit.id} / ${TYPES[unit.type].name}` : "Cabinet editor"}
          </h3>
          <MousePointer2 size={18} />
        </div>
        <select
          aria-label="Select cabinet"
          value={selected || ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a cabinet…</option>
          {plan.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id} · {TYPES[u.type].name} · {u.wall}
            </option>
          ))}
        </select>
        {unit && (
          <>
            <div className="two">
              <Num
                label="Cabinet width"
                value={unit.w}
                min={minimumCabinetWidth(unit)}
                max={maximumCabinetWidth(unit)}
                disabled={['cooker','sink'].includes(unit.type)}
                onChange={(v) => editUnit("w", v)}
              />
              <Num
                label="Cabinet height"
                value={unit.h}
                min={100}
                max={3000}
                onChange={(v) => editUnit("h", v)}
              />
              <Num
                label="Cabinet depth"
                value={unit.d}
                min={100}
                max={1200}
                onChange={(v) => editUnit("d", v)}
              />
              <Num
                label="Cabinet offset"
                value={unit.x}
                onChange={(v) => editUnit("x", v)}
              />
              <Num
                label="Bottom elevation"
                value={unit.z}
                max={3000}
                onChange={(v) => editUnit("z", v)}
              />
              <label className="field">
                Cabinet wall
                <select
                  value={unit.wall}
                  onChange={(e) => editUnit("wall", e.target.value)}
                >
                  {[
                    "A",
                    "B",
                    "C",
                    "D",
                    ...(unit.wall === "Island" ? ["Island"] : []),
                  ].map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </label>
              {unit.wall === "Island" && (
                <>
                  <Num
                    label="Island X"
                    value={unit.ix}
                    onChange={(v) => editUnit("ix", v)}
                  />
                  <Num
                    label="Island Y"
                    value={unit.iy}
                    onChange={(v) => editUnit("iy", v)}
                  />
                </>
              )}
            </div>
            {['cooker','sink'].includes(unit.type)&&<p className="warning">{unit.type==='cooker'?'Cooker and hood width is fixed at 600 mm.':'Sink width is fixed at 800 mm. A last-resort ±50 mm change is available only through the space resolver approval window.'}</p>}
            {!['filler','fridge','dishwasher','open'].includes(unit.type)&&<div className="two">
              <label className="field">Door infill<select value={unit.frontMaterial||(unit.type==='glass'?'glass':'acp')} onChange={e=>editUnit('frontMaterial',e.target.value)}><option value="acp">ACP</option><option value="glass">Glass</option></select></label>
              <label className="field">Front colour / glass tint<input type="color" value={unit.frontColor||p.style.front} onChange={e=>editUnit('frontColor',e.target.value)}/></label>
              {!['spice','bottle','waste','oven'].includes(unit.type)&&<label className="field">{unit.type==='drawers'?'Drawer divisions':'Door divisions'}<select value={unit.doorDivisions||0} onChange={e=>editUnit('doorDivisions',Number(e.target.value))}><option value="0">Automatic</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
              <p className="muted">Spice pullouts: 150–250 mm. Other cabinets: minimum 300 mm. Narrow fillers are closure strips, not cabinet boxes.</p>
            </div>}
            <button
              className="text danger"
              onClick={() => {
                update({ units: plan.units.filter((u) => u.id !== unit.id) });
                setSelected(null);
              }}
            >
              <Trash2 size={15} />
              Remove this cabinet
            </button>
          </>
        )}
        <div className="row add-unit">
          <select
            aria-label="New cabinet type"
            value={addType}
            onChange={(e) => setAddType(e.target.value)}
          >
            {Object.entries(TYPES)
              .filter(([k]) => !['corner','wallCorner','filler','open'].includes(k))
              .map(([k, t]) => (
                <option key={k} value={k}>
                  {t.name}
                </option>
              ))}
          </select>
          <button
            className="icon"
            aria-label="Add manual cabinet"
            onClick={() => {
              const result=insertCabinet(p,plan.units,addType);
              if(result.error){setToast(result.error);return;}
              requestSystemChange(plan.units,{units:result.units,audit:auditCabinetSpace(p,result.units)},`Approve ${TYPES[addType].name} insertion`,result.id);
            }}
          >
            <Plus size={20} />
          </button>
        </div>
        <button
          className="primary full"
          onClick={runGapAudit}
        >
          <Layers size={16} />
          Audit & fill gaps
        </button>
        <button
          className="secondary full"
          onClick={() => {
            const rebuilt=solve({...p,units:null});
            requestSystemChange(plan.units,{units:rebuilt.units,audit:auditCabinetSpace(p,rebuilt.units)},"Approve automatic layout rebuild");
          }}
        >
          <RotateCcw size={16} />
          Rebuild automatic layout
        </button>
      </div>
      <p className="muted">
        UAT geometry includes shared hollow frames and sash profiles. Exact
        machining, connector hardware and CNC exports remain in the archived
        Ruby sources.
      </p>
    </>,
    <>
      <p className="eyebrow">06 / BRING IT TO LIFE</p>
      <h1>
        From your plan
        <br />
        to a real-looking room.
      </h1>
      <p className="intro">
        Prepare reference images and a detailed prompt for ChatGPT image
        creation.
      </p>
      <label className="field">
        Lighting direction
        <textarea
          rows="2"
          value={p.style.lighting}
          onChange={(e) => style("lighting", e.target.value)}
        />
      </label>
      <label className="field">
        Room styling
        <textarea
          rows="2"
          value={p.style.scene}
          onChange={(e) => style("scene", e.target.value)}
        />
      </label>
      <button
        className="primary full"
        disabled={busy || problems.length > 0 || !!sceneError}
        onClick={prepare}
      >
        <Sparkles size={18} />
        {busy
          ? "Preparing your images…"
          : pack
            ? "Refresh rendering pack"
            : "Prepare rendering pack"}
      </button>
      {!!problems.length && (
        <p className="error-text">Resolve the layout check before exporting.</p>
      )}
      {pack && (
        <>
          <div className="pack-images">
            {pack.images.map((img) => (
              <div key={img.name}><a download={img.name} href={img.url}>
                <img src={img.url} alt={img.name.replace(".png", "")} />
                <span>{img.name.replace(/\d+-/, "").replace(".png", "")}</span>
              </a><button className="text" onClick={()=>copyRenderImage(img).then(()=>setToast('Image copied.')).catch(e=>setToast(e.message))}>Copy image</button></div>
            ))}
          </div>
          <button
            className="primary full"
            onClick={() => download(pack.zip, "CODEXKITCHEN-render-pack.zip")}
          >
            <Download size={18} />
            Download all images + prompt
          </button>
          <button className="secondary full" onClick={share}>
            <Share2 size={17} />
            Share images + prompt
          </button>
          <button className="secondary full" onClick={()=>copyRenderPack(pack).then(()=>setToast('Prompt + all-view sheet copied. If your chat pastes only the image, use Copy prompt next.')).catch(e=>setToast(e.message))}><Copy size={17}/>Copy prompt + all views</button>
          <p className="share-note">Copies the prompt and one labelled image sheet containing every view. Your chat may paste only one format. Use Copy prompt separately if needed; download the ZIP for separate full-resolution images.</p>
        </>
      )}
      <div className="two export-actions">
        <button
          className="secondary"
          onClick={() =>
            copyText(prompt)
              .then(() => setToast("Prompt copied."))
              .catch((e) => setToast(e.message))
          }
        >
          <Copy size={16} />
          Copy prompt
        </button>
        <button
          className="secondary"
          onClick={() => {
            window.open(
              "https://chatgpt.com/",
              "_blank",
              "noopener,noreferrer",
            );
            copyText(prompt)
              .then(() =>
                setToast(
                  "Prompt copied. Paste it in ChatGPT and attach the exported PNG images.",
                ),
              )
              .catch((e) => setToast(e.message));
          }}
        >
          <ExternalLink size={16} />
          Open ChatGPT
        </button>
      </div>
      <p className="share-note">
        On your phone, choose ChatGPT in the share sheet if it is offered.
        Otherwise download the images, open ChatGPT and attach them. This app
        cannot automatically submit a chat.
      </p>
      {!window.isSecureContext && (
        <div className="tip">
          <Share2 size={18} />
          <p>
            On this local-network HTTP address, phone sharing may be
            unavailable. Downloads and the selectable prompt still work.
          </p>
        </div>
      )}
      <details>
        <summary>View / select the complete prompt</summary>
        <textarea
          aria-label="Rendering prompt"
          className="prompt"
          readOnly
          value={prompt}
          rows="14"
        />
      </details>
      <div className="pack-list">
        <span>
          <Check size={15} />
          Perspective + aluminum frame PNGs
        </span>
        <span>
          <Check size={15} />
          All wall + island elevations, dimensioned isometric
        </span>
        <span>
          <Check size={15} />
          Prompt + project JSON + cabinet schedule
        </span>
      </div>
    </>,
  ];
  stepContent.splice(
    5,
    0,
    <>
      <FabricationControls
        p={p}
        job={fabrication}
        onChange={(fabrication) => update({ fabrication })}
      />
    </>,
  );
  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-icon">
            <Box size={24} />
          </span>
          <span>
            CODEX<span className="brand-light">KITCHEN</span>
            <small>ALUMINUM DESIGN STUDIO</small>
          </span>
          <b className="uat">UAT 1</b>
        </div>
        <div className="header-actions">
          <button className="secondary compact" disabled={saving} onClick={backToDashboard}><ArrowLeft size={16}/>Projects</button>
          <ThemeToggle/>
          <UserMenu account={account}/>
          <button className="secondary compact" onClick={()=>setCloudOpen(v=>!v)}>Project files</button>
          <span className="saved">
            <CheckCircle2 size={14} />
            {saveState}
          </span>
          <button
            className="secondary compact"
            disabled={saving||!!moveReview}
            onClick={()=>saveNamedProject()}
          >
            <Save size={16} />
            {saving?'Saving…':'Save project'}
          </button>
          <button className="secondary compact" disabled={saving||!!moveReview} onClick={()=>saveNamedProject(true)}>Save as copy</button>
          <button
            className="secondary compact"
            title="Download project JSON"
            aria-label="Download project JSON"
            onClick={() => download(new Blob([JSON.stringify(p,null,2)],{type:"application/json"}),"kitchen-project.json")}
          >
            <Download size={16}/>
            <span>JSON</span>
          </button>
        </div>
      </header>
      {saveError&&<div role="alert" className="workspace-alert">{saveError} Use Save as copy to preserve a conflicting draft as a separate project.</div>}
      {cloudOpen&&<Suspense fallback={<div className="cloud-panel">Loading project files…</div>}><CloudPanel project={p} onClose={()=>setCloudOpen(false)} pack={pack}/></Suspense>}
      <nav className="steps" aria-label="Design steps">
        {STEPS.map(([name, Icon], i) => (
          <button
            key={name}
            aria-current={step === i ? "step" : undefined}
            onClick={() => setStep(i)}
            className={step === i ? "current" : step > i ? "done" : ""}
          >
            <span className="step-num">
              {step > i ? <Check size={14} /> : String(i + 1).padStart(2, "0")}
            </span>
            <Icon size={16} />
            <span>{name}</span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="step-chevron" size={14} />
            )}
          </button>
        ))}
      </nav>
      <main>
        <aside className="editor">
          <div className="step-content" key={step}>
            {stepContent[step]}
          </div>
          <div className="step-footer">
            <button
              className="text"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            {step < STEPS.length - 1 && (
              <button className="primary" onClick={() => setStep((s) => s + 1)}>
                {STEPS[step + 1][0]}
                <ArrowRight size={17} />
              </button>
            )}
          </div>
        </aside>
        <section className="workspace">
          <div className="workspace-top">
            <div>
              <p className="eyebrow">LIVE WORKSPACE</p>
              <h2>{p.name || "Untitled kitchen"}</h2>
            </div>
            <div className="model-badge">
              <Layers size={15} />
              {p.style.mode} aluminum
            </div>
          </div>
          <div className="design-variants" aria-label="Design alternatives">
            <button className="secondary compact" onClick={shuffle} disabled={!!moveReview&&moveReview.kind!=='shuffle'}><Sparkles size={15}/>Shuffle design</button>
            <span className="variant-help">Keep up to four designs</span>
            {Array.from({length:4},(_,slot)=>{
              const saved=p.designVariants?.[slot];
              return <div className={`design-slot ${saved?'occupied':''}`} key={slot}>
                <button disabled={!saved||!!moveReview} onClick={()=>loadSlot(slot)} title={saved?`Preview Design ${slot+1}`:'Empty design slot'}>{slot+1}{saved?' · View':' · Empty'}</button>
                <button onClick={()=>saveSlot(slot)} disabled={!!moveReview} aria-label={`${saved?'Replace':'Save'} design ${slot+1}`} title={saved?'Replace with current approved design':'Save current approved design'}><Save size={14}/></button>
              </div>;
            })}
          </div>
          <div className="viewport">
            <div className="viewport-toolbar">
              <div className="segmented">
                {[
                  ["finished", "Finished"],
                  ["frame", "Frame only"],
                  ["carcass", "Frame + carcass"],
                  ["open", "Open fronts"],
                  ["door", "Door development"],
                  ["run", "Continuous frames"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={mode === key ? "active" : ""}
                    onClick={() => { setMode(key); if(key==="run"&&frameRun==="all"&&frameRunIds[0])setFrameRun(frameRunIds[0]); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="row">
                <button
                  className={dragEnabled?"primary compact":"secondary compact"}
                  aria-pressed={dragEnabled}
                  onClick={toggleMove}
                  title="Move cabinets in 3D or plan"
                >
                  <MousePointer2 size={14}/>{dragEnabled?"Finish move":"Move 3D"}
                </button>
                {dragEnabled&&selected&&<>
                  <button className="secondary compact" title="Move selected box one position towards the start of its wall" aria-label="Move selected box towards wall start" onClick={()=>stepMove(-1)}><ArrowLeft size={14}/></button>
                  <button className="secondary compact" title="Move selected box one position towards the end of its wall" aria-label="Move selected box towards wall end" onClick={()=>stepMove(1)}><ArrowRight size={14}/></button>
                </>}
                <button
                  className={xray ? "primary compact" : "secondary compact"}
                  onClick={() => setXray((v) => !v)}
                  aria-pressed={xray}
                >
                  X-ray
                </button>
                <select
                  aria-label="Camera view"
                  value={view}
                  onChange={(e) => {
                    setView(e.target.value);
                    scene.current?.view(e.target.value);
                  }}
                >
                  <option value="perspective">Perspective</option>
                  <option value="top">Top view</option>
                  {["A", "B", "C", "D"].map((w) => (
                    <option key={w} value={w}>
                      Wall {w}
                    </option>
                  ))}
                </select>
                <button
                  className="icon"
                  title="Reset camera"
                  aria-label="Reset camera"
                  onClick={() => {
                    scene.current?.view("perspective");
                    setView("perspective");
                  }}
                >
                  <Maximize size={18} />
                </button>
              </div>
            </div>
            <Scene
              ref={scene}
              project={displayProject}
              plan={displayPlan}
              settings={settings}
              onSelect={select}
              onMoveUnit={movePlanUnit}
              onMoveStart={beginMove}
              onMoveEnd={finishMove}
              onError={setSceneError}
            />
            {sceneError && <div className="scene-error">{sceneError}</div>}
            {moveReview&&<section className="move-review" aria-label="Placement preview">
              <strong>{moveReview.kind==='shuffle'?'Shuffled design':moveReview.kind==='saved'?'Saved design preview':'Run move preview'}</strong>
              <p role="status">{moveReview.reason}</p>
              {!!moveReview.widths?.length&&<small>{moveReview.widths.map(w=>`${w.id}: ${Math.round(w.before)} → ${Math.round(w.after)} mm`).join(' · ')}</small>}
              <small>Light blue = proposed changes. Not saved until OK.</small>
              {moveReview.phase!=='drag'&&<>
                <div className="row">
                  <button className="primary compact approval-pulse" onClick={keepReview} disabled={!moveReview.valid}><Check size={14}/>OK</button>
                  {moveReview.kind==='shuffle'&&<button className="secondary compact" onClick={shuffle}>Next design</button>}
                  {!!moveReview.candidates?.length&&<button className="secondary compact" aria-expanded={reviewEditing} onClick={()=>setReviewEditing(v=>!v)}>Edit</button>}
                  <button className="text compact" onClick={cancelReview}>Cancel</button>
                </div>
                {reviewEditing&&<div className="inline-width-editor">
                  <p>Tick boxes the system may resize. Doors first, spice next, drawers last. Sink only with your explicit tick (±50 mm).</p>
                  {moveReview.candidates.map(u=><label key={u.id}>
                    <input type="checkbox" checked={editableBoxes.includes(u.id)} onChange={e=>setEditableBoxes(ids=>e.target.checked?[...ids,u.id]:ids.filter(id=>id!==u.id))}/>
                    <span>{u.id} · {TYPES[u.type]?.name}<small>{Math.round(u.w)} mm · allowed {u.min}–{u.max} mm{u.lastResort?' · sink exception':''}</small></span>
                  </label>)}
                  <button className="secondary compact" onClick={previewSelectedWidths}>Preview selected widths</button>
                </div>}
              </>}
            </section>}
            <div className="viewport-bottom">
              <span>{dragEnabled?"Move active · drag a cabinet in 3D · release for snap/adjust preview":"Drag to orbit · scroll to zoom · select a cabinet"}</span>
              <div className="row">
                <label>
                  <input
                    type="checkbox"
                    checked={walls}
                    onChange={(e) => setWalls(e.target.checked)}
                  />
                  Walls
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={labels}
                    onChange={(e) => setLabels(e.target.checked)}
                  />
                  Labels
                </label>
              </div>
            </div>
          </div>
          {mode === "door" && (
            <div className="door-development-controls">
              <label>
                Explode door{" "}
                <input
                  aria-label="Door explode distance"
                  type="range"
                  min="0"
                  max="120"
                  value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))}
                />
                {explode} mm
              </label>
              <p>
                Shows the first door of the selected cabinet. Select another
                cabinet in the plan or Design panel. The complex web sash stays
                active; the grip is adapted from the combined engine.
              </p>
            </div>
          )}
          {mode === "door" && <ProfileSection />}
          {mode === "run" && (
            <div className="door-development-controls continuous-run-controls">
              <label>Continuous run <select aria-label="Continuous frame run" value={frameRunIds.includes(frameRun)?frameRun:"all"} onChange={e=>setFrameRun(e.target.value)}><option value="all">All runs</option>{frameRunIds.map(id=><option key={id} value={id}>{id} · Wall {fabrication.bars.find(b=>b.runId===id)?.wall}</option>)}</select></label>
              <button className="primary" disabled={!frameRunIds.length} onClick={async()=>{try{const {assemblyPdf}=await import('./assembly-pdf.js');const id=frameRunIds.includes(frameRun)?frameRun:'all';const doc=assemblyPdf(fabrication,id);download(new Blob([doc.output('arraybuffer')],{type:'application/pdf'}),`frame-${id}-assembly-REVIEW.pdf`);}catch(e){setToast(e.message)}}}>Download this frame PDF</button>
              <p>Isolated shared front and independent rear support frame. Door-leaf centre lines do not create box-bar uprights.</p>
            </div>
          )}
          {step === 5 && (
            <div className="fabrication-workspace">
              <CostingControls
                p={p}
                plan={plan}
                job={fabrication}
                onChange={(costing) => update({ costing })}
              />
              <FabricationResults job={fabrication} onSelect={setSelected} />
            </div>
          )}
          <div className="workspace-lower">
            <section className="plan-card">
              <div className="row between">
                <h3>Room plan</h3>
                <div className="row">
                  <span>{((p.room.width * p.room.depth) / 1e6).toFixed(1)} m²</span>
                  <button
                    className={dragEnabled?"primary compact":"secondary compact"}
                    aria-pressed={dragEnabled}
                    onClick={toggleMove}
                  >
                    <MousePointer2 size={14}/>
                    {dragEnabled?"Finish moving":"Move items"}
                  </button>
                </div>
              </div>
              <label className="plan-row-filter">Show row <select aria-label="Plan row" value={planRow} onChange={e=>setPlanRow(e.target.value)}><option value="all">Top + bottom</option><option value="base">Bottom only</option><option value="upper">Top only</option></select></label>
              <Plan p={displayProject} plan={displayPlan} selected={selected} onSelect={select} onMoveUnit={movePlanUnit} onMoveOpening={movePlanOpening} onMoveStart={beginMove} onMoveEnd={finishMove} dragEnabled={dragEnabled} rowFilter={planRow} previewIds={previewIds} />
              <div className="legend">
                <span>
                  <i className="window" />
                  Window
                </span>
                <span>
                  <i className="door" />
                  Door
                </span>
                <span><i className="upper-unit"/>Upper unit</span>
                <span>{dragEnabled?"Move active · drag units/openings · 25 mm snap":"Select Move items to reposition"}</span>
              </div>
            </section>
            <section className="check-card">
              <div className="row between">
                <h3>Layout check</h3>
                {problems.length ? (
                  <AlertTriangle size={20} color="#b56425" />
                ) : (
                  <CheckCircle2 size={20} color="#297264" />
                )}
              </div>
              <div className="stats">
                <div>
                  <strong>
                    {plan.units.filter((u) => u.type !== "filler").length}
                  </strong>
                  <span>placed units</span>
                </div>
                <div>
                  <strong>{plan.unmet.length}</strong>
                  <span>unplaced items</span>
                </div>
                <div>
                  <strong>
                    {p.checks.length}/{CHECKS.length}
                  </strong>
                  <span>site checks</span>
                </div>
              </div>
              <details className="space-audit" open={!!spaceAudit.gaps.length}>
                <summary>Cabinet space auditor · {spaceAudit.gaps.length} unboxed spans</summary>
                <p className="muted">Usable wall lengths exclude openings and perpendicular corner footprints. End closures count as covered, not storage.</p>
                <table><thead><tr><th>Wall / row</th><th>Usable</th><th>Unboxed</th></tr></thead><tbody>{spaceAudit.rows.map(r=><tr key={`${r.wall}-${r.row}`}><td>{r.wall} / {r.row}</td><td>{Math.round(r.usable)} mm</td><td>{Math.round(r.unboxed)} mm</td></tr>)}</tbody></table>
                {spaceAudit.gaps.map((g,i)=><p className="warning" key={i}>{g.message} {g.w<300?'Below normal cabinet width: needs neighbouring adjustable storage.':'Available for a correctly sized cabinet.'}</p>)}
                <button className="text" onClick={runGapAudit}>Run audit & fill</button>
              </details>
              {problems.length ? (
                <ul className="issues">
                  {problems.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p className="pass">
                  <CheckCircle2 size={16} />
                  Room bounds, footprints and run coverage clear.
                </p>
              )}
              {plan.warnings.map((w) => (
                <p className="warning" key={w}>
                  {w}
                </p>
              ))}
              <p className="muted small">
                25.4 × 38.1 mm box bar · 3 mm ACP
                <br />
                Verify hardware, opening swings and appliance clearances before
                fabrication.
              </p>
              <button className="text" onClick={() => setStep(3)}>
                Adjust your requirements
                <ArrowRight size={15} />
              </button>
            </section>
          </div>
        </section>
      </main>
      {gapFix&&(
        <div className="modal-backdrop" onMouseDown={()=>setGapFix(null)}>
          <section className="gap-dialog" role="dialog" aria-modal="true" aria-labelledby="gap-dialog-title" onMouseDown={e=>e.stopPropagation()}>
            <div className="row between">
              <div>
                <p className="eyebrow">FIXED-BOX SPACE RESOLVER</p>
                <h2 id="gap-dialog-title">Choose boxes allowed to resize</h2>
              </div>
              <button className="icon" aria-label="Close gap resolver" onClick={()=>setGapFix(null)}>×</button>
            </div>
            <p className="intro">Automatic packing stopped because fixed boxes leave spaces or overlaps. Tick only cabinets whose manufactured width may change. Appliance openings and specialist pullouts are protected.</p>
            <div className="gap-summary">
              {gapFix.audit.gaps.map((gap,index)=><span key={`${gap.wall}-${gap.row}-${gap.x}-${index}`}>Wall {gap.wall} · {gap.row} · {Math.round(gap.w)} mm space at {Math.round(gap.x)} mm</span>)}
              {gapFix.audit.errors.filter(error=>error.includes('overlaps')).map((error,index)=><span key={`overlap-${index}`}>{error}</span>)}
            </div>
            <div className="resize-list">
              {gapFix.candidates.map(candidate=>{
                const checked=gapSelection.includes(candidate.id);
                return <label className={checked?'resize-choice chosen':'resize-choice'} key={candidate.id}>
                  <input type="checkbox" checked={checked} onChange={e=>setGapSelection(ids=>e.target.checked?[...ids,candidate.id]:ids.filter(id=>id!==candidate.id))}/>
                  <span><strong>{candidate.id} · {TYPES[candidate.type].name}</strong><small>Priority {candidate.priority}: {candidate.label}</small><small>Wall {candidate.wall} / {candidate.row} · current {Math.round(candidate.w)} mm · allowed range {Math.round(candidate.min)}–{Math.round(candidate.max)} mm</small></span>
                </label>;
              })}
              {!gapFix.candidates.length&&<div className="tip"><AlertTriangle size={18}/><p>No cabinet in this span is permitted to change width. Move a protected unit, change the opening/room, or add a suitable flexible door cabinet.</p></div>}
            </div>
            <p className="muted">The system may increase or decrease only checked box widths, keeps their far edges aligned, and validates openings and collisions before accepting the change.</p>
            <div className="row gap-actions">
              <button className="secondary" onClick={()=>setGapFix(null)}>Cancel</button>
              <button className="primary" disabled={!gapSelection.length} onClick={applySelectedGapWidths}>Resize selected & close spaces</button>
            </div>
          </section>
        </div>
      )}
      {changeApproval&&(
        <div className="modal-backdrop approval-layer">
          <section className="gap-dialog" role="dialog" aria-modal="true" aria-labelledby="change-approval-title">
            <p className="eyebrow">CHANGES NOT YET APPLIED</p>
            <h2 id="change-approval-title">{changeApproval.title}</h2>
            <p className="intro">Review every proposed system change. Nothing below is saved to the design until you approve it.</p>
            <div className="change-preview">
              {changeApproval.changes.map((change,index)=><div key={index}><Check size={15}/><span>{change}</span></div>)}
            </div>
            {!changeApproval.audit.complete&&<p className="warning">This proposal improves the run but additional fixed-box choices will still be required.</p>}
            <div className="row gap-actions">
              <button className="secondary" onClick={()=>setChangeApproval(null)}>Reject changes</button>
              <button className="primary" onClick={approveSystemChange}>Approve & apply</button>
            </div>
          </section>
        </div>
      )}
      <footer>
        <span>CODEX KITCHEN / Business trial · review before production</span>
        <button
          className="text"
          onClick={() => {
            if (
              confirm(
                "Replace this device’s current design with the UAT example? Save your project first if you need it.",
              )
            ) {
              setP(old=>({...initialProject(),name:old.name,projectId:old.projectId,cloud:old.cloud}));
              setSelected(null);
              setStep(0);
              setToast("UAT example restored.");
            }
          }}
        >
          Load UAT example
        </button>
      </footer>
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function Workspace({account}){
  const [active,setActive]=useState(null);
  return active?<App key={projectIdentity(active.document)} account={account} initialDocument={active.document} initialDirty={active.dirty} onDashboard={()=>setActive(null)}/>:<Dashboard account={account} onOpen={setActive}/>;
}
createRoot(document.getElementById("root")).render(<AuthGate>{account=><Workspace key={account.user.id} account={account}/>}</AuthGate>);
