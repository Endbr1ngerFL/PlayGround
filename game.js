import * as THREE from 'three';

// ============ Helpers ============
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const randi = (a,b)=>Math.floor(rand(a,b+1));
const dist2 = (ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
function mulberry(seed){let t=seed;return function(){t|=0;t=t+0x6D2B79F5|0;let r=Math.imul(t^t>>>15,1|t);r=r+Math.imul(r^r>>>7,61|r)^r;return((r^r>>>14)>>>0)/4294967296}}
const rng = mulberry(1337);

// RuneScape XP table
const XP_TABLE=[0];{let s=0;for(let l=1;l<99;l++){s+=Math.floor(l+300*Math.pow(2,l/7));XP_TABLE[l]=Math.floor(s/4);}XP_TABLE[99]=13034431;}
function levelFromXP(xp){for(let l=99;l>=1;l--){if(xp>=(XP_TABLE[l-1]||0))return l;}return 1;}
function xpForLevel(l){if(l<=1)return 0;return XP_TABLE[l-2+1]||0;}
function xpNeed(l){if(l<=1) return 0;return XP_TABLE[l-1];}

// ============ Cel-shaded Material System ============
// MeshToonMaterial keeps the engine's real lights/shadows/fog (so the day-night
// cycle and cast shadows still work) while banding the lighting into flat steps.
const toonGradient=(()=>{
 const steps=new Uint8Array([70,145,215,255]);
 const t=new THREE.DataTexture(steps,4,1,THREE.RedFormat);
 t.minFilter=THREE.NearestFilter;t.magFilter=THREE.NearestFilter;t.needsUpdate=true;
 return t;
})();
const MAT=(c,opt={})=>{const m=new THREE.MeshToonMaterial(Object.assign({color:c,gradientMap:toonGradient},opt));m.flatShading=true;return m;};
function shadowify(o){o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});return o;}
// inverted-hull outline for hero-sized characters
const OUTLINE_MAT=new THREE.MeshBasicMaterial({color:0x0d0a18,side:THREE.BackSide,depthWrite:false});
function makeOutlined(mesh,scale=1.05){
 const o=new THREE.Mesh(mesh.geometry,OUTLINE_MAT);
 o.scale.setScalar(scale);o.position.copy(mesh.position);o.rotation.copy(mesh.rotation);
 mesh.add(o);return mesh;
}
const SKILLS=[
 {id:'attack',name:'Attack',icon:'⚔️'},
 {id:'strength',name:'Strength',icon:'💪'},
 {id:'defence',name:'Defence',icon:'🛡️'},
 {id:'hitpoints',name:'Hitpoints',icon:'❤️'},
 {id:'ranged',name:'Ranged',icon:'🏹'},
 {id:'magic',name:'Magic',icon:'🔮'},
 {id:'woodcutting',name:'Woodcutting',icon:'🪓'},
 {id:'mining',name:'Mining',icon:'⛏️'},
 {id:'fishing',name:'Fishing',icon:'🎣'},
 {id:'cooking',name:'Cooking',icon:'🍳'},
 {id:'smithing',name:'Smithing',icon:'⚒️'},
 {id:'construction',name:'Construction',icon:'🏠'},
];
const ITEMS={
 logs:{name:'Logs',icon:'🪵'}, oak_logs:{name:'Oak Logs',icon:'🪵'},
 copper_ore:{name:'Copper Ore',icon:'🟤'}, tin_ore:{name:'Tin Ore',icon:'⚪'}, iron_ore:{name:'Iron Ore',icon:'⬛'},
 copper_bar:{name:'Copper Bar',icon:'🟧'}, bronze_bar:{name:'Bronze Bar',icon:'🟨'}, iron_bar:{name:'Iron Bar',icon:'⬜'},
 raw_shrimp:{name:'Raw Shrimp',icon:'🦐'}, raw_trout:{name:'Raw Trout',icon:'🐟'}, raw_salmon:{name:'Raw Salmon',icon:'🐠'},
 cooked_shrimp:{name:'Cooked Shrimp',icon:'🍤',heal:8}, cooked_trout:{name:'Cooked Trout',icon:'🍱',heal:15}, cooked_salmon:{name:'Cooked Salmon',icon:'🍣',heal:25},
 bones:{name:'Bones',icon:'🦴'}, wolf_meat:{name:'Wolf Meat',icon:'🍖',heal:10}, goblin_ear:{name:'Goblin Ear',icon:'👂'},
 bronze_sword:{name:'Bronze Sword',icon:'🗡️',dmg:4}, iron_sword:{name:'Iron Sword',icon:'⚔️',dmg:8}, steel_sword:{name:'Steel Sword',icon:'🏅',dmg:13},
 oak_bow:{name:'Oak Bow',icon:'🏹',dmg:5}, magic_staff:{name:'Apprentice Staff',icon:'🪄',dmg:6},
 plank:{name:'Plank',icon:'🪟'}, torch_item:{name:'Torch',icon:'🕯️'},
};
const CLASSES={
 warrior:{name:'Warrior',hp:120,mana:60,melee:9,spell1:{name:'Heroic Strike',icon:'🗡️',cd:5,mana:10},spell2:{name:'Whirlwind',icon:'🌀',cd:12,mana:20}},
 ranger:{name:'Ranger',hp:90,mana:80,melee:5,spell1:{name:'Multi-Shot',icon:'🏹',cd:5,mana:10},spell2:{name:'Volley',icon:'🌧️',cd:12,mana:20}},
 mage:{name:'Mage',hp:75,mana:130,melee:3,spell1:{name:'Fireball',icon:'🔥',cd:4,mana:12},spell2:{name:'Frost Nova',icon:'❄️',cd:13,mana:25}},
};
const BUILD_DEFS={
 foundation:{name:'Foundation',cost:{logs:4},xp:20,size:[3,0.3,3]},
 wall:{name:'Wall',cost:{logs:2},xp:12,size:[3,2.4,0.3]},
 campfire:{name:'Campfire',cost:{logs:3},xp:25,use:'cook'},
 workbench:{name:'Workbench',cost:{logs:5},xp:30,use:'craft'},
 furnace:{name:'Furnace',cost:{logs:2,iron_ore:0,copper_ore:0},xp:30,use:'smelt',altCost:'10 logs? no'},
 anvil:{name:'Anvil',cost:{bronze_bar:2},xp:40,use:'smith'},
 torch:{name:'Torch',cost:{logs:1},xp:8,use:'light'},
};
// fix furnace cost (needs stone-ish): use logs + copper ore? keep simple
BUILD_DEFS.furnace.cost={logs:4};

const QUESTS=[
 {id:'wolves',giver:'Captain Maro',icon:'❗',name:'Wolf Menace',desc:'Wolves stalk the village. Slay 5 Wolves.',need:{kill_wolf:5},reward:{gold:80,xp:{attack:120,strength:80,hitpoints:60}},dialog:'The packs grow bold, hero. Thin them out!'},
 {id:'timber',giver:'Lumberjack Bim',icon:'🪓',name:'Timber!',desc:'Chop 8 Logs for the palisade.',need:{item_logs:8},keepItems:false,reward:{gold:40,xp:{woodcutting:150}},dialog:'We need timber! The saw sings for logs.'},
 {id:'ore',giver:'Smith Guerra',icon:'⛏️',name:'Ore Deal',desc:'Mine 4 Copper Ore and smelt 2 Bronze Bars.',need:{mine_copper:4,smelt_bronze:2},reward:{gold:60,xp:{mining:120,smithing:150},items:{iron_sword:1}},dialog:'Bring me copper and bronze. I will make you a real blade.'},
 {id:'supper',giver:'Cook Nella',icon:'🍳',name:'Fish Supper',desc:'Catch 3 fish and cook 2 meals.',need:{catch_fish:3,cook_food:2},reward:{gold:50,xp:{fishing:120,cooking:150},items:{cooked_trout:2}},dialog:'Hungry heroes fight best. Fish and cook for us!'},
 {id:'dragon',giver:'Elder Myra',icon:'🐉',name:'Dragon of Dragonfall',desc:'Slay Malachar the Young Dragon in the scorched crater (NE).',need:{kill_dragon:1},reward:{gold:500,xp:{attack:500,magic:500,hitpoints:400}},dialog:'Only you can face Malachar. End the fire, save the isle!'},
];

// ============ State ============
const S={
 started:false, cls:'warrior',
 hp:100,maxHp:100,mana:100,maxMana:100,stam:100,
 gold:20, pos:{x:0,z:13}, yaw:0,
 inv:{logs:3,cooked_shrimp:2}, equip:{weapon:null},
 skills:{}, // id -> {xp}
 quests:{}, // id -> {stage:'avail'|'active'|'done', progress:{}}
 stats:{kill_wolf:0,kill_goblin:0,kill_cultist:0,kill_dragon:0,item_logs:0,mine_copper:0,smelt_bronze:0,catch_fish:0,cook_food:0},
 buildings:[], time:8, dead:false, won:false,
 cd1:0, cd2:0, weaponDmg:0,
};
for(const sk of SKILLS) S.skills[sk.id]={xp:0};
function skillLevel(id){return levelFromXP(S.skills[id].xp);}
function combatLevel(){const a=skillLevel('attack'),s=skillLevel('strength'),d=skillLevel('defence'),h=skillLevel('hitpoints'),r=skillLevel('ranged'),m=skillLevel('magic');return Math.floor((a+s+d+h+r+m)/6)+1;}
function addXP(id,amt,quiet){
 const o=S.skills[id];const before=levelFromXP(o.xp);o.xp=Math.min(13034431,o.xp+amt);
 const after=levelFromXP(o.xp);
 if(after>before){onLevelUp(id,after);recalcVitals();}
 if(!quiet) spawnXPText(id,amt);
 updateHUD(); if(panelTab==='skills') renderPanel(); save();
 return after>before;
}
function recalcVitals(){
 const c=CLASSES[S.cls];
 S.maxHp=c.hp+(skillLevel('hitpoints')-1)*8;
 S.maxMana=c.mana+(skillLevel('magic')-1)*6;
 S.weaponDmg=c.melee+(S.equip.weapon&&ITEMS[S.equip.weapon].dmg?ITEMS[S.equip.weapon].dmg:0)+Math.floor(skillLevel('attack')/3);
}
function addItem(id,n=1){S.inv[id]=(S.inv[id]||0)+n;if(id==='logs')S.stats.item_logs+=n;updateHUD();save();}
function removeItem(id,n=1){if((S.inv[id]||0)<n)return false;S.inv[id]-=n;if(S.inv[id]<=0)delete S.inv[id];updateHUD();save();return true;}
function addGold(n){S.gold+=n;$('gold-val').textContent=S.gold;save();}

// ============ Audio (procedural) ============
let AC=null;
function sfx(kind){
 try{
  AC=AC||new (window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended')AC.resume();
  const t=AC.currentTime;
  const play=(f0,f1,dur,type='square',vol=0.12)=>{
   const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
   g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+dur+0.02);};
  if(kind==='hit')play(220,80,0.12,'square',0.15);
  else if(kind==='swing')play(600,200,0.08,'sawtooth',0.06);
  else if(kind==='shoot')play(900,300,0.15,'sawtooth',0.1);
  else if(kind==='chop')play(180,90,0.1,'square',0.15);
  else if(kind==='mine')play(1200,900,0.07,'square',0.08);
  else if(kind==='splash')play(400,800,0.2,'sine',0.1);
  else if(kind==='eat')play(300,500,0.15,'sine',0.12);
  else if(kind==='coin')play(900,1400,0.12,'square',0.1);
  else if(kind==='level'){play(440,880,0.3,'square',0.12);setTimeout(()=>sfx('coin'),180);}
  else if(kind==='hurt')play(300,100,0.2,'sawtooth',0.15);
  else if(kind==='place')play(150,300,0.15,'square',0.12);
  else if(kind==='fire')play(200,600,0.3,'sawtooth',0.12);
  else if(kind==='quest'){play(523,523,0.15,'square',0.1);setTimeout(()=>play(659,659,0.15,'square',0.1),150);setTimeout(()=>play(784,784,0.3,'square',0.1),300);}
 }catch(e){}
}

// ============ Three setup ============
const canvas=$('game-canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87b5e5);
scene.fog=new THREE.Fog(0x9fc3e8,40,140);
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,0.1,400);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

const hemi=new THREE.HemisphereLight(0xbfd9ff,0x3d5a3a,0.9);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2d0,1.6);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-40;sun.shadow.camera.right=40;sun.shadow.camera.top=40;sun.shadow.camera.bottom=-40;sun.shadow.camera.far=160;
scene.add(sun);scene.add(sun.target);

// Terrain height function (must be analytic)
function terrainH(x,z){
 const d=Math.hypot(x,z);
 const island=Math.max(0,1-Math.pow(d/72,2.2));
 let h=island*7-1.6;
 h+=Math.sin(x*0.15)*Math.cos(z*0.13)*0.7*island;
 h+=Math.sin(x*0.5+z*0.3)*0.18*island;
 // crater NE for dragon
 const cd=Math.hypot(x-46,z-46);
 if(cd<16) h+= (1-cd/16)*4 - 1.2;
 // flatten village
 const vd=Math.hypot(x,z);
 if(vd<12) h*= (vd/12)*0.7+0.3, h=Math.max(h,0.4);
 return h;
}
function groundColor(x,z,h){
 if(h<0.15) return [0.76,0.72,0.5]; // sand
 if(h>6.5) return [0.5,0.5,0.55];
 const n=Math.sin(x*0.8)*Math.cos(z*0.7);
 if(n>0.55) return [0.25,0.45,0.25];
 return [0.3,0.55,0.3];
}

// Build terrain mesh
let terrainMesh;
{
 const SIZE=150,SEG=90;
 const g=new THREE.PlaneGeometry(SIZE,SIZE,SEG,SEG);
 g.rotateX(-Math.PI/2);
 const pos=g.attributes.position;
 const colors=new Float32Array(pos.count*3);
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i);
  const h=terrainH(x,z);
  pos.setY(i,h);
  const c=groundColor(x,z,h);
  colors[i*3]=c[0];colors[i*3+1]=c[1];colors[i*3+2]=c[2];
 }
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));
 g.computeVertexNormals();
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,flatShading:true});
 terrainMesh=new THREE.Mesh(g,m);
 terrainMesh.receiveShadow=true;
 scene.add(terrainMesh);
 // water - stylized cel bands
 const wg=new THREE.PlaneGeometry(400,400);
 wg.rotateX(-Math.PI/2);
 const wm=MAT(0x3a8fd6,{transparent:true,opacity:0.82});
 const water=new THREE.Mesh(wg,wm);
 water.position.y=-0.35;scene.add(water);
}

// ============ World props ============
const trees=[],rocks=[],fishSpots=[],enemies=[],npcs=[],buildings3d=[],projectiles=[],pickups=[],torches=[];
const colliders=[]; // {x,z,r}

