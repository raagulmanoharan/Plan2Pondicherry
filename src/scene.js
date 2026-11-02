import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {places,project} from './data.js';

export function createScene(host,onSelect){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#bcd8e0');scene.fog=new THREE.Fog('#cbdcda',1800,6500);
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(45,1,.3,10000);camera.position.set(1050,1350,1550);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2.08;controls.minDistance=60;controls.maxDistance=4500;controls.target.set(30,0,0);
 scene.add(new THREE.HemisphereLight('#fff6dc','#6b8076',2));const sun=new THREE.DirectionalLight('#ffe3b2',3.1);sun.position.set(-700,1000,600);scene.add(sun);
 // Reuse geometry and instance repeated details: hundreds of facades, a few draw calls.
 const geometry=new THREE.BoxGeometry(1,1,1),groups=new Map(),colliders=[];
 function box(x,z,w,d,h,color,y=0){if(!groups.has(color))groups.set(color,[]);groups.get(color).push([x,y+h/2,z,w,h,d]);}
 let seed=47;function rand(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
 box(-540,0,2320,2500,8,'#c8c5ad',-10);box(590,0,65,2500,2,'#d8c79d',-2);
 box(555,0,8,2500,1.6,'#d4c8ae');
 const xs=[-1510,-1280,-1050,-820,-590,-360,-130,100,330,540];
 const zs=[-1120,-920,-720,-520,-320,-120,80,280,480,680,880,1080];
 for(const x of xs){box(x,0,22,2400,.2,'#8f9691');box(x-15,0,6,2400,.7,'#dbd2be');box(x+15,0,6,2400,.7,'#dbd2be');}
 for(const z of zs){box(-470,z,2120,22,.25,'#8f9691');box(-470,z-15,2120,6,.7,'#dbd2be');box(-470,z+15,2120,6,.7,'#dbd2be');}
 const palette=['#e4c47b','#d6c6ac','#e8dac0','#b7c8c0','#dfb1a0','#d4cebd','#d7ab7c','#dcd4b5'];
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
  const x=xs[i],z=zs[j];if(x===100&&z===-120){box(x+105,z+98,180,165,.4,'#91ab78');continue;}
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
   if(rand()<.18)continue;const h=8+Math.floor(rand()*3)*4,w=40+rand()*12,d=34+rand()*14,c=palette[Math.floor(rand()*palette.length)],bx=x+40+a*63,bz=z+36+b*58;
   box(bx,bz,w,d,h,c);colliders.push({x:bx,z:bz,w:w/2+1.4,d:d/2+1.4});
   box(bx,bz,w+1.3,d+1.3,.6,'#f0e5cb',h-.5);box(bx,bz,w-2,d-2,.3,'#a9987b',h+.1);
   // Parapets, cornices, doors, recessed windows and timber shutters.
   box(bx,bz-d/2,w+1,1,.6,'#f0e5cb',h-1.4);
   for(let floor=0;floor<Math.floor(h/4);floor++)for(let win=-1;win<=1;win++){
    const wx=bx+win*w*.27,wy=1.3+floor*4;
    box(wx,bz+d/2+.08,2.5,.2,2.1,'#42625c',wy);box(wx-1.6,bz+d/2+.24,.6,.3,2.3,'#6f8070',wy-.1);box(wx+1.6,bz+d/2+.24,.6,.3,2.3,'#6f8070',wy-.1);
    box(wx,bz+d/2+.3,4,.5,.25,'#eee3c8',wy+2.2);
    box(wx,bz-d/2-.1,2.5,.2,2.1,'#42625c',wy);
    for(const face of [-1,1]){box(bx+face*(w/2+.1),bz+win*d*.27,.2,2.5,2.1,'#42625c',wy);box(bx+face*(w/2+.3),bz+win*d*.27,.5,4,.25,'#eee3c8',wy+2.2);}
   }
   box(bx,bz+d/2+.12,2.4,.25,3.1,'#665d4c',.1);
  }
 }
 // Promenade lighting, benches, and a recognizable coastal palm rhythm.
 for(let z=-1080;z<1100;z+=65){box(551,z,.45,.45,7,'#4f5d57');box(551,z,2.2,2.2,.6,'#e5d9b0',6.7);box(565,z+20,4,1.4,.25,'#746e55',.9);box(563.5,z+20,.3,1.4,.9,'#4f5d57');box(566.5,z+20,.3,1.4,.9,'#4f5d57');}
 const leafGeometry=new THREE.IcosahedronGeometry(1,1),leaves=[];
 for(let i=0;i<330;i++){const x=-1480+rand()*2000,z=-1100+rand()*2200;if(colliders.some(b=>Math.abs(x-b.x)<b.w+5&&Math.abs(z-b.z)<b.d+5))continue;box(x,z,1,1,7,'#8a7d60');leaves.push([x,10,z,6+rand()*3,7,6]);}
 for(let z=-1100;z<1100;z+=85){box(576,z,.8,.8,13,'#968364');for(let k=0;k<6;k++){const a=k*Math.PI/3;leaves.push([576+Math.cos(a)*4,13.4,z+Math.sin(a)*4,Math.abs(Math.cos(a))*5+1,.7,Math.abs(Math.sin(a))*5+1]);}}
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
 function instances(geo,entries,color){const mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color,roughness:.88}),entries.length);entries.forEach(([x,y,z,w,h,d],i)=>{position.set(x,y,z);scale.set(w,h,d);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);});mesh.computeBoundingSphere();scene.add(mesh);}
 for(const [color,entries] of groups)instances(geometry,entries,color);instances(leafGeometry,leaves,'#6d8d62');
 const seaMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p; uniform float time; void main(){float wave=sin(p.x*.09+p.y*.025+time*.8)*.5+.5;float fine=pow(wave,12.);vec3 water=mix(vec3(.25,.53,.56),vec3(.48,.70,.69),clamp((p.x+2500.)/5000.,0.,1.));gl_FragColor=vec4(water+fine*.055,1.);}'});
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(6000,9000),seaMaterial);sea.rotation.x=-Math.PI/2;sea.position.set(3620,-2,0);scene.add(sea);
 const markers=places.map(p=>{const e=document.createElement('button');e.className='map-pin';e.textContent=p.icon;e.title=p.name;e.setAttribute('aria-label',`Explore ${p.name}`);host.append(e);e.onclick=()=>onSelect(p.id);return {p,e,v:new THREE.Vector3(project(p.lat,p.lon).x,30,project(p.lat,p.lon).z)};});
 let route=null,target=null,walking=false,last=0,visible=true,held=null;const keys=new Set(),forward=new THREE.Vector3(),side=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const walkUI=document.createElement('div');walkUI.className='walk-ui';walkUI.hidden=true;walkUI.innerHTML='<span>STREET EXPLORATION · ILLUSTRATIVE</span><p>Drag to look · WASD / arrows to move</p><div class="walk-pad"><button data-step="forward" aria-label="Walk forward">↑</button><div><button data-step="left" aria-label="Walk left">←</button><button data-step="back" aria-label="Walk backward">↓</button><button data-step="right" aria-label="Walk right">→</button></div></div>';host.append(walkUI);
 walkUI.querySelectorAll('[data-step]').forEach(e=>{e.onpointerdown=ev=>{held=e.dataset.step;e.setPointerCapture(ev.pointerId);};e.onpointerup=e.onpointercancel=()=>held=null;});
 const typing=()=>['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]');
 addEventListener('keydown',e=>{if(walking&&!typing()&&['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys.add(e.key);e.preventDefault();}});addEventListener('keyup',e=>keys.delete(e.key));addEventListener('blur',()=>{keys.clear();held=null;});
 document.addEventListener('visibilitychange',()=>{visible=!document.hidden;keys.clear();});
 function move(dt){camera.getWorldDirection(forward);forward.y=0;forward.normalize();side.crossVectors(forward,up);const delta=new THREE.Vector3();if(keys.has('w')||keys.has('ArrowUp')||held==='forward')delta.add(forward);if(keys.has('s')||keys.has('ArrowDown')||held==='back')delta.sub(forward);if(keys.has('d')||keys.has('ArrowRight')||held==='right')delta.add(side);if(keys.has('a')||keys.has('ArrowLeft')||held==='left')delta.sub(side);delta.normalize().multiplyScalar(dt*13);const next=camera.position.clone().add(delta);if(next.x<585&&next.x> -1550&&Math.abs(next.z)<1150&&!colliders.some(b=>Math.abs(next.x-b.x)<b.w&&Math.abs(next.z-b.z)<b.d)){camera.position.add(delta);controls.target.add(delta);}}
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05)||0;last=now;if(!visible)return;if(walking&&!typing())move(dt);if(target){const delta=target.clone().sub(controls.target).multiplyScalar(reduce?1:.08);controls.target.add(delta);camera.position.add(delta);if(controls.target.distanceTo(target)<1)target=null;}controls.update();if(!reduce)seaMaterial.uniforms.time.value=now/1000;renderer.render(scene,camera);const w=host.clientWidth,h=host.clientHeight;for(const {e,v} of markers){const q=v.clone().project(camera);e.style.left=`${(q.x*.5+.5)*w}px`;e.style.top=`${(-q.y*.5+.5)*h}px`;e.style.visibility=walking||q.z>1||q.z< -1||Math.abs(q.x)>1||Math.abs(q.y)>1?'hidden':'visible';}}
 new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(host);requestAnimationFrame(frame);
 function setWalk(value){walking=value;walkUI.hidden=!value;target=null;keys.clear();held=null;controls.enablePan=!value;controls.enableZoom=!value;controls.minDistance=value?5:60;controls.maxPolarAngle=value?Math.PI*.56:Math.PI/2.08;controls.minPolarAngle=value?Math.PI*.38:0;controls.rotateSpeed=value?-.45:1;controls.enableDamping=!reduce;host.classList.toggle('street-mode',value);if(value){camera.position.set(540,2.2,420);controls.target.set(540,2.2,410);}else{camera.position.set(1050,1350,1550);controls.target.set(30,0,0);}}
 return {
  focus(id){if(walking)setWalk(false);const p=places.find(p=>p.id===id),q=project(p.lat,p.lon);target=new THREE.Vector3(q.x,0,q.z);for(const m of markers)m.e.classList.toggle('selected',m.p.id===id);},
  filter(ids){for(const m of markers)m.e.hidden=!ids.includes(m.p.id);},
  route(items){if(route){scene.remove(route);route.geometry.dispose();route.material.dispose();route=null;}if(items.length<2)return;const pts=items.map(p=>{const q=project(p.lat,p.lon);return new THREE.Vector3(q.x,28,q.z);});route=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:'#ae512d',dashSize:16,gapSize:10}));route.computeLineDistances();scene.add(route);},
  zoom(n){if(!walking)camera.position.sub(controls.target).multiplyScalar(n).add(controls.target);},
  reset(){setWalk(false);},
  flat(value){setWalk(false);camera.position.set(controls.target.x+10,value?2600:1350,controls.target.z+(value?10:1550));},
  walk(){setWalk(!walking);return walking;},
  getStats(){return {drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,walking};}
 };
}
