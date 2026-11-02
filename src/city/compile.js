// Local metric scene format shared by the offline pipeline and live tile preview.
export const pilot={origin:{lat:11.9325,lon:79.833},bounds:[-600,-650,600,650]};
export function projectPoint([lon,lat],origin){return [(lon-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180),-(lat-origin.lat)*111320];}
export function unprojectPoint([x,z],origin){return [origin.lon+x/(111320*Math.cos(origin.lat*Math.PI/180)),origin.lat-z/111320];}
const positive=(v)=>{const n=typeof v==='string'?Number.parseFloat(v):Number(v);return Number.isFinite(n)&&n>0?n:null;};
export function compileCity(collection,{origin=pilot.origin,bounds=pilot.bounds,source={name:'Imported geographic data',license:'unspecified'}}={}){
 if(collection?.type!=='FeatureCollection')throw Error('Expected a GeoJSON FeatureCollection');
 if(!Number.isFinite(origin.lat)||!Number.isFinite(origin.lon)||Math.abs(origin.lat)>85)throw Error('Invalid local origin');
 const city={version:1,origin,bounds,source,buildings:[],roads:[],trees:[],water:[],parks:[],models:[],quality:{estimatedHeights:0,estimatedRoadWidths:0}};
 const seen=new Set(),inside=([x,z])=>x>=bounds[0]&&x<=bounds[2]&&z>=bounds[1]&&z<=bounds[3];
 const point=c=>{if(!Array.isArray(c)||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>90)throw Error('Invalid WGS84 coordinate');return projectPoint(c,origin).map(n=>Math.round(n*100)/100);};
 const intersects=points=>{const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);return Math.max(...xs)>=bounds[0]&&Math.min(...xs)<=bounds[2]&&Math.max(...zs)>=bounds[1]&&Math.min(...zs)<=bounds[3];};
 for(const f of collection.features){
  const g=f.geometry,p=f.properties||{};if(!g)continue;
  const key=JSON.stringify([f.id,p._kind,g]);if(seen.has(key))continue;seen.add(key);
  const kind=p._kind||(p.building?'building':p.highway?'road':p.natural==='tree'?'tree':p.natural==='water'||p.water?'water':p.leisure==='park'||p.landuse==='grass'?'park':null);
  const id=String(f.id??p.id??`${kind}-${seen.size}`);
  if(kind==='tree'&&g.type==='Point'){const position=point(g.coordinates);if(inside(position))city.trees.push({id,position,height:positive(p.height)||7,estimatedHeight:!positive(p.height)});continue;}
  if(kind==='road'&&['LineString','MultiLineString'].includes(g.type)){
   const classification=p.highway||p.class||'unclassified';
   if(['motorway','motorway_link','trunk','trunk_link','rail','railway','transit'].includes(classification)||p.foot==='no'||p.access==='private')continue;
   const explicit=positive(p.width),lanes=positive(p.lanes),width=explicit|| (lanes?lanes*3: ['footway','path','pedestrian','cycleway'].includes(classification)?2.5:6);
   for(const path of g.type==='LineString'?[g.coordinates]:g.coordinates){const points=path.map(point);if(points.length>1&&intersects(points)){city.roads.push({id,points,width:Math.min(width,30),name:p.name||'',estimatedWidth:!explicit});if(!explicit)city.quality.estimatedRoadWidths++;}}
  }
  if(['building','water','park'].includes(kind)&&['Polygon','MultiPolygon'].includes(g.type)){
   for(const polygon of g.type==='Polygon'?[g.coordinates]:g.coordinates){
    const rings=polygon.map(r=>r.map(point));if(!rings[0]||rings[0].length<4||!intersects(rings[0]))continue;
    if(kind==='building'){
     const height=positive(p.height),levels=positive(p['building:levels']),render=positive(p.render_height);
     const heightSource=height?'tag-height':levels?'levels-estimate':render?'provider-height':'default-estimate';
     city.buildings.push({id,rings,bounds:[Math.min(...rings[0].map(p=>p[0])),Math.min(...rings[0].map(p=>p[1])),Math.max(...rings[0].map(p=>p[0])),Math.max(...rings[0].map(p=>p[1]))],height:Math.min(height||levels*3.2||render||8,250),base:Math.max(0,positive(p.min_height)||positive(p.render_min_height)||0),heightSource});
     if(heightSource!=='tag-height')city.quality.estimatedHeights++;
    }else city[kind==='water'?'water':'parks'].push({id,rings});
   }
  }
 }
 if(city.roads.length===0)throw Error('No mapped walkable roads in this area. Load more map detail or import a complete pilot extract.');
 return city;
}
export function pointInRing([x,z],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [a,b]=ring[i],[c,d]=ring[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)inside=!inside;}return inside;}
export function inPolygon(point,rings){return pointInRing(point,rings[0])&&!rings.slice(1).some(r=>pointInRing(point,r));}
export function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
export function canWalk(city,p,radius=.35){
 const [x,z]=p,[w,n,e,s]=city.bounds;if(x<w+radius||x>e-radius||z<n+radius||z>s-radius)return false;
 if(city.water.some(b=>inPolygon(p,b.rings)))return false;
 if(city.buildings.some(b=>(!b.bounds||(x>=b.bounds[0]-radius&&x<=b.bounds[2]+radius&&z>=b.bounds[1]-radius&&z<=b.bounds[3]+radius))&&b.base<2&&(inPolygon(p,b.rings)||b.rings.some(r=>r.some((a,i)=>i&&segmentDistance(p,r[i-1],a)<radius)))))return false;
 if(city.trees.some(t=>Math.hypot(x-t.position[0],z-t.position[1])<radius+.25))return false;
 return city.parks.some(b=>inPolygon(p,b.rings))||city.roads.some(r=>r.points.some((a,i)=>i&&segmentDistance(p,r.points[i-1],a)<=r.width/2+1.4-radius));
}
export function findSpawn(city){
 const choices=[];
 for(const road of city.roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i];
  for(const t of [0,.25,.5,.75,1]){const p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(canWalk(city,p))choices.push({position:p,yaw:Math.atan2(-(b[0]-a[0]),-(b[1]-a[1]))});}
 }
 choices.sort((a,b)=>Math.hypot(...a.position)-Math.hypot(...b.position));
 if(!choices.length)throw Error('No safe road spawn exists in this extract');return choices[0];
}
export function movePlayer(city,position,delta){
 let p=[...position];const steps=Math.max(1,Math.ceil(Math.hypot(...delta)/.15));
 for(let i=0;i<steps;i++){const x=[p[0]+delta[0]/steps,p[1]];if(canWalk(city,x))p=x;const z=[p[0],p[1]+delta[1]/steps];if(canWalk(city,z))p=z;}
 return p;
}