function makeTree(x,z,kind){
 const h=terrainH(x,z);if(h<0.3)return null;
 const g=new THREE.Group();
 const trunkH=kind==='oak'?2.2:1.8;
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.32,trunkH,7),MAT(kind==='oak'?0x6d4c2f:0x5d4028));
 trunk.position.y=trunkH/2;g.add(trunk);
 const leafC=kind==='oak'?0x2e7d32:0x1b5e20;
 for(let i=0;i<3;i++){
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.5-i*0.35,1.4,8),MAT(leafC));
  cone.position.y=trunkH+0.5+i*0.8;g.add(cone);
 }
 g.position.set(x,h,z);
 const s=rand(0.85,1.35);g.scale.setScalar(s);
 shadowify(g);scene.add(g);
 const t={kind,x,z,mesh:g,hp:3,respawn:0,alive:true,baseScale:s};
 trees.push(t);colliders.push({x,z,r:0.5});
 return t;
}
function makeRock(x,z,ore){
 const h=terrainH(x,z);if(h<0.25)return null;
 const g=new THREE.Group();
 const col=ore==='copper'?0x8d6e63:ore==='tin'?0x9e9e9e:ore==='iron'?0x616161:0x757575;
 const m=new THREE.Mesh(new THREE.DodecahedronGeometry(ore?1.0:rand(0.6,1.1),0),MAT(col));
 m.position.y=0.5;g.add(m);
 if(ore){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(0.25),MAT(ore==='copper'?0xff7043:ore==='tin'?0xeceff1:0x37474f,{emissive:ore==='copper'?0x662200:0x1a1a1a}));gem.position.y=1.0;g.add(gem);}
 g.position.set(x,h,z);
 g.rotation.y=rand(0,6);
 shadowify(g);scene.add(g);
 const r={ore:ore||null,x,z,mesh:g,hp:ore?4:2,respawn:0,alive:true};
 rocks.push(r);colliders.push({x,z,r:0.9});
 return r;
}
function makeFishSpot(x,z){
 const g=new THREE.Group();
 const ring=new THREE.Mesh(new THREE.RingGeometry(0.9,1.3,16),new THREE.MeshBasicMaterial({color:0x80deea,transparent:true,opacity:0.8,side:THREE.DoubleSide}));
 ring.rotation.x=-Math.PI/2;ring.position.y=0.15;g.add(ring);
 const bob=new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8),MAT(0xff5252));
 bob.position.y=0.4;g.add(bob);g.userData.bob=bob;
 g.position.set(x,0.0,z);scene.add(g);
 fishSpots.push({x,z,mesh:g,stock:5,respawn:0});
}
function makeHut(x,z,ry){
 const h=terrainH(x,z);
 const g=new THREE.Group();
 const base=new THREE.Mesh(new THREE.BoxGeometry(4,2.4,3.4),MAT(0xa1887f));base.position.y=1.2;g.add(base);
 const roof=new THREE.Mesh(new THREE.ConeGeometry(3.2,1.8,4),MAT(0x6d4c41));roof.position.y=3.2;roof.rotation.y=Math.PI/4;g.add(roof);
 const door=new THREE.Mesh(new THREE.BoxGeometry(0.9,1.6,0.1),MAT(0x3e2723));door.position.set(0,0.8,1.75);g.add(door);
 g.position.set(x,h,z);g.rotation.y=ry;shadowify(g);scene.add(g);
 colliders.push({x,z,r:2.6});
 return g;
}
function makeCampfireProp(x,z){
 const h=terrainH(x,z);const g=new THREE.Group();
 for(let i=0;i<5;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,1.1,6),MAT(0x5d4037));log.rotation.z=Math.PI/2;log.rotation.y=i/5*Math.PI;log.position.y=0.15;g.add(log);}
 const flame=new THREE.Mesh(new THREE.ConeGeometry(0.35,0.9,8),new THREE.MeshBasicMaterial({color:0xff9100}));flame.position.y=0.7;g.add(flame);
 const light=new THREE.PointLight(0xff8f00,8,10);light.position.y=1.2;g.add(light);
 g.position.set(x,h,z);scene.add(g);
 g.userData.flame=flame;
 torches.push({mesh:g,flame,light,phase:rand(0,6)});
 return g;
}
function makeStationProp(kind,x,z){
 const h=terrainH(x,z);const g=new THREE.Group();
 if(kind==='anvil'){const b=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.4,0.5),MAT(0x455a64));b.position.y=0.8;g.add(b);const legs=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.7,0.4),MAT(0x37474f));legs.position.y=0.35;g.add(legs);}
 else if(kind==='furnace'){const f=new THREE.Mesh(new THREE.BoxGeometry(1.6,2,1.4),MAT(0x616161));f.position.y=1;g.add(f);const mouth=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.6,0.1),new THREE.MeshBasicMaterial({color:0xff6d00}));mouth.position.set(0,0.5,0.72);g.add(mouth);}
 else if(kind==='workbench'){const t=new THREE.Mesh(new THREE.BoxGeometry(2,0.25,1),MAT(0x8d6e63));t.position.y=0.9;g.add(t);for(const sx of[-0.8,0.8])for(const sz of[-0.35,0.35]){const l=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.9,0.18),MAT(0x5d4037));l.position.set(sx,0.45,sz);g.add(l);}}
 g.position.set(x,h,z);shadowify(g);scene.add(g);colliders.push({x,z,r:1.2});return g;
}
function textSprite(text,scale=1){
 const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');
 ctx.font='bold 30px system-ui';ctx.textAlign='center';ctx.fillStyle='#000';ctx.fillRect(0,0,256,64);
 // bg
 ctx.fillStyle='rgba(0,0,0,0.0)';ctx.clearRect(0,0,256,64);
 ctx.lineWidth=6;ctx.strokeStyle='#000';ctx.strokeText(text,128,42);ctx.fillStyle='#ffe082';ctx.fillText(text,128,42);
 const t=new THREE.CanvasTexture(c);const m=new THREE.SpriteMaterial({map:t,depthTest:false});const s=new THREE.Sprite(m);s.scale.set(3*scale,0.75*scale,1);return s;
}
function makeNPC(name,x,z,color){
 const h=terrainH(x,z);
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.35,0.8,4,8),MAT(color));body.position.y=1.0;g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(0.28,12,12),MAT(0xffcc9e));head.position.y=1.95;g.add(head);
 const neM=new THREE.MeshBasicMaterial({color:0x1a1a1a});
 for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6),neM);e.position.set(s*0.1,1.98,0.25);g.add(e);}
 const q=new THREE.Mesh(new THREE.SphereGeometry(0.18,8,8),new THREE.MeshBasicMaterial({color:0xffd54a}));q.position.y=2.6;g.add(q);g.userData.q=q;
 const label=textSprite(name,0.65);label.position.y=2.9;g.add(label);
 g.position.set(x,h,z);shadowify(g);scene.add(g);
 const n={name,x,z,mesh:g,ry0:Math.atan2(-x,-z)};npcs.push(n);colliders.push({x,z,r:0.6});return n;
}

// Populate world
for(let i=0;i<70;i++){const a=rng()*Math.PI*2,d=14+rng()*50;const x=Math.cos(a)*d,z=Math.sin(a)*d;if(Math.hypot(x-46,z-46)<20)continue;makeTree(x,z,rng()>0.6?'oak':'pine');}
for(let i=0;i<34;i++){const a=rng()*Math.PI*2,d=12+rng()*52;const x=Math.cos(a)*d,z=Math.sin(a)*d;if(Math.hypot(x-46,z-46)<20)continue;const r=rng();makeRock(x,z,r<0.3?'copper':r<0.5?'tin':r<0.62?'iron':null);}
makeFishSpot(10,-2);makeFishSpot(-12,6);makeFishSpot(6,18);makeFishSpot(-8,-16);makeFishSpot(24,10);
// extra trees near spawn for tutorial
makeTree(8,6,'pine');makeTree(-6,10,'oak');makeRock(6,-8,'copper');makeRock(-9,-4,'tin');
// village — spread out so labels don't overlap
makeHut(-8,-2,0.4);makeHut(8,-5,-0.5);makeHut(-7,8,Math.PI);
makeCampfireProp(0,0);
makeStationProp('anvil',-4,1);makeStationProp('furnace',4,0);makeStationProp('workbench',0,-7);
makeNPC('Captain Maro',5,0.8,0x1565c0);
makeNPC('Lumberjack Bim',1.8,4.8,0x2e7d32);
makeNPC('Smith Guerra',-4.2,3.0,0x4e342e);
makeNPC('Cook Nella',-4.2,-3.2,0xef6c00);
makeNPC('Elder Myra',1.8,-4.8,0x6a1b9a);
// dragon crater decor: scorched rocks
for(let i=0;i<10;i++){const x=46+rand(-14,14),z=46+rand(-14,14);makeRock(x,z,null);}
// grass tufts (instanced-ish simple)
{
 const gg=new THREE.ConeGeometry(0.12,0.6,4);
 const gm=MAT(0x43a047);
 for(let i=0;i<250;i++){const a=rng()*Math.PI*2,d=4+rng()*60;const x=Math.cos(a)*d,z=Math.sin(a)*d;const h=terrainH(x,z);if(h<0.3||h>6)continue;const m=new THREE.Mesh(gg,gm);m.position.set(x,h+0.25,z);scene.add(m);}
}

