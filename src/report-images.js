import {planImage,elevationImage,islandElevationImage} from './exports.js';
export async function reportImages(p,plan,scene){
 if(typeof scene?.capture!=='function')throw new Error('The 3D view is still loading. Please retry the renders.');
 const images=[];
 for(const [name,view,mode] of [
  ['01-perspective.jpg','perspective','finished'],['02-isometric.jpg','iso','finished'],
  ['03-left-side.jpg','D','finished'],['04-right-side.jpg','B','finished'],
  ['05-isometric-frame.jpg','iso','frame'],['06-frame-and-carcass.jpg','perspective','carcass']
 ]){
  await new Promise(resolve=>setTimeout(resolve,25));
  images.push({name,url:scene.capture(view,mode,{width:1440,format:'jpeg',...(['D','B'].includes(view)?{wall:view}: {})})});
 }
 images.push({name:'07-room-plan.png',url:planImage(p,plan.units)});
 for(const wall of ['A','B','C','D']){await new Promise(resolve=>setTimeout(resolve,25));images.push({name:`08-elevation-wall-${p.siteWallLabels?.[wall]||wall}.png`,url:elevationImage(p,plan.units,wall)});}
 const island=islandElevationImage(p,plan.units);if(island)images.push({name:'09-island-elevation.png',url:island});
 return images;
}
