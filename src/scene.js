import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {places, center} from './data.js';
import {compileCity} from './city/compile.js';

const home={center:[center.lon,center.lat],zoom:15.6,pitch:58,bearing:0};
const emptyRoute={type:'FeatureCollection',features:[]};

export function createScene(host,onSelect){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const map=new maplibregl.Map({container:host,style:'https://tiles.openfreemap.org/styles/liberty',...home,
  minZoom:11,maxZoom:20,maxPitch:75,renderWorldCopies:false,
  maxBounds:[[79.70,11.80],[79.95,12.10]],
  attributionControl:false,canvasContextAttributes:{antialias:true}});
 map.addControl(new maplibregl.AttributionControl({compact:false,
  customAttribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'}),'bottom-right');
 map.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
 const status=document.createElement('div');status.className='map-data-status';status.setAttribute('role','status');
 const message=document.createElement('span');message.textContent='Loading Puducherry map data…';status.append(message);
 const retry=document.createElement('button');retry.type='button';retry.textContent='Retry map';retry.hidden=true;retry.onclick=()=>location.reload();status.append(retry);host.append(status);
 let loaded=false,walking=false,routeData=emptyRoute,walker=null,pending=false;
 const fail=()=>{status.hidden=false;message.textContent=loaded?'Some map data could not load. Check your connection or retry the map.':'Map data could not load. Check your connection. Places and day planning still work.';retry.hidden=false;};
 const timeout=setTimeout(()=>{if(!loaded)fail();},20000);
 map.on('error',fail);
 map.on('load',()=>{
  loaded=true;clearTimeout(timeout);status.hidden=true;
  const layers=map.getStyle().layers;
  const building=layers.find(layer=>layer['source-layer']==='building');
  const label=layers.find(layer=>layer.type==='symbol'&&layer.layout?.['text-field']);
  // Geographic polygons and render heights come from the OpenMapTiles schema.
  // Provider/default heights are not surveyed; this limitation is shown in the UI.
  if(building){
   for(const layer of layers.filter(layer=>layer['source-layer']==='building'))map.setLayoutProperty(layer.id,'visibility','none');
   map.addLayer({id:'pondy-buildings',type:'fill-extrusion',source:building.source,'source-layer':'building',minzoom:14,
    filter:['!=',['get','hide_3d'],true],paint:{
     'fill-extrusion-color':'#dccbb0',
     'fill-extrusion-height':['max',0,['to-number',['get','render_height'],8]],
     'fill-extrusion-base':['max',0,['to-number',['get','render_min_height'],0]],
     'fill-extrusion-opacity':0.92,'fill-extrusion-vertical-gradient':true}},label?.id);
  }
  map.setLight({anchor:'viewport',color:'#fff3dc',intensity:0.45,position:[1.5,210,40]});
  map.addSource('day-plan',{type:'geojson',data:routeData});
  map.addLayer({id:'day-plan-line',type:'line',source:'day-plan',paint:{'line-color':'#ae512d','line-width':3,'line-dasharray':[2,2]}});
 });
 const markers=places.map(p=>{
  const e=document.createElement('button');e.type='button';e.className='map-pin geo-pin';e.textContent=p.icon;e.title=p.name;
  e.setAttribute('aria-label',`Explore ${p.name}`);e.onclick=ev=>{ev.stopPropagation();onSelect(p.id);};
  const marker=new maplibregl.Marker({element:e,anchor:'bottom'}).setLngLat([p.lon,p.lat]).addTo(map);
  return {p,e,marker};
 });
 const ease=options=>map.easeTo({...options,duration:reduce?0:650});
 function stopWalk(){walking=false;walker?.dispose();walker=null;host.classList.remove('street-mode');host.dispatchEvent(new CustomEvent('walkchange',{detail:false}));}
 function tileCity(){
  if(!loaded||!map.areTilesLoaded())throw Error('Wait for the geographic map to load before walking.');
  const layers=map.getStyle().layers,features=[];
  const definitions=[['building','building'],['transportation','road'],['water','water'],['landuse','park'],['poi','tree']];
  for(const [sourceLayer,kind] of definitions){
   const layer=layers.find(l=>l['source-layer']===sourceLayer);if(!layer)continue;
   for(const f of map.querySourceFeatures(layer.source,{sourceLayer})){
    if(kind==='park'&&!['park','grass','garden','recreation_ground'].includes(f.properties.class))continue;
    if(kind==='tree'&&f.properties.class!=='tree')continue;
    if(kind==='road'&&f.properties.brunnel==='tunnel')continue;
    const geo=f.toJSON();geo.properties={...geo.properties,_kind:kind};features.push(geo);
   }
  }
  const c=map.getCenter();
  return compileCity({type:'FeatureCollection',features},{origin:{lat:c.lat,lon:c.lng},bounds:[-350,-350,350,350],source:{name:'OpenStreetMap via OpenFreeMap — loaded tile preview',license:'ODbL-1.0',attribution:'© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap · Loaded tile preview; coverage may be incomplete'}});
 }
 async function startWalk(){
  if(pending)return walking;
  if(walking){stopWalk();return false;}
  pending=true;
  try{
   let city;
   const response=await fetch('/city/pilot.json');
   if(response.ok&&response.headers.get('content-type')?.includes('json')){city=await response.json();if(city.version!==1||!Array.isArray(city.roads)||!Array.isArray(city.buildings))throw Error('Invalid compiled pilot data.');}
   else if(response.status===404||response.ok)city=tileCity();
   else throw Error('The compiled city could not load. Retry the map.');
   const {createWalk}=await import('./city/walk.js');
   walker=await createWalk(host,city,stopWalk);walking=true;host.classList.add('street-mode');host.dispatchEvent(new CustomEvent('walkchange',{detail:true}));return true;
  }finally{pending=false;}
 }
 new ResizeObserver(()=>map.resize()).observe(host);
 const compass=document.querySelector('.compass');
 map.on('rotate',()=>{if(compass)compass.style.transform=`rotate(${-map.getBearing()}deg)`;});
 return {
  focus(id){const p=places.find(p=>p.id===id);if(!p)return;if(walking)stopWalk();ease({center:[p.lon,p.lat],zoom:17,pitch:58});for(const m of markers)m.e.classList.toggle('selected',m.p.id===id);},
  filter(ids){for(const m of markers)m.e.hidden=!ids.includes(m.p.id);},
  route(items){routeData=items.length<2?emptyRoute:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:items.map(p=>[p.lon,p.lat])}}]};map.getSource('day-plan')?.setData(routeData);},
  zoom(n){map.zoomTo(map.getZoom()-Math.log2(n),{duration:reduce?0:250});},
  reset(){stopWalk();ease(home);},
  flat(value){if(walking)stopWalk();ease({pitch:value?0:58,bearing:0});},
  walk:startWalk,
  getStats(){return {walking,loaded,zoom:map.getZoom(),center:map.getCenter().toArray(),buildingLayer:Boolean(map.getLayer('pondy-buildings')),walk:walker?.getStats()};}
 };
}