// ============ Player (pivot rig — model faces +Z) ============
const playerGroup=new THREE.Group();
const rig=new THREE.Group();playerGroup.add(rig); // hurt-tilt, roll flips & lunge offsets go here
let pBody,pHead,pArmLp,pArmRp,pLegLp,pLegRp,pWeaponHolder,pTrail,pClothMat,pGear,pHeadGear;
const CLASS_TINT={warrior:0x283593,ranger:0x2e7d32,mage:0x5e35b1};
function limbMesh(r,len,mat){const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,3,8),mat);m.position.y=-(len/2+r*0.5);return m;}
function legPivot(parent,x,y,z,w,h,mat){const p=new THREE.Group();p.position.set(x,y,z);const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),mat);m.position.y=-h/2;p.add(m);parent.add(p);return p;}
{
 pClothMat=MAT(CLASS_TINT[S.cls]||0x283593);
 pBody=new THREE.Mesh(new THREE.CapsuleGeometry(0.34,0.7,4,10),pClothMat);pBody.position.y=1.2;rig.add(pBody);
 const belt=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.37,0.12,10),MAT(0x4e342e));belt.position.y=0.92;rig.add(belt);
 for(const s of [-1,1]){const pad=new THREE.Mesh(new THREE.SphereGeometry(0.16,10,8,0,Math.PI*2,0,1.4),MAT(0x37474f));pad.position.set(s*0.48,1.62,0);rig.add(pad);}
 pHead=new THREE.Group();pHead.position.y=1.98;rig.add(pHead);
 pHead.add(new THREE.Mesh(new THREE.SphereGeometry(0.27,14,14),MAT(0xffcc9e)));
 const eyeM=new THREE.MeshBasicMaterial({color:0x141414});
 for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8),eyeM);e.position.set(s*0.1,0.04,0.235);pHead.add(e);}
 const nose=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.12,6),MAT(0xe0a878));nose.position.set(0,-0.03,0.28);nose.rotation.x=Math.PI/2;pHead.add(nose);
 const helm=new THREE.Mesh(new THREE.SphereGeometry(0.295,12,10,0,Math.PI*2,0,1.25),MAT(0x37474f));helm.position.y=0.05;pHead.add(helm);
 const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.31,0.33,0.06,12),MAT(0x263238));brim.position.y=0.03;pHead.add(brim);
 pHeadGear=new THREE.Group();pHead.add(pHeadGear); // class headgear (hood / wizard hat), rebuilt on class change
 pArmLp=new THREE.Group();pArmLp.position.set(-0.48,1.55,0);rig.add(pArmLp);
 pArmRp=new THREE.Group();pArmRp.position.set(0.48,1.55,0);rig.add(pArmRp);
 pArmLp.add(limbMesh(0.11,0.5,pClothMat));
 pArmRp.add(limbMesh(0.11,0.5,pClothMat));
 const handM=MAT(0xffcc9e);
 for(const pv of [pArmLp,pArmRp]){const h=new THREE.Mesh(new THREE.SphereGeometry(0.11,8,8),handM);h.position.y=-0.72;pv.add(h);}
 pLegLp=new THREE.Group();pLegLp.position.set(-0.18,0.85,0);rig.add(pLegLp);
 pLegRp=new THREE.Group();pLegRp.position.set(0.18,0.85,0);rig.add(pLegRp);
 const legM=MAT(0x1a237e);
 pLegLp.add(limbMesh(0.13,0.45,legM));
 pLegRp.add(limbMesh(0.13,0.45,legM));
 const bootM=MAT(0x3e2723);
 for(const pv of [pLegLp,pLegRp]){const b=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.12,0.32),bootM);b.position.set(0,-0.8,0.06);pv.add(b);}
 pWeaponHolder=new THREE.Group();pWeaponHolder.position.set(0,-0.72,0.1);pArmRp.add(pWeaponHolder);
 // swing arc flash — child of rig so it always faces forward
 pTrail=new THREE.Mesh(new THREE.RingGeometry(0.7,1.5,14,1,0,Math.PI*0.75),new THREE.MeshBasicMaterial({color:0xfff176,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
 pTrail.position.set(0,1.2,0.5);pTrail.rotation.set(-0.35,0,Math.PI*0.12);rig.add(pTrail);
 pGear=new THREE.Group();rig.add(pGear); // class gear layer (pauldrons/cape/hat/robe)
 makeOutlined(pBody,1.06);makeOutlined(pHead.children[0],1.1);
 shadowify(playerGroup);scene.add(playerGroup);
}

// ============ Weapons (tiered designs, held in the fist) ============
const WEAPON_LOOK={
 bronze_sword:{blade:0xc97b2f,guard:0x5d4037},
 iron_sword:{blade:0xcfd8dc,guard:0x455a64},
 steel_sword:{blade:0xf5f9ff,guard:0xb71c1c,glow:0x223344},
};
function buildSwordMesh(look){
 const g=new THREE.Group();
 const steel=MAT(look.blade,look.glow?{emissive:look.glow}:{});
 if(look.glow)steel.emissive=new THREE.Color(look.glow);
 const blade=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.085,1.1,4),steel);
 blade.rotation.y=Math.PI/4;blade.position.y=0.85;g.add(blade);
 const tip=new THREE.Mesh(new THREE.ConeGeometry(0.062,0.24,4),steel);tip.rotation.y=Math.PI/4;tip.position.y=1.5;g.add(tip);
 const guardM=MAT(look.guard);
 const guard=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.07,0.13),guardM);guard.position.y=0.28;g.add(guard);
 for(const s of [-1,1]){const w=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8),guardM);w.position.set(s*0.23,0.28,0);g.add(w);}
 const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.055,0.24,8),MAT(0x3e2723));grip.position.y=0.12;g.add(grip);
 const pom=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,10),guardM);pom.position.y=-0.02;g.add(pom);
 g.rotation.x=0.35;
 return g;
}
function buildBowMesh(){
 const g=new THREE.Group();
 const wood=MAT(0x6d4c41);
 // limbs arc FORWARD (+Z, toward target); string + arrow sit behind on the archer side
 const top=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.52,0.07),wood);top.position.set(0,0.32,0.09);top.rotation.x=-0.35;g.add(top);
 const bot=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.52,0.07),wood);bot.position.set(0,-0.32,0.09);bot.rotation.x=0.35;g.add(bot);
 g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.22,8),MAT(0x3e2723)));
 const strM=new THREE.MeshBasicMaterial({color:0xf5f5f5});
 const sTop=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.58,4),strM);sTop.position.set(0,0.28,-0.07);sTop.rotation.x=0.245;g.add(sTop);
 const sBot=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.58,4),strM);sBot.position.set(0,-0.28,-0.07);sBot.rotation.x=-0.245;g.add(sBot);
 // nocked arrow: tail on the string, tip toward the target (+Z)
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.7,6),MAT(0x8d6e63));shaft.rotation.x=Math.PI/2;shaft.position.set(0,0,0.23);g.add(shaft);
 const tip=new THREE.Mesh(new THREE.ConeGeometry(0.045,0.12,6),MAT(0x9e9e9e));tip.rotation.x=Math.PI/2;tip.position.set(0,0,0.61);g.add(tip);
 g.rotation.y=-0.15;
 return g;
}
function buildStaffMesh(){
 const g=new THREE.Group();
 g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.055,1.6,8),MAT(0x4e342e)));
 const cage=new THREE.Mesh(new THREE.TorusGeometry(0.12,0.03,8,14),MAT(0x8d6e63));cage.position.y=0.9;g.add(cage);
 const orb=new THREE.Mesh(new THREE.SphereGeometry(0.11,12,12),new THREE.MeshBasicMaterial({color:S.cls==='mage'?0x7fd4ff:0xffd54a}));orb.position.y=0.9;g.add(orb);
 const light=new THREE.PointLight(S.cls==='mage'?0x66ccff:0xffca28,4,6);light.position.y=0.9;g.add(light);
 const spike=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.18,6),MAT(0x37474f));spike.position.y=-0.88;spike.rotation.x=Math.PI;g.add(spike);
 g.position.y=0.1;
 return g;
}
function refreshPlayerWeapon(){
 if(!pWeaponHolder)return;
 while(pWeaponHolder.children.length)pWeaponHolder.remove(pWeaponHolder.children[0]);
 pClothMat.color.setHex(CLASS_TINT[S.cls]||0x283593);
 let id=S.equip.weapon;
 if(!id||!ITEMS[id]||!ITEMS[id].dmg)id=S.cls==='ranger'?'oak_bow':S.cls==='mage'?'magic_staff':null;
 let mesh=null;
 if(!id)mesh=new THREE.Group();
 else if(id.includes('bow'))mesh=buildBowMesh();
 else if(id.includes('staff'))mesh=buildStaffMesh();
 else mesh=buildSwordMesh(WEAPON_LOOK[id]||WEAPON_LOOK.iron_sword);
 pWeaponHolder.add(mesh);
 buildClassGear();
}
// class-distinct silhouettes layered onto the shared rig
function clearGear(){
 if(!pGear)return;
 while(pGear.children.length)pGear.remove(pGear.children[0]);
}
function buildClassGear(){
 if(!pGear)return;
 clearGear();
 while(pHeadGear.children.length)pHeadGear.remove(pHeadGear.children[0]);
 const helm=pHead.children[1];
 if(helm)helm.visible=!(S.cls==='ranger'||S.cls==='mage');
 const brim=pHead.children[2];
 if(brim)brim.visible=!(S.cls==='ranger'||S.cls==='mage');
 const cls=S.cls;
 const trim=MAT(cls==='warrior'?0x8d6e63:cls==='ranger'?0x4e6b3a:0x4527a0);
 const dark=MAT(0x2a2a38);
 if(cls==='warrior'){
  // heavy pauldrons + chest plate + shield on the left arm
  for(const s of [-1,1]){
   const pa=new THREE.Mesh(new THREE.SphereGeometry(0.24,8,6,0,Math.PI*2,0,1.3),MAT(0x90a4ae));
   pa.position.set(s*0.5,1.62,0);pa.scale.set(1,0.8,1.1);pGear.add(pa);
  }
  const plate=new THREE.Mesh(new THREE.BoxGeometry(0.66,0.5,0.44),MAT(0x78909c));plate.position.y=1.3;pGear.add(plate);
  const crest=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.22,0.3),MAT(0xd32f2f));crest.position.y=2.28;pGear.add(crest);
  const shield=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.07,6),MAT(0x8d6e63));
  shield.rotation.x=Math.PI/2;shield.rotation.z=Math.PI/6;shield.position.set(-0.62,1.1,-0.18);pGear.add(shield);
  const boss=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8),MAT(0xcfd8dc));boss.position.set(-0.62,1.1,0.02);pGear.add(boss);
 } else if(cls==='ranger'){
  const hood=new THREE.Mesh(new THREE.SphereGeometry(0.33,10,8,0,Math.PI*2,0,1.6),MAT(0x33691e));hood.position.y=0.06;pHeadGear.add(hood);
  const cowl=new THREE.Mesh(new THREE.ConeGeometry(0.36,0.3,8),MAT(0x2e5d18));cowl.position.set(0,0.02,0.14);cowl.rotation.x=1.0;pHeadGear.add(cowl);
  const cape=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.1,6,1,true),MAT(0x2e7d32));cape.position.set(0,1.25,-0.28);cape.rotation.x=-0.12;pGear.add(cape);
  const quiver=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.5,6),MAT(0x5d4037));
  quiver.position.set(0.3,1.35,-0.32);quiver.rotation.z=0.5;pGear.add(quiver);
  for(let i=0;i<3;i++){const ar=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.5,4),MAT(0xcfd8dc));ar.position.set(0.4+i*0.06,1.72,-0.32);ar.rotation.z=0.5;pGear.add(ar);}
  const belt=new THREE.Mesh(new THREE.TorusGeometry(0.36,0.05,6,12),MAT(0x4e342e));belt.position.y=0.95;belt.rotation.x=Math.PI/2;pGear.add(belt);
 } else {
  const hat=new THREE.Mesh(new THREE.ConeGeometry(0.36,0.85,8),MAT(0x4527a0));hat.position.y=0.5;pHeadGear.add(hat);
  const hatBrim=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.05,10),MAT(0x311b92));hatBrim.position.y=0.16;pHeadGear.add(hatBrim);
  const robe=new THREE.Mesh(new THREE.ConeGeometry(0.55,1.1,8,1,true),MAT(0x311b92));robe.position.y=0.75;pGear.add(robe);
  const cape=new THREE.Mesh(new THREE.ConeGeometry(0.48,1.0,6,1,true),MAT(0x1a237e));cape.position.set(0,1.3,-0.26);cape.rotation.x=-0.1;pGear.add(cape);
  const sash=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.14,0.5),MAT(0x7e57c2));sash.position.y=0.98;pGear.add(sash);
 }
 // class-colored trim on shoulders
 for(const s of [-1,1]){
  const p=new THREE.Mesh(new THREE.SphereGeometry(0.17,8,6,0,Math.PI*2,0,1.4),trim);
  p.position.set(s*0.48,1.62,0);pGear.add(p);
 }
 shadowify(pGear);
}
const P={x:4,z:8,vy:0,y:1,vx:0,vz:0,grounded:true,faceYaw:0,rollT:0,rollCD:0,attackT:0,combo:0,swingT:0,walkPhase:0,deadT:0,ifalias:0,hurtT:0};

// ============ Enemies ============
function hpBarMake(w=1.2){
 const g=new THREE.Group();
 const bg=new THREE.Mesh(new THREE.PlaneGeometry(w,0.14),new THREE.MeshBasicMaterial({color:0x000000,depthTest:false,transparent:true,opacity:0.7}));
 const fg=new THREE.Mesh(new THREE.PlaneGeometry(w,0.12),new THREE.MeshBasicMaterial({color:0xe53935,depthTest:false}));
 fg.position.z=0.001;g.add(bg);g.add(fg);g.userData={fg,w};
 return g;
}
function hpBarSet(g,frac){const {fg,w}=g.userData;fg.scale.x=Math.max(0.001,frac);fg.position.x=-w*(1-frac)/2;}
function makeWolf(x,z){
 const g=new THREE.Group();
 const fur=MAT(0x616161),dark=MAT(0x424242);
 const body=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.55,1.1),fur);body.position.y=0.55;g.add(body);
 const head=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,0.45),MAT(0x757575));head.position.set(0,0.85,0.68);g.add(head);
 const snout=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.18,0.28),dark);snout.position.set(0,0.76,0.98);g.add(snout);
 for(const s of [-1,1]){
  const ear=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.22,5),dark);ear.position.set(s*0.14,1.12,0.6);g.add(ear);
  const eye=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8),new THREE.MeshBasicMaterial({color:0xff3d00}));eye.position.set(s*0.12,0.92,0.9);g.add(eye);
 }
 const tail=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.45),dark);tail.position.set(0,0.72,-0.72);tail.rotation.x=0.5;g.add(tail);
 const legs=[];
 for(const [lx,lz] of [[0.18,0.38],[-0.18,0.38],[0.18,-0.38],[-0.18,-0.38]])legs.push(legPivot(g,lx,0.5,lz,0.14,0.5,dark));
 const bar=hpBarMake();bar.position.y=1.5;g.add(bar);
 g.position.set(x,terrainH(x,z),z);shadowify(g);scene.add(g);
 return {type:'wolf',name:'Wolf',mesh:g,bar,x,z,hp:35,maxHp:35,dmg:8,speed:4.2,xp:{attack:25,strength:20,hitpoints:25},loot:{wolf_meat:1,bones:1},gold:5,range:1.8,cd:0,atkT:0,flashT:0,dying:0,state:'idle',wt:0,respawn:0,alive:true,home:{x,z},anim:{legs,tail,head}};
}
function makeGoblin(x,z){
 const g=new THREE.Group();
 const skin=MAT(0x43a047);
 const legs=[];
 for(const s of [-1,1])legs.push(legPivot(g,s*0.15,0.45,0,0.16,0.45,MAT(0x2e7d32)));
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.3,0.55,4,8),skin);body.position.y=0.95;g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(0.3,10,10),MAT(0x66bb6a));head.position.y=1.62;g.add(head);
 for(const s of [-1,1]){
  const white=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,8),new THREE.MeshBasicMaterial({color:0xffffff}));white.position.set(s*0.11,1.68,0.24);g.add(white);
  const pup=new THREE.Mesh(new THREE.SphereGeometry(0.032,6,6),new THREE.MeshBasicMaterial({color:0x111111}));pup.position.set(s*0.11,1.68,0.3);g.add(pup);
 }
 const ear1=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.35,6),MAT(0x2e7d32));ear1.position.set(-0.32,1.72,0);ear1.rotation.z=1.1;g.add(ear1);
 const ear2=ear1.clone();ear2.position.x=0.32;ear2.rotation.z=-1.1;g.add(ear2);
 const armL=new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.4,3,6),skin);armL.position.set(-0.42,1.0,0);g.add(armL);
 const clubPivot=new THREE.Group();clubPivot.position.set(0.42,1.25,0);g.add(clubPivot);
 const armR=new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.4,3,6),skin);armR.position.y=-0.25;clubPivot.add(armR);
 const club=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.85,0.13),MAT(0x5d4037));club.position.y=-0.55;clubPivot.add(club);
 const knob=new THREE.Mesh(new THREE.SphereGeometry(0.13,8,8),MAT(0x4e342e));knob.position.y=-0.95;clubPivot.add(knob);
 clubPivot.rotation.x=-0.15;
 const bar=hpBarMake();bar.position.y=2.3;g.add(bar);
 g.position.set(x,terrainH(x,z),z);shadowify(g);scene.add(g);
 return {type:'goblin',name:'Goblin Thug',mesh:g,bar,x,z,hp:55,maxHp:55,dmg:11,speed:3.4,xp:{attack:40,strength:35,hitpoints:40},loot:{bones:1,goblin_ear:1},gold:9,range:1.9,cd:0,atkT:0,flashT:0,dying:0,state:'idle',wt:0,respawn:0,alive:true,home:{x,z},anim:{legs,clubPivot,head}};
}
function makeCultist(x,z){
 const g=new THREE.Group();
 const robe=new THREE.Mesh(new THREE.ConeGeometry(0.55,1.7,8),MAT(0x4a148c));robe.position.y=0.85;g.add(robe);
 const head=new THREE.Mesh(new THREE.SphereGeometry(0.26,10,10),MAT(0xce93d8));head.position.y=1.75;g.add(head);
 for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6),new THREE.MeshBasicMaterial({color:0xffee58}));e.position.set(s*0.09,1.78,0.22);g.add(e);}
 const staff=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1.6,6),MAT(0x3e2723));staff.position.set(0.5,0.9,0.1);g.add(staff);
 const orb=new THREE.Mesh(new THREE.SphereGeometry(0.11,10,10),new THREE.MeshBasicMaterial({color:0xe040fb}));orb.position.set(0.5,1.75,0.1);g.add(orb);
 const bar=hpBarMake();bar.position.y=2.4;g.add(bar);
 g.position.set(x,terrainH(x,z),z);shadowify(g);scene.add(g);
 return {type:'cultist',name:'Dark Cultist',mesh:g,bar,x,z,hp:70,maxHp:70,dmg:13,speed:2.8,xp:{magic:60,hitpoints:50,defence:30},loot:{bones:2},gold:15,range:12,cd:0,atkT:0,flashT:0,dying:0,state:'idle',wt:0,respawn:0,alive:true,home:{x,z},ranged:true,anim:{head}};
}
function makeDragon(x,z){
 const g=new THREE.Group();
 const scale=MAT(0xb71c1c),dark=MAT(0x7f0000);
 const body=new THREE.Mesh(new THREE.BoxGeometry(2,1.6,3.2),scale);body.position.y=1.8;g.add(body);
 const belly=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.1,2.6),MAT(0xe57373));belly.position.set(0,1.45,0.2);g.add(belly);
 for(let i=0;i<3;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(0.18,0.5,5),MAT(0xffebee));spike.position.set(0,2.75,-0.9+i*0.9);g.add(spike);}
 const neck=new THREE.Mesh(new THREE.BoxGeometry(0.8,1.0,1.4),MAT(0xc62828));neck.position.set(0,2.5,2.0);neck.rotation.x=0.45;g.add(neck);
 const head=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.8,1.0),MAT(0xd32f2f));head.position.set(0,3.0,2.9);g.add(head);
 const jaw=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.25,0.85),dark);jaw.position.set(0,2.62,2.95);g.add(jaw);
 for(const s of [-1,1]){
  const horn=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.6,6),MAT(0xffebee));horn.position.set(s*0.28,3.55,2.6);horn.rotation.x=-0.4;g.add(horn);
  const eye=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8),new THREE.MeshBasicMaterial({color:0xffeb3b}));eye.position.set(s*0.24,3.12,3.36);g.add(eye);
 }
 const wingM=MAT(0x7f0000,{side:THREE.DoubleSide});
 const wingL=new THREE.Group();wingL.position.set(-0.9,2.9,0);g.add(wingL);
 const wingR=new THREE.Group();wingR.position.set(0.9,2.9,0);g.add(wingR);
 const wl=new THREE.Mesh(new THREE.BoxGeometry(3,0.08,1.6),wingM);wl.position.x=-1.5;wingL.add(wl);
 const wr=new THREE.Mesh(new THREE.BoxGeometry(3,0.08,1.6),wingM);wr.position.x=1.5;wingR.add(wr);
 const tail=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,2.4),dark);tail.position.set(0,1.6,-2.6);g.add(tail);
 const tip=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.7,6),scale);tip.position.set(0,1.6,-3.9);tip.rotation.x=-Math.PI/2;g.add(tip);
 const legs=[];
 for(const [lx,lz] of [[0.8,1],[-0.8,1],[0.8,-1],[-0.8,-1]])legs.push(legPivot(g,lx,1.1,lz,0.6,1.1,dark));
 const bar=hpBarMake(3);bar.position.y=4.9;g.add(bar);
 g.position.set(x,terrainH(x,z),z);shadowify(g);scene.add(g);
 return {type:'dragon',name:'Malachar the Young Dragon',mesh:g,bar,x,z,hp:900,maxHp:900,dmg:22,speed:4.8,xp:{attack:500,magic:400,hitpoints:400},loot:{bones:5},gold:500,range:3.2,cd:0,atkT:0,flashT:0,dying:0,state:'idle',wt:0,respawn:1e9,alive:true,home:{x,z},boss:true,anim:{wingL,wingR,tail,jaw,legs}};
}
function spawnEnemies(){
 enemies.length=0;
 const spots=[[-20,-12],[18,-16],[-26,12],[22,20],[-12,26],[30,-6],[-32,-4],[14,32]];
 for(const [sx,sz] of spots){for(let i=0;i<3;i++)enemies.push(Math.random()<0.5?makeWolf(sx+rand(-6,6),sz+rand(-6,6)):makeGoblin(sx+rand(-6,6),sz+rand(-6,6)));}
 for(let i=0;i<4;i++){let x,z,tries=0;do{x=rand(-32,32);z=rand(-32,32);tries++;}while(Math.hypot(x,z)<24&&tries<30);enemies.push(makeCultist(x,z));}
 enemies.push(makeDragon(46,46));
}
spawnEnemies();

