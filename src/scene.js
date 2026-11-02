import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {places, center} from './data.js';

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
 let loaded=false,walking=false,routeData=emptyRoute,held=null,last=0;
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
 const walkUI=document.createElement('div');walkUI.className='walk-ui';walkUI.hidden=true;
 walkUI.innerHTML='<span>NEIGHBORHOOD CLOSE-UP</span><p>Drag to pan · Right-drag to look<br>WASD / arrows to move · Not street imagery</p><div class="walk-pad"><button data-step="forward" aria-label="Move north">↑</button><div><button data-step="left" aria-label="Move west">←</button><button data-step="back" aria-label="Move south">↓</button><button data-step="right" aria-label="Move east">→</button></div></div>';
 host.append(walkUI);
 walkUI.querySelectorAll('[data-step]').forEach(e=>{
  e.onpointerdown=ev=>{held=e.dataset.step;e.setPointerCapture(ev.pointerId);};
  e.onpointerup=e.onpointercancel=()=>held=null;
 });
 const keys=new Set();
 const typing=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]');
 addEventListener('keydown',e=>{if(walking&&!typing()&&['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys.add(e.key);e.preventDefault();}});
 addEventListener('keyup',e=>keys.delete(e.key));addEventListener('blur',()=>{keys.clear();held=null;});
 document.addEventListener('visibilitychange',()=>{keys.clear();held=null;});
 function frame(now){
  const dt=Math.min((now-last)/1000,.05)||0;last=now;
  if(walking&&!typing()&&!document.hidden){
   const north=Number(keys.has('w')||keys.has('ArrowUp')||held==='forward')-Number(keys.has('s')||keys.has('ArrowDown')||held==='back');
   const east=Number(keys.has('d')||keys.has('ArrowRight')||held==='right')-Number(keys.has('a')||keys.has('ArrowLeft')||held==='left');
   if(north||east){const c=map.getCenter(),step=dt*0.00018/Math.hypot(north,east);map.jumpTo({center:[c.lng+east*step/Math.cos(c.lat*Math.PI/180),c.lat+north*step]});}
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 const ease=options=>map.easeTo({...options,duration:reduce?0:650});
 function setWalk(value){walking=value;keys.clear();held=null;walkUI.hidden=!value;host.classList.toggle('street-mode',value);if(value)ease({zoom:18.3,pitch:72});else ease(home);}
 new ResizeObserver(()=>map.resize()).observe(host);
 const compass=document.querySelector('.compass');
 map.on('rotate',()=>{if(compass)compass.style.transform=`rotate(${-map.getBearing()}deg)`;});
 return {
  focus(id){const p=places.find(p=>p.id===id);if(!p)return;if(walking)setWalk(false);ease({center:[p.lon,p.lat],zoom:17,pitch:58});for(const m of markers)m.e.classList.toggle('selected',m.p.id===id);},
  filter(ids){for(const m of markers)m.e.hidden=!ids.includes(m.p.id);},
  route(items){routeData=items.length<2?emptyRoute:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:items.map(p=>[p.lon,p.lat])}}]};map.getSource('day-plan')?.setData(routeData);},
  zoom(n){map.zoomTo(map.getZoom()-Math.log2(n),{duration:reduce?0:250});},
  reset(){setWalk(false);},
  flat(value){if(walking)setWalk(false);ease({pitch:value?0:58,bearing:0});},
  walk(){setWalk(!walking);return walking;},
  getStats(){return {walking,loaded,zoom:map.getZoom(),center:map.getCenter().toArray(),buildingLayer:Boolean(map.getLayer('pondy-buildings'))};}
 };
}
