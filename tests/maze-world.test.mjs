import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../app/maze-engine.js',import.meta.url),'utf8').split('// MAZE_MODEL_BEGIN')[1].split('// MAZE_MODEL_END')[0];
const model={};vm.runInNewContext(code+';this.createMaze=createMaze;this.mazeDistances=mazeDistances;',model);
test('all wide-street mazes keep every delivery and goal reachable within the driving budget',()=>{
 for(let seed=48371;seed<48371+100*9973;seed+=9973){
  const maze=model.createMaze(seed);
  assert.equal(maze.n,7);assert.equal(maze.cells.length,49);
  assert.equal(new Set([maze.start,maze.goal,...maze.targets]).size,5);
  assert.ok(model.mazeDistances(maze.cells,maze.start).dist.every(Number.isFinite));
  assert.ok(maze.optimum*.39<30,'Leave at least half the time for decisions.');
  for(const cell of maze.cells)for(const next of Object.values(cell.links)){
   const other=maze.cells[next];
   assert.equal(Math.abs(cell.x-other.x)+Math.abs(cell.y-other.y),1);
   assert.ok(Object.values(other.links).includes(cell.id));
  }
 }
});