// ============ Controls ============
const keys={};
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault();if(e.code==='KeyE')doInteract();if(e.code==='KeyJ')doAttack();if(e.code==='KeyQ')doSpell1();if(e.code==='KeyR')doSpell2();if(e.code==='ShiftLeft'||e.code==='ShiftRight')doDodge();});
addEventListener('keyup',e=>{keys[e.code]=false;});
// joystick
const joy={x:0,y:0,id:null};
const jzone=$('joystick-zone'),jbase=$('joystick-base'),jknob=$('joystick-knob');
let joyOrigin=null;
jzone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];joy.id=t.identifier;joyOrigin={x:t.clientX,y:t.clientY};jbase.style.display='block';jbase.style.left=(t.clientX-55)+'px';jbase.style.top=(t.clientY-140)+'px';jbase.style.bottom='auto';e.preventDefault();},{passive:false});
addEventListener('touchmove',e=>{
 for(const t of e.changedTouches){
  if(t.identifier===joy.id){
   const dx=(t.clientX-joyOrigin.x)/45,dy=(t.clientY-joyOrigin.y)/45;
   const l=Math.hypot(dx,dy);const cl=l>1?1/l:1;
   joy.x=dx*cl;joy.y=dy*cl;
   jknob.style.transform=`translate(${joy.x*32}px,${joy.y*32}px)`;
  } else if(t.identifier===look.id){
   const dx=t.clientX-look.px,dy=t.clientY-look.py;look.px=t.clientX;look.py=t.clientY;
   camYaw-=dx*0.006;camPitch=clamp(camPitch+dy*0.004,-0.2,1.1);
  }
 }
},{passive:true});
addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===joy.id){joy.id=null;joy.x=0;joy.y=0;jknob.style.transform='';jbase.style.display='none';}if(t.identifier===look.id)look.id=null;}},{passive:true});
// camera look (mouse + touch on right)
const look={id:null,px:0,py:0};
let camYaw=0,camPitch=0.45,camDist=8;
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.clientX<innerWidth*0.45)return;look.id='mouse';look.px=e.clientX;look.py=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(look.id==='mouse'&&(e.buttons||e.pointerType!=='mouse')){const dx=e.clientX-look.px,dy=e.clientY-look.py;look.px=e.clientX;look.py=e.clientY;camYaw-=dx*0.005;camPitch=clamp(camPitch+dy*0.003,-0.2,1.15);}});
canvas.addEventListener('pointerup',()=>{look.id=null;});
canvas.addEventListener('wheel',e=>{camDist=clamp(camDist+e.deltaY*0.01,4,16);},{passive:true});
// touch look start on right half
canvas.addEventListener('touchstart',e=>{for(const t of e.changedTouches){if(t.clientX>innerWidth*0.45&&look.id==null){look.id=t.identifier;look.px=t.clientX;look.py=t.clientY;}}},{passive:true});
function bindBtn(id,fn){const el=$(id);const h=e=>{e.preventDefault();fn();};el.addEventListener('touchstart',h,{passive:false});el.addEventListener('mousedown',h);}
bindBtn('btn-attack',doAttack);bindBtn('btn-jump',doJump);bindBtn('btn-dodge',doDodge);
bindBtn('btn-spell1',doSpell1);bindBtn('btn-spell2',doSpell2);bindBtn('btn-interact',doInteract);

// ============ Combat ============
let target=null;
function nearestEnemy(maxD=3.2){
 let best=null,bd=maxD;
 for(const e of enemies){if(!e.alive)continue;const d=dist2(P.x,P.z,e.x,e.z);if(d<bd){bd=d;best=e;}}
 return best;
}
function doJump(){if(P.grounded&&S.stam>5){P.vy=6;P.grounded=false;S.stam=Math.max(0,S.stam-5);}}
function doDodge(){
 if(P.rollCD>0||S.stam<15||P.rollT>0)return;
 P.rollT=0.45;P.rollCD=1.1;S.stam=Math.max(0,S.stam-15);P.ifalias=0.5;sfx('swing');
}
function meleeArc(dmg,range=2.8,arc=1.2,skill='attack'){
 sfx('swing');
 setTimeout(()=>{
  let hitAny=false;
  for(const e of enemies){
   if(!e.alive)continue;
   const d=dist2(P.x,P.z,e.x,e.z);
   if(d>range+e.mesh.scale.x*0.5&&d>range)continue;
   const ang=Math.atan2(e.z-P.z,e.x-P.x);
   let da=Math.abs(((ang-P.faceYaw+Math.PI*3)%(Math.PI*2))-Math.PI);
   if(da<arc){
    damageEnemy(e,dmg,skill);hitAny=true;
   }
  }
  if(hitAny){sfx('hit');}
 },140);
}
function doAttack(){
 if(!S.started||S.dead||P.rollT>0||P.attackT>0)return;
 P.attackT=0.45;P.combo=(P.combo+1)%3;P.swingT=0.3;
 const base=S.weaponDmg+randi(0,2);
 const isRanger=S.cls==='ranger';
 if(isRanger){ // shoot arrow
  if(S.stam<5)return;S.stam-=5;sfx('shoot');
  const t=nearestEnemy(18)||target;
  const dir=t?Math.atan2(t.z-P.z,t.x-P.x):P.faceYaw;
  spawnProjectile('arrow',P.x,P.z,dir,22,base+2,'player');
  addXP('ranged',4,true);addXP('hitpoints',2,true);
 } else {
  meleeArc(base+(P.combo===2?3:0));
  addXP('attack',4,true);addXP('strength',3,true);addXP('hitpoints',2,true);
 }
 updateHUD();
}
function doSpell1(){
 if(!S.started||S.dead||S.cd1>0)return;
 const c=CLASSES[S.cls];
 if(S.mana<c.spell1.mana){toast('Not enough mana!');return;}
 S.mana-=c.spell1.mana;S.cd1=c.spell1.cd;
 if(S.cls==='warrior'){sfx('hit');meleeArc(S.weaponDmg+10,3.2,1.4);addXP('strength',25);}
 else if(S.cls==='ranger'){sfx('shoot');for(let i=-1;i<=1;i++)spawnProjectile('arrow',P.x,P.z,P.faceYaw+i*0.15,24,S.weaponDmg+4,'player');addXP('ranged',30);}
 else {sfx('fire');const t=nearestEnemy(20);const dir=t?Math.atan2(t.z-P.z,t.x-P.x):P.faceYaw;spawnProjectile('fireball',P.x,P.z,dir,18,S.weaponDmg+12,'player');addXP('magic',35);}
 updateHUD();
}
function doSpell2(){
 if(!S.started||S.dead||S.cd2>0)return;
 const c=CLASSES[S.cls];
 if(S.mana<c.spell2.mana){toast('Not enough mana!');return;}
 S.mana-=c.spell2.mana;S.cd2=c.spell2.cd;
 if(S.cls==='warrior'){sfx('hit');meleeArc(S.weaponDmg+7,4.2,Math.PI);addXP('strength',40);}
 else if(S.cls==='ranger'){sfx('shoot');for(let i=0;i<6;i++){const a=rand(0,Math.PI*2);spawnProjectile('arrow',P.x+Math.cos(a)*2,P.z+Math.sin(a)*2,a,20,S.weaponDmg+2,'player');}addXP('ranged',45);}
 else {sfx('fire');for(const e of enemies){if(!e.alive)continue;if(dist2(P.x,P.z,e.x,e.z)<6){damageEnemy(e,S.weaponDmg+10,'magic');}}ringEffect(P.x,P.z,0x88ccff);addXP('magic',50);}
 updateHUD();
}
function spawnProjectile(kind,x,z,dir,speed,dmg,from){
 const g=new THREE.Group();
 let mesh;
 if(kind==='fireball'){mesh=new THREE.Mesh(new THREE.SphereGeometry(0.3,10,10),new THREE.MeshBasicMaterial({color:0xff6d00}));const l=new THREE.PointLight(0xff6d00,6,8);g.add(l);}
 else if(kind==='enemybolt'){mesh=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,8),new THREE.MeshBasicMaterial({color:0xce93d8}));}
 else {mesh=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.06,0.06),MAT(0x8d6e63));}
 g.add(mesh);
 const y=kind==='arrow'?1.4:1.6;
 g.position.set(x,terrainH(x,z)+y,z);
 scene.add(g);
 projectiles.push({kind,mesh:g,x,z,y,dir,speed,dmg,from,life:3});
}
function damageEnemy(e,dmg,skill){
 if(!e.alive)return;
 const crit=Math.random()<0.12;
 const final=Math.round(dmg*(crit?1.8:1)*rand(0.9,1.15));
 e.hp-=final;
 hpBarSet(e.bar,e.hp/e.maxHp);
 spawnDmg(e.x,e.z,final,crit?'crit':'enemy');
 e.flashT=0.12;e.state='chase';
 if(e.hp<=0) killEnemy(e);
 else if(e.boss) bossReact(e);
}
function killEnemy(e){
 e.alive=false;e.hp=0;e.dying=0.7;e.mesh.rotation.z=0; // death throes animate in updateEnemies
 // loot shower
 const lootGold=e.gold+randi(0,4);
 addGold(lootGold);spawnDmg(e.x,e.z,'+'+lootGold+'g','heal');
 for(const [id,n] of Object.entries(e.loot||{})){addItem(id,n);}
 for(const [sk,xp] of Object.entries(e.xp))addXP(sk,xp,true);
 updateHUD();sfx('coin');
 if(e.type==='wolf')S.stats.kill_wolf++;
 if(e.type==='goblin')S.stats.kill_goblin++;
 if(e.type==='cultist')S.stats.kill_cultist++;
 if(e.type==='dragon'){S.stats.kill_dragon++;onDragonSlain();}
 // pickup sparkle
 ringEffect(e.x,e.z,0xffd54a);
 toast(`Slew ${e.name}! +loot`);
 checkQuests();save();
 setTimeout(()=>{
  if(e.boss)return;
  // respawn at home
  e.hp=e.maxHp;e.alive=true;e.dying=0;e.x=e.home.x+rand(-2,2);e.z=e.home.z+rand(-2,2);
  e.mesh.rotation.z=0;e.mesh.rotation.x=0;
  e.mesh.position.set(e.x,terrainH(e.x,e.z),e.z);hpBarSet(e.bar,1);scene.add(e.mesh);e.state='idle';
 },22000);
}
function damagePlayer(dmg,from){
 if(S.dead||P.ifalias>0||P.rollT>0)return;
 const def=Math.floor(skillLevel('defence')/4);
 const final=Math.max(1,Math.round(dmg-def*0.5+rand(-2,2)));
 S.hp-=final;P.hurtT=0.28;sfx('hurt');spawnDmg(P.x,P.z,final,'player');
 addXP('defence',Math.round(final*0.6),true);addXP('hitpoints',Math.round(final*0.8),true);
 updateHUD();
 if(S.hp<=0)die();
}
function die(){
 S.dead=true;S.hp=0;stopGather();
 rig.rotation.x=-1.25; // fallen flat
 $('death-modal').classList.remove('hidden');
}
$('btn-respawn').onclick=()=>{
 S.dead=false;S.hp=S.maxHp;S.mana=S.maxMana;S.stam=100;
 P.x=0;P.z=13;P.vy=0;P.grounded=true;P.y=terrainH(0,13);
 rig.rotation.x=0;rig.position.z=0;
 $('death-modal').classList.add('hidden');updateHUD();toast('Revived by the Spirit Healer ✝');
};
function onDragonSlain(){
 S.won=true;
 $('victory-modal').classList.remove('hidden');
 sfx('quest');
}
$('btn-keep-playing').onclick=()=>$('victory-modal').classList.add('hidden');

