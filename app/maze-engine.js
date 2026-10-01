import { directionFromVector, connectedPath, extendDrawnRoute, nextDriveDirection, validateRoadRoute } from './drive-controls';
export function mountMaze(root) {
  const $=id=>root.querySelector('#'+id);
  const lifecycle=new AbortController();
  let cleanup=()=>{};
  const on=(element,event,handler)=>element.addEventListener(event,handler,{signal:lifecycle.signal});
  // MAZE_MODEL_BEGIN
  const DIRS=[{id:'n',dx:0,dy:-1,name:'北'},{id:'e',dx:1,dy:0,name:'東'},{id:'s',dx:0,dy:1,name:'南'},{id:'w',dx:-1,dy:0,name:'西'}];
  function seededRandom(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function mazeDistances(cells,start){const dist=Array(cells.length).fill(Infinity),prev=Array(cells.length).fill(-1),queue=[start];dist[start]=0;for(let p=0;p<queue.length;p++){const u=queue[p];for(const v of Object.values(cells[u].links)){if(dist[v]!==Infinity)continue;dist[v]=dist[u]+1;prev[v]=u;queue.push(v);}}return {dist,prev};}
  function createMaze(seed,n=7){
    const rnd=seededRandom(seed),cells=Array.from({length:n*n},(_,id)=>({id,x:id%n,y:Math.floor(id/n),links:{}}));
    const start=(n-1)*n+Math.floor(n/2),visited=new Set([start]);
    function candidates(id){const c=cells[id];return DIRS.map(d=>({dir:d.id,x:c.x+d.dx,y:c.y+d.dy})).filter(p=>p.x>=0&&p.x<n&&p.y>=0&&p.y<n).map(p=>({dir:p.dir,to:p.y*n+p.x}));}
    function connect(a,b,dir){cells[a].links[dir]=b;const reverse={n:'s',e:'w',s:'n',w:'e'};cells[b].links[reverse[dir]]=a;}
    // Longer streets give a phone player time to read the next junction.
    const stack=[{id:start,heading:'n'}];
    while(stack.length){
      const current=stack.at(-1),options=candidates(current.id).filter(edge=>!visited.has(edge.to));
      if(!options.length){stack.pop();continue;}
      const straight=options.find(edge=>edge.dir===current.heading);
      const edge=straight&&rnd()<.72?straight:options[Math.floor(rnd()*options.length)];
      connect(current.id,edge.to,edge.dir);visited.add(edge.to);stack.push({id:edge.to,heading:edge.dir});
    }
    const loops=[];for(const c of cells)for(const p of candidates(c.id))if(c.id<p.to&&c.links[p.dir]===undefined)loops.push({from:c.id,...p});
    let added=0;while(loops.length&&added<3){const edge=loops.splice(Math.floor(rnd()*loops.length),1)[0];if(mazeDistances(cells,edge.from).dist[edge.to]<8)continue;connect(edge.from,edge.to,edge.dir);added++;}
    const fromStart=mazeDistances(cells,start).dist;
    const goal=cells.filter(c=>c.id!==start).sort((a,b)=>fromStart[b.id]-fromStart[a.id]||a.id-b.id)[0].id;
    const endpoints=cells.filter(c=>Object.keys(c.links).length===1&&c.id!==start&&c.id!==goal).map(c=>c.id);
    const choices=endpoints.length>=3?endpoints:cells.filter(c=>c.id!==start&&c.id!==goal).map(c=>c.id);
    const a=[...choices].sort((x,y)=>Math.abs(fromStart[x]-12)-Math.abs(fromStart[y]-12)||x-y)[0];
    const fromA=mazeDistances(cells,a).dist,fromGoal=mazeDistances(cells,goal).dist;
    const b=choices.filter(id=>id!==a).sort((x,y)=>Math.min(fromStart[y],fromA[y],fromGoal[y])-Math.min(fromStart[x],fromA[x],fromGoal[x])||x-y)[0];
    const fromB=mazeDistances(cells,b).dist;
    const c=choices.filter(id=>id!==a&&id!==b).sort((x,y)=>Math.min(fromStart[y],fromA[y],fromB[y],fromGoal[y])-Math.min(fromStart[x],fromA[x],fromB[x],fromGoal[x])||x-y)[0];
    const targets=[a,b,c],distances=[start,...targets,goal].map(id=>mazeDistances(cells,id).dist);
    let optimum=Infinity,bestOrder=[];
    for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){let total=fromStart[targets[order[0]]];total+=distances[order[0]+1][targets[order[1]]]+distances[order[1]+1][targets[order[2]]]+distances[order[2]+1][goal];if(total<optimum){optimum=total;bestOrder=order;}}
    return {seed,n,cells,start,goal,targets,optimum,bestOrder,deadEnds:cells.filter(c=>Object.keys(c.links).length===1).length};
  }
  // MAZE_MODEL_END
  import('three').then(T=>{if(!lifecycle.signal.aborted)init(T);}).catch(e=>{if(lifecycle.signal.aborted)return;$('mr-loading').textContent='3D画面を読み込めませんでした。通信環境とWebGL対応ブラウザをご確認ください。';console.error('Clean Rush:',e);});
  function init(T){
    const scene=new T.Scene();scene.background=new T.Color('#b3cdd7');
    const renderer=new T.WebGLRenderer({canvas:$('mr-canvas'),antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
    const camera=new T.OrthographicCamera(-30,30,30,-30,.1,500);
    scene.add(new T.HemisphereLight('#e3f4ff','#687950',2.1));const sun=new T.DirectionalLight('#fff0d2',3);sun.position.set(-25,48,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-37,right:37,top:37,bottom:-37});sun.shadow.normalBias=.05;scene.add(sun);
    const materialCache=new Map(),cube=new T.BoxGeometry(1,1,1),world=new T.Group();scene.add(world);
    function material(color){if(!materialCache.has(color))materialCache.set(color,new T.MeshStandardMaterial({color,roughness:.87}));return materialCache.get(color);}
    function box(w,h,d,x,y,z,color,parent=world,shadow=true){const m=new T.Mesh(cube,typeof color==='string'?material(color):color);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;}
    const cylinderGeometry=new T.CylinderGeometry(1,1,1,10),treeGeometry=new T.IcosahedronGeometry(1,0);
    function cylinder(r,h,x,y,z,color,parent=world){const m=new T.Mesh(cylinderGeometry,material(color));m.scale.set(r,h,r);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
    function tree(x,z,scale=1){cylinder(.12*scale,scale,x,scale/2,z,'#927355');const top=new T.Mesh(treeGeometry,material('#539273'));top.scale.set(.7*scale,.95*scale,.7*scale);top.position.set(x,1.25*scale,z);top.castShadow=true;world.add(top);}
    function labelTexture(text,bg='#2a556e'){const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,384,96);ctx.fillStyle='#f5ffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 46px sans-serif';ctx.fillText(text,192,49);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:tex});}
    const truck=new T.Group();scene.add(truck);
    // A stylized rear-loading collection truck, built as native 3D geometry.
    box(1.5,.32,3.6,0,.4,0,'#204251',truck);
    box(1.72,1.08,1.12,0,1.05,-1.3,'#f2faf7',truck);
    box(1.74,.13,1.15,0,1.65,-1.3,'#3eacc1',truck);
    box(1.4,.54,.04,0,1.3,-1.88,'#235469',truck);
    for(const x of [-.875,.875])box(.04,.48,.72,x,1.3,-1.3,'#397b90',truck);
    box(1.82,1.52,2.1,0,1.28,.43,'#278baf',truck);
    box(1.67,.2,2.07,0,2.04,.43,'#57bad0',truck);
    // Recessed rear hopper, lip, grab rails and safety markings.
    box(1.84,1.3,.32,0,1.25,1.63,'#207694',truck);
    box(1.38,.74,.07,0,1.3,1.81,'#183f50',truck);
    box(1.68,.24,.48,0,.78,1.75,'#51aabe',truck);
    for(const x of [-.81,.81]){box(.07,.9,.08,x,1.42,1.86,'#eaf9f7',truck);box(.2,.12,.04,x,.86,2.01,'#ff8360',truck);}
    for(const x of [-.48,0,.48]){box(.24,.15,.035,x,.62,1.99,'#ffdd67',truck);}
    box(1.76,.2,.15,0,.59,-1.91,'#ccdadd',truck);
    for(const x of [-.55,.55])box(.32,.19,.04,x,.84,-1.94,'#fff1bc',truck);
    box(.67,.13,.3,0,1.78,-1.3,'#ffbd42',truck);
    for(const x of [-.88,.88])for(const z of [-1.23,1.12]){const w=cylinder(.35,.22,x,.36,z,'#233747',truck);w.rotation.z=Math.PI/2;}
    const truckLabel=labelTexture('KYOUEI','#197b94');
    for(const side of [-1,1]){const m=new T.Mesh(new T.PlaneGeometry(1.82,.5),truckLabel);m.position.set(side*.92,1.47,.43);m.rotation.y=side*Math.PI/2;truck.add(m);box(.04,.2,1.92,side*.935,.97,.43,'#c5f46d',truck);}
    truck.scale.setScalar(1.12);truck.traverse(object=>{object.castShadow=false;});
    const halo=new T.Mesh(new T.RingGeometry(1.62,1.92,28),new T.MeshBasicMaterial({color:'#ffdb68',transparent:true,opacity:.85,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.205;scene.add(halo);
    const traceGroup=new T.Group();scene.add(traceGroup);const traceMaterial=new T.MeshBasicMaterial({color:'#74e4b9',transparent:true,opacity:.78,depthWrite:false});
    const step=6.8,roadWidth=4.2,edgeSeconds=.39,limit=60;
    let model,seed=48371,mapNumber=1,pins=[],goalPad,goalMaterial,trail=[],visitedEdges=new Set();
    const targetInfo=[{id:'a',text:'A',name:'住宅街',color:'#96dfff'},{id:'b',text:'B',name:'商店街',color:'#ffb28f'},{id:'c',text:'C',name:'オフィス',color:'#d7ef99'}];
    const state={phase:'ready',current:0,prev:-1,heading:null,buffer:null,segment:null,elapsed:0,collecting:null,collected:[false,false,false],moves:0,backtracks:0,paused:false,best:null,exitNotified:false};
    const drive={held:null,route:[],routeActive:false,planning:false,draft:[],pointer:null};
    let collectionProps=[];
    let selectedTarget=0;
    let targetDistances=[];
    const routeGroup=new T.Group();scene.add(routeGroup);
    const routeMaterial=new T.MeshBasicMaterial({color:'#ffdc69',depthTest:false});
    const view={follow:false,top:false};
    let departure=null;
    const cameraFocus={x:0,z:0,leadX:0,leadZ:-2.2};let width=736,height=500,lastTime=null,lastUi=0,lastRender=0,toastUntil=0,frameId,closed=false;
    function pos(id){const c=model.cells[id],half=(model.n-1)/2;return {x:(c.x-half)*step,z:(c.y-half)*step};}
    function addBuilding(x,z,index){const h=.75+((index*19)%5)*.16,palette=['#c9d8d5','#b5cbc9','#d1c9b8','#a6bac2'];box(1.65,h,1.65,x,h/2+.18,z,palette[index%4]);box(1.85,.16,1.85,x,h+.25,z,'#537082');box(.7,.25,.55,x+.32,h+.44,z-.2,'#a4bdc3');if(index%3===0){box(1.55,.36,.035,x,.8,z+1.12,'#3f758a',world,false);box(.035,.36,1.55,x+1.12,.8,z,'#3f758a',world,false);}}
    function drawMaze(){
      renderer.shadowMap.needsUpdate=true;
      world.clear();traceGroup.clear();trail=[];visitedEdges.clear();pins=[];$('mr-labels').replaceChildren();
      const span=(model.n-1)*step+10;
      box(span,1.2,span,0,-.75,0,'#547c7a');box(span,.16,span,0,-.08,0,'#b1c3b7');
      for(const c of model.cells){const p=pos(c.id);box(roadWidth,.11,roadWidth,p.x,.085,p.z,'#304a60',world,false);for(const d of ['e','s']){const next=c.links[d];if(next===undefined)continue;const q=pos(next),horizontal=d==='e';box(horizontal?step:roadWidth,.11,horizontal?roadWidth:step,(p.x+q.x)/2,.085,(p.z+q.z)/2,'#304a60',world,false);for(const k of [-1,0,1])box(horizontal?.46:.065,.012,horizontal?.065:.46,(p.x+q.x)/2+(horizontal?k*.86:0),.147,(p.z+q.z)/2+(horizontal?0:k*.86),'#8fa9b5',world,false);}
        for(const d of DIRS){if(c.links[d.id]!==undefined)continue;const boundary=c.x+d.dx<0||c.x+d.dx>=model.n||c.y+d.dy<0||c.y+d.dy>=model.n;if(!boundary&&!['e','s'].includes(d.id))continue;const bx=p.x+d.dx*step/2,bz=p.z+d.dy*step/2;box(d.dx?.65:4.4,.5,d.dy?.65:4.4,bx,.29,bz,'#7b9eaa');box(d.dx?.75:4.5,.12,d.dy?.75:4.5,bx,.6,bz,'#e5eadc');}
      }
      for(let x=0;x<model.n-1;x++)for(let y=0;y<model.n-1;y++){const px=(x-(model.n-1)/2+.5)*step,pz=(y-(model.n-1)/2+.5)*step;if((x*3+y)%3!==0){box(2.5,.14,2.5,px,.11,pz,'#82a98a');tree(px-.45,pz,.8);tree(px+.65,pz+.55,.58);}else addBuilding(px,pz,x*11+y);}
      for(let i=0;i<model.n;i++){tree(-span/2+1.2,-span/2+2+i*5,.72);tree(span/2-1.2,-span/2+2+i*5,.72);}
      collectionProps=[];
      targetInfo.forEach((info,i)=>{
        const p=pos(model.targets[i]);const pad=box(3.8,.025,3.8,p.x,.158,p.z,new T.MeshStandardMaterial({color:info.color,roughness:.85}),world,false);
        const bags=new T.Group();bags.position.set(p.x,0,p.z);world.add(bags);
        for(let j=0;j<3;j++){
          const x=1.23+(j%2)*.36,z=-.7+Math.floor(j/2)*.7;
          const bag=new T.Mesh(treeGeometry,material('#eef0df'));bag.scale.set(.42,.58,.4);bag.position.set(x,.59,z);bags.add(bag);
          cylinder(.09,.13,x,1.18,z,'#9bad9c',bags);
        }
        const clean=new T.Group();clean.position.set(p.x+1.4,.4,p.z);world.add(clean);
        box(.72,.22,.72,0,0,0,'#e7e8ca',clean);const leaf=new T.Mesh(treeGeometry,material('#55b47e'));leaf.scale.set(.52,.67,.5);leaf.position.y=.5;clean.add(leaf);clean.visible=false;
        collectionProps.push({bags,clean,pad,origin:p});
        const element=document.createElement('div');element.className='mr-pin';element.style.setProperty('--pin',info.color);element.textContent=info.text+' 回収';$('mr-labels').appendChild(element);pins.push({element,id:model.targets[i],target:i,y:3.0});
      });
      const gp=pos(model.goal);goalMaterial=new T.MeshStandardMaterial({color:'#b8c9d0',roughness:.8});goalPad=box(3.9,.025,3.9,gp.x,.16,gp.z,goalMaterial,world,false);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)if((x+z)%2===0)box(.68,.015,.68,gp.x+x*.7,.184,gp.z+z*.7,'#304f66',world,false);
      const ge=document.createElement('div');ge.className='mr-pin';ge.style.setProperty('--pin','#d4e2e8');ge.textContent='センター';$('mr-labels').appendChild(ge);pins.push({element:ge,id:model.goal,y:3.1,goal:true});
      const sp=pos(model.start);box(3.8,.025,3.8,sp.x,.158,sp.z,'#ffcd68',world,false);
      const se=document.createElement('div');se.className='mr-pin';se.textContent='出発';$('mr-labels').appendChild(se);pins.push({element:se,id:model.start,y:3.0,start:true});
      targetDistances=[...model.targets,model.goal].map(id=>mazeDistances(model.cells,id).dist);
      $('mr-mapname').textContent='AREA '+String(mapNumber).padStart(2,'0');$('mr-mapdetail').textContent=model.n+' × '+model.n+' / '+model.deadEnds+'か所の行き止まり';
    }
    function screen(x,y,z){const p=new T.Vector3(x,y,z).project(camera);return {x:(p.x*.5+.5)*width,y:(-p.y*.5+.5)*height};}
    function updatePins(){
      for(const p of pins){
        const xyz=pos(p.id),point=screen(xyz.x,p.y,xyz.z);
        const selected=p.target===selectedTarget||p.goal&&selectedTarget===3;
        const outside=point.x<38||point.x>width-38||point.y<94||point.y>height-38;
        p.element.hidden=!!p.start&&state.phase!=='ready';
        p.element.style.visibility=outside&&!selected?'hidden':'visible';
        p.element.style.left=(outside?Math.max(42,Math.min(width-42,point.x)):point.x)+'px';
        p.element.style.top=(outside?Math.max(98,Math.min(height-30,point.y)):point.y)+'px';
        p.element.dataset.selected=selected;p.element.dataset.edge=outside&&selected;
        if(p.target!==undefined)p.element.dataset.done=state.collected[p.target];
        const text=p.start?'出発':p.goal?'センター':targetInfo[p.target].text;
        p.element.textContent=(outside&&selected?bearingArrow(point.x-width/2,point.y-height/2)+' ':'')+text+(p.target!==undefined&&!outside?' 回収':'');
      }
    }
    function bearingArrow(dx,dy){return ['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(Math.atan2(dx,-dy)/(Math.PI/4))+8)%8];}
    function navigation(){
      const target=selectedTarget===3?model.goal:model.targets[selectedTarget],p=pos(target),point=screen(p.x,0,p.z),car=screen(truck.position.x,0,truck.position.z);
      const name=selectedTarget===3?'センター':targetInfo[selectedTarget].text+' '+targetInfo[selectedTarget].name;
      const distance=targetDistances[selectedTarget][state.segment?state.segment.to:state.current];
      $('mr-navname').textContent=name;
      $('mr-navdistance').textContent=selectedTarget<3&&state.collected[selectedTarget]?'回収済':distance===0?'到着':'道のり '+distance+'区画';
      $('mr-navarrow').textContent=bearingArrow(point.x-car.x,point.y-car.y);
      const nextCell=model.cells[state.segment?state.segment.to:state.current],roads=DIRS.filter(d=>nextCell.links[d.id]!==undefined);
      $('mr-junction').textContent=(state.segment?'次の交差点：':'進める道：')+roads.map(d=>({n:'↑',e:'→',s:'↓',w:'←'}[d.id])).join('　');
      $('mr-navigation').style.setProperty('--nav',selectedTarget===3?'#c8ff84':targetInfo[selectedTarget].color);
      for(const button of root.querySelectorAll('[data-stamp]'))button.setAttribute('aria-pressed',String(targetInfo.findIndex(t=>t.id===button.dataset.stamp)===selectedTarget));
      $('mr-exitstatus').setAttribute('aria-pressed',String(selectedTarget===3));
      $('mr-minimap').hidden=!view.follow;
      $('mr-maphint').hidden=view.follow||state.phase!=='playing';
      $('mr-maphint').textContent=drive.planning?'指を離すと、このルートを走行':drive.routeActive?'黄色のルートを走行中':'トラックから道路をなぞってルート指定';
      drawMinimap();updateRoadArrows();
    }
    function selectTarget(index){selectedTarget=index;navigation();updatePins();}
    function drawMinimap(){
      const ctx=$('mr-minimap-canvas').getContext('2d'),size=224,pad=17,scale=(size-pad*2)/(model.n-1);
      const xy=id=>({x:pad+model.cells[id].x*scale,y:pad+model.cells[id].y*scale});
      ctx.fillStyle='#153448';ctx.fillRect(0,0,size,size);ctx.lineCap='round';ctx.strokeStyle='#7294a8';ctx.lineWidth=5;
      ctx.beginPath();for(const c of model.cells){const a=xy(c.id);for(const dir of ['e','s']){if(c.links[dir]===undefined)continue;const b=xy(c.links[dir]);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}ctx.stroke();
      const path=drive.planning?drive.draft:[state.current,...(state.segment?[state.segment.to]:[]),...drive.route];
      if(path.length>1){ctx.beginPath();ctx.strokeStyle='#ffcf62';ctx.lineWidth=5;path.forEach((id,i)=>{const p=xy(id);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();}
      [...model.targets,model.goal].forEach((id,i)=>{const p=xy(id);ctx.fillStyle=i===3?'#c8ff84':state.collected[i]?'#8298a0':targetInfo[i].color;ctx.beginPath();ctx.arc(p.x,p.y,i===selectedTarget?12:10,0,Math.PI*2);ctx.fill();if(i===selectedTarget){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}ctx.fillStyle='#10283a';ctx.font='900 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i===3?'G':targetInfo[i].text,p.x,p.y);});
      const half=(model.n-1)/2,car={x:pad+(truck.position.x/step+half)*scale,y:pad+(truck.position.z/step+half)*scale};
      ctx.fillStyle='#ff5d59';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(car.x,car.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    function drawPlannedRoute(){
      routeGroup.clear();if(!drive.planning&&!drive.routeActive)return;const path=drive.planning?drive.draft:[state.current,...(state.segment?[state.segment.to]:[]),...drive.route];
      for(let i=1;i<path.length;i++){const p=pos(path[i-1]),q=pos(path[i]);const m=new T.Mesh(cube,routeMaterial);m.scale.set(p.x===q.x?.38:step,.03,p.z===q.z?.38:step);m.position.set((p.x+q.x)/2,.22,(p.z+q.z)/2);m.renderOrder=2;routeGroup.add(m);}
    }
    function updateRoadArrows(){
      const anchor=state.segment?state.segment.to:state.current;
      for(const button of $('mr-roadarrows').querySelectorAll('[data-road-dir]')){
        const dir=button.dataset.roadDir,to=model.cells[anchor].links[dir];
        let point=null;if(to!==undefined){const p=pos(to);point=screen(p.x,.2,p.z);}
        const visible=state.phase==='playing'&&!state.paused&&!departure&&view.follow&&point&&point.x>30&&point.x<width-30&&point.y>108&&point.y<height-35&&!(point.x>width-138&&point.y>height-154);
        button.hidden=!visible;
        if(visible){button.style.left=point.x+'px';button.style.top=point.y+'px';button.dataset.queued=(drive.held||state.buffer)===dir;}
      }
    }
    function cameraWidths(){
      const aspect=width/height;
      return {follow:Math.max(10.2,8.8*aspect),overview:Math.max(28,27*width/Math.max(140,height-136))};
    }
    function projectCamera(halfWidth,overviewAmount=0){
      const halfHeight=halfWidth*height/width,offset=38*2*halfWidth/width*overviewAmount;
      camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight+offset;camera.bottom=-halfHeight+offset;camera.updateProjectionMatrix();
    }
    function moveCamera(snap=false){
      if(view.follow){
        const dir=DIRS.find(d=>d.id===(state.segment?.dir||state.heading||'n'));
        const leadX=dir.dx*2.2,leadZ=dir.dy*2.2;
        cameraFocus.leadX=snap?leadX:cameraFocus.leadX+(leadX-cameraFocus.leadX)*.16;
        cameraFocus.leadZ=snap?leadZ:cameraFocus.leadZ+(leadZ-cameraFocus.leadZ)*.16;
        cameraFocus.x=truck.position.x+cameraFocus.leadX;cameraFocus.z=truck.position.z+cameraFocus.leadZ;
      }else{cameraFocus.x=0;cameraFocus.z=0;}
      let x=cameraFocus.x,z=cameraFocus.z;
      if(departure){
        const progress=Math.min(1,departure.elapsed/departure.duration),ease=progress*progress*(3-2*progress),sizes=cameraWidths();
        x=T.MathUtils.lerp(departure.fromX,x,ease);z=T.MathUtils.lerp(departure.fromZ,z,ease);
        projectCamera(T.MathUtils.lerp(sizes.overview,sizes.follow,ease),1-ease);
      }
      camera.position.set(x+.01,view.top?95:90,z+(view.top?.01:30));camera.lookAt(x,0,z);camera.updateMatrixWorld();
    }
    function resize(){
      const rect=$('mr-scene').getBoundingClientRect();width=rect.width;height=rect.height;if(!width||!height)return;
      renderer.setSize(width,height,false);const sizes=cameraWidths();projectCamera(view.follow?sizes.follow:sizes.overview,view.follow?0:1);
      moveCamera(true);updatePins();navigation();renderer.render(scene,camera);
    }
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('mr-scene'));
    cleanup=()=>{closed=true;cancelAnimationFrame(frameId);resizeObserver.disconnect();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:o.material?[o.material]:[])){materials.add(m);if(m.map)textures.add(m.map);}});for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of textures)x.dispose();renderer.dispose();};
    function showToast(text,milliseconds=1100){$('mr-toast').textContent=text;$('mr-toast').hidden=false;toastUntil=performance.now()+milliseconds;}
    function controls(){
      const anchor=state.segment?state.segment.to:state.current,c=model.cells[anchor];
      const currentCell=model.cells[state.current];
      $('mr-canvas').setAttribute('aria-label','3D収集ルート。現在地 '+(currentCell.x+1)+'列'+(currentCell.y+1)+'行。'+(state.segment?'次の交差点 '+(c.x+1)+'列'+(c.y+1)+'行。':'停車中。')+'回収 '+state.collected.filter(Boolean).length+'件。');
      for(const button of $('mr-dpad').querySelectorAll('[data-dir]')){
        const d=button.dataset.dir;button.disabled=state.phase!=='playing'||state.paused||!!departure;button.dataset.queued=(drive.held||state.buffer)===d;button.dataset.open=c.links[d]!==undefined;
        button.querySelector('.mr-dirtext').firstChild.textContent=DIRS.find(v=>v.id===d).name;button.setAttribute('aria-pressed',String((drive.held||state.buffer)===d));
      }
      $('mr-padcenter').textContent=drive.held?'HOLD':'STOP';
      if(state.paused)$('mr-status').innerHTML='<strong>一時停止中</strong>';
      else if(departure)$('mr-status').innerHTML='<strong>回収へ出発！</strong>';
      else if(state.collecting)$('mr-status').innerHTML='<strong>'+targetInfo[state.collecting.index].name+'を回収中</strong><span>積み込みが終わったら出発</span>';
      else if(drive.planning)$('mr-status').innerHTML='<strong>ルートを描いています</strong><span>指を離すと走行開始</span>';
      else if(drive.routeActive)$('mr-status').innerHTML='<strong>なぞった道を走行中</strong><span>パッドを触ると手動操作</span>';
      else if(drive.held)$('mr-status').innerHTML='<strong>'+DIRS.find(d=>d.id===drive.held).name+'へ運転中</strong><span>指を滑らせると方向転換</span>';
      else if(state.segment)$('mr-status').innerHTML='<strong>次の交差点で停止</strong><span>タップで1区画ずつ進む</span>';
      else $('mr-status').innerHTML='<strong>パッドを押して走る</strong><span>離して停止・滑らせて曲がる</span>';
      navigation();
    }
    function hud(){
      $('mr-clock').textContent=Math.max(0,limit-state.elapsed).toFixed(1);$('mr-clock').style.color=limit-state.elapsed<10?'#ff947c':'';
      for(let i=0;i<3;i++){const e=root.querySelector('[data-stamp="'+targetInfo[i].id+'"]');e.dataset.done=state.collected[i];e.querySelector('span').textContent=state.collected[i]?'回収済':targetInfo[i].name;}
      collectionProps.forEach((prop,i)=>{prop.bags.visible=!state.collected[i];prop.clean.visible=state.collected[i];prop.pad.material.color.set(state.collected[i]?'#abedba':targetInfo[i].color);});
      const count=state.collected.filter(Boolean).length;$('mr-exitstatus').textContent=count===3?'センターへ！':count+' / 3 → センター';$('mr-exitstatus').dataset.open=count===3;
      goalMaterial.color.set(count===3?'#b6f56e':'#b8c9d0');const goalPin=pins.find(p=>p.goal);goalPin.element.style.setProperty('--pin',count===3?'#c4ff83':'#d4e2e8');
    }
    function addTrace(a,b){const key=[a,b].sort((x,y)=>x-y).join('-');if(visitedEdges.has(key))return;visitedEdges.add(key);const p=pos(a),q=pos(b);const m=new T.Mesh(cube,traceMaterial);m.scale.set(p.x===q.x?.13:step,.018,p.z===q.z?.13:step);m.position.set((p.x+q.x)/2,.18,(p.z+q.z)/2);traceGroup.add(m);trail.push(m);}
    function headingAngle(dir){return {n:0,e:-Math.PI/2,s:Math.PI,w:Math.PI/2}[dir];}
    function begin(dir){if(state.collecting)return false;const to=model.cells[state.current].links[dir];if(to===undefined)return false;if(to===state.prev)state.backtracks++;state.segment={from:state.current,to,dir,progress:0};state.heading=dir;state.moves++;controls();return true;}
    function autoContinue(){
      if(drive.planning||state.collecting){controls();return;}
      const dir=nextDriveDirection(model.cells,state,drive);
      if(dir)begin(dir);else controls();
      drawPlannedRoute();
    }
    function cancelRoute(){drive.route=[];drive.routeActive=false;drive.draft=[];drive.planning=false;drawPlannedRoute();}
    function pressDirection(dir){
      if(state.phase!=='playing'||state.paused||departure)return;
      cancelRoute();
      if(state.collecting){state.buffer=dir;controls();return;}
      if(!state.segment){if(model.cells[state.current].links[dir]===undefined){controls();return;}state.buffer=null;begin(dir);return;}
      state.buffer=dir;controls();
    }
    function holdDirection(dir){
      if(state.phase!=='playing'||state.paused||departure)return;
      if(dir===drive.held)return;
      drive.held=dir;
      if(dir)pressDirection(dir);else{state.buffer=null;controls();}
    }
    function releaseDrive(keepTap=false){drive.held=null;if(!keepTap)state.buffer=null;controls();}
    function arrive(from,to){
      state.prev=from;state.current=to;state.segment=null;addTrace(from,to);
      const index=model.targets.indexOf(to);
      if(index>=0&&!state.collected[index]){
        state.collecting={index,elapsed:0,duration:.8};
        showToast(targetInfo[index].name+'で停車・積み込み中',800);controls();return;
      }
      if(to===model.goal){if(state.collected.every(Boolean)){finish(true);return;}if(!state.exitNotified){showToast('回収があと'+state.collected.filter(v=>!v).length+'件。全部回収してからセンターへ。',1500);state.exitNotified=true;}}
      autoContinue();
    }
    function advanceCollection(seconds){
      const pickup=state.collecting;if(!pickup)return 0;
      const used=Math.min(seconds,pickup.duration-pickup.elapsed);pickup.elapsed+=used;
      const progress=Math.min(1,pickup.elapsed/pickup.duration),prop=collectionProps[pickup.index];
      prop.bags.position.set(T.MathUtils.lerp(prop.origin.x,truck.position.x,progress),Math.sin(progress*Math.PI)*1.25,prop.origin.z);
      prop.bags.scale.setScalar(1-progress*.65);
      if(progress>=1-1e-7){
        const index=pickup.index;state.collecting=null;state.collected[index]=true;
        renderer.shadowMap.needsUpdate=true;
        if(selectedTarget===index)selectedTarget=state.collected.every(Boolean)?3:state.collected.findIndex(done=>!done);
        showToast(targetInfo[index].text+' 回収完了！'+(state.collected.every(Boolean)?' センターへ！':''),1100);
        $('mr-live').textContent=targetInfo[index].name+'がきれいになりました。';hud();autoContinue();
      }
      return used;
    }
    function finish(success){
      drive.held=null;drive.pointer=null;cancelRoute();$('mr-touchcursor').hidden=true;root.dataset.phase='finished';state.phase='finished';state.segment=null;state.collecting=null;state.buffer=null;if(success&&(state.best===null||state.elapsed<state.best))state.best=state.elapsed;
      $('mr-result-title').textContent=success?'CITY CLEANED!':'TIME UP';$('mr-result-time').textContent=state.elapsed.toFixed(1);
      $('mr-result-message').textContent=success?'3か所の回収完了！ 街のきれいをつないで、センターに到着。':state.collected.filter(Boolean).length+' / 3か所を回収。全体図でルートを見直して、もう一度出発しよう。';
      $('mr-resultstats').textContent='走行 '+state.moves+'区間 / 引き返し '+state.backtracks+'回'+(state.best!==null?' / この迷路のベスト '+state.best.toFixed(1)+'秒':'');
      $('mr-result').hidden=false;$('mr-controls').hidden=true;$('mr-toast').hidden=true;$('mr-live').textContent=$('mr-result-title').textContent+'。'+$('mr-result-message').textContent;controls();hud();renderer.render(scene,camera);
    }
    function reset(){
      departure=null;drive.held=null;drive.pointer=null;cancelRoute();selectedTarget=0;$('mr-touchcursor').hidden=true;root.dataset.phase='ready';view.follow=false;updateViewButtons();
      state.phase='ready';state.current=model.start;state.prev=-1;state.heading=null;state.buffer=null;state.segment=null;state.collecting=null;state.elapsed=0;collectionProps.forEach(prop=>{prop.bags.position.set(prop.origin.x,0,prop.origin.z);prop.bags.scale.setScalar(1);});renderer.shadowMap.needsUpdate=true;state.collected=[false,false,false];state.moves=0;state.backtracks=0;state.paused=false;state.exitNotified=false;traceGroup.clear();trail=[];visitedEdges.clear();const p=pos(model.start);truck.position.set(p.x,.18,p.z);truck.rotation.y=0;halo.position.set(p.x,.2,p.z);$('mr-result').hidden=true;$('mr-controls').hidden=false;$('mr-startpanel').hidden=false;$('mr-playpanel').hidden=true;$('mr-toast').hidden=true;$('mr-pause').textContent='一時停止';hud();controls();resize();
    }
    function start(){
      reset();
      const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(!reduceMotion)departure={elapsed:0,duration:.9,fromX:cameraFocus.x,fromZ:cameraFocus.z};
      root.dataset.phase='playing';state.phase='playing';view.follow=true;updateViewButtons();
      $('mr-startpanel').hidden=true;$('mr-playpanel').hidden=false;lastTime=performance.now();resize();controls();updatePins();
      showToast('回収へ出発！',900);$('mr-live').textContent='全体図からトラックへ移動します。運転画面になってから60秒の計測を始めます。';
    }
    function newMaze(){seed+=9973;mapNumber++;model=createMaze(seed);state.best=null;drawMaze();view.follow=false;$('mr-view').textContent='追従';$('mr-view').setAttribute('aria-label','トラックを拡大して追従表示する');reset();}
    on($('mr-start'),'click',start);on($('mr-retry'),'click',start);on($('mr-restart'),'click',start);on($('mr-newmaze'),'click',newMaze);
    for(const button of $('mr-roadarrows').querySelectorAll('[data-road-dir]')){
      on(button,'pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;event.preventDefault();drive.held=null;pressDirection(button.dataset.roadDir);});
      on(button,'click',event=>{if(event.detail===0){drive.held=null;pressDirection(button.dataset.roadDir);}});
    }
    const dpad=$('mr-dpad');
    function padDirection(event){const r=dpad.getBoundingClientRect();return directionFromVector(event.clientX-r.left-r.width/2,event.clientY-r.top-r.height/2,drive.held,17);}
    on(dpad,'pointerdown',event=>{
      if(!event.isPrimary||event.button!==0||state.phase!=='playing'||state.paused||departure)return;
      event.preventDefault();dpad.setPointerCapture(event.pointerId);drive.pointer={id:event.pointerId,kind:'pad',time:performance.now(),x:event.clientX,y:event.clientY,moved:false};holdDirection(padDirection(event));
    });
    on(dpad,'pointermove',event=>{const p=drive.pointer;if(!p||p.id!==event.pointerId||p.kind!=='pad')return;if(Math.hypot(event.clientX-p.x,event.clientY-p.y)>8)p.moved=true;holdDirection(padDirection(event));});
    function releasePointer(event,cancel=false){const p=drive.pointer;if(!p||p.id!==event.pointerId)return;drive.pointer=null;releaseDrive(!cancel&&!p.moved&&performance.now()-p.time<200);}
    on(dpad,'pointerup',event=>releasePointer(event));on(dpad,'pointercancel',event=>releasePointer(event,true));on(dpad,'lostpointercapture',event=>releasePointer(event,true));
    on(dpad,'click',event=>{if(event.detail!==0)return;const button=event.target.closest('[data-dir]');if(button)pressDirection(button.dataset.dir);});
    const keys={ArrowUp:'n',ArrowRight:'e',ArrowDown:'s',ArrowLeft:'w',w:'n',d:'e',s:'s',a:'w',W:'n',D:'e',S:'s',A:'w'};
    on(document,'keydown',event=>{if(state.phase!=='playing'||state.paused||departure||event.ctrlKey||event.metaKey||event.altKey)return;if(keys[event.key]){event.preventDefault();holdDirection(keys[event.key]);}});
    on(document,'keyup',event=>{if(keys[event.key]===drive.held)releaseDrive();});
    function nearestRoad(event){
      const rect=$('mr-scene').getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      let chosen=null,best=Infinity;for(const c of model.cells){const p=pos(c.id),point=screen(p.x,.18,p.z),d=Math.hypot(x-point.x,y-point.y);if(d<best){best=d;chosen=c.id;}}
      const centre=screen(0,.18,0),east=screen(step,.18,0),radius=Math.max(18,Math.hypot(east.x-centre.x,east.y-centre.y)*.62);
      return best<radius?chosen:null;
    }
    function addRoadPoint(event){const target=nearestRoad(event);if(target===null)return;const next=extendDrawnRoute(model.cells,drive.draft,target);if(next!==drive.draft){drive.draft=next;drawPlannedRoute();controls();}}
    function commitRoute(){
      const path=[...drive.draft];drive.draft=[];drive.planning=false;
      if(path.length>1){drive.route=path.slice(1);drive.routeActive=true;if(!state.segment)autoContinue();showToast('なぞったルートを走ります',900);}
      else{drive.route=[];drive.routeActive=false;showToast('トラックのいる道路から、指でなぞろう',1100);}
      drawPlannedRoute();controls();
    }
    on($('mr-scene'),'pointerdown',event=>{
      if(!event.isPrimary||event.button!==0||event.target.closest('button,a')||state.phase!=='playing'||state.paused||departure)return;
      event.preventDefault();$('mr-scene').setPointerCapture(event.pointerId);cancelRoute();drive.held=null;state.buffer=null;
      drive.pointer={id:event.pointerId,kind:view.follow?'steer':'route',time:performance.now(),x:event.clientX,y:event.clientY,moved:false};
      if(!view.follow){drive.planning=true;drive.draft=[state.segment?state.segment.to:state.current];addRoadPoint(event);drawPlannedRoute();controls();}
      else{const rect=$('mr-scene').getBoundingClientRect();$('mr-touchcursor').style.left=(event.clientX-rect.left)+'px';$('mr-touchcursor').style.top=(event.clientY-rect.top)+'px';$('mr-touchcursor').hidden=false;}
    });
    on($('mr-scene'),'pointermove',event=>{
      const p=drive.pointer;if(!p||p.id!==event.pointerId||p.kind==='pad')return;
      if(Math.hypot(event.clientX-p.x,event.clientY-p.y)>8)p.moved=true;
      if(p.kind==='route')addRoadPoint(event);else holdDirection(directionFromVector(event.clientX-p.x,event.clientY-p.y,drive.held,12));
    });
    function releaseScene(event,cancel=false){
      const p=drive.pointer;if(!p||p.id!==event.pointerId||p.kind==='pad')return;
      drive.pointer=null;$('mr-touchcursor').hidden=true;
      if(cancel){cancelRoute();releaseDrive();return;}
      if(p.kind==='route')commitRoute();
      else{releaseDrive();if(!p.moved){const target=nearestRoad(event),from=state.segment?state.segment.to:state.current,path=target===null?null:connectedPath(model.cells,from,target,2);if(path&&path.length>1){drive.route=path.slice(1);drive.routeActive=true;drawPlannedRoute();if(!state.segment)autoContinue();}}}
    }
    on($('mr-scene'),'pointerup',event=>releaseScene(event));on($('mr-scene'),'pointercancel',event=>releaseScene(event,true));on($('mr-scene'),'lostpointercapture',event=>releaseScene(event,true));
    for(let i=0;i<3;i++)on(root.querySelector('[data-stamp="'+targetInfo[i].id+'"]'),'click',()=>selectTarget(i));
    on($('mr-exitstatus'),'click',()=>selectTarget(3));
    on($('mr-minimap'),'click',()=>setView(false));
    function setPaused(paused){if(state.phase!=='playing')return;if(paused){drive.held=null;drive.pointer=null;state.buffer=null;drive.planning=false;drive.draft=[];$('mr-touchcursor').hidden=true;drawPlannedRoute();}state.paused=paused;lastTime=performance.now();$('mr-pause').textContent=paused?'再開する':'一時停止';controls();}
    on($('mr-pause'),'click',()=>setPaused(!state.paused));
    on(document,'visibilitychange',()=>{if(document.hidden&&state.phase==='playing'&&!state.paused)setPaused(true);lastTime=performance.now();});
    on(window,'blur',()=>{if(state.phase==='playing')setPaused(true);});
    function updateViewButtons(){
      root.dataset.view=view.follow?'follow':'overview';
      $('mr-view').textContent=view.follow?'全体図':'拡大';
      $('mr-view').setAttribute('aria-label',view.follow?'迷路全体を表示する':'トラックを拡大して追従表示する');
      $('mr-thumbview').textContent=view.follow?'全体図を見る':'トラックに戻る';
    }
    function setView(follow){if(departure)return;drive.held=null;drive.pointer=null;state.buffer=null;if(drive.planning)cancelRoute();$('mr-touchcursor').hidden=true;view.follow=follow;root.dataset.view=follow?'follow':'overview';updateViewButtons();resize();controls();}
    function toggleView(){setView(!view.follow);}
    on($('mr-view'),'click',toggleView);on($('mr-thumbview'),'click',toggleView);
    on($('mr-camera'),'click',()=>{if(departure)return;view.top=!view.top;$('mr-camera').textContent=view.top?'立体':'真上';$('mr-camera').setAttribute('aria-label',view.top?'立体的な俯瞰表示に切り替える':'真上からの表示に切り替える');resize();});
    function tick(now){
      if(closed||!root.isConnected){closed=true;resizeObserver.disconnect();renderer.dispose();cancelAnimationFrame(frameId);return;}
      let dt=lastTime===null?0:Math.max(0,(now-lastTime)/1000);lastTime=now;
      if(departure&&!state.paused){
        departure.elapsed+=dt;dt=0;
        if(departure.elapsed>=departure.duration){departure=null;resize();controls();$('mr-live').textContent='60秒の回収スタート。';}
      }
      if(state.phase==='playing'&&!state.paused&&!departure){
        dt=Math.min(dt,limit-state.elapsed);let remaining=dt;
        while(remaining>1e-7&&state.phase==='playing'){
          if(state.collecting){const used=advanceCollection(remaining);state.elapsed+=used;remaining-=used;continue;}
          if(!state.segment){state.elapsed+=remaining;remaining=0;break;}
          const segment=state.segment,used=Math.min(remaining,edgeSeconds*(1-segment.progress));segment.progress=Math.min(1,segment.progress+used/edgeSeconds);state.elapsed+=used;remaining-=used;
          const a=pos(segment.from),b=pos(segment.to),p=segment.progress;truck.position.set(T.MathUtils.lerp(a.x,b.x,p),.18+Math.sin(p*Math.PI)*.05,T.MathUtils.lerp(a.z,b.z,p));const desired=headingAngle(segment.dir),delta=Math.atan2(Math.sin(desired-truck.rotation.y),Math.cos(desired-truck.rotation.y));truck.rotation.y+=delta*Math.min(1,used*22);
          if(p>=1-1e-7)arrive(segment.from,segment.to);
        }
        if(state.elapsed>=limit-1e-7&&state.phase==='playing'){state.elapsed=limit;finish(false);}
      }
      halo.position.x=truck.position.x;halo.position.z=truck.position.z;if(view.follow)moveCamera();if(now-lastUi>90)updatePins();
      if(now>toastUntil)$('mr-toast').hidden=true;if(now-lastUi>90){hud();navigation();lastUi=now;}
      if(now-lastRender>25){renderer.render(scene,camera);lastRender=now;}frameId=requestAnimationFrame(tick);
    }
    function readGameState(){
      const current=model.cells[state.current],next=model.cells[state.segment?state.segment.to:state.current];
      return {phase:state.phase,departing:!!departure,collecting:state.collecting?targetInfo[state.collecting.index].id:null,paused:state.paused,secondsLeft:Number(Math.max(0,limit-state.elapsed).toFixed(1)),collected:state.collected.filter(Boolean).length,column:current.x+1,row:current.y+1,nextColumn:next.x+1,nextRow:next.y+1,queuedDirection:state.buffer,heldDirection:drive.held,routeRemaining:drive.route.length,selectedTarget:selectedTarget===3?'goal':targetInfo[selectedTarget].id,view:view.follow?'follow':'overview',maze:mapNumber,mapSize:model.n};
    }
    const context=document.modelContext;
    if(context?.registerTool){
      const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.warn('Game tool registration unavailable',error));}catch(error){console.warn('Game tool registration unavailable',error);}};
      register({name:'read_collection_game',title:'収集ゲームの状況を見る',description:'Read the same collection count, timer, location, pause status, and view shown in the game.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input===null||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object.');return readGameState();}});
      register({name:'control_collection_game',title:'収集ゲームを操作する',description:'Start or restart the 60-second collection run, steer the truck, hold a direction until release, pause or resume, or change between the full map and truck view. Uses the same actions as the game buttons. Starting resets the current attempt.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['start','north','east','south','west','pause','resume','overview','follow','hold_north','hold_east','hold_south','hold_west','release']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){
        const actions=['start','north','east','south','west','pause','resume','overview','follow','hold_north','hold_east','hold_south','hold_west','release'];
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='action')||!actions.includes(input.action))throw new Error('Choose a supported game action.');
        const action=input.action;
        if(action==='start')start();
        else if(action==='overview'||action==='follow'){setView(action==='follow');}
        else {if(state.phase!=='playing')throw new Error('Start the collection run first.');if(action==='pause'||action==='resume')setPaused(action==='pause');else{if(state.paused)throw new Error('Resume the trial before steering.');if(action==='release'){cancelRoute();releaseDrive();}else if(action.startsWith('hold_'))holdDirection({hold_north:'n',hold_east:'e',hold_south:'s',hold_west:'w'}[action]);else pressDirection({north:'n',east:'e',south:'s',west:'w'}[action]);}}
        return readGameState();
      }});
      register({name:'set_collection_route',title:'なぞった道路のルートで走る',description:'Set a route through connected road intersections, the same as drawing on the full map. Each point is a one-based column and row. Begin with nextColumn and nextRow from read_collection_game. Does not find an automatic route or cross walls.',inputSchema:{type:'object',properties:{points:{type:'array',minItems:2,maxItems:200,items:{type:'object',properties:{column:{type:'integer',minimum:1,maximum:7},row:{type:'integer',minimum:1,maximum:7}},required:['column','row'],additionalProperties:false}}},required:['points'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){
        if(!input||typeof input!=='object'||Object.keys(input).some(key=>key!=='points')||!Array.isArray(input.points))throw new Error('Provide road intersection points.');
        if(state.phase!=='playing'||state.paused||departure)throw new Error('Wait for departure to finish, then start or resume the game before setting a route.');
        if(input.points.some(p=>!p||typeof p!=='object'||Object.keys(p).some(k=>k!=='column'&&k!=='row')||!Number.isInteger(p.column)||!Number.isInteger(p.row)||p.column<1||p.column>model.n||p.row<1||p.row>model.n))throw new Error('Points must be within the 7 by 7 map.');
        const path=input.points.map(p=>(p.row-1)*model.n+p.column-1),anchor=state.segment?state.segment.to:state.current;
        if(!validateRoadRoute(model.cells,path,anchor))throw new Error('The route must start at the truck and follow connected roads.');
        cancelRoute();drive.held=null;state.buffer=null;drive.route=path.slice(1);drive.routeActive=true;if(!state.segment)autoContinue();drawPlannedRoute();controls();
        return readGameState();
      }});
    }
    model=createMaze(seed);drawMaze();reset();$('mr-loading').hidden=true;$('mr-start').disabled=false;frameId=requestAnimationFrame(tick);
  }
  return ()=>{lifecycle.abort();cleanup();};
}
