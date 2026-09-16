// Presentation dimensions only; appliance installation clearances require approval.
export const hoodType=unit=>unit.hoodType==='column'?'column':'cassette';
export function hoodParts(unit){
  const w=unit.w;
  return hoodType(unit)==='column'?
    [{name:'Column hood canopy',w,h:65,d:450,x:0,y:1550,z:0},
     {name:'Hood chimney',w:250,h:450,d:230,x:(w-250)/2,y:1615,z:0}]:
    [{name:'Cassette hood body',w,h:65,d:320,x:0,y:1550,z:0},
     {name:'Cassette hood pull-out lip',w,h:18,d:40,x:0,y:1550,z:320}];
}
