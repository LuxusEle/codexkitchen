// Web adapter. Original source snapshots remain untouched in reference/fabrication.
// Frame rail/upright orientation: combined/combined_engine.rb create_box_bar.
// The separate web frameanddoor.js rotates its internal uprights differently.
// Sash and hinge/insert distinction: master/cabinex_master.rb, front().
import { PROFILE } from "./model.js";
import { frameRuns, frontDivision } from "./construction.js";
import { doorBody, SASH_PROFILE } from "./sash-profile.js";
export const FIT_CLEARANCE=1; // 1 mm per cut edge, not 1 mm total slot oversize.
const shelfAllowed=u=>!['filler','sink','drawers','spice','bottle','waste','oven'].includes(u.type);

export function frontSpecs(u) {
  if (["fridge", "dishwasher", "filler"].includes(u.type)||(u.type==='open'&&u.z>=900)) return [];
  const y = u.z + (u.z > 0 ? 1.5 : 41),
    h = u.h - (u.z > 0 ? 3 : 44),
    out = [];
  const divisions=fallback=>Number.isInteger(u.doorDivisions)&&u.doorDivisions>=1&&u.doorDivisions<=6?u.doorDivisions:fallback;
  const add = (x, y, w, h, kind = "hinge", hand = "left") =>
    out.push({
      id: `${u.id}-F${out.length + 1}`,
      unitId: u.id,
      x,
      y,
      w,
      h,
      kind,
      hand,
      handleSide: u.z > 0 ? "bottom" : "top",
      glass: (u.frontMaterial || (u.type==='glass'?'glass':'acp'))==='glass',
      color:u.frontColor,
    });
  if (u.type === "oven") {
    add(1.5, y, u.w - 3, 550);
    add(1.5, u.z + 1650, u.w - 3, u.h - 1653);
  } else if (["drawers", "spice", "bottle", "waste"].includes(u.type)) {
    const n = u.type === "drawers" ? divisions(3) : 1,
      hh = (h - (n - 1) * 3) / n;
    for (let i = 0; i < n; i++)
      add(1.5, y + i * (hh + 3), u.w - 3, hh, "drawer");
  } else if (["corner", "wallCorner"].includes(u.type)) {
    const blind = u.type === "corner" ? 625 : 375;
    const width=u.w-blind,count=divisions(width>600?2:1);
    for(const [i,leaf] of frontDivision(width,count).entries())
      add((u.hand==='left'?blind:0)+leaf.x,y,leaf.w,h,'hinge',count===1?(u.hand==='left'?'right':'left'):(i%2?'right':'left'));
  } else
    for (const [i, leaf] of frontDivision(u.w, divisions(u.w > 600 ? 2 : 1)).entries())
      add(
        leaf.x,
        y,
        leaf.w,
        h,
        u.type === "lift" ? "lift" : "hinge",
        i % 2 ? "right" : "left",
      );
  return out;
}

export function hingePositions(front) {
  // Source sash recipe has two inserts, 100 mm from each end. Not a rated load schedule.
  const body = doorBody(front),
    inset = Math.min(100, body.height * 0.2);
  return front.kind === "hinge"
    ? [body.y + inset, body.y + body.height - inset]
    : [];
}

export function supportPlan(run, spacing = 600, rearAdjustment = 0) {
  const { start, end } = run,
    pw = PROFILE.width,
    rearWidth = PROFILE.height;
  // The four-sided fixed sash is the structural member at each run end. Only
  // real internal cabinet boundaries receive front box-bar uprights; a
  // two-leaf door division does not create one.
  const front = run.units
      .filter((u) => u.type !== "filler")
      .map((u) => u.x + u.w)
      .filter((x) => x > start + pw && x < end - pw);
  // Rear posts are a structural support grid, NOT a copy of the door divisions.
  const segments = Math.max(
    1,
    Math.ceil((end - start) / Math.max(100, spacing)) + rearAdjustment,
  );
  const rear = Array.from(
    { length: Math.max(0, segments - 1) },
    (_, i) => start + ((end - start) * (i + 1)) / segments - rearWidth / 2,
  );
  return { front, rear };
}

