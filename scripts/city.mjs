import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import osmtogeojson from 'osmtogeojson';
import {compileCity,findSpawn,canWalk} from '../src/city/compile.js';

const [command,...argv]=process.argv.slice(2),args={};
for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('Use --option value');args[argv[i].slice(2)]=argv[i+1];}
const config=JSON.parse(await readFile(args.config||'city/pilot.config.json','utf8'));
async function save(file,value){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value));}
const sha=data=>createHash('sha256').update(data).digest('hex');
if(command==='fetch'){
 const bbox=config.bbox;if(!Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite)||bbox[0]>=bbox[2]||bbox[1]>=bbox[3]||(bbox[2]-bbox[0])*(bbox[3]-bbox[1])>.001)throw Error('Use an ordered pilot bbox smaller than about 12 km²');
 const endpoint=args.endpoint||'https://overpass-api.de/api/interpreter';if(!endpoint.startsWith('https://'))throw Error('Overpass endpoint must use HTTPS');
 const b=bbox.join(','),query=`[out:json][timeout:45];(way[building](${b});relation[building](${b});way[highway](${b});node[natural=tree](${b});way[natural=water](${b});relation[natural=water](${b});way[leisure=park](${b});relation[leisure=park](${b}););out body;>;out skel qt;`;
 const output=execFileSync('curl',['--fail','--silent','--show-error','--max-time','60','--data-urlencode',`data=${query}`,endpoint],{maxBuffer:40*1024*1024});
 const osm=JSON.parse(output);if(osm.remark)throw Error(`Overpass did not return a complete extract: ${osm.remark}`);if(!Array.isArray(osm.elements)||!osm.elements.length)throw Error('Empty OSM extract');
 const file=args.out||'work/osm-pilot.json';await save(file,osm);await save(`${file}.source.json`,{endpoint,bbox,retrievedAt:new Date().toISOString(),sha256:sha(output),source:config.source});console.log(`Saved ${osm.elements.length} OSM elements to ${file}`);
}else if(command==='build'){
 if(!args.input)throw Error('Provide --input path/to/osm-or-geojson.json');
 const raw=await readFile(args.input),input=JSON.parse(raw);const geo=input.type==='FeatureCollection'?input:osmtogeojson(input,{flatProperties:true});
 const city=compileCity(geo,config);city.source={...config.source,inputSha256:sha(raw),builtAt:new Date().toISOString()};
 const output=args.out||'public/city/pilot.json';
 if(args.models){
  const manifest=JSON.parse(await readFile(args.models,'utf8'));
  for(const entry of manifest.models||[]){
   if(!entry.file||!entry.license||!entry.creator||!entry.source||!entry.alignment||!Array.isArray(entry.position)||entry.position.length!==3||!entry.position.every(Number.isFinite)||!(entry.scale>0)||!Number.isFinite(entry.yaw))throw Error('Every model requires file, license, creator, source, alignment, xyz position, positive scale, and yaw');
   if(!entry.file.endsWith('.glb'))throw Error('Use self-contained GLB assets');
   const bytes=await readFile(path.resolve(path.dirname(args.models),entry.file));
   if(bytes.length>25*1024*1024)throw Error('Split or optimize model chunks below 25 MiB');
   if(bytes.toString('utf8',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB v2');
   const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
   if((gltf.extensionsRequired||[]).some(e=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(e)))throw Error('Export uncompressed GLB geometry and PNG/JPEG textures for this renderer');
   if([...(gltf.buffers||[]),...(gltf.images||[])].some(v=>v.uri&&!v.uri.startsWith('data:')))throw Error('GLB assets must embed their buffers and images');
   const digest=sha(bytes),name=`${digest.slice(0,16)}.glb`,destination=path.join(path.dirname(output),'assets',name);await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.resolve(path.dirname(args.models),entry.file),destination);
   city.models.push({url:`/city/assets/${name}`,position:entry.position,yaw:entry.yaw,scale:entry.scale,license:entry.license,creator:entry.creator,source:entry.source,alignment:entry.alignment,sha256:digest});
  }
 }
 city.spawn=findSpawn(city);if(!canWalk(city,city.spawn.position))throw Error('Unsafe compiled spawn');
 await save(output,city);await save(`${output}.report.json`,{inputSha256:sha(raw),counts:Object.fromEntries(['buildings','roads','trees','water','parks','models'].map(k=>[k,city[k].length])),quality:city.quality,spawn:city.spawn,photorealistic:false,limitations:['Flat ground; no surveyed terrain','Default or inferred attributes are estimates','Only mapped tree positions; coverage may be incomplete','Models require separate visual and alignment review']});
 console.log(`Built ${city.buildings.length} buildings, ${city.roads.length} road parts, ${city.trees.length} trees, ${city.models.length} captured models → ${output}`);
}else if(command==='validate'){
 const city=JSON.parse(await readFile(args.input||'public/city/pilot.json','utf8'));if(city.version!==1||!Array.isArray(city.roads)||!Array.isArray(city.buildings))throw Error('Invalid city format');const spawn=findSpawn(city);console.log(JSON.stringify({valid:true,spawn,counts:{buildings:city.buildings.length,roads:city.roads.length,trees:city.trees.length},quality:city.quality}));
}else throw Error('Commands: fetch, build, validate. See docs/city-pipeline.md');