// ============ Gathering / Interact ============
let gather={active:false,type:null,obj:null,t:0,need:1.2};
function nearestInteract(){
 // NPC first
 let best=null,bd=3.2,bkind=null;
 for(const n of npcs){const d=dist2(P.x,P.z,n.x,n.z);if(d<bd){bd=d;best=n;bkind='npc';}}
 for(const t of trees){if(!t.alive)continue;const d=dist2(P.x,P.z,t.x,t.z);if(d<bd){bd=d;best=t;bkind='tree';}}
 for(const r of rocks){if(!r.alive)continue;const d=dist2(P.x,P.z,r.x,r.z);if(d<bd){bd=d;best=r;bkind='rock';}}
 for(const f of fishSpots){if(f.stock<=0)continue;const d=dist2(P.x,P.z,f.x,f.z);if(d<bd+1){bd=d;best=f;bkind='fish';}}
 // stations & buildings usable
 for(const b of buildings3d){if(!b.use)continue;const d=dist2(P.x,P.z,b.x,b.z);if(d<bd){bd=d;best=b;bkind='station:'+b.use;}}
 // static stations
 for(const [kind,x,z] of [['cook',0,0],['smith',-4,1],['smelt',4,0],['craft',0,-7]]){
  const d=dist2(P.x,P.z,x,z);if(d<bd){bd=d;best={kind,x,z};bkind='station:'+kind;}
 }
 // enemies talk? no
 return best?{obj:best,kind:bkind}:null;
}
function doInteract(){
 if(!S.started||S.dead)return;
 if(buildMode)return placeBuild();
 const it=nearestInteract();
 if(!it){ // try attack nearest instead
  const e=nearestEnemy(3.2);if(e){doAttack();}return;
 }
 if(it.kind==='npc'){openNPC(it.obj);return;}
 if(it.kind.startsWith('station:')){openStation(it.kind.split(':')[1]);return;}
 // start gathering
 gather.active=true;gather.obj=it.obj;gather.type=it.kind;gather.t=0;
 gather.need=it.kind==='tree'?1.4:it.kind==='rock'?1.6:1.8;
 $('gather-bar-wrap').classList.remove('hidden');
}
function stopGather(){gather.active=false;$('gather-bar-wrap').classList.add('hidden');}
function updateGather(dt){
 if(!gather.active)return;
 const o=gather.obj;
 const d=dist2(P.x,P.z,o.x,o.z);
 if(d>4){stopGather();return;}
 // face
 P.faceYaw=Math.atan2(o.z-P.z,o.x-P.x);
 gather.t+=dt;
 $('gather-fill').style.width=(gather.t/gather.need*100)+'%';
 $('gather-label').textContent=gather.type==='tree'?'🪓 Chopping…':gather.type==='rock'?'⛏️ Mining…':'🎣 Fishing…';
 // (chop swing is driven by the player rig in updatePlayer)
 if(gather.t>=gather.need){
  gather.t=0;
  if(gather.type==='tree')chopTree(o);
  else if(gather.type==='rock')mineRock(o);
  else if(gather.type==='fish')fishSpot(o);
 }
}
function chopTree(t){
 sfx('chop');
 const lvl=skillLevel('woodcutting');
 const isOak=t.kind==='oak';
 if(isOak&&lvl<15){toast('Need Woodcutting 15 for Oak!');stopGather();return;}
 t.hp--;
 spawnDmg(t.x,t.z,'🪵','xp');
 if(t.hp<=0){
  t.alive=false;t.mesh.visible=false;t.respawn=30;
  addItem(isOak?'oak_logs':'logs',isOak?2:1);
  addXP('woodcutting',isOak?50:22);
  S.stats.item_logs+=0; // addItem already counts only logs; count oak too
  if(isOak)S.stats.item_logs+=2;
  stopGather();checkQuests();
  setTimeout(()=>{},0);
 } else {
  addItem(isOak?'oak_logs':'logs',1);
  addXP('woodcutting',isOak?12:7);
  if(t.kind!=='oak')S.stats.item_logs+=0;
 }
}
function mineRock(r){
 sfx('mine');
 const lvl=skillLevel('mining');
 const need=r.ore==='iron'?15:r.ore==='tin'?1:r.ore==='copper'?1:1;
 if(lvl<need){toast(`Need Mining ${need}!`);stopGather();return;}
 r.hp--;
 if(r.hp<=0){
  r.alive=false;r.mesh.visible=false;r.respawn=35;
  if(r.ore==='copper'){addItem('copper_ore',2);addXP('mining',30);S.stats.mine_copper+=2;}
  else if(r.ore==='tin'){addItem('tin_ore',2);addXP('mining',30);}
  else if(r.ore==='iron'){addItem('iron_ore',2);addXP('mining',55);}
  else {addItem('logs',0);addGold(2);}
  stopGather();checkQuests();
 } else {
  if(r.ore==='copper'){addItem('copper_ore',1);addXP('mining',10);S.stats.mine_copper++;}
  else if(r.ore==='tin'){addItem('tin_ore',1);addXP('mining',10);}
  else if(r.ore==='iron'){addItem('iron_ore',1);addXP('mining',18);}
  checkQuests();
 }
}
function fishSpot(f){
 sfx('splash');
 if(f.stock<=0){toast('Fishing spot depleted…');stopGather();return;}
 f.stock--;
 const lvl=skillLevel('fishing');
 const fish=lvl>=20?'raw_salmon':lvl>=10?'raw_trout':'raw_shrimp';
 addItem(fish,1);addXP('fishing',fish==='raw_salmon'?30:fish==='raw_trout'?20:12);
 S.stats.catch_fish++;
 spawnDmg(f.x,f.z,'🐟','xp');
 if(f.stock<=0){f.respawn=40;}
 stopGather();checkQuests();
}

// ============ Crafting / Cooking / Smelting ============
function cookable(){return [['raw_shrimp','cooked_shrimp',12],['raw_trout','cooked_trout',30],['raw_salmon','cooked_salmon',60]];}
function smeltable(){return [['copper_ore','copper_bar',15],['tin_ore','bronze_bar',20],['iron_ore','iron_bar',35]];}

// ============ Building ============
let buildMode=null,buildRot=0,ghostMesh=null,ghostValid=false;
function setBuildMode(kind){
 buildMode=kind;buildRot=0;
 document.querySelectorAll('.buildpick').forEach(b=>b.classList.toggle('sel',b.dataset.build===kind));
 if(!kind){if(ghostMesh){scene.remove(ghostMesh);ghostMesh=null;}$('build-bar').classList.add('hidden');return;}
 $('build-bar').classList.remove('hidden');
 if(ghostMesh)scene.remove(ghostMesh);
 ghostMesh=makeBuildMesh(kind,true);
 scene.add(ghostMesh);
 toast(`Place ${BUILD_DEFS[kind].name}: walk + tap ✋. Need: ${costText(kind)}`);
}
function costText(kind){
 const c=BUILD_DEFS[kind].cost;
 return Object.entries(c).filter(([,n])=>n>0).map(([id,n])=>`${n}x ${ITEMS[id]?ITEMS[id].name:id}`).join(', ')||'free';
}
function makeBuildMesh(kind,ghost=false){
 const def=BUILD_DEFS[kind];
 const g=new THREE.Group();
 const op=ghost?{transparent:true,opacity:0.55}:{};
 if(kind==='foundation'){const m=new THREE.Mesh(new THREE.BoxGeometry(3,0.3,3),MAT(ghost?0x00ff00:0x8d6e63,op));m.position.y=0.15;g.add(m);}
 else if(kind==='wall'){const m=new THREE.Mesh(new THREE.BoxGeometry(3,2.4,0.3),MAT(ghost?0x00ff00:0xa1887f,op));m.position.y=1.2;g.add(m);}
 else if(kind==='campfire'){return makeCampfireGhost(ghost);}
 else if(kind==='torch'){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,2,6),MAT(0x5d4037,op));p.position.y=1;g.add(p);const f=new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8),new THREE.MeshBasicMaterial({color:0xffb300}));f.position.y=2.1;g.add(f);}
 else if(kind==='workbench'||kind==='anvil'||kind==='furnace'){
  const m=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.2,1.2),MAT(kind==='anvil'?0x455a64:kind==='furnace'?0x616161:0x8d6e63,op));m.position.y=0.6;g.add(m);
 }
 if(!ghost)shadowify(g);
 return g;
}
function makeCampfireGhost(ghost){
 const g=new THREE.Group();
 for(let i=0;i<4;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,1.1,6),ghost?new THREE.MeshBasicMaterial({color:0x00ff00,transparent:true,opacity:0.55}):MAT(0x5d4037));log.rotation.z=Math.PI/2;log.rotation.y=i/4*Math.PI;log.position.y=0.15;g.add(log);}
 return g;
}
// prototype pictures for the build menu — one tiny shared GL context, rendered once each
let thumbRenderer=null;const THUMBS={};
const BUILD_ICON={foundation:'🟫',wall:'🧱',campfire:'🔥',workbench:'🪓',furnace:'♨️',anvil:'⚒️',torch:'🕯️'};
function thumbFor(kind){
 if(THUMBS[kind]!==undefined)return THUMBS[kind];
 try{
  thumbRenderer=thumbRenderer||new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  thumbRenderer.setSize(112,112);
  const sc=new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff,0x445533,1.2));
  const dl=new THREE.DirectionalLight(0xffffff,1.3);dl.position.set(3,5,4);sc.add(dl);
  const m=makeBuildMesh(kind,false);
  const box=new THREE.Box3().setFromObject(m);
  const c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());
  const R=Math.max(s.x,s.y,s.z,0.6);
  const cam=new THREE.PerspectiveCamera(38,1,0.1,100);
  cam.position.set(c.x+R*1.5,c.y+R*1.15,c.z+R*1.5);cam.lookAt(c.x,c.y+R*0.05,c.z);
  sc.add(m);
  thumbRenderer.render(sc,cam);
  THUMBS[kind]=thumbRenderer.domElement.toDataURL();
 }catch(err){THUMBS[kind]=null;}
 return THUMBS[kind];
}
function decorateBuildBar(){
 try{document.querySelectorAll('.buildpick').forEach(btn=>{
  if(btn.querySelector('img'))return;
  const u=thumbFor(btn.dataset.build);
  if(u){const img=document.createElement('img');img.src=u;img.className='build-thumb small';img.alt='';btn.prepend(img);}
 });}catch(e){}
}
function canAfford(kind){
 for(const [id,n] of Object.entries(BUILD_DEFS[kind].cost)){if((S.inv[id]||0)<n)return false;}
 return true;
}
function placeBuild(){
 if(!buildMode||!ghostMesh)return;
 // validity: not in water, not colliding
 const gx=Math.round(P.x+Math.cos(P.faceYaw)*2.5),gz=Math.round(P.z+Math.sin(P.faceYaw)*2.5);
 const h=terrainH(gx,gz);
 if(h<0.25){toast('Too wet to build here!');sfx('hurt');return;}
 if(!canAfford(buildMode)){toast('Need: '+costText(buildMode));sfx('hurt');return;}
 for(const [id,n] of Object.entries(BUILD_DEFS[buildMode].cost))removeItem(id,n);
 const mesh=makeBuildMesh(buildMode,false);
 mesh.position.set(gx,h,gz);mesh.rotation.y=buildRot;scene.add(mesh);
 const use=BUILD_DEFS[buildMode].use||null;
 const b={kind:buildMode,x:gx,z:gz,mesh,use};
 // add light for campfire/torch
 if(buildMode==='campfire'){const l=new THREE.PointLight(0xff8f00,10,12);l.position.y=1.5;mesh.add(l);const fl=mesh.children.find(c=>c.geometry&&c.geometry.type==='ConeGeometry');torches.push({mesh,flame:fl||mesh.children[0],light:l,phase:rand(0,6)});}
 if(buildMode==='torch'){const l=new THREE.PointLight(0xffb300,6,9);l.position.y=2.2;mesh.add(l);}
 buildings3d.push(b);
 S.buildings.push({kind:buildMode,x:gx,z:gz,rot:buildRot});
 addXP('construction',BUILD_DEFS[buildMode].xp);
 sfx('place');toast(`Built ${BUILD_DEFS[buildMode].name}! (+${BUILD_DEFS[buildMode].xp} Construction XP)`);
 save();
}
$('build-rotate').onclick=e=>{e.stopPropagation();buildRot+=Math.PI/4;};
$('build-cancel').onclick=()=>{setBuildMode(null);};

