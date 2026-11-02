import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [command,...argv]=process.argv.slice(2),args={};
for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('Use --option value');args[argv[i].slice(2)]=argv[i+1];}
if(command==='fetch'){
 const manifest=JSON.parse(await readFile(args.manifest||'city/online-sources.json','utf8')),out=args.out||'work/imagery';await mkdir(out,{recursive:true});const receipts=[];
 for(const image of manifest.images){
  if(!image.creator||!image.license||!image.source||!image.licenseUrl||!/^[a-z0-9-]+$/i.test(image.id)||!image.url?.startsWith('https://'))throw Error('Image metadata must include a safe id, HTTPS URL, creator, source page, license and license URL');
  const file=path.join(out,`${image.id}.jpg`);
  execFileSync('curl',['--fail','--location','--silent','--show-error','--max-time','30','--max-filesize','25000000','--output',file,image.url],{stdio:'inherit'});
  const bytes=await readFile(file);if(bytes[0]!==0xff||bytes[1]!==0xd8)throw Error('Expected a JPEG image');
  receipts.push({...image,file:path.resolve(file),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,retrievedAt:new Date().toISOString()});
  await writeFile(path.join(out,'receipts.json'),JSON.stringify({images:receipts},null,2));
 }
 console.log(`Downloaded ${receipts.length} images with attribution receipts. Reference images are not automatically reconstruction-ready.`);
}else if(command==='reconstruct'){
 if(!args.manifest)throw Error('Provide --manifest work/imagery/sequence.json with a reviewed multi-view sequence');
 const manifest=JSON.parse(await readFile(args.manifest,'utf8'));const images=manifest.images||[],sequence=images[0]?.sequence;
 if(images.length<20||!sequence||images.some(i=>i.sequence!==sequence||i.reconstructionReady!==true||!i.creator||!i.license||!i.source||!i.sha256))throw Error('Need at least 20 reviewed, overlapping images of one sequence with source/license/checksum metadata. Reference-only photos cannot be used as a street reconstruction.');
 const directory=path.resolve(args.images||path.dirname(args.manifest));
 for(const image of images){const imagePath=path.resolve(directory,image.file);if(!imagePath.startsWith(directory+path.sep))throw Error('Images must be inside the sequence directory');const bytes=await readFile(imagePath);if(createHash('sha256').update(bytes).digest('hex')!==image.sha256)throw Error('Image checksum mismatch');}
 const out=path.resolve(args.out||'work/reconstruction');await mkdir(out,{recursive:true});
 // COLMAP processes only this manifest's admitted images via an explicit list.
 const imageList=path.join(out,'image-list.txt');await writeFile(imageList,images.map(i=>path.relative(directory,path.resolve(directory,i.file))).join('\n'));
 const db=path.join(out,'database.db'),sparse=path.join(out,'sparse'),dense=path.join(out,'dense');
 await mkdir(sparse,{recursive:true});
 const mvs=path.join(out,'scene.mvs'),denseMvs=path.join(out,'scene_dense.mvs'),mesh=path.join(out,'scene_dense_mesh.ply'),refined=path.join(out,'scene_dense_mesh_refined.ply'),textured=path.join(out,'scene_dense_mesh_refined_texture.mvs');
 const commands=[
  {tool:'colmap',args:['feature_extractor','--database_path',db,'--image_path',directory,'--image_list_path',imageList,'--SiftExtraction.use_gpu','0']},
  {tool:'colmap',args:['sequential_matcher','--database_path',db,'--SiftMatching.use_gpu','0']},
  {tool:'colmap',args:['mapper','--database_path',db,'--image_path',directory,'--output_path',sparse]},
  {tool:'colmap',args:['image_undistorter','--image_path',directory,'--input_path',path.join(sparse,'0'),'--output_path',dense,'--output_type','COLMAP']},
  {tool:'InterfaceCOLMAP',args:['-i',dense,'-o',mvs,'--image-folder',path.join(dense,'images')]},
  {tool:'DensifyPointCloud',args:[mvs]},
  {tool:'ReconstructMesh',args:[denseMvs,'-p',path.join(out,'scene_dense.ply')]},
  {tool:'RefineMesh',args:[denseMvs,'-m',mesh,'-o',path.join(out,'scene_dense_mesh_refined.mvs')]},
  {tool:'TextureMesh',args:[denseMvs,'-m',refined,'-o',textured,'--export-type','glb']}
 ];
 await writeFile(path.join(out,'plan.json'),JSON.stringify({tools:['COLMAP','OpenMVS'],commands,sourceManifest:path.resolve(args.manifest),notes:['Requires compatible COLMAP and OpenMVS installations; check flags against installed versions','Image overlap and successful registration must be inspected','Output is a photo-textured GLB in reconstruction coordinates, not georeferenced. Scale, ground alignment, optimization, and collision review remain separate stages.']},null,2));
 if(args.run==='true'){
  execFileSync('colmap',['--help'],{stdio:'ignore'});
  for(const command of commands)execFileSync(command.tool,command.args,{stdio:'inherit',cwd:out});
  console.log('Reconstruction commands completed. Inspect registration, texture coverage, scale, and alignment before admission.');
 }else console.log(`Wrote a reconstruction job plan to ${out}. Use --run true only on a prepared reconstruction machine; no reconstruction was executed.`);
}else throw Error('Commands: fetch, reconstruct');
