import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {findSpawn,movePlayer,unprojectPoint} from './compile.js';

export async function createWalk(host,city,onExit){
 const spawn=findSpawn(city),scene=new THREE.Scene();scene.background=new THREE.Color('#a8cadc');scene.fog=new THREE.Fog('#c5d5d5',120,700);
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const root=document.createElement('section');root.className='city-walk';root.setAttribute('aria-label','First-person geographic city prototype');root.append(renderer.domElement);host.append(root);
 const camera=new THREE.PerspectiveCamera(70,1,.08,1300);camera.rotation.order='YXZ';
 let position=spawn.position,yaw=spawn.yaw,pitch=0,last=0,active=true,held=null,drag=null;
 const sun=new THREE.DirectionalLight('#fff0d3',3);sun.position.set(-100,150,80);scene.add(sun,new THREE.HemisphereLight('#d3e8f5','#7e7765',2));
 const material=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness});
 const groundMaterial=material('#b5b5a1'),wallMaterial=material('#e4d5b8'),parkMaterial=material('#738b59'),waterMaterial=material('#518e9d',.35);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(city.bounds[2]-city.bounds[0],city.bounds[3]-city.bounds[1]),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.set((city.bounds[0]+city.bounds[2])/2,-.025,(city.bounds[1]+city.bounds[3])/2);scene.add(ground);
 function shape(rings){const s=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));for(const r of rings.slice(1))s.holes.push(new THREE.Path(r.map(([x,z])=>new THREE.Vector2(x,-z))));return s;}
 function surface(rings,mat,y){const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape(rings)),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=y;scene.add(mesh);}
 for(const p of city.parks)surface(p.rings,parkMaterial,.005);
 for(const p of city.water)surface(p.rings,waterMaterial,.01);
 // Roads follow imported centerlines; widths and sidewalk widths can be estimates.
 const roadMaterial=material('#555a59'),pavementMaterial=material('#cec7b5');
 function ribbon(points,width,y,mat){
  const vertices=[];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(!length)continue;const x=-dz/length*width/2,z=dx/length*width/2;
   vertices.push(a[0]+x,y,a[1]+z,a[0]-x,y,a[1]-z,b[0]+x,y,b[1]+z,b[0]+x,y,b[1]+z,a[0]-x,y,a[1]-z,b[0]-x,y,b[1]-z);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,mat);mesh.material.side=THREE.DoubleSide;scene.add(mesh);
 }
 for(const r of city.roads){ribbon(r.points,r.width+3,.02,pavementMaterial);ribbon(r.points,r.width,.035,roadMaterial);}
 for(const b of city.buildings){
  const geometry=new THREE.ExtrudeGeometry(shape(b.rings),{depth:Math.max(.1,b.height-b.base),bevelEnabled:false,steps:1});
  const mesh=new THREE.Mesh(geometry,wallMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.y=b.base;scene.add(mesh);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,35),new THREE.LineBasicMaterial({color:'#aa9e88'}));edges.rotation.x=-Math.PI/2;edges.position.y=b.base+.005;scene.add(edges);
 }
 // Only individually mapped trees are added. No generated tree locations.
 const trunk=material('#75624b'),leaves=material('#426d48');
 for(const t of city.trees){const h=t.height;const stem=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,h*.65,6),trunk);stem.position.set(t.position[0],h*.325,t.position[1]);scene.add(stem);const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(h*.3,1),leaves);canopy.position.set(t.position[0],h*.7,t.position[1]);canopy.scale.y=1.1;scene.add(canopy);}
 const ui=document.createElement('div');ui.className='city-walk-hud';
 ui.innerHTML='<div class="walk-heading"><strong>Walk White Town</strong><button class="exit-walk" type="button">Back to map</button></div><p>Drag to look · WASD / arrows to walk · Shift to move faster</p><p class="walk-quality"></p><p class="walk-location"></p><a class="street-reference" target="_blank" rel="noopener">Compare in Google Street View ↗</a><div class="walk-pad"><button data-step="forward" aria-label="Walk forward">↑</button><div><button data-step="left" aria-label="Walk left">←</button><button data-step="back" aria-label="Walk backward">↓</button><button data-step="right" aria-label="Walk right">→</button></div></div>';
 ui.querySelector('.walk-quality').textContent=`Map-based prototype · ${city.buildings.length} footprint parts · ${city.trees.length} mapped trees · façades not captured`;
 root.append(ui);ui.querySelector('.exit-walk').onclick=onExit;
 const credit=document.createElement('div');credit.className='walk-credit';credit.textContent=city.source.attribution||city.source.name;for(const model of city.models||[]){const span=document.createElement('span');span.textContent=` · ${model.creator} · ${model.license} · aligned model `;credit.append(span);if(model.source?.startsWith('https://')){const link=document.createElement('a');link.href=model.source;link.target='_blank';link.rel='noopener';link.textContent='source';credit.append(link);}}root.append(credit);
 const location=ui.querySelector('.walk-location'),reference=ui.querySelector('.street-reference');
 const keys=new Set(),typing=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]');
 const keydown=e=>{if(e.key==='Escape'){onExit();return;}if(!typing()&&['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift'].includes(e.key)){keys.add(e.key);e.preventDefault();}};
 const keyup=e=>keys.delete(e.key),clear=()=>{keys.clear();held=null;drag=null;};
 addEventListener('keydown',keydown);addEventListener('keyup',keyup);addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
 renderer.domElement.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);};
 renderer.domElement.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.004;pitch=Math.max(-1.25,Math.min(1.25,pitch-(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY;};
 renderer.domElement.onpointerup=renderer.domElement.onpointercancel=()=>drag=null;
 ui.querySelectorAll('[data-step]').forEach(e=>{e.onpointerdown=ev=>{held=e.dataset.step;e.setPointerCapture(ev.pointerId);};e.onpointerup=e.onpointercancel=()=>held=null;});
 const resize=new ResizeObserver(()=>{const w=root.clientWidth,h=root.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(root);
 const modelErrors=[];
 const loader=new GLTFLoader();
 for(const model of city.models||[]){
  if(!model.url?.startsWith('/city/assets/')||model.url.includes('..'))continue;
  loader.load(model.url,gltf=>{if(!active){gltf.scene.traverse(disposeObject);return;}const mesh=gltf.scene;mesh.position.set(...model.position);mesh.rotation.y=model.yaw||0;mesh.scale.setScalar(model.scale||1);scene.add(mesh);},undefined,()=>{modelErrors.push(model.url);ui.querySelector('.walk-quality').textContent='A captured model failed to load; map geometry remains visible.';});
 }
 let frames=0;
 function frame(now){if(!active)return;const dt=Math.min((now-last)/1000,.05)||0;last=now;
  if(!document.hidden){
   if(!typing()){
    const f=Number(keys.has('w')||keys.has('ArrowUp')||held==='forward')-Number(keys.has('s')||keys.has('ArrowDown')||held==='back');
    const s=Number(keys.has('d')||keys.has('ArrowRight')||held==='right')-Number(keys.has('a')||keys.has('ArrowLeft')||held==='left');
    if(f||s){const speed=(keys.has('Shift')?4.5:1.5)*dt/Math.hypot(f,s);position=movePlayer(city,position,[(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed,(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed]);}
   }
   camera.position.set(position[0],1.7,position[1]);camera.rotation.set(pitch,yaw,0);renderer.render(scene,camera);
   if(frames++%10===0){const [lon,lat]=unprojectPoint(position,city.origin);location.textContent=`${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E · eye height 1.7 m`;reference.href=`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;}
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 function disposeObject(o){o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){if(!m)continue;for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}}
 return {getStats:()=>({position:[...position],yaw,walking:active,buildings:city.buildings.length,roads:city.roads.length,trees:city.trees.length,modelErrors:[...modelErrors]}),dispose(){active=false;clear();resize.disconnect();removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);scene.traverse(disposeObject);renderer.dispose();root.remove();}};
}
