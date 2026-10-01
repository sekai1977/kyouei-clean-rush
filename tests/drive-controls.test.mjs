import test from 'node:test';
import assert from 'node:assert/strict';
import {directionFromVector,connectedPath,extendDrawnRoute,nextDriveDirection} from '../app/drive-controls.js';
const cells=[{links:{e:1}},{links:{w:0,s:3}},{links:{e:3}},{links:{n:1,w:2}}];
const state=(overrides={})=>({current:1,prev:0,heading:'e',buffer:null,...overrides});
const drive=(overrides={})=>({held:null,route:[],routeActive:false,...overrides});
test('dead zone and four cardinal directions',()=>{
 assert.equal(directionFromVector(4,4),null);
 for(const [x,y,d] of [[0,-50,'n'],[50,0,'e'],[0,50,'s'],[-50,0,'w']])assert.equal(directionFromVector(x,y),d);
});
test('diagonal jitter retains direction until a deliberate turn',()=>{
 assert.equal(directionFromVector(39,42,'e'),'e');
 assert.equal(directionFromVector(25,50,'e'),'s');
 assert.equal(directionFromVector(-50,0,'e'),'w');
});
test('snapping fills a skipped junction but cannot jump a wall',()=>{
 assert.deepEqual(connectedPath(cells,0,3),[0,1,3]);
 assert.equal(connectedPath(cells,0,2),null);
 assert.equal(connectedPath(cells,1,2,1),null);
});
test('dragging back shortens a route instead of creating a loop',()=>{
 assert.deepEqual(extendDrawnRoute(cells,[0,1,3],1),[0,1]);
 assert.deepEqual(extendDrawnRoute(cells,[0],2),[0]);
});
test('release stops at a junction, without automatic turns',()=>assert.equal(nextDriveDirection(cells,state(),drive()),null));
test('holding a turn selects that road and consumes stale tap input',()=>{
 const s=state({buffer:'w'});assert.equal(nextDriveDirection(cells,s,drive({held:'s'})),'s');assert.equal(s.buffer,null);
});
test('holding toward a wall does not choose an arbitrary corner',()=>assert.equal(nextDriveDirection(cells,state(),drive({held:'e'})),null));
test('tap input is consumed once and cannot unexpectedly turn later',()=>{
 const s=state({buffer:'s'});assert.equal(nextDriveDirection(cells,s,drive()),'s');assert.equal(nextDriveDirection(cells,s,drive()),null);
 const blocked=state({buffer:'n'});assert.equal(nextDriveDirection(cells,blocked,drive()),null);assert.equal(blocked.buffer,null);
});
test('drawn route follows only legal edges then stops at its endpoint',()=>{
 const d=drive({route:[1,3,2],routeActive:true});
 assert.equal(nextDriveDirection(cells,state({current:0}),d),'e');
 assert.equal(nextDriveDirection(cells,state({current:1}),d),'s');
 assert.equal(nextDriveDirection(cells,state({current:3}),d),'w');
 assert.equal(nextDriveDirection(cells,state({current:2}),d),null);
 assert.equal(d.routeActive,false);
});
test('invalid route cannot move through a wall',()=>assert.equal(nextDriveDirection(cells,state({current:0}),drive({route:[2],routeActive:true})),null));
import {validateRoadRoute} from '../app/drive-controls.js';
test('route validation rejects disconnected roads and the wrong start',()=>{
 assert.equal(validateRoadRoute(cells,[0,1,3,2],0),true);
 assert.equal(validateRoadRoute(cells,[0,2],0),false);
 assert.equal(validateRoadRoute(cells,[1,3],0),false);
 assert.equal(validateRoadRoute(cells,[0,1,99],0),false);
});
