import { zipSync, strToU8 } from "fflate";
import { frontSpecs } from './assembly.js';
import {
  TYPES,
  wallPoint,
  wallLength,
  footprint,
  islandSettings,
  renderingPrompt,
} from "./model";
export function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand("copy");
  input.remove();
  if (!ok)
    throw Error(
      "Select and copy the prompt below. Clipboard access is unavailable.",
    );
}
function sheet(title) {
  const c = document.createElement("canvas");
  c.width = 1800;
  c.height = 1200;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f8faf8";
  ctx.fillRect(0, 0, 1800, 1200);
  ctx.fillStyle = "#163d43";
  ctx.font = "bold 32px Arial";
  ctx.fillText("CODEX KITCHEN / " + title, 70, 60);
  ctx.font = "18px Arial";
  ctx.fillStyle = "#536769";
  ctx.fillText(
    "UAT 1 · dimensions in millimeters · design reference",
    70,
    1110,
  );
  return [c, ctx];
}
export function planImage(p, units) {
  const [c, ctx] = sheet("ROOM PLAN"),
    s = Math.min(1550 / p.room.width, 900 / p.room.depth),
    ox = (1800 - p.room.width * s) / 2,
    oy = 120;
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  ctx.lineWidth = 3 / s;
  ctx.fillStyle = "#e6ebe7";
  ctx.fillRect(0, 0, p.room.width, p.room.depth);
  ctx.strokeStyle = "#234d52";
  ctx.strokeRect(0, 0, p.room.width, p.room.depth);
  for (const u of [...units].sort((a, b) => b.z - a.z)) {
    let a, b;
    if (u.wall === "Island") {
      const f=footprint(p,u);
      a = [f[0],f[1]];
      b = [f[2],f[3]];
    } else {
      a = wallPoint(p.room, u.wall, u.x);
      b = wallPoint(p.room, u.wall, u.x + u.w, u.d);
    }
    const x = Math.min(a[0], b[0]),
      y = Math.min(a[1], b[1]),
      w = Math.abs(a[0] - b[0]),
      d = Math.abs(a[1] - b[1]);
    ctx.fillStyle = u.z > 900 ? "#d6e3df" : p.style.front;
    ctx.globalAlpha = u.z > 900 ? 0.4 : 1;
    ctx.fillRect(x, y, w, d);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#4b696b";
    ctx.strokeRect(x, y, w, d);
    ctx.fillStyle = "#123d43";
    ctx.font = `${28 / s}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText(u.id, x + w / 2, y + d / 2);
  }
  for (const o of p.openings) {
    const a = wallPoint(p.room, o.wall, o.x),
      b = wallPoint(p.room, o.wall, o.x + o.w);
    ctx.strokeStyle = o.kind === "window" ? "#21899d" : "#d78c3e";
    ctx.lineWidth = 12 / s;
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  }
  ctx.font = `${25 / s}px Arial`;
  ctx.fillStyle = "#163d43";
  ctx.fillText(`A · ${p.room.width} mm`, p.room.width / 2, -30 / s);
  ctx.fillText(
    `C · ${p.room.width} mm`,
    p.room.width / 2,
    p.room.depth + 45 / s,
  );
  ctx.save();
  ctx.translate(-35 / s, p.room.depth / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`D · ${p.room.depth} mm`, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(p.room.width + 45 / s, p.room.depth / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(`B · ${p.room.depth} mm`, 0, 0);
  ctx.restore();
  return c.toDataURL("image/png");
}
export function elevationImage(p, units, wall) {
  const [c, ctx] = sheet(`WALL ${wall} ELEVATION`),
    len = wallLength(p.room, wall),
    s = Math.min(1550 / len, 850 / p.room.height),
    ox = (1800 - len * s) / 2,
    base = 1010;
  const rect = (x, y, w, h) => [ox + x * s, base - (y + h) * s, w * s, h * s];
  ctx.fillStyle = p.style.wall;
  ctx.fillRect(...rect(0, 0, len, p.room.height));
  ctx.strokeStyle = "#506d72";
  ctx.lineWidth = 2;
  ctx.strokeRect(...rect(0, 0, len, p.room.height));
  for (const o of p.openings.filter((o) => o.wall === wall)) {
    ctx.fillStyle = o.kind === "window" ? "#b3dce2" : "#ead2b5";
    ctx.fillRect(...rect(o.x, o.sill, o.w, o.h));
    ctx.strokeRect(...rect(o.x, o.sill, o.w, o.h));
    ctx.fillStyle = "#254f54";
    ctx.font = "18px Arial";
    ctx.fillText(
      `${o.kind} / sill ${o.sill}`,
      ox + o.x * s + 8,
      base - (o.sill + o.h) * s + 24,
    );
  }
  for (const u of units.filter((u) => u.wall === wall)) {
    ctx.fillStyle = u.frontColor || ((u.frontMaterial || (u.type==='glass'?'glass':'acp')) === "glass" ? "#91b7ba" : p.style.front);
    ctx.fillRect(...rect(u.x, u.z, u.w, u.h));
    ctx.strokeStyle = p.style.frame;
    ctx.lineWidth = 3;
    ctx.strokeRect(...rect(u.x, u.z, u.w, u.h));
    for(const f of frontSpecs(u))ctx.strokeRect(...rect(u.x+f.x,f.y,f.w,f.h));
    ctx.fillStyle = "#163d43";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText(u.id, ox + (u.x + u.w / 2) * s, base - (u.z + u.h / 2) * s);
    ctx.font = "15px Arial";
    ctx.fillText(
      `${Math.round(u.w)} mm`,
      ox + (u.x + u.w / 2) * s,
      base - (u.z + u.h / 2) * s + 22,
    );
  }
  ctx.fillStyle = "#163d43";
  ctx.font = "22px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${len} mm`, 900, 1060);
  return c.toDataURL("image/png");
}
export function islandElevationImage(p, units) {
  const island=units.filter(u=>u.wall==="Island").sort((a,b)=>(a.x||0)-(b.x||0));
  if(!island.length)return null;
  const cfg=islandSettings(p),[c,ctx]=sheet(`${cfg.kind==="breakfast"?"BREAKFAST BAR":"ISLAND"} FRONT ELEVATION`),
    width=Math.max(cfg.width,...island.map(u=>(u.x||0)+u.w)),height=Math.max(850,...island.map(u=>u.z+u.h)),
    s=Math.min(1450/width,720/height),ox=(1800-width*s)/2,base=950;
  const rect=(x,y,w,h)=>[ox+x*s,base-(y+h)*s,w*s,h*s];
  ctx.fillStyle="#eef1ed";
  ctx.fillRect(...rect(0,0,width,height));
  ctx.strokeStyle=p.style.frame;
  ctx.lineWidth=3;
  ctx.strokeRect(...rect(0,0,width,height));
  for(const u of island){
    ctx.fillStyle=u.frontColor||p.style.front;
    ctx.fillRect(...rect(u.x||0,u.z,u.w,u.h));
    ctx.strokeRect(...rect(u.x||0,u.z,u.w,u.h));
    for(const front of frontSpecs(u))ctx.strokeRect(...rect((u.x||0)+front.x,front.y,front.w,front.h));
    ctx.fillStyle="#163d43";
    ctx.textAlign="center";
    ctx.font="bold 18px Arial";
    ctx.fillText(u.id,ox+((u.x||0)+u.w/2)*s,base-(u.z+u.h/2)*s);
    ctx.font="15px Arial";
    ctx.fillText(`${Math.round(u.w)} mm`,ox+((u.x||0)+u.w/2)*s,base-(u.z+u.h/2)*s+23);
  }
  if(cfg.kind==="breakfast"){
    ctx.fillStyle="#6f3d22";
    for(let x=0;x<220;x+=16)ctx.fillRect(690+x,985,8,42);
    ctx.fillStyle="#163d43";
    ctx.font="18px Arial";
    ctx.fillText(`Reverse/public face: timber slats · ${cfg.overhang} mm stone overhang · ${cfg.pendants} pendant lights`,900,1020);
  }
  ctx.fillStyle="#163d43";
  ctx.font="22px Arial";
  ctx.textAlign="center";
  ctx.fillText(`${Math.round(width)} mm overall · room position X ${Math.round(cfg.x)} / Y ${Math.round(cfg.y)} · rotation ${cfg.rotation}°`,900,1070);
  return c.toDataURL("image/png");
}
const bytes = (url) =>
  Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));
