// Synthetic geometry for integration tests only. Never served by the application.
import geojsonVt from 'geojson-vt';
import {fromGeojsonVt} from '@maplibre/vt-pbf';
const polygon=(coordinates,properties={})=>({type:'Feature',properties,geometry:{type:'Polygon',coordinates:[coordinates]}});
const index=geojsonVt({type:'FeatureCollection',features:[
 polygon([[79.830,11.932],[79.8307,11.932],[79.8307,11.9326],[79.830,11.9326],[79.830,11.932]],{render_height:18,render_min_height:0}),
 polygon([[79.832,11.934],[79.833,11.934],[79.833,11.935],[79.832,11.935],[79.832,11.934]],{}),
]},{maxZoom:14,indexMaxZoom:14});
const roads=geojsonVt({type:'FeatureCollection',features:[{type:'Feature',properties:{class:'minor',name:'Synthetic test road'},geometry:{type:'LineString',coordinates:[[79.8315,11.925],[79.8315,11.940]]}}]},{maxZoom:14,indexMaxZoom:14});
const trees=geojsonVt({type:'FeatureCollection',features:[{type:'Feature',properties:{class:'tree'},geometry:{type:'Point',coordinates:[79.8318,11.933]}}]},{maxZoom:14,indexMaxZoom:14});
export async function mockMap(page){
 await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
 await page.route('https://tiles.openfreemap.org/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/styles/liberty')return route.fulfill({json:{version:8,sources:{fixture:{type:'vector',tiles:['https://tiles.openfreemap.org/fixture/{z}/{x}/{y}.pbf'],maxzoom:14}},layers:[
   {id:'background',type:'background',paint:{'background-color':'#dce6df'}},
   {id:'building',type:'fill',source:'fixture','source-layer':'building',paint:{'fill-color':'#bfa88d'}},
   {id:'road',type:'line',source:'fixture','source-layer':'transportation',paint:{'line-color':'#777777','line-width':4}},
   {id:'tree',type:'circle',source:'fixture','source-layer':'poi',paint:{'circle-radius':3,'circle-color':'green'}}
  ]}});
  const match=url.pathname.match(/fixture\/(\d+)\/(\d+)\/(\d+)\.pbf/);
  if(!match)return route.abort();
  const [,z,x,y]=match.map(Number),tile=index.getTile(z,x,y);
  const body=Buffer.from(fromGeojsonVt({building:tile||{features:[]},transportation:roads.getTile(z,x,y)||{features:[]},poi:trees.getTile(z,x,y)||{features:[]}}));
  return route.fulfill({contentType:'application/x-protobuf',body});
 });
}
