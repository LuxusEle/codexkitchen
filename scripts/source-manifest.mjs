import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const sources=[['reference/aluminum_engine.rb','../cabinex_ai/cbx_hybrid_engine.rb'],['reference/combined_engine.rb','../cbx_hybrid_engine.rb'],['reference/sketchup_planner.rb','../cabinex_ai/cbx_hybrid_planner.rb'],['reference/layout_solver.rb','../cabinex_ai/cbx_layout_solver.rb'],['reference/master_studio.rb','../Cabinex_Master_Studio/cabinex_master.rb'],['reference/assembly_plan.md','../Cabinex_Assembly_Lab/PLAN.md'],['reference/browser_frame.js','C:/Users/asank/Documents/Aluminum/aluminum-kitchen-designer/frameanddoor.js']];
const files=sources.map(([copy,source])=>{const data=fs.readFileSync(path.join(root,copy)),original=fs.readFileSync(path.resolve(root,source));if(!data.equals(original))throw Error(`Source changed: ${copy}`);return {copy,source,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')}});
fs.writeFileSync(path.join(root,'reference','manifest.json'),JSON.stringify({captured:new Date().toISOString(),purpose:'Source snapshots for UAT 1 port; not loaded into browser',files},null,2));console.log(`${files.length} source copies verified byte-for-byte.`);