function mergeCuts(cuts, width) {
  const sorted = cuts
      .map(([a, b]) => [Math.max(0, a), Math.min(width, b)])
      .filter(([a, b]) => b > a)
      .sort((a, b) => a[0] - b[0]),
    result = [];
  for (const cut of sorted) {
    const prior = result.at(-1);
    if (prior && cut[0] <= prior[1]) prior[1] = Math.max(prior[1], cut[1]);
    else result.push([...cut]);
  }
  return result;
}
// Port of combined_engine.rb create_notched_horizontal_panel, extended so front
// and back have independent post intervals. One connected outline, not bridge strips.
export function notchedOutline(
  width,
  depth,
  frontCuts,
  backCuts,
  notchDepth = 13.2,
) {
  if (notchDepth * 2 >= depth) throw Error("U-notches consume the panel depth");
  const edge = (cuts) => {
    const points = [[0, cuts[0]?.[0] === 0 ? notchDepth : 0]];
    for (const [a, b] of cuts) {
      if (a > 0) points.push([a, 0], [a, notchDepth]);
      points.push([b, notchDepth]);
      if (b < width) points.push([b, 0]);
    }
    if (points.at(-1)[0] !== width) points.push([width, 0]);
    return points;
  };
  const lower = edge(mergeCuts(backCuts, width)),
    upper = edge(mergeCuts(frontCuts, width))
      .reverse()
      .map(([x, y]) => [x, depth - y]);
  return [...lower, ...upper].filter(
    (p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1],
  );
}