// ============ NPC / Quests ============
function questStage(id){
 if(!S.quests[id])S.quests[id]={stage:'avail',progress:{}};
 return S.quests[id];
}
function checkQuests(){
 for(const q of QUESTS){
  const st=questStage(q.id);
  if(st.stage!=='active')continue;
  let done=true;
  for(const [k,need] of Object.entries(q.need)){
   let have=0;
   if(k.startsWith('kill_'))have=S.stats[k]||0;
   else if(k.startsWith('item_'))have=(S.inv[k.slice(5)]||0)+(q.id==='timber'?0:0);
   else have=S.stats[k]||0;
   // for timber quest item_logs counts cumulative? use inventory of logs+oak
   if(q.id==='timber'&&k==='item_logs')have=(S.inv['logs']||0)+(S.inv['oak_logs']||0);
   if(have<need)done=false;
   st.progress[k]=Math.min(have,need);
  }
  if(done){st.stage='turnin';toast(`❓ ${q.name}: return to ${q.giver}!`);sfx('quest');}
 }
 renderTracker();save();
}
function openNPC(n){
 const qs=QUESTS.filter(q=>q.giver===n.name);
 panelTab='npc';openPanel('npc');
 let html=`<div class="quest-card"><h4>${n.name}</h4><p><i>"${qs[0]?qs[0].dialog:'Greetings, traveler.'}"</i></p></div>`;
 for(const q of qs){
  const st=questStage(q.id);
  const needTxt=Object.entries(q.need).map(([k,v])=>{
   const have=st.progress[k]!==undefined?st.progress[k]:(S.stats[k]||S.inv[k.slice(5)]||0);
   return `${k.replace(/_/g,' ')}: ${Math.min(have,v)}/${v}`;
  }).join(' • ');
  if(st.stage==='avail')html+=`<div class="quest-card q-active"><h4>❗ ${q.name}</h4><p>${q.desc}</p><p>${needTxt}</p><button data-accept="${q.id}">Accept quest</button></div>`;
  else if(st.stage==='active')html+=`<div class="quest-card q-active"><h4>📜 ${q.name} (in progress)</h4><p>${q.desc}</p><p>${needTxt}</p></div>`;
  else if(st.stage==='turnin')html+=`<div class="quest-card q-done"><h4>❓ ${q.name} — COMPLETE!</h4><button data-turnin="${q.id}">Turn in for reward</button></div>`;
  else html+=`<div class="quest-card q-done"><h4>✔ ${q.name} — done</h4></div>`;
 }
 // shop-ish: buy food?
 html+=`<div class="quest-card"><h4>🛒 General</h4><p>Buy Cooked Shrimp — 10g</p><button data-buy="cooked_shrimp">Buy (10g)</button></div>`;
 $('panel-body').innerHTML=html;
 $('panel-body').querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>{questStage(b.dataset.accept).stage='active';sfx('quest');toast('Quest accepted!');checkQuests();openNPC(n);});
 $('panel-body').querySelectorAll('[data-turnin]').forEach(b=>b.onclick=()=>turnIn(b.dataset.turnin));
 $('panel-body').querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{
  if(S.gold<10){toast('Not enough gold!');return;}
  S.gold-=10;addItem('cooked_shrimp',1);sfx('coin');updateHUD();save();
 });
}
function turnIn(qid){
 const q=QUESTS.find(q=>q.id===qid);
 const st=questStage(qid);
 // consume if needed (timber consumes 8 logs? keep items = false means consume)
 if(qid==='timber'){removeItem('logs',Math.min(S.inv['logs']||0,8));const rem=8-0; /* simplified: remove up to 8 total */ let need=8;for(const lid of ['logs','oak_logs']){const has=S.inv[lid]||0;const take=Math.min(has,need);if(take>0)removeItem(lid,take);need-=take;if(need<=0)break;}}
 st.stage='done';
 addGold(q.reward.gold||0);
 for(const [sk,xp] of Object.entries(q.reward.xp||{}))addXP(sk,xp);
 for(const [id,n] of Object.entries(q.reward.items||{}))addItem(id,n);
 sfx('quest');toast(`✔ ${q.name} complete! +${q.reward.gold}g`);
 // banner
 showLevelBanner('Quest Complete!',q.name);
 checkQuests();renderTracker();save();
 if(panelTab==='npc'||panelTab==='quests')renderPanel();
}
function openStation(kind){
 panelTab='station:'+kind;openPanel('Station');
 const b=$('panel-body');
 if(kind==='cook'||kind==='campfire'){
  let html=`<div class="quest-card"><h4>🔥 Cooking (Campfire)</h4><p>Cook raw fish. Requires Cooking skill.</p></div>`;
  for(const [raw,cooked,xp] of cookable()){
   const has=S.inv[raw]||0;
   html+=`<div class="craft-card"><h4>${ITEMS[raw].icon} ${ITEMS[raw].name} → ${ITEMS[cooked].icon} ${ITEMS[cooked].name}</h4><p>Have: ${has} • +${xp} XP</p><button data-cook="${raw}|${cooked}|${xp}">Cook 1</button> <button data-cookall="${raw}|${cooked}|${xp}">Cook All</button></div>`;
  }
  b.innerHTML=html;
  b.querySelectorAll('[data-cook]').forEach(btn=>btn.onclick=()=>{const [raw,cooked,xp]=btn.dataset.cook.split('|');if(!removeItem(raw,1)){toast('No raw fish!');return;}addItem(cooked,1);addXP('cooking',+xp);S.stats.cook_food++;checkQuests();sfx('eat');openStation(kind);});
  b.querySelectorAll('[data-cookall]').forEach(btn=>btn.onclick=()=>{const [raw,cooked,xp]=btn.dataset.cookall.split('|');let n=0;while((S.inv[raw]||0)>0){removeItem(raw,1);addItem(cooked,1);addXP('cooking',+xp,true);S.stats.cook_food++;n++;}addXP('cooking',0);checkQuests();openStation(kind);toast(`Cooked ${n}!`);});
 } else if(kind==='smelt'||kind==='furnace'){
  let html=`<div class="quest-card"><h4>♨️ Smelting (Furnace)</h4><p>Smelt ore into bars. +Smithing XP</p></div>`;
  // bronze needs copper+tin
  html+=`<div class="craft-card"><h4>🟤+⚪ Copper+Tin → 🟨 Bronze Bar</h4><p>Have: ${S.inv['copper_ore']||0} copper, ${S.inv['tin_ore']||0} tin • +25 XP</p><button id="smelt-bronze">Smelt Bronze</button></div>`;
  for(const [ore,bar,xp] of smeltable()){
   if(bar==='bronze_bar')continue;
   html+=`<div class="craft-card"><h4>${ITEMS[ore].icon} ${ITEMS[ore].name} → ${ITEMS[bar].icon} ${ITEMS[bar].name}</h4><p>Have: ${S.inv[ore]||0} • +${xp} XP</p><button data-smelt="${ore}|${bar}|${xp}">Smelt 1</button></div>`;
  }
  b.innerHTML=html;
  const bb=$('smelt-bronze');if(bb)bb.onclick=()=>{
   if((S.inv['copper_ore']||0)<1||(S.inv['tin_ore']||0)<1){toast('Need 1 copper + 1 tin!');return;}
   removeItem('copper_ore',1);removeItem('tin_ore',1);addItem('bronze_bar',1);addXP('smithing',25);S.stats.smelt_bronze++;checkQuests();openStation(kind);
  };
  b.querySelectorAll('[data-smelt]').forEach(btn=>btn.onclick=()=>{const [ore,bar,xp]=btn.dataset.smelt.split('|');if(!removeItem(ore,1)){toast('No ore!');return;}addItem(bar,1);addXP('smithing',+xp);openStation(kind);});
 } else if(kind==='smith'||kind==='anvil'){
  const recipes=[['bronze_bar',2,'bronze_sword',40,'Bronze Sword (+4 dmg)'],['bronze_bar',3,'oak_bow',45,'Oak Bow (+5)'],['iron_bar',2,'iron_sword',70,'Iron Sword (+8 dmg)'],['iron_bar',3,'steel_sword',110,'Steel Sword (+13 dmg, req Smith 20)']];
  let html=`<div class="quest-card"><h4>⚒️ Smithing (Anvil)</h4><p>Forge bars into weapons. Equip in Hero tab.</p></div>`;
  for(const [bar,cost,out,xp,label] of recipes){
   html+=`<div class="craft-card"><h4>${label}</h4><p>Needs ${cost}x ${ITEMS[bar].name} (have ${S.inv[bar]||0}) • +${xp} XP</p><button data-forge="${bar}|${cost}|${out}|${xp}">Forge</button></div>`;
  }
  b.innerHTML=html;
  b.querySelectorAll('[data-forge]').forEach(btn=>btn.onclick=()=>{
   const [bar,cost,out,xp]=btn.dataset.forge.split('|');
   if(out==='steel_sword'&&skillLevel('smithing')<20){toast('Need Smithing 20!');return;}
   if((S.inv[bar]||0)<+cost){toast('Not enough bars!');return;}
   removeItem(bar,+cost);addItem(out,1);addXP('smithing',+xp);sfx('place');openStation(kind);
  });
 } else { // workbench / craft
  let html=`<div class="quest-card"><h4>🪓 Workbench</h4><p>Craft building supplies.</p></div>`;
  html+=`<div class="craft-card"><h4>🪵 2 Logs → 🪟 Plank set (build material)</h4><p>Logs: ${S.inv['logs']||0}</p><button id="craft-plank">Craft (2 logs → +10 Construction XP)</button></div>`;
  html+=`<div class="craft-card"><h4>🕯️ Torch (light)</h4><p>Place via Build menu. Cost 1 log.</p></div>`;
  b.innerHTML=html;
  $('craft-plank').onclick=()=>{if(!removeItem('logs',2)){toast('Need 2 logs!');return;}addItem('plank',1);addXP('construction',10);openStation(kind);};
 }
}

// ============ UI ============
let panelTab=null;
document.querySelectorAll('.toolbtn').forEach(b=>b.onclick=()=>{
 const tab=b.dataset.tab;
 if(panelTab===tab&&!$('side-panel').classList.contains('hidden')){closePanel();return;}
 panelTab=tab;openPanel(tab);
});
$('panel-close').onclick=closePanel;
function openPanel(tab){
 if(tab.startsWith('station:')){/* already set */}
 else panelTab=tab;
 $('side-panel').classList.remove('hidden');
 $('panel-title').textContent=tab==='inventory'?'🎒 Backpack':tab==='skills'?'🌟 Skills':tab==='craft'?'⚒️ Crafting':tab==='build'?'🏠 Building':tab==='quests'?'❗ Quests':tab==='character'?'🧙 Hero':tab==='help'?'❓ Help':tab==='npc'?'💬 Talk':'⚙️ Station';
 renderPanel();
}
function closePanel(){$('side-panel').classList.add('hidden');panelTab=null;document.querySelectorAll('.toolbtn').forEach(b=>b.classList.remove('active'));}
function renderPanel(){
 const b=$('panel-body');
 const tab=panelTab;
 if(!tab)return;
 if(tab==='inventory'){
  let html='<div class="inv-grid">';
  const ids=Object.keys(S.inv);
  if(!ids.length)html+='<p>Empty… chop, mine & loot!</p>';
  for(const id of ids){
   const it=ITEMS[id]||{name:id,icon:'📦'};
   html+=`<div class="inv-slot"><b>${it.icon}</b><span>${it.name}</span><i>x${S.inv[id]}</i></div>`;
  }
  html+='</div><div class="inv-actions">';
  for(const id of ids){
   const it=ITEMS[id];
   if(it&&it.heal)html+=`<button data-eat="${id}">Eat ${it.icon}</button>`;
  }
  html+='</div><p style="color:#8fa0d8;font-size:12px">Gold: '+S.gold+' • Weapons equip in Hero tab.</p>';
  b.innerHTML=html;
  b.querySelectorAll('[data-eat]').forEach(btn=>btn.onclick=()=>{
   const id=btn.dataset.eat;if(!removeItem(id,1))return;
   S.hp=Math.min(S.maxHp,S.hp+ITEMS[id].heal);sfx('eat');spawnDmg(P.x,P.z,'+'+ITEMS[id].heal,'heal');updateHUD();renderPanel();save();
  });
 } else if(tab==='skills'){
  let html='';
  for(const sk of SKILLS){
   const xp=S.skills[sk.id].xp,lvl=levelFromXP(xp);
   const cur=xpNeed(lvl),next=xpNeed(Math.min(99,lvl+1));
   const pct=lvl>=99?100:clamp((xp-cur)/(next-cur)*100,0,100);
   html+=`<div class="skill-row"><div class="sic">${sk.icon}</div><div class="sinfo"><b>${sk.name} — Lvl ${lvl}</b> <small>${xp.toLocaleString()} XP</small><div class="xpbar"><div style="width:${pct}%"></div></div></div></div>`;
  }
  html+=`<p style="font-size:12px;color:#8fa0d8">Combat level ${combatLevel()} • XP curve mirrors RuneScape.</p>`;
  b.innerHTML=html;
 } else if(tab==='craft'){
  b.innerHTML=`<div class="quest-card"><h4>⚒️ Crafting stations</h4><p>Walk to a station and press ✋, or quick-craft here:</p>
  <button data-q="cook">🔥 Cook</button> <button data-q="smelt">♨️ Smelt</button> <button data-q="smith">⚒️ Forge</button> <button data-q="craft">🪓 Bench</button></div>
  <div class="quest-card"><h4>🍖 Quick-eat</h4><p>Consume cooked food to heal.</p></div>`;
  b.querySelectorAll('[data-q]').forEach(x=>x.onclick=()=>openStation(x.dataset.q));
 } else if(tab==='build'){
  let html='<div class="quest-card"><h4>🏠 Dragonwilds Building</h4><p>Pick a piece below (or top bar), then walk & press ✋ to place. Rotate with ↻.</p></div>';
  for(const [id,def] of Object.entries(BUILD_DEFS)){
   const th=thumbFor(id);
   html+=`<div class="craft-card build-card">${th?`<img class="build-thumb" src="${th}" alt="${def.name}">`:`<div class="build-thumb build-emoji">${BUILD_ICON[id]||'🏠'}</div>`}<div class="build-info"><h4>${def.name}</h4><p>Cost: ${costText(id)} • +${def.xp} XP</p><button data-b="${id}">Select</button></div></div>`;
  }
  b.innerHTML=html;
  b.querySelectorAll('[data-b]').forEach(x=>x.onclick=()=>{setBuildMode(x.dataset.b);closePanel();$('build-bar').classList.remove('hidden');});
 } else if(tab==='quests'){
  let html='';
  for(const q of QUESTS){
   const st=questStage(q.id);
   const cls=st.stage==='done'?'q-done':(st.stage==='active'||st.stage==='turnin')?'q-active':'';
   const label=st.stage==='avail'?'❗ Available':st.stage==='active'?'📜 Active':st.stage==='turnin'?'❓ Return!':'✔ Done';
   html+=`<div class="quest-card ${cls}"><h4>${label} — ${q.name}</h4><p>${q.desc}</p><p><i>${q.giver}</i> • Reward: ${q.reward.gold||0}g</p></div>`;
  }
  b.innerHTML=html;
 } else if(tab==='character'){
  const c=CLASSES[S.cls];
  let html=`<div class="quest-card"><h4>🧙 ${c.name} — Combat ${combatLevel()}</h4><p>HP ${Math.round(S.hp)}/${S.maxHp} • Mana ${Math.round(S.mana)}/${S.maxMana}</p><p>Weapon dmg +${S.weaponDmg} (${S.equip.weapon?ITEMS[S.equip.weapon].name:'fists'})</p></div>`;
  html+='<div class="quest-card"><h4>🗡️ Weapons</h4>';
  let hasW=false;
  for(const id of Object.keys(S.inv)){
   if(ITEMS[id]&&ITEMS[id].dmg){hasW=true;html+=`<div class="char-row">${ITEMS[id].icon} ${ITEMS[id].name} (+${ITEMS[id].dmg}) x${S.inv[id]} <button data-eq="${id}">${S.equip.weapon===id?'Equipped':'Equip'}</button></div>`;}
  }
  if(!hasW)html+='<p>No weapons yet — forge at Anvil!</p>';
  html+='</div><div class="quest-card"><h4>🔄 Class</h4><button data-cls="warrior">Warrior</button> <button data-cls="ranger">Ranger</button> <button data-cls="mage">Mage</button></div>';
  html+='<div class="quest-card"><h4>💾 Save</h4><button id="btn-save">Save</button> <button id="btn-wipe">New game (wipe)</button></div>';
  b.innerHTML=html;
  b.querySelectorAll('[data-eq]').forEach(x=>x.onclick=()=>{S.equip.weapon=x.dataset.eq;recalcVitals();refreshPlayerWeapon();sfx('coin');renderPanel();save();});
  b.querySelectorAll('[data-cls]').forEach(x=>x.onclick=()=>{S.cls=x.dataset.cls;applyClass();recalcVitals();S.hp=Math.min(S.hp,S.maxHp);S.mana=Math.min(S.mana,S.maxMana);updateHUD();renderPanel();save();toast('Class: '+S.cls);});
  $('btn-save').onclick=()=>{save();toast('Saved!');};
  $('btn-wipe').onclick=()=>{localStorage.removeItem('wilds-save-v1');location.reload();};
 } else if(tab==='help'){
  b.innerHTML=`<div class="quest-card"><h4>❓ How to play</h4>
  <p>🎯 <b>WoW side:</b> grab quests (!), follow tracker, kill wolves/goblins, beat the dragon NE.</p>
  <p>🌲 <b>Dragonwilds side:</b> chop/mine/fish (walk up + ✋ hold), cook at 🔥, smelt at ♨️, forge at ⚒️, build base via 🏠.</p>
  <p>⚔️ <b>Combat:</b> ⚔️ attack, 🔥/🌀 abilities, 💨 dodge-roll (invincible!), 🍖 eat to heal.</p>
  <p>📱 <b>Mobile:</b> left stick move, drag right to look, pinch-less zoom via wheel on PC.</p>
  <p>⌨️ <b>PC:</b> WASD, mouse-drag look, J attack, Q/R spells, E interact, Space jump, Shift dodge.</p></div>`;
 }
}
function applyClass(){
 const c=CLASSES[S.cls];
 $('spell1-icon').textContent=c.spell1.icon;
 $('spell2-icon').textContent=c.spell2.icon;
 refreshPlayerWeapon();
}
function setEmissive(root,hex){root.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive)o.material.emissive.setHex(hex);});}
function bossReact(e){
 if(e.hp<e.maxHp*0.5&&!e.enraged){e.enraged=true;e.speed+=1.2;e.dmg+=5;toast('🐉 Malachar is ENRAGED!');ringEffect(e.x,e.z,0xff1744);sfx('fire');}
 else if(e.hp<e.maxHp*0.25&&!e.frenzy){e.frenzy=true;e.cd=0;sfx('fire');}
}
function toast(msg,ms=2600){
 const d=document.createElement('div');d.className='toast';d.textContent=msg;
 $('toast-layer').appendChild(d);
 setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .4s';setTimeout(()=>d.remove(),400);},ms);
}
function showLevelBanner(title,sub){
 $('levelup-title').textContent=title;$('levelup-sub').textContent=sub||'';
 $('levelup-banner').classList.remove('hidden');
 clearTimeout(showLevelBanner._t);
 showLevelBanner._t=setTimeout(()=>$('levelup-banner').classList.add('hidden'),2200);
}
function onLevelUp(skill,lvl){
 const sk=SKILLS.find(s=>s.id===skill);
 showLevelBanner('Level Up!',`${sk.icon} ${sk.name} — Level ${lvl}`);
 sfx('level');
 spawnDmg(P.x,P.z,`${sk.icon} ${lvl}`,'xp');
 if(skill==='hitpoints'){S.hp=S.maxHp;}
}
function spawnDmg(x,z,text,kind='enemy'){
 // project 3D -> screen
 const v=new THREE.Vector3(x,terrainH(x,z)+2.2,z).project(camera);
 if(v.z>1)return;
 const sx=(v.x*0.5+0.5)*innerWidth,sy=(-v.y*0.5+0.5)*innerHeight;
 const d=document.createElement('div');d.className='dmg '+kind;d.textContent=text;
 d.style.left=(sx+rand(-20,20))+'px';d.style.top=sy+'px';
 $('damage-layer').appendChild(d);
 setTimeout(()=>d.remove(),950);
}
function spawnXPText(skill,amt){
 // lightweight: only for notable gains
 if(amt<10)return;
 const v=new THREE.Vector3(P.x,terrainH(P.x,P.z)+2.4,P.z).project(camera);
 if(v.z>1)return;
 const sx=(v.x*0.5+0.5)*innerWidth,sy=(-v.y*0.5+0.5)*innerHeight;
 const d=document.createElement('div');d.className='dmg xp';d.textContent=`+${amt} ${skill}`;
 d.style.left=sx+'px';d.style.top=sy+'px';
 $('damage-layer').appendChild(d);setTimeout(()=>d.remove(),900);
}
function ringEffect(x,z,color){
 const m=new THREE.Mesh(new THREE.RingGeometry(0.5,1.6,20),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9,side:THREE.DoubleSide}));
 m.rotation.x=-Math.PI/2;m.position.set(x,terrainH(x,z)+0.15,z);scene.add(m);
 let t=0;const iv=setInterval(()=>{t+=0.06;m.scale.setScalar(1+t*2);m.material.opacity=0.9-t;if(t>0.9){clearInterval(iv);scene.remove(m);}},30);
}
function updateHUD(){
 $('hp-fill').style.transform=`scaleX(${clamp(S.hp/S.maxHp,0,1)})`;
 $('mana-fill').style.transform=`scaleX(${clamp(S.mana/S.maxMana,0,1)})`;
 $('stam-fill').style.transform=`scaleX(${clamp(S.stam/100,0,1)})`;
 $('hp-text').textContent=`${Math.ceil(S.hp)}/${S.maxHp}`;
 $('mana-text').textContent=`${Math.ceil(S.mana)}/${S.maxMana}`;
 $('combat-level').textContent=combatLevel();
 $('gold-val').textContent=S.gold;
 // cooldown overlays
 $('spell1-cd').textContent=S.cd1>0?Math.ceil(S.cd1):'';
 $('spell2-cd').textContent=S.cd2>0?Math.ceil(S.cd2):'';
 // target
 if(target&&target.alive){
  $('target-frame').classList.remove('hidden');
  $('target-name').textContent=`${target.boss?'🐉 ':''}${target.name} ${Math.ceil(target.hp)}/${target.maxHp}`;
  $('target-hp-fill').style.transform=`scaleX(${clamp(target.hp/target.maxHp,0,1)})`;
 } else $('target-frame').classList.add('hidden');
}
function renderTracker(){
 const el=$('quest-tracker-list');let html='';
 let n=0;
 for(const q of QUESTS){
  const st=questStage(q.id);
  if(st.stage==='active'||st.stage==='turnin'){
   n++;
   const prog=Object.entries(q.need).map(([k,v])=>`${Math.min(st.progress[k]||S.stats[k]||0,v)}/${v}`).join(', ');
   html+=`<div>${st.stage==='turnin'?'❓':'📜'} ${q.name} <small>(${prog})</small></div>`;
  }
 }
 el.innerHTML=n?html:'<div style="opacity:.6">No quests — find ❗ NPCs!</div>';
}

