(() => {
  'use strict';

  const W = 960, H = 540, ground = 455;
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas'), ctx = canvas.getContext('2d');
  const home = $('home'), play = $('play'), result = $('result');
  const scoreLabel = $('scoreLabel'), scoreValue = $('scoreValue');
  const instruction = $('instruction'), palette = $('palette');
  const colors = ['#ff5f71', '#ffb02e', '#ffe04a', '#5bd477', '#47beea', '#756deb', '#e488df', '#9b633e'];
  const levelData = {
    bubble: [
      { name: 'สวนฟองใส', friends: [[665, 359, 'bunny']], crates: [[475, 414]], jellies: [[545, 418]] },
      { name: 'สะพานสายรุ้ง', friends: [[630, 310, 'chick'], [805, 367, 'bunny']], crates: [[460, 415], [735, 414]], jellies: [[575, 420]] },
      { name: 'งานเลี้ยงในสวน', friends: [[560, 343, 'cat'], [715, 280, 'bunny'], [845, 368, 'chick']], crates: [[475, 415], [765, 414]], jellies: [[610, 418], [790, 418]] }
    ],
    punch: [
      { name: 'ทางเดินเด้งดึ๋ง', friends: [[675, 355, 'chick']], crates: [[480, 415], [540, 415]], jellies: [[590, 417]] },
      { name: 'ป้อมกล่องจอมซน', friends: [[670, 330, 'bunny'], [815, 368, 'cat']], crates: [[480, 415], [545, 415], [545, 357], [735, 415]], jellies: [[610, 418]] },
      { name: 'ขบวนพาเพื่อนกลับ', friends: [[570, 360, 'chick'], [710, 305, 'cat'], [845, 365, 'bunny']], crates: [[460, 415], [520, 415], [635, 415], [775, 415]], jellies: [[600, 417], [795, 417]] }
    ],
    color: [{name:'ผีเสื้อแสนสวย'}, {name:'บ้านน้อยในสวน'}, {name:'จรวดท่องฟ้า'}]
  };
  let mode = null, level = 0, friends = [], crates = [], jellies = [], shots = [], particles = [];
  let saved = 0, zones = [], colored = 0, selectedColor = 0;
  let soundOn = true, audio = null, aim = null, lastShot = 0, lastTime = 0, scale = 1, ox = 0, oy = 0;

  function tone(freq, duration=.11, shape='sine', volume=.09, endFreq=freq) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = shape; o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq),t+duration);
      g.gain.setValueAtTime(volume,t); g.gain.exponentialRampToValueAtTime(.001,t+duration);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t+duration+.01);
    } catch (_) { /* The game remains playable without audio. */ }
  }
  function song() { [523,659,784,1046].forEach((n,i) => setTimeout(() => tone(n,.19,'triangle',.08),i*110)); }
  const rnd = (a,b) => a + Math.random()*(b-a);
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  function roundRect(x,y,w,h,r,fill,stroke,line=0) {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fillStyle=fill; ctx.fill();
    if (stroke) {ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
  }
  function ellipse(x,y,rx,ry,fill,stroke,line=0) {
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
  }
  function poly(points,fill,stroke,line=0) {
    ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
  }
  function cloud(x,y,s=1) {
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    ellipse(0,9,50,18,'#e9fbff');ellipse(-25,0,25,20,'#fff');ellipse(5,-13,35,30,'#fff');ellipse(37,2,28,21,'#fff');
    ctx.restore();
  }
  function landscape(time,variant='bubble') {
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,variant==='punch'?'#61b8f3':'#63c5f6');sky.addColorStop(.75,'#c4f5ee');sky.addColorStop(1,'#f8f4bb');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ellipse(785,100,55,55,'#ffe68d');ellipse(785,100,42,42,'#fff1ac');
    cloud(115+Math.sin(time*.00019)*12,123,1.2);cloud(440+Math.sin(time*.00014)*13,82,.75);cloud(845+Math.sin(time*.0002)*8,185,.7);
    ellipse(115,445,240,145,'#b4e682');ellipse(470,445,320,125,'#8cd763');ellipse(855,455,240,130,'#a4df73');
    ctx.fillStyle='#62ba4c';ctx.fillRect(0,ground,W,H-ground);ctx.fillStyle='#8bd967';ctx.fillRect(0,ground,W,10);
    for(let i=0;i<29;i++){const x=(i*97+17)%W,y=462+(i*47)%67;ellipse(x,y,9,4,i%2?'#8cdd60':'#56ab43');if(i%4===0){ellipse(x,y-9,3,3,'#ffd565');ellipse(x-4,y-7,3,3,'#fff');ellipse(x+4,y-7,3,3,'#fff');}}
    for(let i=0;i<9;i++){const x=(i*153+75)%W,y=245+(i*43)%180;ellipse(x,y+Math.sin(time*.002+i)*3,2.5,2.5,'#fff8c4');}
  }
  function animal(type,x,y,s=1) {
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    let body=type==='bunny'?'#fff4e5':type==='cat'?'#ffbf73':'#ffda57';
    if(type==='bunny') {ellipse(-12,-35,10,30,'#fff4e5','#bd835f',2);ellipse(13,-36,10,30,'#fff4e5','#bd835f',2);ellipse(-12,-35,4,19,'#f8b5b8');ellipse(13,-36,4,19,'#f8b5b8');}
    if(type==='cat') {poly([[-33,-9],[-31,-40],[-8,-24]],body,'#af6438',2);poly([[9,-24],[31,-40],[34,-8]],body,'#af6438',2);}
    ellipse(0,3,34,32,body,'#a76842',2.5);ellipse(-13,-2,5.3,6,'#173d53');ellipse(13,-2,5.3,6,'#173d53');ellipse(-15,-4,1.5,1.5,'#fff');ellipse(11,-4,1.5,1.5,'#fff');
    ellipse(-23,12,6,3,'#f89e9e');ellipse(23,12,6,3,'#f89e9e');
    if(type==='chick')poly([[-8,9],[8,9],[0,20]],'#ef8c35');else {ellipse(0,11,4,3,'#ad6770');ctx.strokeStyle='#8d6265';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,10,9,.23,Math.PI-.23);ctx.stroke();}
    ellipse(-22,31,11,6,body);ellipse(22,31,11,6,body);ctx.restore();
  }
  function cage(x,y,type,time) {
    ctx.save();ctx.translate(x,y+Math.sin(time*.003+x)*2);
    ellipse(0,45,51,10,'#315b5a3d');
    animal(type,0,0,.78);
    ctx.strokeStyle='#334d66';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,2,41,Math.PI,0);ctx.lineTo(41,42);ctx.lineTo(-41,42);ctx.closePath();ctx.stroke();
    ctx.lineWidth=4;ctx.strokeStyle='#91d8e2';for(const q of [-22,0,22]){ctx.beginPath();ctx.moveTo(q,-27);ctx.lineTo(q,42);ctx.stroke();}
    roundRect(-43,37,86,12,5,'#e3a64c','#8c5934',2);ellipse(0,-39,8,8,'#ffdf60','#a5722c',2);
    ctx.restore();
  }
  function crate(c) {
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.rot||0);
    roundRect(-27,-27,54,54,5,'#c98345','#764729',4);roundRect(-21,-21,42,42,2,'#e9ad60','#bc7540',2);
    ctx.strokeStyle='#b1743d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-18,-18);ctx.lineTo(18,18);ctx.moveTo(18,-18);ctx.lineTo(-18,18);ctx.stroke();
    for(const x of [-19,19])for(const y of [-19,19])ellipse(x,y,2.5,2.5,'#fff0b6');ctx.restore();
  }
  function jelly(j,time) {
    ctx.save();ctx.translate(j.x,j.y+Math.sin(time*.006+j.x)*3);ctx.rotate(j.rot||0);
    ellipse(0,28,30,5,'#2d765342');ellipse(0,0,29,31,'#ae81df','#6d50a7',3);ellipse(-8,-8,5,6,'#263b66');ellipse(9,-8,5,6,'#263b66');
    ctx.strokeStyle='#593d88';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,12,.3,Math.PI-.3);ctx.stroke();ellipse(-17,-15,4,3,'#d3b2f1');ctx.restore();
  }
  function launcher(time) {
    ctx.save();ctx.translate(120,385);
    ellipse(0,65,78,12,'#245d4766');
    if(mode==='bubble'){
      roundRect(-50,15,94,53,18,'#ffc847','#a65b28',5);ellipse(-30,65,17,17,'#3b708c','#153d5a',4);ellipse(28,65,17,17,'#3b708c','#153d5a',4);
      roundRect(4,-7,87,35,13,'#38aad6','#166087',5);ellipse(88,10,11,20,'#a5f1f8','#176a99',4);
      animal('chick',-20,-17,.67);
      for(let i=0;i<3;i++)ellipse(-66+i*15,-28+Math.sin(time*.004+i)*4,9,9,'#ffffff72','#fff',1);
    } else {
      roundRect(-53,14,104,54,20,'#f7aa3d','#9a5132',5);ellipse(-30,65,17,17,'#416a91','#1e3f5a',4);ellipse(33,65,17,17,'#416a91','#1e3f5a',4);
      roundRect(1,-4,77,34,16,'#ed6682','#9b3b5a',4);ellipse(78,13,17,20,'#fe879b','#a84c68',4);animal('cat',-23,-18,.66);
    }
    ctx.restore();
  }
  function spark(x,y,color,n=15) {for(let i=0;i<n;i++)particles.push({x,y,vx:rnd(-230,230),vy:rnd(-260,-30),r:rnd(3,7),life:rnd(.4,.95),color});}
  function updateScore() {scoreValue.textContent=mode==='color'?`${colored} / ${zones.length}`:`${saved} / ${friends.length}`;}
  function win() {
    if(!mode||play.hidden||!result.hidden)return;
    song();result.hidden=false;
    $('resultTitle').textContent=mode==='color'?'ภาพสวยแล้ว!':'ช่วยเพื่อนได้แล้ว!';
    $('resultText').textContent=mode==='color'?`ระบายสีภาพ ${levelData.color[level].name} สำเร็จ`:`ช่วยเพื่อนครบทุกตัวในด่าน ${level+1}`;
    $('nextLevel').textContent=level===2?'เลือกเกมอื่น →':'ด่านถัดไป →';
    try{localStorage.setItem(`playground-${mode}-level`,String(Math.max(level+1,Number(localStorage.getItem(`playground-${mode}-level`)||0))));}catch(_){}
  }
  function start(game,n=0) {
    mode=game;level=n;home.hidden=true;play.hidden=false;result.hidden=true;
    $('gameName').textContent={bubble:'ฟองสบู่กู้ภัย',punch:'นวมเด้งช่วยเพื่อน',color:'โลกสีรุ้ง'}[mode];
    $('levelName').textContent=`ด่าน ${level+1} จาก 3 · ${levelData[mode][level].name}`;
    friends=(levelData[mode][level].friends||[]).map(([x,y,type])=>({x,y,type,free:false}));
    crates=(levelData[mode][level].crates||[]).map(([x,y])=>({x,y,vx:0,vy:0,rot:0}));
    jellies=(levelData[mode][level].jellies||[]).map(([x,y])=>({x,y,vx:0,rot:0}));
    shots=[];particles=[];saved=0;aim=null;lastShot=0;colored=0;
    zones=mode==='color'?makePicture(level):[];
    palette.hidden=mode!=='color';instruction.hidden=mode==='color';
    scoreLabel.textContent=mode==='color'?'ระบายแล้ว':'ช่วยเพื่อน';updateScore();
    instruction.textContent=mode==='bubble'?'แตะตรงกรงเพื่อยิงฟองช่วยเพื่อน!':'แตะตรงกรงเพื่อปล่อยนวมเด้ง!';
    if(innerHeight>innerWidth && !sessionStorage.getItem('rotate-dismissed'))$('rotateTip').hidden=false;
    else $('rotateTip').hidden=true;
    resize();
  }
  function goHome(){mode=null;play.hidden=true;home.hidden=false;result.hidden=true;$('rotateTip').hidden=true;}
  function resize(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';scale=Math.min(innerWidth/W,innerHeight/H);ox=(innerWidth-W*scale)/2;oy=(innerHeight-H*scale)/2;}
  function pointer(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left-ox)/scale,y:(e.clientY-r.top-oy)/scale};}
  function fire(at){
    const now=performance.now();if(now-lastShot<400||!result.hidden)return;lastShot=now;
    const x=208,y=395,dx=at.x-x,dy=at.y-y,len=Math.hypot(dx,dy)||1,speed=mode==='bubble'?720:790;
    shots.push({x,y,px:x,py:y,vx:dx/len*speed,vy:dy/len*speed,r:mode==='bubble'?23:22,life:2.1,bounces:0,hits:new Set()});
    tone(mode==='bubble'?680:210,.18,mode==='bubble'?'sine':'triangle',.09,mode==='bubble'?980:90);
    spark(x,y,mode==='bubble'?'#b3f8ff':'#ffd36a',6);
  }
  function segmentDistance(ax,ay,bx,by,cx,cy){const dx=bx-ax,dy=by-ay,t=clamp(((cx-ax)*dx+(cy-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(cx-(ax+t*dx),cy-(ay+t*dy));}
  function physics(dt) {
    for(const c of crates){c.x+=c.vx*dt;c.vx*=Math.pow(.035,dt);c.x=clamp(c.x,330,930);c.rot+=c.vx*dt*.001;}
    for(const j of jellies){j.x+=j.vx*dt;j.vx*=Math.pow(.02,dt);j.x=clamp(j.x,330,925);j.rot=j.vx*.001;}
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);
    for(const s of shots){
      s.px=s.x;s.py=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;if(mode==='punch')s.vy+=160*dt;else s.vy-=18*dt;s.life-=dt;
      if(s.y>ground-s.r){s.y=ground-s.r;s.vy=-Math.abs(s.vy)*.72;s.vx*=.84;s.bounces++;tone(190,.07,'triangle',.03,110);}
      for(const c of crates){if(!s.hits.has(c)&&segmentDistance(s.px,s.py,s.x,s.y,c.x,c.y)<s.r+27){s.hits.add(c);c.vx+=mode==='punch'?300:180;s.vy-=mode==='punch'?28:8;spark(c.x,c.y,'#ffd475',7);tone(230,.12,'square',.035,120);}}
      for(const j of jellies){if(!s.hits.has(j)&&segmentDistance(s.px,s.py,s.x,s.y,j.x,j.y)<s.r+28){s.hits.add(j);j.vx+=mode==='punch'?350:270;s.vy-=mode==='punch'?35:10;spark(j.x,j.y,'#d6a8f9',12);tone(330,.15,'sine',.065,150);}}
      for(const f of friends){if(!f.free&&segmentDistance(s.px,s.py,s.x,s.y,f.x,f.y)<s.r+43){f.free=true;saved++;updateScore();s.life=0;spark(f.x,f.y,'#ffdd64',34);tone(760,.2,'sine',.11,1150);setTimeout(()=>{if(mode!=='color'&&saved===friends.length)win();},420);break;}}
    }
    shots=shots.filter(s=>s.life>0&&s.x<W+100&&s.x>-50&&s.y>-100&&s.bounces<5);
  }
  function drawShots(time){for(const s of shots){ctx.save();ctx.translate(s.x,s.y);if(mode==='bubble'){ellipse(0,0,s.r,s.r,'#a8eeff81','#fff',4);ellipse(-8,-9,7,4,'#ffffffa8');ellipse(7,6,4,3,'#e2ffff');}else{ctx.rotate(Math.atan2(s.vy,s.vx));ellipse(0,0,25,20,'#f0708c','#9b3858',4);roundRect(-12,-12,17,23,6,'#ffaabb');ellipse(14,-3,5,3,'#ffd1d9');}ctx.restore();}}
  function drawRescue(time){landscape(time,mode);for(const c of crates)crate(c);for(const j of jellies)jelly(j,time);for(const f of friends)if(!f.free)cage(f.x,f.y,f.type,time);launcher(time);drawShots(time);if(aim){ctx.save();ctx.setLineDash([9,13]);ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(205,395);ctx.lineTo(aim.x,aim.y);ctx.stroke();ctx.setLineDash([]);ellipse(aim.x,aim.y,13,13,'#ffffff4d','#fff',3);ctx.restore();}}
  function drawParticles(){for(const p of particles){ctx.globalAlpha=clamp(p.life*1.5,0,1);ellipse(p.x,p.y,p.r,p.r,p.color);}ctx.globalAlpha=1;}
  function pathEllipse(x,y,rx,ry){const p=new Path2D();p.ellipse(x,y,rx,ry,0,0,Math.PI*2);return p;}
  function pathPoly(points){const p=new Path2D();p.moveTo(...points[0]);for(const point of points.slice(1))p.lineTo(...point);p.closePath();return p;}
  function pathRound(x,y,w,h,r){const p=new Path2D();p.roundRect(x,y,w,h,r);return p;}
  function add(z,name,path){z.push({name,path,color:null});}
  function makePicture(n){const z=[];
    if(n===0){
      add(z,'ปีกซ้ายบน',pathEllipse(348,245,112,88));add(z,'ปีกขวาบน',pathEllipse(612,245,112,88));
      add(z,'ปีกซ้ายล่าง',pathEllipse(371,357,83,75));add(z,'ปีกขวาล่าง',pathEllipse(589,357,83,75));
      add(z,'ตัวผีเสื้อ',pathEllipse(480,299,38,125));add(z,'หัวผีเสื้อ',pathEllipse(480,164,38,37));
      add(z,'จุดปีกซ้าย',pathEllipse(344,243,32,29));add(z,'จุดปีกขวา',pathEllipse(616,243,32,29));
    }else if(n===1){
      add(z,'ตัวบ้าน',pathRound(319,239,322,195,13));add(z,'หลังคา',pathPoly([[287,245],[480,110],[673,245]]));
      add(z,'ประตู',pathRound(455,334,58,100,8));add(z,'หน้าต่างซ้าย',pathRound(350,290,64,59,5));add(z,'หน้าต่างขวา',pathRound(550,290,64,59,5));
      add(z,'ดวงอาทิตย์',pathEllipse(766,172,51,51));add(z,'พุ่มไม้ซ้าย',pathEllipse(270,411,56,33));add(z,'พุ่มไม้ขวา',pathEllipse(690,411,56,33));
    }else{
      add(z,'เปลวไฟ',pathPoly([[438,377],[480,465],[522,377]]));
      add(z,'ปีกซ้าย',pathPoly([[440,319],[340,408],[449,393]]));add(z,'ปีกขวา',pathPoly([[520,319],[620,408],[511,393]]));
      add(z,'ลำจรวด',pathRound(423,177,114,229,53));add(z,'หัวจรวด',pathPoly([[424,235],[480,90],[536,235]]));
      add(z,'หน้าต่าง',pathEllipse(480,268,39,39));add(z,'ดาวซ้าย',pathEllipse(285,202,36,36));add(z,'ดาวขวา',pathEllipse(689,287,40,40));
    }return z;
  }
  function drawColor(time){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#b9e9ff');sky.addColorStop(1,'#fff8dd');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    for(let i=0;i<12;i++){const x=(i*103+15)%W;ellipse(x,90+(i*47)%330,3,3,'#ffffffbd');}
    roundRect(158,82,644,382,32,'#fffdf3','#fff',10);
    ctx.save();ctx.shadowColor='#879cac4d';ctx.shadowBlur=16;ctx.shadowOffsetY=12;roundRect(175,91,610,355,22,'#fffefa');ctx.restore();
    for(const z of zones){ctx.fillStyle=z.color||'#fffdf5';ctx.strokeStyle='#285477';ctx.lineWidth=7;ctx.lineJoin='round';ctx.fill(z.path);ctx.stroke(z.path);}
    if(level===0){ctx.strokeStyle='#285477';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(462,138);ctx.quadraticCurveTo(445,112,426,122);ctx.moveTo(498,138);ctx.quadraticCurveTo(515,112,534,122);ctx.stroke();ellipse(467,156,3,3,'#254c6c');ellipse(493,156,3,3,'#254c6c');}
    if(level===1){ctx.strokeStyle='#366c71';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(381,290);ctx.lineTo(381,349);ctx.moveTo(350,319);ctx.lineTo(414,319);ctx.moveTo(581,290);ctx.lineTo(581,349);ctx.moveTo(550,319);ctx.lineTo(614,319);ctx.stroke();}
    if(level===2){ellipse(466,258,6,6,'#fff');ellipse(489,283,4,4,'#fff');}
  }
  function drawPreview(id,kind){const c=$(id),g=c.getContext('2d');
    // Render to a temporary canvas so preview art shares the same illustrated world as the game.
    const tmp=document.createElement('canvas');tmp.width=W;tmp.height=H;const t=tmp.getContext('2d');
    // Canvas methods below use the main context; swap via drawing a self-contained vignette here.
    const grad=t.createLinearGradient(0,0,0,H);grad.addColorStop(0,kind==='slingshot'?'#45adca':kind==='color'?'#a7d8fb':'#66c7ee');grad.addColorStop(1,kind==='punch'?'#ffc779':'#c8edaa');t.fillStyle=grad;t.fillRect(0,0,W,H);
    t.fillStyle='#fff9bc';t.beginPath();t.arc(774,115,72,0,7);t.fill();
    for(const [x,y,s] of [[135,125,1.1],[545,90,.7]]){t.fillStyle='#ffffffc4';t.beginPath();t.ellipse(x,y,100*s,32*s,0,0,7);t.fill();t.beginPath();t.ellipse(x+18*s,y-25*s,62*s,50*s,0,0,7);t.fill();}
    t.fillStyle=kind==='color'?'#fffdf2':'#77ca55';t.beginPath();t.ellipse(480,565,600,164,0,0,7);t.fill();
    if(kind==='color'){
      t.fillStyle='#fff';t.strokeStyle='#315c7d';t.lineWidth=12;t.beginPath();t.ellipse(480,310,270,145,0,0,7);t.fill();t.stroke();
      for(const [x,y,rx,ry,col] of [[365,265,85,65,'#fb76a2'],[595,265,85,65,'#ffca49'],[385,370,75,55,'#a186ed'],[575,370,75,55,'#59daba']]){t.fillStyle=col;t.strokeStyle='#365a78';t.lineWidth=10;t.beginPath();t.ellipse(x,y,rx,ry,0,0,7);t.fill();t.stroke();}
      t.fillStyle='#353f75';t.beginPath();t.ellipse(480,320,29,106,0,0,7);t.fill();
    }else{
      const ball=kind==='bubble'?'#c9f7ff':kind==='punch'?'#ff83a1':'#ffce37';
      t.fillStyle=ball;t.strokeStyle='#fff';t.lineWidth=14;t.beginPath();t.arc(300,300,kind==='bubble'?71:61,0,7);t.fill();t.stroke();
      t.fillStyle='#fff';t.beginPath();t.ellipse(280,278,18,11,-.4,0,7);t.fill();
      t.fillStyle=kind==='slingshot'?'#77be52':'#d9aa5e';t.fillRect(625,328,130,93);t.strokeStyle='#775238';t.lineWidth=10;t.strokeRect(625,328,130,93);
      t.fillStyle=kind==='slingshot'?'#87c557':'#ffd661';t.beginPath();t.arc(775,322,55,0,7);t.fill();t.stroke();t.fillStyle='#254257';for(const x of [754,793]){t.beginPath();t.arc(x,309,7,0,7);t.fill();}t.lineWidth=5;t.beginPath();t.arc(775,320,20,.3,Math.PI-.3);t.stroke();
      if(kind==='bubble')for(const [x,y,r] of [[145,200,23],[196,143,15],[413,195,13]]){t.fillStyle='#e8ffff80';t.strokeStyle='#fff';t.lineWidth=5;t.beginPath();t.arc(x,y,r,0,7);t.fill();t.stroke();}
    }
    g.drawImage(tmp,0,0,c.width,c.height);
  }
  function render(time){
    const dt=clamp((time-lastTime)/1000,0,.04);lastTime=time;
    if(mode){
      const dpr=canvas.width/innerWidth;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
      ctx.fillStyle=mode==='color'?'#b9e9ff':'#6bc5ef';ctx.fillRect(0,0,innerWidth,innerHeight);
      ctx.translate(ox,oy);ctx.scale(scale,scale);
      if(mode==='color')drawColor(time);else{physics(dt);drawRescue(time);}drawParticles();
    }
    requestAnimationFrame(render);
  }
  document.querySelectorAll('[data-game]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.game)));
  $('backToHome').addEventListener('click',goHome);$('restartLevel').addEventListener('click',()=>start(mode,level));
  $('replay').addEventListener('click',()=>start(mode,level));$('nextLevel').addEventListener('click',()=>level<2?start(mode,level+1):goHome());
  $('dismissRotate').addEventListener('click',()=>{$('rotateTip').hidden=true;sessionStorage.setItem('rotate-dismissed','1');});
  function fullscreen(){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();}
  $('homeFullscreen').addEventListener('click',fullscreen);$('gameFullscreen').addEventListener('click',fullscreen);
  $('soundToggle').addEventListener('click',()=>{soundOn=!soundOn;$('soundToggle').innerHTML=soundOn?'🔊 <span>เสียง</span>':'🔇 <span>ปิดเสียง</span>';$('soundToggle').setAttribute('aria-label',soundOn?'ปิดเสียง':'เปิดเสียง');if(soundOn)tone(660);});
  colors.forEach((color,i)=>{const b=document.createElement('button');b.type='button';b.style.background=color;b.setAttribute('aria-label',`สีที่ ${i+1}`);b.setAttribute('aria-pressed',String(i===selectedColor));b.addEventListener('click',()=>{selectedColor=i;palette.querySelectorAll('button').forEach((p,j)=>p.setAttribute('aria-pressed',String(i===j)));tone(500+i*45,.08);});palette.appendChild(b);});
  canvas.addEventListener('pointerdown',e=>{if(!mode||!result.hidden)return;canvas.setPointerCapture(e.pointerId);const p=pointer(e);
    if(mode==='color'){
      const hit=document.createElement('canvas').getContext('2d');
      for(const z of [...zones].reverse())if(hit.isPointInPath(z.path,p.x,p.y)){if(!z.color)colored++;z.color=colors[selectedColor];updateScore();spark(p.x,p.y,colors[selectedColor],10);tone(560+selectedColor*35,.1,'sine',.07,720);if(colored===zones.length)setTimeout(win,350);break;}
    }else aim=p;
  });
  canvas.addEventListener('pointermove',e=>{if(aim)aim=pointer(e);});
  canvas.addEventListener('pointerup',e=>{if(aim){fire(pointer(e));aim=null;}});
  canvas.addEventListener('pointercancel',()=>aim=null);
  window.addEventListener('resize',()=>{resize();if(innerHeight<=innerWidth)$('rotateTip').hidden=true;});
  for(const kind of ['bubble','punch','color','slingshot'])drawPreview(`art-${kind}`,kind);
  resize();requestAnimationFrame(render);
})();