// Every record below is consumed by BOTH 3D and the cut/BOM adapter.
export function carcassParts(p, units) {
  const parts = [];
  const runs=frameRuns(units);
  for (const [index, run] of runs.entries()) {
    const { start, end, z, h, d } = run,
      pw = PROFILE.width,
      ph = PROFILE.height;
    const bottom = z + (z === 0 ? ph : 0),
      H = h - (z === 0 ? ph : 0),
      runId = `R${index + 1}`;
    const verticalOverlap=v=>Math.min(z+h,v.z+v.h)-Math.max(z,v.z)>.1;
    const adjacent=side=>units.find(v=>v.wall===run.wall&&!run.units.some(u=>u.id===v.id)&&!['fridge','dishwasher'].includes(v.type)&&verticalOverlap(v)&&Math.abs(side==='left'?v.x+v.w-start:v.x-end)<.1);
    const ownerKey=[...run.units.map(u=>u.id)].sort()[0];
    const ownsSide=neighbor=>!neighbor||h>neighbor.h||(h===neighbor.h&&(d>neighbor.d||(d===neighbor.d&&ownerKey<neighbor.id)));
    const hasLeftSash=ownsSide(adjacent('left')),hasRightSash=ownsSide(adjacent('right'));
    const t=PROFILE.acp,
      frameStart=start+(hasLeftSash?SASH_PROFILE.depth:0),
      frameEnd=end-(hasRightSash?SASH_PROFILE.depth:0),
      frameBack=t,frameFront=d-t,frameDepth=frameFront-frameBack;
    const base = {
      runId,
      wall: run.wall,
      ix: run.units[0].ix,
      iy: run.units[0].iy,
      islandX: run.units[0].islandX,
      islandY: run.units[0].islandY,
      islandRotation: run.units[0].islandRotation,
      islandDepth: run.units[0].d,
      islandOverhang: run.units[0].islandOverhang,
      islandPhysicalDepth: run.units[0].islandPhysicalDepth,
      featureKind: run.units[0].featureKind,
      islandStart: start,
      unitIds: run.units.map((u) => u.id),
    };
    let seq = 0;
    const add = (name, kind, w, hh, dd, x, y, zz, extra = {}) => {
      if (Math.min(w, hh, dd) <= 0) return;
      parts.push({
        ...base,
        id: `${runId}-${++seq}`,
        name,
        kind,
        w,
        h: hh,
        d: dd,
        x,
        y,
        z: zz,
        ...extra,
      });
    };
    const bar = (name, w, h, d, x, y, z, axis, extra = {}) =>
      add(name, "bar", w, h, d, x, y, z, {
        axis,
        profile: "BOX_25.4x38.1x1.2",
        length: axis === "x" ? w : axis === "y" ? h : d,
        ...extra,
      });
    const panel = (name, w, h, d, x, y, z, extra = {}) => {
      const dims = [w, h, d].sort((a, b) => b - a);
      add(name, "panel", w, h, d, x, y, z, {
        material: "Carcass ACP",
        cutW: dims[0],
        cutH: dims[1],
        thickness: 3,
        ...extra,
      });
    };
    const spacing = Number.isFinite(p.fabrication?.rearSupportSpacing)
      ? Math.max(100, Math.min(1200, p.fabrication.rearSupportSpacing))
      : 600;
    const rearAdjustment = Number.isInteger(p.fabrication?.rearSupportAdjustment)
      ? Math.max(-10, Math.min(20, p.fabrication.rearSupportAdjustment))
      : 0;
    const { front: posts, rear } = supportPlan({...run,start:frameStart,end:frameEnd}, spacing, rearAdjustment);
    // Each usable shelf opening gets its own closed perimeter. A sink, drawer,
    // pullout or oven ends the opening; no shelf member is allowed to bridge it.
    const shelfSpans=[];
    let shelfSpan=null;
    const finishShelfSpan=()=>{
      if(!shelfSpan)return;
      const a=Math.max(frameStart,shelfSpan[0]),b=Math.min(frameEnd,shelfSpan[1]);
      if(b-a>2*pw+.1)shelfSpans.push([a,b]);
      shelfSpan=null;
    };
    for(const u of run.units){
      if(!shelfAllowed(u)){finishShelfSpan();continue;}
      if(!shelfSpan||u.x>shelfSpan[1]+.1){finishShelfSpan();shelfSpan=[u.x,u.x+u.w];}
      else shelfSpan[1]=Math.max(shelfSpan[1],u.x+u.w);
    }
    finishShelfSpan();
    // Continuous top/bottom rails; joins at long spans are review-only, not hidden.
    for (const y of [bottom, bottom + H - ph])
      for (const zz of [frameBack, frameFront - pw])
        for (let a = frameStart; a < frameEnd; a += 6377)
          bar("Run rail", Math.min(6377, frameEnd - a), ph, pw, a, y, zz, "x");
    for (const x of posts)
      bar("Front upright", pw, H - 2 * ph, ph, x, bottom + ph, frameFront - ph, "y");
    // Turn the concealed rear uprights: 38.1 mm across the run and 25.4 mm
    // in cabinet depth. They finish flush with the rear rails and ACP datum.
    for (const x of rear)
      bar("Rear upright", ph, H - 2 * ph, pw, x, bottom + ph, frameBack, "y");
    for (const x of posts) {
      for (const yy of [bottom, bottom + H - ph])
        bar("Cross rail", pw, ph, frameDepth - 2 * pw, x, yy, frameBack+pw, "z");
    }
    for(const [shelfIndex,[a,b]] of shelfSpans.entries()){
      const assemblyId=`${runId}-SHELF-${shelfIndex+1}`,
        extra={assemblyId,assemblyType:'shelf-frame'},
        y=bottom+H/2,
        shelfBack=frameBack+pw+t,
        shelfFront=frameFront-pw,
        crossDepth=shelfFront-shelfBack-pw;
      // Rear + front rails and left + right rails are a true four-sided frame.
      // The rear rail sits immediately in front of the 3 mm rear liner.
      bar('Shelf rear rail',b-a,ph,pw,a,y,shelfBack,'x',extra);
      bar('Shelf front rail',b-a,ph,pw,a,y,shelfFront,'x',extra);
      bar('Shelf left rail',pw,ph,crossDepth,a,y,shelfBack+pw,'z',extra);
      bar('Shelf right rail',pw,ph,crossDepth,b-pw,y,shelfBack+pw,'z',extra);
      // Long shelves may use cabinet-division cross members, but both ends of
      // every such member terminate into the front and rear perimeter rails.
      for(const x of posts.filter(x=>x>a+pw+.1&&x<b-2*pw-.1))
        bar('Shelf intermediate rail',pw,ph,crossDepth,x,y,shelfBack+pw,'z',extra);
    }
    if (z === 0) {
      const assemblyId=`${runId}-PLINTH`,extra={assemblyId,assemblyType:'plinth-frame'},
        rearZ=50,frontZ=frameFront-pw,crossDepth=frontZ-rearZ-pw;
      // Toe frame is also closed: the front/rear runners never finish in air.
      bar('Plinth rear rail',frameEnd-frameStart,ph,pw,frameStart,0,rearZ,'x',extra);
      bar('Plinth front rail',frameEnd-frameStart,ph,pw,frameStart,0,frontZ,'x',extra);
      bar('Plinth left rail',pw,ph,crossDepth,frameStart,0,rearZ+pw,'z',extra);
      bar('Plinth right rail',pw,ph,crossDepth,frameEnd-pw,0,rearZ+pw,'z',extra);
    }
    // Fixed box ends use the actual door sash on ALL FOUR edges. No grip rise,
    // handle extrusion or hinge hardware. Keep the external cabinet envelope;
    // the box framework is inset by the full sash depth to avoid intersections.
    for(const side of ['left','right']){
      if((side==='left'&&!hasLeftSash)||(side==='right'&&!hasRightSash))continue;
      const sd=SASH_PROFILE.depth,face=SASH_PROFILE.face;
      const assemblyId=`${runId}-END-${side.toUpperCase()}`;
      const originX=side==='left'?frameStart:frameEnd;
      const originZ=side==='left'?0:d;
      const rotationY=side==='left'?-Math.PI/2:Math.PI/2;
      for(const [edge,length,bx,by,bw,bh,px,py,angle] of [
        ['BOT',d,0,0,d,face,0,0,0],
        ['TOP',d,0,H-face,d,face,d,H,Math.PI],
        ['LFT',H,0,0,face,H,0,H,-Math.PI/2],
        ['RHT',H,d-face,0,face,H,d,0,Math.PI/2],
      ]){
        add(`End sash ${edge}`,'bar',sd,bh,bw,side==='left'?start:frameEnd,bottom+by,side==='left'?bx:d-bx-bw,{
          assemblyId,assemblyType:'fixed-end',hasHandle:false,
          axis:edge==='BOT'||edge==='TOP'?'z':'y',length,profile:SASH_PROFILE.id,
          miterStart:45,miterEnd:45,endDetail:'Fixed end sash: mitred 45/45, no handle',
          sashPlacement:{origin:[originX,bottom,originZ],rotationY,position:[px,py,0],rotationZ:angle},
        });
      }
      const inset=SASH_PROFILE.panelInset,thickness=SASH_PROFILE.panelThickness;
      panel('Fixed end sash infill',thickness,H-2*inset,d-2*inset,
        side==='left'?frameStart-SASH_PROFILE.panelDepth-thickness:frameEnd+SASH_PROFILE.panelDepth,
        bottom+inset,inset,{assemblyId,assemblyType:'fixed-end',hasHandle:false,material:'Front ACP',thickness});
    }
    // No duplicate plain-ACP inner side skin. The fixed four-sided sash and
    // its channel-seated infill are the visible and structural box end.
    // Stock-bounded continuous panels. Prefer supported seams at front dividers;
    // impossible stock is rejected by nesting, never silently split into slivers.
    const stockW = p.fabrication?.sheetWidth ?? 2440,
      margin = p.fabrication?.sheetMargin ?? 10;
    const maxPanel = Math.max(100, Math.min(2400, stockW - 2 * margin));
    const spans = (a, b) => {
      const result = [];
      while (b - a > 0.01) {
        let finish = Math.min(b, a + maxPanel);
        if (finish < b) {
          const support = posts.filter((x) => x > a + pw && x+pw/2 <= finish).at(-1);
          if (support) finish = support + pw / 2;
        }
        result.push([a, finish]);
        a = finish;
      }
      return result;
    };
    const horizontal = (name, a, b, y, geometry={}) => {
      a=Math.max(a,frameStart);
      b=Math.min(b,frameEnd);
      for (const [l, r] of spans(a, b)) {
        const panelFront=geometry.panelFront??frameFront-pw,
          panelBack=geometry.panelBack??frameBack+pw+t;
        const cutPosts=parts.filter(q=>q.runId===runId&&q.name==='Front upright'&&q.x<r&&q.x+q.w>l&&q.y<y+t&&q.y+q.h>y&&q.z<panelFront);
        const frontCuts = cutPosts.map(q => [q.x - l - FIT_CLEARANCE, q.x + q.w - l + FIT_CLEARANCE]),
          backCuts = []; // The shelf butts against the inner rear liner, clear of rear posts.
        const cutDepth=cutPosts.length?Math.max(...cutPosts.map(q=>panelFront-q.z+FIT_CLEARANCE)):0;
        const panelD = panelFront-panelBack,
          outline = notchedOutline(
            r - l,
            panelD,
            frontCuts,
            backCuts,
            cutDepth,
          );
        panel(name, r - l, 3, panelD, l, y, panelBack, {
          cutW: r - l,
          cutH: panelD,
          outline,
          plane: "horizontal",
          notchDepth: cutDepth,
          notchSources:cutPosts.map(q=>q.id),
          fitClearance:FIT_CLEARANCE,
          notches: {
            front: mergeCuts(frontCuts, r - l),
            rear: mergeCuts(backCuts, r - l),
          },
        });
      }
    };
    horizontal("Continuous U-notched bottom", frameStart, frameEnd, bottom + ph);
    // A bottom cabinet has no ACP top liner: the granite/worktop is its cover.
    // Upper and tall frames retain top liners, with appliance openings clear.
    if (z > 0 || h >= 1000) {
      let topStart=null,topEnd;
      for(const u of [...run.units,{type:'sink'}]){
        if(!['sink','cooker'].includes(u.type)){topStart??=Math.max(frameStart,u.x);topEnd=Math.min(frameEnd,u.x+u.w)}
        else if(topStart!==null){horizontal('Continuous U-notched top',topStart,topEnd,bottom+H-ph-t);topStart=null}
      }
    }
    for(const [shelfStart,shelfEnd] of shelfSpans)
      horizontal(
        "Continuous U-notched shelf",
        shelfStart+pw,
        shelfEnd-pw,
        bottom + H / 2 + ph,
        {panelBack:frameBack+2*pw+t,panelFront:frameFront-pw},
      );
    // Rear liner is on the ROOM side of the rearmost posts, not behind them.
    // This is a physical 3 mm lining, not a rendering mask.
    for (const [l, r] of spans(frameStart, frameEnd))
      panel("Continuous rear cladding", r - l, H-2*ph, t, l, bottom+ph, frameBack+pw);
  }
  for (const u of units) {
    const isCorner = ["corner", "wallCorner"].includes(u.type);
    if (u.type !== "filler" && !isCorner) continue;
    const w = isCorner ? (u.type === "corner" ? 625 : 375) : u.w;
    parts.push({
      id: `${u.id}-CLOSURE`,
      name: isCorner ? "Blind corner closure" : "Run end closure",
      kind: "panel",
      wall: u.wall,
      ix: u.ix,
      iy: u.iy,
      islandStart: 0,
      unitIds: [u.id],
      w,
      h: isCorner ? u.h - (u.z > 0 ? 3 : 44) : u.h,
      d: 3,
      x: u.x + (isCorner && u.hand !== "left" ? u.w - w : 0),
      y: isCorner ? u.z + (u.z > 0 ? 1.5 : 41) : u.z,
      z: u.d,
      material: "Front ACP",
      thickness: 3,
      cutW: w,
      cutH: isCorner ? u.h - (u.z > 0 ? 3 : 44) : u.h,
    });
  }
  return parts;
}