// ============ Save ============
function save(){
 try{
  localStorage.setItem('wilds-save-v1',JSON.stringify({cls:S.cls,hp:S.hp,mana:S.mana,gold:S.gold,inv:S.inv,skills:S.skills,quests:S.quests,stats:S.stats,buildings:S.buildings,equip:S.equip,pos:{x:P.x,z:P.z},time:S.time}));
 }catch(e){}
}
function load(){
 try{
  const raw=localStorage.getItem('wilds-save-v1');
  if(!raw)return false;
  const d=JSON.parse(raw);
  S.cls=d.cls||'warrior';S.gold=d.gold||0;S.inv=d.inv||{};S.skills=d.skills||S.skills;S.quests=d.quests||{};S.stats={...S.stats,...(d.stats||{})};S.equip=d.equip||{weapon:null};S.time=d.time||8;
  P.x=d.pos?d.pos.x:0;P.z=d.pos?d.pos.z:13;
  // restore buildings
  for(const bd of (d.buildings||[])){
   const mesh=makeBuildMesh(bd.kind,false);
   mesh.position.set(bd.x,terrainH(bd.x,bd.z),bd.z);mesh.rotation.y=bd.rot||0;scene.add(mesh);
   buildings3d.push({kind:bd.kind,x:bd.x,z:bd.z,mesh,use:BUILD_DEFS[bd.kind].use||null});
   S.buildings.push(bd);
  }
  return true;
 }catch(e){return false;}
}

// ============ Class select ============
let selectedClass='warrior';
document.querySelectorAll('.class-card').forEach(c=>c.onclick=()=>{
 document.querySelectorAll('.class-card').forEach(x=>x.classList.remove('sel'));
 c.classList.add('sel');selectedClass=c.dataset.class;
});
document.querySelector('.class-card[data-class="warrior"]').classList.add('sel');
$('btn-new-game').onclick=()=>{
 // fresh start: wipe prior progress (buildings, skills, quests)
 for(const b of buildings3d)scene.remove(b.mesh);
 buildings3d.length=0;
 for(const sk of SKILLS)S.skills[sk.id]={xp:0};
 S.quests={};S.stats={kill_wolf:0,kill_goblin:0,kill_cultist:0,kill_dragon:0,item_logs:0,mine_copper:0,smelt_bronze:0,catch_fish:0,cook_food:0};
 S.inv={logs:3,cooked_shrimp:2};S.gold=20;S.equip={weapon:null};S.buildings=[];S.time=8;S.won=false;S.dead=false;
 try{localStorage.removeItem('wilds-save-v1');}catch(e){}
 P.x=0;P.z=13;P.faceYaw=-Math.PI/2;camYaw=0;
 S.cls=selectedClass;S.started=true;
 recalcVitals();S.hp=S.maxHp;S.mana=S.maxMana;S.stam=100;
 applyClass();updateHUD();renderTracker();
 $('class-modal').style.display='none';
 toast(`Welcome, ${CLASSES[S.cls].name}! Talk to ❗ NPCs in the village.`);
 sfx('quest');
 save();
};
if(load()){
 $('btn-continue').classList.remove('hidden');
 $('btn-continue').onclick=()=>{
  S.cls=S.cls||selectedClass;S.started=true;
  recalcVitals();S.hp=S.maxHp;S.mana=S.maxMana;
  applyClass();updateHUD();renderTracker();
  $('class-modal').style.display='none';
  toast('Welcome back, hero!');
 };
}

// build bar picks
document.querySelectorAll('.buildpick').forEach(b=>b.onclick=()=>setBuildMode(b.dataset.build===buildMode?null:b.dataset.build));

// ============ Minimap ============
const mm=$('minimap').getContext('2d');
let mmT=0;
function drawMinimap(){
 mm.clearRect(0,0,120,120);
 mm.fillStyle='#0e1a33';mm.beginPath();mm.arc(60,60,58,0,7);mm.fill();
 mm.save();mm.beginPath();mm.arc(60,60,56,0,7);mm.clip();
 const sc=120/150;
 const px=(x)=>(x+75)*sc, pz=(z)=>(z+75)*sc;
 // dragon crater
 mm.fillStyle='#5d1010';mm.beginPath();mm.arc(px(46),pz(46),12,0,7);mm.fill();
 // trees
 mm.fillStyle='#2e7d32';
 for(const t of trees){if(!t.alive)continue;mm.fillRect(px(t.x)-1,pz(t.z)-1,2,2);}
 // enemies red
 mm.fillStyle='#ff5252';
 for(const e of enemies){if(!e.alive)continue;mm.beginPath();mm.arc(px(e.x),pz(e.z),e.boss?4:2,0,7);mm.fill();}
 // npcs yellow
 mm.fillStyle='#ffd54a';
 for(const n of npcs){mm.beginPath();mm.arc(px(n.x),pz(n.z),2.5,0,7);mm.fill();}
 // player white arrow
 mm.fillStyle='#fff';
 mm.save();mm.translate(px(P.x),pz(P.z));mm.rotate(-P.faceYaw+Math.PI/2+camYaw*0);mm.fillRect(-2,-4,4,8);mm.restore();
 mm.restore();
}

