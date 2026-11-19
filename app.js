import { Network, PhysicsSpiral, TRUE_SPIRAL, FEATURE_NAMES, makeData, loss } from './model.js';
import { TrainingHistory } from './history.js';
import { chartWindow, chartHasOutOfRange } from './chart.js';

const $ = id => document.getElementById(id);
const state = { dataset:'ellipse', shape:[4,2], selected:[true,true,false,false,false,false,false], physics:false, points:[], train:[], test:[], model:null, epoch:0, running:false, history:new TrainingHistory(), runId:0 };
const pos = [22, 145, 125], neg = [144, 105, 180];

function stop() { state.running = false; state.runId++; $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Start training'); $('play').title = 'Start training'; }
function splitData() {
  const n = Math.round(state.points.length * Number($('split').value) / 100);
  state.train = state.points.slice(0, n); state.test = state.points.slice(n);
}
function newData() { state.points = makeData(state.dataset, Number($('noise').value)); splitData(); reset(); }
function reset() {
  stop(); state.epoch = 0; state.history.reset();
  state.model = state.physics ? new PhysicsSpiral() : new Network(state.selected.flatMap((on, i) => on ? [i] : []), state.shape, $('activation').value);
  state.history.add(0, loss(state.model,state.train), loss(state.model,state.test), state.physics ? state.model : null);
  render();
}
function trainEpoch() {
  const data = [...state.train];
  for (let i=data.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [data[i],data[j]]=[data[j],data[i]]; }
  const batch = Number($('batch').value), lr = Number($('learning-rate').value), reg = $('regularization').value, rate = Number($('regularization-rate').value);
  for (let i=0;i<data.length;i+=batch) state.model.train(data.slice(i,i+batch),lr,reg,rate);
  state.epoch++;
  state.history.add(state.epoch,loss(state.model,state.train),loss(state.model,state.test),state.physics ? state.model : null);
}
function tick(runId) {
  if (!state.running || runId !== state.runId) return;
  for (let i=0;i<2;i++) trainEpoch();
  render();
  if (state.running && runId === state.runId) requestAnimationFrame(() => tick(runId));
}
function color(p, alpha=1) {
  const v = Math.max(0, Math.min(1,p));
  return `rgba(${Math.round(neg[0]*(1-v)+pos[0]*v)},${Math.round(neg[1]*(1-v)+pos[1]*v)},${Math.round(neg[2]*(1-v)+pos[2]*v)},${alpha})`;
}
function drawPoints(ctx, points, size, faint = false) {
  for (const p of points) {
    const x=(p.x+6)/12*size, y=(6-p.y)/12*size;
    ctx.beginPath(); ctx.arc(x,y,faint ? 2.4 : 3,0,Math.PI*2);
    ctx.fillStyle=faint?'white':color(p.label); ctx.fill(); ctx.lineWidth=1.15;ctx.strokeStyle=color(p.label);ctx.stroke();
  }
}
function thumbnail(canvas, kind) {
  const ctx=canvas.getContext('2d'), data=makeData(kind,0,180); ctx.fillStyle='#fff';ctx.fillRect(0,0,90,90);
  for(const p of data){ctx.beginPath();ctx.arc((p.x+6)/12*90,(6-p.y)/12*90,1.45,0,Math.PI*2);ctx.fillStyle=color(p.label,.9);ctx.fill();}
}
function drawOutput() {
  const canvas=$('output'),ctx=canvas.getContext('2d'), n=80, temp=document.createElement('canvas'); temp.width=n;temp.height=n;
  const tc=temp.getContext('2d'), image=tc.createImageData(n,n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    let p=state.model.predict(x/(n-1)*12-6,6-y/(n-1)*12);if($('discretize').checked)p=p>=.5?1:0;
    const strength=Math.abs(p-.5)*2, base=p>=.5?pos:neg, i=(y*n+x)*4;
    for(let c=0;c<3;c++) image.data[i+c]=Math.round(249*(1-strength*.48)+base[c]*strength*.48);image.data[i+3]=255;
  }
  tc.putImageData(image,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(temp,0,0,400,400);
  ctx.strokeStyle='rgba(60,80,75,.08)';ctx.lineWidth=1;for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(i*400/6,0);ctx.lineTo(i*400/6,400);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*400/6);ctx.lineTo(400,i*400/6);ctx.stroke();}
  drawPoints(ctx,state.train,400);if($('show-test').checked)drawPoints(ctx,state.test,400,true);
}
function drawChart(canvas, series, rangeId, warningId, groundTruth = null, phase = false) {
  const ctx=canvas.getContext('2d'), points=state.history.points(), w=canvas.width, h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const left=70,right=w-12,top=12,bottom=h-40;
  const [min,max]=$(rangeId).value.split(',').map(Number);
  const {start,end}=chartWindow(points.at(-1)?.epoch ?? 0,$('timeline').value);
  const x=e=>left+(right-left)*(e-start)/(end-start), y=v=>bottom-(v-min)/(max-min)*(bottom-top);
  canvas.dataset.xStart=String(start);canvas.dataset.xEnd=String(end);canvas.dataset.yMin=String(min);canvas.dataset.yMax=String(max);
  $(warningId).hidden=!chartHasOutOfRange(points,series.map(s=>s.key),start,end,min,max);
  ctx.font='20px "Segoe UI", sans-serif';ctx.fillStyle='#586f65';ctx.textAlign='right';ctx.textBaseline='middle';
  for(let i=0;i<=4;i++) {const value=min+(max-min)*i/4, py=y(value);ctx.strokeStyle='#d9e4dd';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.stroke();ctx.fillText(Number(value.toFixed(2)).toString(),left-8,py);}
  ctx.textBaseline='top';ctx.fillStyle='#586f65';
  for(let i=0;i<=2;i++){const epoch=start+(end-start)*i/2,px=x(epoch);ctx.textAlign=i===0?'left':i===2?'right':'center';ctx.fillText(Number(epoch.toFixed(1)).toLocaleString('en-US'),px,bottom+7);}
  ctx.textAlign='center';ctx.font='18px "Segoe UI", sans-serif';ctx.fillText('epoch',(left+right)/2,h-18);
  ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  let firstVisible=points.findIndex(p=>p.epoch>=start);if(firstVisible<0)firstVisible=points.length;const visible=points.slice(Math.max(0,firstVisible-1)).filter(p=>p.epoch<=end);
  for(const item of series){ctx.beginPath();ctx.strokeStyle=item.color;ctx.lineWidth=3;let started=false;for(const p of visible){if(!Number.isFinite(p[item.key]))continue;const px=x(p.epoch),py=y(p[item.key]);if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py);}ctx.stroke();const latest=points.at(-1);if(latest && Number.isFinite(latest[item.key]) && latest.epoch>=start && latest.epoch<=end){ctx.beginPath();ctx.arc(x(latest.epoch),y(latest[item.key]),4,0,Math.PI*2);ctx.fillStyle=item.color;ctx.fill();}}
  if(groundTruth!==null) {
    const first=Math.ceil((min-groundTruth)/(2*Math.PI)),last=Math.floor((max-groundTruth)/(2*Math.PI)),count=Math.max(0,last-first+1);
    const truths=phase ? (count<=20 ? Array.from({length:count},(_,i)=>groundTruth+(first+i)*2*Math.PI) : [groundTruth+Math.round(((points.at(-1)?.phase ?? 0)-groundTruth)/(2*Math.PI))*2*Math.PI]) : [groundTruth];
    ctx.save();ctx.setLineDash([8,6]);ctx.lineWidth=2;ctx.strokeStyle='#687e73';for(const truth of truths){ctx.beginPath();ctx.moveTo(left,y(truth));ctx.lineTo(right,y(truth));ctx.stroke();}ctx.restore();
  }
  ctx.restore();
}
function drawLoss() { drawChart($('loss-chart'),[{key:'train',color:'#168879'},{key:'test',color:'#9474b7'}],'loss-range','loss-warning'); }
function editParameter(title, value, save) {
  stop(); const dialog=$('parameter-dialog'), input=$('parameter-value');
  $('parameter-title').textContent=title; input.value=Number(value.toFixed(5));
  dialog.onclose=()=>{if(dialog.returnValue==='save' && Number.isFinite(input.valueAsNumber)){save(input.valueAsNumber);state.history.reviseLatest(loss(state.model,state.train),loss(state.model,state.test));render();}};
  dialog.showModal();input.select();
}
function activationTiles() {
  // A single grid evaluates all neurons; every miniature is a live activation map.
  const n=20, layers=state.model.layers, tiles=layers.slice(0,-1).map(layer=>layer.biases.map(()=>new Uint8ClampedArray(n*n*4)));
  if(!tiles.length)return tiles;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const out=state.model.forward(x/(n-1)*12-6,6-y/(n-1)*12);
    for(let l=0;l<tiles.length;l++)for(let j=0;j<tiles[l].length;j++){
      const v=out.acts[l+1][j], z=state.model.activation==='sigmoid'?(v-.5)*2:Math.tanh(v), base=z>=0?pos:neg, strength=Math.min(1,Math.abs(z));
      const a=tiles[l][j], k=(y*n+x)*4;for(let c=0;c<3;c++)a[k+c]=Math.round(249*(1-.62*strength)+base[c]*(.62*strength));a[k+3]=255;
    }
  }
  return tiles.map(layer=>layer.map(bytes=>{const c=document.createElement('canvas');c.width=n;c.height=n;const ctx=c.getContext('2d');ctx.putImageData(new ImageData(bytes,n,n),0,0);return c.toDataURL();}));
}
const svgEl = (type,attrs) => {const e=document.createElementNS('http://www.w3.org/2000/svg',type);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
function drawNetwork() {
  const area=$('network-drawing');area.replaceChildren();area.classList.toggle('physics-network',state.physics);
  const svg=svgEl('svg',{viewBox:'0 0 600 330',preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':state.physics?'Physics-informed spiral network':'Neural network architecture'});area.append(svg);
  if(state.physics){
    svg.setAttribute('viewBox','0 0 600 275');
    const text=(x,y,value,cls,anchor='middle')=>{const t=svgEl('text',{x,y,'text-anchor':anchor,class:cls});t.textContent=value;svg.append(t);};
    const edge=(x1,y1,x2,y2,trainable=false)=>svg.append(svgEl('line',{x1,y1,x2,y2,class:trainable?'physics-edge trainable-edge':'physics-edge'}));
    const node=(x,y,label,caption)=>{svg.append(svgEl('circle',{cx:x,cy:y,r:21,class:'physics-node'}));text(x,y+4,label,'physics-node-text');if(caption)text(x,y-33,caption,'physics-caption');};
    const badge=(x,y,name,value,targetX,targetY)=>{edge(x,y-15,targetX,targetY,true);const group=svgEl('g',{class:'parameter-badge'});group.append(svgEl('rect',{x:x-40,y:y-14,width:80,height:28,rx:5}));const label=svgEl('text',{x,y:y+4,'text-anchor':'middle'});label.textContent=`${name} ${value.toFixed(2)}`;group.append(label);svg.append(group);};
    for(const [y,label] of [[86,'x₁'],[154,'x₂']])node(30,y,label,y===86?'INPUT':null);
    node(132,86,'r','POLAR');node(132,154,'θ',null);node(237,86,'×','MULTIPLY');node(328,125,'−','RESIDUAL');node(416,125,'cos','COSINE');node(548,125,'σ','OUTPUT');
    edge(51,86,111,86);edge(51,86,111,154);edge(51,154,111,86);edge(51,154,111,154);
    edge(153,86,216,86);edge(258,86,307,115);edge(153,154,307,135);edge(349,125,395,125);edge(437,125,527,125);
    text(132,198,'r = √(x₁² + x₂²)','physics-formula');text(132,215,'θ = atan2(x₁, x₂)','physics-formula');
    text(328,167,'θ − kr − φ','physics-formula');text(483,110,'s · cos Δ + b','physics-formula');
    badge(237,230,'k',state.model.rate,237,107);badge(328,230,'φ',state.model.phase,328,146);badge(470,230,'s',state.model.scale,537,145);badge(556,230,'b',state.model.bias,559,145);
    text(398,268,'COLORED BADGES = TRAINABLE','physics-key');
    return;
  }
  const active=state.selected.flatMap((on,i)=>on?[i]:[]), sizes=[active.length,...state.shape,1], columns=sizes.map((n,layer)=>Array.from({length:n},(_,j)=>({x:35+layer*(530/(sizes.length-1)),y:165+(j-(n-1)/2)*Math.min(48,245/Math.max(1,n-1))})));
  state.model.layers.forEach((layer,l)=>layer.weights.forEach((weights,j)=>weights.forEach((w,i)=>{const a=columns[l][i],b=columns[l+1][j];svg.append(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:w>=0?'#4fae98':'#9f83c0','stroke-opacity':Math.min(.8,.2+Math.abs(w)*.45),'stroke-width':Math.min(3,.6+Math.abs(w))}));const hit=svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'transparent','stroke-width':10,style:'cursor:pointer'});const title=svgEl('title',{});title.textContent=`Weight ${w.toFixed(3)} · click to edit`;hit.append(title);hit.addEventListener('click',()=>editParameter('Edit weight',w,value=>{layer.weights[j][i]=value;}));svg.append(hit);})));
  const tiles=activationTiles();
  columns.forEach((col,l)=>col.forEach((node,j)=>{
    if(l>0 && l<columns.length-1){const img=svgEl('image',{x:node.x-14,y:node.y-14,width:28,height:28,href:tiles[l-1][j]});svg.append(img);const rect=svgEl('rect',{x:node.x-14,y:node.y-14,width:28,height:28,fill:'transparent',stroke:'#188a7b','stroke-width':1.5,style:'cursor:pointer'});const title=svgEl('title',{});title.textContent=`Neuron output · bias ${state.model.layers[l-1].biases[j].toFixed(3)} · click to edit`;rect.append(title);rect.addEventListener('click',()=>editParameter('Edit neuron bias',state.model.layers[l-1].biases[j],value=>{state.model.layers[l-1].biases[j]=value;}));rect.addEventListener('pointerenter',()=>{const preview=document.createElement('img');preview.className='neuron-preview';preview.src=tiles[l-1][j];preview.alt='';area.append(preview);preview.style.left=`${Math.min(75,Math.max(0,node.x/600*100))}%`;preview.style.top=`${Math.min(60,Math.max(0,node.y/330*100))}%`;});rect.addEventListener('pointerleave',()=>area.querySelector('.neuron-preview')?.remove());svg.append(rect);}
    else {const circle=svgEl('circle',{cx:node.x,cy:node.y,r:15,fill:'#fff',stroke:l===0?'#829d94':'#188a7b','stroke-width':1.6});svg.append(circle);const t=svgEl('text',{x:node.x,y:node.y+4,'text-anchor':'middle','font-size':11,fill:'#3f5b53','pointer-events':'none'});t.textContent=l===0?FEATURE_NAMES[active[j]]:'ŷ';svg.append(t);if(l===columns.length-1){circle.style.cursor='pointer';circle.addEventListener('click',()=>editParameter('Edit output bias',state.model.layers.at(-1).biases[0],value=>{state.model.layers.at(-1).biases[0]=value;}));}}
  }));
  state.shape.forEach((n,i)=>{const x=(35+(i+1)*(530/(sizes.length-1)))/600*100, box=document.createElement('div');box.className='layer-buttons';box.style.left=`${x}%`;const minus=document.createElement('button');minus.textContent='−';minus.setAttribute('aria-label',`Remove neuron from layer ${i+1}`);minus.disabled=n<=1;minus.onclick=()=>{state.shape[i]--;reset();};const plus=document.createElement('button');plus.textContent='+';plus.setAttribute('aria-label',`Add neuron to layer ${i+1}`);plus.disabled=n>=8;plus.onclick=()=>{state.shape[i]++;reset();};const count=document.createElement('span');count.textContent=`${n} neuron${n===1?'':'s'}`;box.append(minus,plus,count);area.append(box);});
}
function drawFeatures(){const root=$('features');root.replaceChildren();FEATURE_NAMES.forEach((name,i)=>{const button=document.createElement('button');button.className='feature'+(state.selected[i]?' active':'');button.textContent=name;button.setAttribute('aria-pressed',String(state.selected[i]));button.disabled=state.physics;button.title=state.physics?'Physics mode uses x₁ and x₂':`Toggle ${name}`;button.onclick=()=>{if(state.selected[i]&&state.selected.filter(Boolean).length===1)return;state.selected[i]=!state.selected[i];reset();};root.append(button);});}
function render(){
  $('epoch').textContent=String(state.epoch).padStart(6,'0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  $('train-loss').textContent=loss(state.model,state.train).toFixed(3);$('test-loss').textContent=loss(state.model,state.test).toFixed(3);
  $('layer-count').textContent=state.shape.length;$('remove-layer').disabled=state.shape.length===0;$('add-layer').disabled=state.shape.length===3;
  $('layer-controls').hidden=state.physics;$('features').hidden=state.physics;$('physics-detail').hidden=!state.physics;$('activation').disabled=state.physics;
  $('network-subtitle').textContent=state.physics?'Learn a spiral directly from polar coordinates':'Select inputs; click a connection or neuron to edit';
  if(state.physics){$('learned-rate').textContent=state.model.rate.toFixed(3);$('learned-phase').textContent=state.model.phaseUnwrapped.toFixed(3);$('true-rate').textContent=TRUE_SPIRAL.rate.toFixed(3);$('true-phase').textContent=TRUE_SPIRAL.phase.toFixed(3);}
  drawFeatures();drawNetwork();drawOutput();drawLoss();
  if(state.physics){drawChart($('rate-chart'),[{key:'rate',color:'#168879'}],'rate-range','rate-warning',TRUE_SPIRAL.rate);drawChart($('phase-chart'),[{key:'phase',color:'#168879'}],'phase-range','phase-warning',TRUE_SPIRAL.phase,true);}
}
$('reset').onclick=reset;
$('play').onclick=()=>{if(state.running){stop();return;}state.running=true;const runId=++state.runId;$('play').textContent='❚❚';$('play').setAttribute('aria-label','Pause training');$('play').title='Pause training';requestAnimationFrame(()=>tick(runId));};
$('step').onclick=()=>{stop();trainEpoch();render();};
$('add-layer').onclick=()=>{if(state.shape.length<3){state.shape.push(3);reset();}};
$('remove-layer').onclick=()=>{if(state.shape.length>0){state.shape.pop();reset();}};
$('activation').onchange=reset;
$('physics').onchange=()=>{state.physics=$('physics').checked;reset();};
document.querySelectorAll('.dataset').forEach(button=>button.onclick=()=>{state.dataset=button.dataset.dataset;document.querySelectorAll('.dataset').forEach(b=>{const on=b===button;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});$('physics').disabled=state.dataset!=='spiral';if(state.dataset!=='spiral'){$('physics').checked=false;state.physics=false;}$('physics-help').textContent=state.dataset==='spiral'?'Switch modes to compare model architectures.':'Available for the two-spiral dataset.';newData();});
$('split').oninput=()=>{$('split-value').textContent=$('split').value+'%';splitData();reset();};
$('noise').oninput=()=>{$('noise-value').textContent=Number($('noise').value).toFixed(2);};$('noise').onchange=newData;
$('batch').oninput=()=>{$('batch-value').textContent=$('batch').value;};$('regenerate').onclick=newData;
$('show-test').onchange=render;$('discretize').onchange=render;
for(const id of ['timeline','loss-range','rate-range','phase-range']) $(id).onchange=render;
thumbnail($('ellipse-thumb'),'ellipse');thumbnail($('spiral-thumb'),'spiral');newData();