export function preparePack(p, plan, scene) {
  const prompt = renderingPrompt(p, plan),
    islandElevation=islandElevationImage(p,plan.units),
    images = [
      { name: "01-perspective.png", url: scene.capture() },
      { name: "02-isometric-box-width-reference.png", url: scene.capture("iso") },
      { name: "03-room-plan.png", url: planImage(p, plan.units) },
      ...["A","B","C","D"].map((w) => ({
        name: `04-elevation-wall-${w}.png`,
        url: elevationImage(p, plan.units, w),
      })),
      ...(islandElevation?[{name:"05-elevation-island-front.png",url:islandElevation}]:[]),
      {
        name: "06-aluminum-frame.png",
        url: scene.capture("perspective", "frame"),
      },
      {name:'07-frame-and-carcass.png',url:scene.capture('perspective','carcass')},
    ];
  const items = {};
  for (const img of images) items[img.name] = bytes(img.url);
  items["render-prompt.txt"] = strToU8(prompt);
  items["kitchen-project.json"] = strToU8(JSON.stringify(p, null, 2));
  items["resolved-design.json"] = strToU8(
    JSON.stringify(
      {
        ...p,
        units: plan.units,
        validation: { errors: plan.errors, unmet: plan.unmet },
      },
      null,
      2,
    ),
  );
  items["cabinet-schedule.csv"] = strToU8(
    [
      "ID,Type,Wall,Offset_mm,World_X_mm,World_Y_mm,Rotation_deg,Width_mm,Height_mm,Depth_mm,Bottom_mm",
      ...plan.units.map((u) => {
        const position=u.wall==="Island"
          ? [u.islandX??u.ix??0,u.islandY??u.iy??0,u.islandRotation??0]
          : [...wallPoint(p.room,u.wall,u.x),0];
        return [
          u.id,
          TYPES[u.type].name,
          u.wall,
          u.x,
          Math.round(position[0]),
          Math.round(position[1]),
          position[2],
          Math.round(u.w),
          u.h,
          u.d,
          u.z,
        ].join(",");
      }),
    ].join("\r\n"),
  );
  items["READ-ME.txt"] = strToU8(
    "Attach the perspective, dimensioned isometric, room plan, all four wall elevations and island elevation (when present) in ChatGPT, then paste render-prompt.txt. Box labels use ID / W(width in mm); the cabinet schedule maps every label to position and size. Frame and carcass images provide construction context. Image generation can reinterpret dimensions: the JSON and schedule remain the design reference.\n\nThe web model includes shared run frames, independent rear supports, continuous U-notched cladding and the detailed lipped web sash. The combined-engine grip is adapted without replacing that sash; this hybrid extrusion requires approval. Original sources are copied unchanged under reference/.\n\nCutting & BOM provides a separate REVIEW ZIP with stock nesting, outlines, cuts and provisional hardware. These are not machine-release files. Hardware drilling, structural support approval, splice/connector details, worktop and drawer-box manufacture, column cutouts, full corner joinery, pricing, swept-door collision checking and the complete catalogue remain outstanding.\n\nPhone: use Share images + prompt and choose ChatGPT if listed. Native sharing needs a supported secure browser context; on local-network HTTP use image downloads and copy/paste. The website cannot force another app to accept attachments.",
  );
  const zip = new Blob([zipSync(items)], { type: "application/zip" });
  const shareFiles = images.map(
    (img) => new File([items[img.name]], img.name, { type: "image/png" }),
  );
  return { images, prompt, zip, shareFiles };
}
export function reminderICS(p) {
  if (!p.reminder) throw Error("Choose a reminder date and time first.");
  const date = new Date(p.reminder);
  if (!Number.isFinite(date.getTime()))
    throw Error("Choose a valid reminder date.");
  const format = (d) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const esc = (s) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  return new Blob(
    [
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CODEXKITCHENAPP//UAT1//EN",
        "BEGIN:VEVENT",
        `UID:${crypto.randomUUID?.() || Date.now()}@codexkitchen.local`,
        `DTSTAMP:${format(new Date())}`,
        `DTSTART:${format(date)}`,
        `DTEND:${format(new Date(date.getTime() + 1800000))}`,
        `SUMMARY:${esc("Kitchen site check: " + p.name)}`,
        `DESCRIPTION:${esc(p.notes || "Confirm room measurements, openings, services and appliance dimensions.")}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Kitchen site check",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    ],
    { type: "text/calendar;charset=utf-8" },
  );
}