// ============ Main loop ============
const clock=new THREE.Clock();
let elapsed=0;
function collide(nx,nz){
 for(const c of colliders){
  const d=dist2(nx,nz,c.x,c.z);
  if(d<c.r+0.4){const a=Math.atan2(nz-c.z,nx-c.x);nx=c.x+Math.cos(a)*(c.r+0.4);nz=c.z+Math.sin(a)*(c.r+0.4);}
 }
 // world bounds
 const dd=Math.hypot(nx,nz);
 if(dd>70){nx*=70/dd;nz*=70/dd;}
 return [nx,nz];
}
function updatePlayer(dt){
 // input vector
 let ix=0,iz=0;
 if(keys['KeyW']||keys['ArrowUp'])iz-=1;
 if(keys['KeyS']||keys['ArrowDown'])iz+=1;
 if(keys['KeyA']||keys['ArrowLeft'])ix-=1;
 if(keys['KeyD']||keys['ArrowRight'])ix+=1;
 ix+=joy.x;iz+=joy.y;
 const l=Math.hypot(ix,iz);
 if(l>1){ix/=l;iz/=l;}
 const moving=l>0.15;
 // camera-relative
 const sin=Math.sin(camYaw),cos=Math.cos(camYaw);
 let wx=ix*cos-iz*sin, wz=ix*sin+iz*cos;
 // wait: standard third person: forward = -Z rotated by yaw. Let's define:
 // forward vector = (sin(yaw)? ) — simpler: use camYaw as orbit angle
 // recompute properly:
 const fwdX=-Math.sin(camYaw),fwdZ=-Math.cos(camYaw);
 const rightX=-fwdZ,rightZ=fwdX;
 wx=rightX*ix+fwdX*(-iz);
 wz=rightZ*ix+fwdZ*(-iz);
 const speed=P.rollT>0?9:(moving?5.6:0);
 if(moving&&gather.active&&l>0.3)stopGather();
 if(!S.dead){
  let nx=P.x+wx*speed*dt,nz=P.z+wz*speed*dt;
  [nx,nz]=collide(nx,nz);
  // water block (slow)
  const h=terrainH(nx,nz);
  if(h<-0.1){nx=P.x;nz=P.z;}
  P.x=nx;P.z=nz;
  if(moving){P.faceYaw=Math.atan2(wz,wx);P.walkPhase+=dt*10;}
 }
 // gravity/jump
 const gy=terrainH(P.x,P.z);
 if(P.grounded){
  P.y=gy;
  if(keys['Space']){doJump();keys['Space']=false;}
 } else {
  P.vy-=18*dt;P.y+=P.vy*dt;
  if(P.y<=gy){P.y=gy;P.grounded=true;P.vy=0;}
 }
 // timers
 P.rollT=Math.max(0,P.rollT-dt);P.rollCD=Math.max(0,P.rollCD-dt);
 P.attackT=Math.max(0,P.attackT-dt);P.swingT=Math.max(0,P.swingT-dt);
 P.ifalias=Math.max(0,P.ifalias-dt);
 S.cd1=Math.max(0,S.cd1-dt);S.cd2=Math.max(0,S.cd2-dt);
 S.stam=clamp(S.stam+dt*12,0,100);
 S.mana=clamp(S.mana+dt*6,0,S.maxMana);
 // mesh — rig faces +Z, so yaw +Z onto the movement direction
 playerGroup.position.set(P.x,P.y,P.z);
 playerGroup.rotation.y=Math.PI/2-P.faceYaw;
 playerGroup.rotation.x=0;
 // ---- procedural animation (shoulder/hip pivots) ----
 const t=performance.now()*0.001;
 P.hurtT=Math.max(0,P.hurtT-dt);
 const br=Math.sin(t*2.2)*0.02; // idle breathing
 pBody.scale.set(1+br*0.4,1+br,1+br*0.4);
 if(P.rollT>0){ // dodge roll: tuck & backflip
  rig.rotation.x=-(1-P.rollT/0.45)*Math.PI*2;
  pLegLp.rotation.x=1.3;pLegRp.rotation.x=1.3;
  pArmLp.rotation.x=1.0;pArmRp.rotation.x=1.0;
  playerGroup.position.y+=0.15;
 } else {
  rig.rotation.x=(moving?0.1:0)+(P.hurtT>0?-0.5*P.hurtT:0);
  rig.position.y=moving?Math.abs(Math.sin(P.walkPhase))*0.07:Math.sin(t*2.2)*0.015;
  if(moving){
   const s=Math.sin(P.walkPhase);
   pLegLp.rotation.x=s*0.8;pLegRp.rotation.x=-s*0.8;
   pArmLp.rotation.x=-s*0.65;pArmLp.rotation.z=0.1;
   if(P.swingT<=0&&!gather.active){pArmRp.rotation.x=s*0.65;pArmRp.rotation.z=-0.1;}
   pHead.rotation.x=0.08;pHead.rotation.y=Math.sin(P.walkPhase*0.5)*0.07;
  } else {
   pLegLp.rotation.x*=0.85;pLegRp.rotation.x*=0.85;
   pArmLp.rotation.x=Math.sin(t*2.2)*0.07;pArmLp.rotation.z=0.1;
   if(P.swingT<=0&&!gather.active){pArmRp.rotation.x=Math.sin(t*2.2+1)*0.07;pArmRp.rotation.z=-0.1;}
   pHead.rotation.x=0;pHead.rotation.y=Math.sin(t*0.55)*0.18;
  }
  if(!P.grounded){pLegLp.rotation.x=0.6;pLegRp.rotation.x=-0.4;pArmLp.rotation.z=1.0;pArmRp.rotation.z=-1.0;pArmLp.rotation.x=-0.5;pArmRp.rotation.x=-0.5;}
 }
 if(gather.active){ // rhythmic overhead chop / mine swing
  const c=Math.abs(Math.sin(performance.now()*0.011));
  pArmRp.rotation.x=-2.5+c*1.7;pArmRp.rotation.z=-0.05;
 }
 if(P.swingT>0){ // combo flourishes + arc flash (slash arc only for melee)
  const sw=1-P.swingT/0.3;
  const isMeleeSwing=S.cls==='warrior'||(S.equip.weapon&&S.equip.weapon.includes('sword'));
  pTrail.material.opacity=isMeleeSwing?0.7*(1-sw):0;
  pTrail.rotation.z=Math.PI*0.12+sw*1.6;
  if(P.combo===1){pArmRp.rotation.x=-1.7+sw*1.3;pArmRp.rotation.z=-0.6+sw*1.1;}
  else if(P.combo===2){pArmRp.rotation.x=-2.7+sw*2.3;pArmRp.rotation.z=0;}
  else {pArmRp.rotation.x=-1.3+sw*0.7;pArmRp.rotation.z=-0.15;rig.position.z=sw*0.3;}
 } else {pTrail.material.opacity=Math.max(0,pTrail.material.opacity-dt*5);rig.position.z*=0.8;}
 // camera
 const cx=P.x+Math.sin(camYaw)*Math.cos(camPitch)*camDist;
 const cz=P.z+Math.cos(camYaw)*Math.cos(camPitch)*camDist;
 const cy=P.y+2+Math.sin(camPitch)*camDist;
 camera.position.lerp(new THREE.Vector3(cx,Math.max(cy,terrainH(cx,cz)+1),cz),0.2);
 camera.lookAt(P.x,P.y+1.6,P.z);
 sun.position.set(P.x+30*Math.cos(elapsed*0.02),40,P.z+30*Math.sin(elapsed*0.02));
}
function updateEnemies(dt){
 // pick target = nearest alive enemy for UI
 let bestT=null,bd=10;
 for(const e of enemies){
  if(!e.alive)continue;
  const d=dist2(P.x,P.z,e.x,e.z);
  if(d<bd){bd=d;bestT=e;}
 }
 target=bd<9?bestT:null;
 for(const e of enemies){
  if(!e.alive){
   if(e.dying>0){ // death throes: tip over & sink, then remove
    e.dying-=dt;
    e.mesh.rotation.z=Math.min(Math.PI/2,e.mesh.rotation.z+dt*5);
    e.mesh.position.y-=dt*0.35;
    if(e.dying<=0&&e.mesh.parent)scene.remove(e.mesh);
   }
   continue;
  }
  const d=dist2(P.x,P.z,e.x,e.z);
  e.cd=Math.max(0,e.cd-dt);
  e.atkT=Math.max(0,(e.atkT||0)-dt);
  e.flashT=Math.max(0,(e.flashT||0)-dt);
  if(e.flashT>0&&!e._fl){e._fl=true;setEmissive(e.mesh,0x993300);}
  else if(e.flashT<=0&&e._fl){e._fl=false;setEmissive(e.mesh,0x000000);}
  // face player when chasing
  if(e.state==='idle'){
   e.wt-=dt;
   const homeD0=dist2(e.x,e.z,e.home.x,e.home.z);
   const playerSafe=Math.hypot(P.x,P.z)<15&&!e.boss;
   if(!playerSafe&&d< (e.boss?22:11))e.state='chase';
   else if(homeD0>8){ // leash home
    const hd=Math.atan2(e.home.z-e.z,e.home.x-e.x);
    e.x+=Math.cos(hd)*e.speed*0.5*dt;e.z+=Math.sin(hd)*e.speed*0.5*dt;
    e.mesh.position.set(e.x,terrainH(e.x,e.z),e.z);e.mesh.lookAt(e.home.x,e.mesh.position.y,e.home.z);
   }
   else if(e.wt<=0){e.wt=rand(2,5);e.wanderA=rand(0,Math.PI*2);}
   else if(e.wanderA!==undefined){e.x+=Math.cos(e.wanderA)*e.speed*0.3*dt;e.z+=Math.sin(e.wanderA)*e.speed*0.3*dt;e.mesh.position.set(e.x,terrainH(e.x,e.z),e.z);e.mesh.rotation.y=Math.atan2(Math.cos(e.wanderA),Math.sin(e.wanderA));}
  } else if(e.state==='chase'){
   const homeD=dist2(e.x,e.z,e.home.x,e.home.z);
   const pSafe=Math.hypot(P.x,P.z)<14&&!e.boss;
   if(d>(e.boss?30:22)||homeD>30||pSafe||(Math.hypot(e.x,e.z)<10&&!e.boss)){e.state='idle';}
   else if(d<e.range){
    // attack
    e.mesh.lookAt(P.x,e.mesh.position.y,P.z);
    if(e.cd<=0){
     e.cd=e.boss?1.4:1.8;e.atkT=0.35;
     if(e.ranged){ // cultist bolt
      const dir=Math.atan2(P.z-e.z,P.x-e.x);
      spawnProjectile('enemybolt',e.x,e.z,dir,12,e.dmg,'enemy');sfx('shoot');
     } else if(e.boss){
      // boss: random breath or bite
      if(Math.random()<0.5){ // fire breath: cone damage if close + visual
       damagePlayer(e.dmg+6,'dragon');ringEffect(P.x,P.z,0xff5722);sfx('fire');
       // breath projectiles
       for(let i=-2;i<=2;i++)spawnProjectile('fireball',e.x,e.z,Math.atan2(P.z-e.z,P.x-e.x)+i*0.15,10,10,'enemy');
      } else {damagePlayer(e.dmg,'dragon');}
     } else {damagePlayer(e.dmg,'enemy');}
    }
   } else {
    const dir=Math.atan2(P.z-e.z,P.x-e.x);
    e.x+=Math.cos(dir)*e.speed*dt;e.z+=Math.sin(dir)*e.speed*dt;
    e.mesh.position.set(e.x,terrainH(e.x,e.z),e.z);
    e.mesh.lookAt(P.x,e.mesh.position.y,P.z);
    // walk bob
    e.mesh.position.y+=Math.abs(Math.sin(performance.now()*0.01))*0.05;
   }
  }
  // ---- creature animation ----
  const now=performance.now()*0.001;
  if(e.anim&&e.anim.legs)for(let li=0;li<e.anim.legs.length;li++){
   const L=e.anim.legs[li];
   if(e.state==='chase'&&d>e.range)L.rotation.x=Math.sin(now*11+li*Math.PI)*0.65;
   else L.rotation.x*=0.85;
  }
  if(e.anim&&e.anim.tail)e.anim.tail.rotation.y=Math.sin(now*2.1+e.x)*0.35;
  if(e.type==='goblin'&&e.anim&&e.anim.clubPivot)e.anim.clubPivot.rotation.x=e.atkT>0?-2.2*e.atkT/0.35:-0.15+Math.sin(now*3)*0.06;
  if(e.type==='wolf'&&e.anim&&e.anim.head)e.anim.head.position.y=0.85+(e.atkT>0?-0.18:Math.sin(now*3)*0.03);
  if(e.ranged)e.mesh.position.y=terrainH(e.x,e.z)+0.15+Math.sin(now*2.6+e.z)*0.1; // cultist hover
  if(e.boss&&e.anim){
   const w=Math.sin(now*4.5)*0.45;
   e.anim.wingL.rotation.z=0.25+w;e.anim.wingR.rotation.z=-0.25-w;
   if(e.anim.jaw)e.anim.jaw.position.y=2.62+(e.atkT>0?-0.2*e.atkT/0.35:Math.sin(now*1.3)*0.03);
  }
  // hp bar faces camera
  e.bar.lookAt(camera.position);
 }
}
function updateProjectiles(dt){
 for(let i=projectiles.length-1;i>=0;i--){
  const p=projectiles[i];
  p.life-=dt;
  p.x+=Math.cos(p.dir)*p.speed*dt;
  p.z+=Math.sin(p.dir)*p.speed*dt;
  const gy=terrainH(p.x,p.z);
  if(p.kind==='arrow')p.y-=dt*2;
  p.mesh.position.set(p.x,gy+p.y,p.z);
  p.mesh.rotation.y=-p.dir;
  let dead=p.life<=0||Math.hypot(p.x,p.z)>75;
  if(!dead){
   if(p.from==='player'){
    for(const e of enemies){
     if(!e.alive)continue;
     if(dist2(p.x,p.z,e.x,e.z)<(e.boss?2.2:1.0)){damageEnemy(e,p.dmg,p.kind==='fireball'?'magic':'ranged');if(p.kind==='fireball')ringEffect(p.x,p.z,0xff6d00);dead=true;break;}
    }
   } else {
    if(dist2(p.x,p.z,P.x,P.z)<0.9){damagePlayer(p.dmg,'proj');dead=true;}
   }
   // hit terrain
   if(p.y+gy<gy+0.1&&p.kind==='arrow')dead=true;
  }
  if(dead){scene.remove(p.mesh);projectiles.splice(i,1);}
 }
}
function updateWorld(dt){
 elapsed+=dt;
 // day/night
 S.time=(S.time+dt*0.15)%24;
 const hr=Math.floor(S.time),mn=Math.floor((S.time-hr)*60);
 $('clock-val').textContent=`${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
 const night=S.time<6||S.time>19;
 const dayF=night?0.25:1;
 sun.intensity=night?0.35:1.6;
 hemi.intensity=night?0.3:0.9;
 scene.background.setHex(night?0x0b1020:0x87b5e5);
 scene.fog.color.setHex(night?0x0b1020:0x9fc3e8);
 // torches flicker
 for(const t of torches){if(t.flame){t.flame.scale.setScalar(1+Math.sin(performance.now()*0.01+t.phase)*0.15);}if(t.light)t.light.intensity=6+Math.sin(performance.now()*0.012+t.phase)*2;}
 // respawns
 for(const t of trees){if(!t.alive){t.respawn-=dt;if(t.respawn<=0){t.alive=true;t.hp=3;t.mesh.visible=true;}}}
 for(const r of rocks){if(!r.alive){r.respawn-=dt;if(r.respawn<=0){r.alive=true;r.hp=r.ore?4:2;r.mesh.visible=true;}}}
 for(const f of fishSpots){if(f.stock<=0){f.respawn-=dt;if(f.respawn<=0)f.stock=5;}f.mesh.rotation.y+=dt*0.5;f.mesh.userData.bob.position.y=0.4+Math.sin(performance.now()*0.003+f.x)*0.15;}
 // ghost follow
 if(buildMode&&ghostMesh){
  const gx=Math.round(P.x+Math.cos(P.faceYaw)*2.5),gz=Math.round(P.z+Math.sin(P.faceYaw)*2.5);
  ghostMesh.position.set(gx,terrainH(gx,gz)+0.2,gz);
  ghostMesh.rotation.y=buildRot;
  const ok=terrainH(gx,gz)>0.25&&canAfford(buildMode);
  ghostMesh.traverse(o=>{if(o.isMesh&&o.material&&o.material.color)o.material.color.setHex(ok?0x00e676:0xff1744);});
  $('interact-prompt').textContent=`🏠 ${BUILD_DEFS[buildMode].name} — press ✋ to place (${costText(buildMode)})`;
  $('interact-prompt').classList.remove('hidden');
 } else {
  // interact prompt
  const it=S.started&&!S.dead?nearestInteract():null;
  if(it){
   let txt='✋ ';
   if(it.kind==='npc')txt+=`Talk to ${it.obj.name}`;
   else if(it.kind==='tree')txt+=`Chop ${it.obj.kind==='oak'?'Oak (15 WC)':'Tree'} — hold ✋`;
   else if(it.kind==='rock')txt+=`Mine ${it.obj.ore?it.obj.ore+' ore':'rock'} — hold ✋`;
   else if(it.kind==='fish')txt+=`Fish — hold ✋`;
   else if(it.kind.startsWith('station:'))txt+=`Use ${it.kind.split(':')[1]}`;
   $('interact-prompt').textContent=txt;$('interact-prompt').classList.remove('hidden');
  } else if(!gather.active)$('interact-prompt').classList.add('hidden');
 }
 // npcs: quest marker bob + face nearby players
 for(const n of npcs){
  n.mesh.userData.q.rotation.y+=dt*2;
  const hasQ=QUESTS.some(q=>q.giver===n.name&&(questStage(q.id).stage==='avail'||questStage(q.id).stage==='turnin'));
  n.mesh.userData.q.visible=hasQ;n.mesh.userData.q.material.color.setHex(questStageAvailTurnin(n)?0xffd54a:0x9e9e9e);
  if(S.started&&dist2(P.x,P.z,n.x,n.z)<7)n.mesh.lookAt(P.x,n.mesh.position.y,P.z);
  else {let dd=n.ry0-n.mesh.rotation.y;dd=((dd+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;n.mesh.rotation.y+=dd*Math.min(1,dt*3);}
 }
}
function questStageAvailTurnin(n){
 return QUESTS.some(q=>q.giver===n.name&&(questStage(q.id).stage==='avail'||questStage(q.id).stage==='turnin'));
}
function loop(){
 requestAnimationFrame(loop);
 const dt=Math.min(0.05,clock.getDelta());
 if(!S.started){renderer.render(scene,camera);return;}
 if(!S.dead){
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateGather(dt);
 }
 updateWorld(dt);
 updateHUD();
 mmT-=dt;if(mmT<=0){mmT=0.25;drawMinimap();}
 renderer.render(scene,camera);
}
// init camera behind spawn
P.x=0;P.z=13;P.faceYaw=-Math.PI/2;camYaw=0;
recalcVitals();S.maxHp=100;S.maxMana=100;S.hp=100;S.mana=100;S.weaponDmg=CLASSES[S.cls].melee;
applyClass();updateHUD();renderTracker();
camera.position.set(P.x+6,terrainH(P.x,P.z)+5,P.z+6);
camera.lookAt(P.x,2,P.z);
$('loading').style.display='none';
decorateBuildBar();
// starter toast loop to guide
setTimeout(()=>{if(!S.started)return;},1000);
loop();
// autosave
setInterval(()=>{if(S.started)save();},15000);
// prevent scroll/zoom gestures
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
