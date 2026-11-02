"""Bounded local experiment. Image/model publishing is a separate rights decision."""
import argparse
import hashlib
import importlib
import io
import json
import math
import subprocess
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2))

def metric(p, origin):
    return ((p[1]-origin[1])*111320*math.cos(math.radians(origin[0])), (p[0]-origin[0])*111320)

def along(p, config):
    a=metric(p, config['start']); b=metric(config['end'], config['start'])
    t=(a[0]*b[0]+a[1]*b[1])/(b[0]**2+b[1]**2)
    clamped=max(0,min(1,t)); distance=math.hypot(a[0]-clamped*b[0],a[1]-clamped*b[1])
    return t,distance

def get(url, binary=False):
    import requests
    # Keep inherited proxy and CA settings. Never work around an explicit denial.
    response=requests.get(url, timeout=(10,35), allow_redirects=False)
    response.raise_for_status()
    if response.status_code != 200:
        raise RuntimeError(f'Unexpected HTTP {response.status_code}; inspect the response before continuing')
    if len(response.content)>12*1024*1024:
        raise RuntimeError('Response exceeds per-request pilot size limit')
    return response.content if binary else response.text

def source_module(scraper, commit):
    root=Path(scraper).resolve()
    observed=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
    if observed!=commit:
        raise RuntimeError(f'Expected upstream commit {commit}, found {observed}')
    sys.path.insert(0,str(root))
    return importlib.import_module('streetview')

def discover(args, config, out):
    library=source_module(args.scraper,config['upstream_commit'])
    count=config['samples']
    if not 2<=count<=25: raise ValueError('Pilot supports 2–25 sampling positions')
    if math.hypot(*metric(config['end'],config['start']))>250: raise ValueError('Pilot line must be at most 250 m')
    found={}
    for i in range(count):
        t=i/(count-1); lat,lon=[a+(b-a)*t for a,b in zip(config['start'],config['end'])]
        text=get(library._panoids_url(lat,lon))
        try: rows=library.panoids_from_response(text)
        except (IndexError,ValueError) as error: raise RuntimeError('Upstream metadata parser no longer matches the endpoint') from error
        for row in rows:
            position=(row['lat'],row['lon']); order,distance=along(position,config)
            if distance<=config['corridor_metres']:
                found[row['panoid']]={**row,'order':order,'distance_to_line_m':distance}
        time.sleep(.4)
    rows=sorted(found.values(),key=lambda p:(p['order'],p.get('year',0),p.get('month',0)))
    save(out/'discovery.json',{'config':config,'retrieved_at':datetime.now(timezone.utc).isoformat(),'panoramas':rows})
    print(f'Found {len(rows)} candidate panoramas. Inspect discovery.json, then select one capture period.')

def select(args, config, out):
    rows=json.loads((out/'discovery.json').read_text())['panoramas']
    periods=Counter(f"{p['year']:04}-{p['month']:02}" for p in rows if 'year'in p and 'month'in p)
    if not periods: raise RuntimeError('No capture dates available; inspect metadata rather than mixing unknown dates')
    period=args.period or periods.most_common(1)[0][0]
    rows=[p for p in rows if 'year'in p and 'month'in p and f"{p['year']:04}-{p['month']:02}"==period]
    rows.sort(key=lambda p:p['order']); selected=[]
    for p in rows:
        if all(math.hypot(*metric((p['lat'],p['lon']),(q['lat'],q['lon'])))>=2 for q in selected):selected.append(p)
    selected=selected[:config['max_panoramas']]
    if len(selected)<3:raise RuntimeError('Fewer than three distinct positions from one period; this is not enough to attempt the pilot')
    save(out/'selection.json',{'period':period,'panoramas':selected,'source':'Google Street View','reuse_rights':'not established by downloader','review_required':['Check street location and capture-date continuity','Inspect overlaps and moving objects','Verify actual panorama dimensions before download']})
    print(f'Selected {len(selected)} positions from {period}; available periods: {dict(periods)}')

def stitch(fetch, panoid, width, height):
    from PIL import Image
    if width!=height*2 or not 1024<=width<=16384:raise ValueError('Expected full equirectangular dimensions: width=2*height, 1024–16384 pixels')
    nx,ny=math.ceil(width/512),math.ceil(height/512)
    canvas=Image.new('RGB',(nx*512,ny*512))
    def tile(pair):
        x,y=pair
        url=f'https://cbk0.google.com/cbk?output=tile&panoid={panoid}&zoom=5&x={x}&y={y}'
        image=Image.open(io.BytesIO(fetch(url,True))); image.load()
        if image.size!=(512,512):raise ValueError(f'Unexpected tile dimensions {image.size}')
        return x,y,image.convert('RGB')
    with ThreadPoolExecutor(max_workers=2) as pool:
        for x,y,image in pool.map(tile,[(x,y)for y in range(ny)for x in range(nx)]):canvas.paste(image,(x*512,y*512))
    return canvas.crop((0,0,width,height))

