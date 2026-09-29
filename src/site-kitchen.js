import {initialProject,TYPES} from './model.js';
export function siteKitchen(){
  const p=initialProject();
  p.name='Site kitchen - 29 September - doorway clear';
  p.room={width:2900,depth:3190,height:2700,layout:'U'};
  p.needs={sink:1,cooker:1,fridge:1,wall:5};p.preferences={sink:'D',cooker:'A',fridge:'B'};p.upperWalls=['A'];
  p.cabinetRuns={base:{A:[0,2900],B:[0,2180],D:[1325,3190]}};
  p.openings=[{id:'bottom-window',wall:'D',kind:'window',x:1930,w:1260,h:1000,sill:1000},{id:'entry',wall:'D',kind:'door',x:430,w:870,h:2100,sill:0},{id:'top-passage',wall:'B',kind:'door',x:2205,w:985,h:2100,sill:0}];
  p.style={...p.style,front:'#454744',frame:'#454744',counter:'#e9e3d8',wall:'#e6e2da'};
  p.fabrication={continuousUpper:true,barLength:6100,sashLength:6400,handleLength:3000,allowRotation:true};
  let n=0;const unit=(type,wall,x,w,extra={})=>({id:'S'+String(++n).padStart(2,'0'),...TYPES[type],type,wall,x,w,z:TYPES[type].z||0,frontMaterial:'acp',...extra});
  p.units=[unit('corner','A',0,1150,{hand:'left'}),unit('cooker','A',1150,600,{frontLayout:'drawers',doorDivisions:2,hoodType:'cassette'}),unit('corner','A',1750,1150,{hand:'right'}),unit('base','B',600,818,{doorDivisions:2}),unit('base','D',1325,465,{doorDivisions:1}),unit('sink','D',1790,800,{doorDivisions:2}),unit('wall','A',0,575,{frontColor:'#dcd5c7',doorDivisions:1}),unit('wall','A',575,575,{frontColor:'#dcd5c7',doorDivisions:1}),unit('wall','A',1750,575,{frontColor:'#dcd5c7',doorDivisions:1}),unit('wall','A',2325,575,{frontColor:'#dcd5c7',doorDivisions:1}),unit('fridge','B',1418,762,{name:'30-inch fridge space - appliance TBD'})];
  p.units.forEach(u=>{if(Number(u.id.slice(1))>=5)u.id='S'+String(Number(u.id.slice(1))+1).padStart(2,'0');});n=12;
  p.units.push(unit('wall','A',1150,600,{h:530,z:1640,frontColor:'#dcd5c7',doorDivisions:2,name:'Above cassette hood'}));
  p.surfaces={graniteBasis:'gross',backsplash:[
    {wall:'A',x:0,w:1150,bottom:875,height:575},
    {wall:'A',x:1150,w:600,bottom:875,height:675},
    {wall:'A',x:1750,w:1150,bottom:875,height:575},
    {wall:'D',x:1325,w:1865,bottom:875,height:101.6},
    {wall:'B',x:0,w:1418,bottom:875,height:101.6}
  ],note:'A and C: nominal 4-inch (101.6 mm) tile strips below the windows/opening. B: full working backsplash to cupboards and hood (575 / 675 mm). C central opening dimensions remain to be surveyed.'};
  p.costing={...p.costing,salesRates:{...p.costing?.salesRates,splash:0}};
  p.siteWallLabels={A:'B',B:'C',C:'D',D:'A'};
  p.notes='REV D - contractor review. A/C backsplash nominal 4 inches; B full working backsplash. Site walls: A=sink/window, B=hob, C=fridge opposite sink, D=plain wall with NO DOOR (latest user correction). Fridge space 762 mm, C offsets 1418-2180. Above-hood cabinet 600 x 530 x 350 at height 1640, top 2170. A entrance starts at 1890; cabinet end 1865. Rectangle 3190 x 2900 approximates stepped room; top wall step 160 omitted. C passage envelope follows existing rectangle, not verified site opening. Green C opening width/sill unmeasured. Assumed ceiling 2700, window sill/height 1000/1000, lower height/depth 850/600, regular upper height/depth 720/350 at 1450. Actual fridge fit, ventilation, hood duct, site dimensions, profiles, fixing and fabrication details need contractor confirmation. Fridge surround and appliances excluded from material BOM.';
  return p;
}
