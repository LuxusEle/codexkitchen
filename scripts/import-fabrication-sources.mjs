import {readFile,copyFile,mkdir,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const aluminum='C:/Users/asank/Documents/Aluminum';
const specs=[
  ...['frame.js','sash.js','sashdoor.js','gbb.js','custom_profile.js','frameanddoor.js','kitchen_assembly.js','estimator.js','src/frame.js','src/sash_door.js',
    'consolidated-designer/src/modules/frameGenerator.js','consolidated-designer/src/modules/sashDoorGenerator.js','consolidated-designer/src/modules/coreUtils.js','consolidated-designer/src/modules/dxfExporter.js']
    .map(file=>({source:`${aluminum}/${file}`,target:`aluminum/${file}`})),
  {source:resolve(root,'../Cabinex_Master_Studio/cabinex_master.rb'),target:'master/cabinex_master.rb'},
  {source:resolve(root,'../cbx_hybrid_engine.rb'),target:'combined/combined_engine.rb'},
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const records=[];
for(const spec of specs){
  const dest=resolve(root,'reference/fabrication',spec.target),bytes=await readFile(spec.source);
  await mkdir(dirname(dest),{recursive:true});
  let exists=true;try{await access(dest)}catch{exists=false}
  if(exists){if(hash(await readFile(dest))!==hash(bytes))throw Error(`Snapshot differs; not overwriting ${dest}`)}
  else await copyFile(spec.source,dest);
  if(hash(await readFile(dest))!==hash(bytes))throw Error(`Copy verification failed: ${dest}`);
  records.push({...spec,sha256:hash(bytes),bytes:bytes.length});
}
await writeFile(resolve(root,'reference/fabrication/manifest.json'),JSON.stringify({copiedAt:new Date().toISOString(),policy:'Originals unchanged. Snapshots unmodified; web adapters live in src.',files:records},null,2));
console.log(`Verified ${records.length} byte-identical source copies.`);