def download(args, config, out):
    selection=json.loads((out/'selection.json').read_text()); images=out/'panoramas';images.mkdir(exist_ok=True,parents=True);receipts=[]
    for i,p in enumerate(selection['panoramas'][:args.limit]):
        import re
        if not re.fullmatch(r'[A-Za-z0-9_-]+',p['panoid']):raise ValueError('Invalid panorama identifier')
        name=f'{i:04}.jpg';target=images/name
        image=stitch(get,p['panoid'],args.width,args.height)
        image.save(target,quality=95,subsampling=0)
        receipts.append({**p,'file':name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'width':args.width,'height':args.height,'dimensions_verified_by_user':True})
        save(out/'download.json',{'period':selection['period'],'source':'Google Street View','panoramas':receipts,'reuse_rights':'not established by downloader'})
        print(f'Saved {name}: {args.width}×{args.height}')

def sfm(args, config, out):
    import pycolmap
    from pycolmap.panorama import reconstruct, PanoramaReconstructionOptions, Matcher
    rows=json.loads((out/'download.json').read_text())['panoramas']
    if len(rows)<3:raise RuntimeError('Download at least 3 distinct positions for a registration experiment')
    for p in rows:
        if hashlib.sha256((out/'panoramas'/p['file']).read_bytes()).hexdigest()!=p['sha256']:raise RuntimeError('Panorama checksum mismatch')
    result=out/'sfm'
    if (result/'database.db').exists():raise RuntimeError('Existing SfM database: move the result directory before rerunning')
    # Official pipeline groups perspective views into zero-baseline camera rigs.
    options=PanoramaReconstructionOptions(use_gpu=False,num_threads=4,matcher=Matcher.EXHAUSTIVE,show_progress=True)
    models=reconstruct(out/'panoramas',result,options)
    report={'pycolmap_version':pycolmap.__version__,'input_panoramas':len(rows),'components':[],'photorealistic_mesh_created':False}
    for index,model in models.items():
        model.export_PLY(str(result/f'component-{index}.ply'))
        report['components'].append({'id':index,'registered_perspective_views':model.num_reg_images(),'registered_panorama_frames':model.num_reg_frames(),'points3D':model.num_points3D()})
    save(out/'sfm-report.json',report)
    if not models:raise RuntimeError('No reconstruction registered. Inspect overlap, image dimensions, and dates; do not fabricate geometry.')
    print(json.dumps(report,indent=2))

def dense(args, config, out):
    import shutil
    import pycolmap
    tools=['InterfaceCOLMAP','DensifyPointCloud','ReconstructMesh','RefineMesh','TextureMesh']
    missing=[tool for tool in tools if not shutil.which(tool)]
    if missing:raise RuntimeError('Install OpenMVS with GLB export support; missing: '+', '.join(missing))
    report=json.loads((out/'sfm-report.json').read_text())
    components=report['components']
    if not components:raise RuntimeError('No registered sparse component')
    component=max(components,key=lambda c:c['registered_panorama_frames'])
    if component['registered_panorama_frames']<3:raise RuntimeError('Fewer than 3 registered panorama positions; inspect the sparse model first')
    sparse=out/'sfm'/'sparse'/str(component['id']);directory=out/'dense'
    if directory.exists():raise RuntimeError('Dense output exists; move it before rerunning')
    pycolmap.undistort_images(directory,sparse,out/'sfm'/'images',jpeg_quality=95,num_threads=4)
    commands=[
      ['InterfaceCOLMAP','-i',str(directory),'-o','scene.mvs','--image-folder',str(directory/'images')],
      ['DensifyPointCloud','scene.mvs'],
      ['ReconstructMesh','scene_dense.mvs','-p','scene_dense.ply'],
      ['RefineMesh','scene_dense.mvs','-m','scene_dense_mesh.ply','-o','scene_dense_mesh_refined.mvs'],
      ['TextureMesh','scene_dense.mvs','-m','scene_dense_mesh_refined.ply','-o','street.mvs','--export-type','glb']
    ]
    save(directory/'commands.json',{'commands':commands,'sparse_component':component})
    for command in commands:subprocess.run(command,cwd=directory,check=True)
    if not (directory/'street.glb').is_file():raise RuntimeError('Texturing did not produce expected street.glb; inspect OpenMVS outputs')
    print('Produced dense/street.glb. Inspect texture coverage and geometry; scale and geographic alignment are not yet established.')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['discover','select','download','sfm','dense'])
    parser.add_argument('--config',default=str(HERE/'pilot.json'));parser.add_argument('--out',default='work/rue-dumas-pilot');parser.add_argument('--scraper');parser.add_argument('--period')
    parser.add_argument('--limit',type=int,default=1);parser.add_argument('--width',type=int);parser.add_argument('--height',type=int)
    args=parser.parse_args();config=json.loads(Path(args.config).read_text());out=Path(args.out).resolve()
    if args.command=='discover' and not args.scraper:parser.error('--scraper must point to a checkout of the upstream repository')
    if args.command=='download' and (not args.width or not args.height or not 1<=args.limit<=config['max_panoramas']):parser.error('Supply verified --width and --height at zoom 5, and --limit between 1 and max_panoramas')
    globals()[{'select':'select'}.get(args.command,args.command)](args,config,out)

if __name__=='__main__':main()
