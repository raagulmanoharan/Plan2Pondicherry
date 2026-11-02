import {test} from 'node:test';
import assert from 'node:assert/strict';
import {places,distance,tripSummary} from './data.js';
test('editorial places have unique IDs and valid Puducherry coordinates',()=>{assert.equal(new Set(places.map(p=>p.id)).size,places.length);for(const p of places){assert.ok(p.lat>11.9&&p.lat<12);assert.ok(p.lon>79.8&&p.lon<79.85);assert.ok(p.duration>0);}});
test('itinerary distance follows stop order and sums visit durations',()=>{const items=places.slice(0,3);const s=tripSummary(items);assert.equal(s.visitMinutes,145);assert.equal(s.meters,distance(items[0],items[1])+distance(items[1],items[2]));assert.equal(tripSummary([]).meters,0);assert.equal(tripSummary([places[0]]).meters,0);});
