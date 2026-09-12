// docs/modules/literal-garden.js — Literal Garden v2: higher fidelity
// Tree of Life + seeds → trees watered over time (0/15/50/120/250)
// Uses global THREE r128 classic. No importmaps.

(function(){
  'use strict';

  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const STAGE_ORDER = ['seed','sprout','juvenile','adult','evolved'];
  const LIFECYCLE = {
    seed:     { energyThreshold: 0,   size: 0.50, glow: 0.30 },
    sprout:   { energyThreshold: 15,  size: 0.70, glow: 0.50 },
    juvenile: { energyThreshold: 50,  size: 0.85, glow: 0.70 },
    adult:    { energyThreshold: 120, size: 1.00, glow: 0.85 },
    evolved:  { energyThreshold: 250, size: 1.20, glow: 1.00 }
  };
  function stageFromEnergy(e){
    for(let i=STAGE_ORDER.length-1;i>=0;i--) if(e>=LIFECYCLE[STAGE_ORDER[i]].energyThreshold) return STAGE_ORDER[i];
    return 'seed';
  }
  const EMOTION_COLORS = {
    joy:{h:45,s:90,l:60}, trust:{h:140,s:70,l:45}, wonder:{h:270,s:80,l:55},
    love:{h:340,s:75,l:65}, calm:{h:200,s:60,l:55}, curiosity:{h:175,s:85,l:50},
    determination:{h:25,s:90,l:55}, sadness:{h:220,s:40,l:40}, neutral:{h:45,s:20,l:60}
  };
  const NAMES = ['Sophia','Lyra','Atlas','Ember','Harmonia'];
  const STORAGE_GROWTH = 'fl_literal_garden_v1';
  const STORAGE_EVOLUTION = 'fl_luminos_evolution';

  function readLegacyEnergies(){
    try{
      const raw=localStorage.getItem(STORAGE_EVOLUTION);
      if(!raw) return null;
      const j=JSON.parse(raw);
      if(j && Array.isArray(j.luminaries)) return j.luminaries;
      if(j && Array.isArray(j.luminos)) return j.luminos;
      if(Array.isArray(j)) return j;
    }catch(e){}
    return null;
  }

  let renderer, scene, camera, controls, rafId=null, paused=false;
  let containerEl=null, plants=[], treeOfLife=null, raycaster, mouse, watering=null, starMat=null;

  function plantPosition(index){
    const r = 2.1 + index * 0.62;
    const ang = index * GOLDEN_ANGLE + 0.9;
    return new THREE.Vector3(Math.cos(ang)*r, -1.2, Math.sin(ang)*r);
  }

  // ── Textures ──
  function makeBarkTexture(){
    const c=document.createElement('canvas'); c.width=256; c.height=512;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#3b2f1e'; ctx.fillRect(0,0,256,512);
    ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1;
    for(let x=0;x<256;x+=12){
      ctx.beginPath(); ctx.moveTo(x,0);
      for(let y=0;y<512;y+=8){
        ctx.lineTo(x + Math.sin(y*0.04 + x*0.12)*3, y);
      }
      ctx.stroke();
    }
    // knots
    ctx.fillStyle='rgba(0,0,0,0.22)';
    for(let i=0;i<6;i++){ const x=30+Math.random()*196, y=40+Math.random()*430, r=3+Math.random()*4; ctx.beginPath(); ctx.ellipse(x,y,r,r*1.4,0,0,Math.PI*2); ctx.fill(); }
    const tex=new THREE.CanvasTexture(c); tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1,1); tex.anisotropy=4;
    return tex;
  }

  function makeGroundTexture(){
    const c=document.createElement('canvas'); c.width=512; c.height=512;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(256,256,60,256,256,360);
    g.addColorStop(0,'#0f2118'); g.addColorStop(0.5,'#0a1a12'); g.addColorStop(1,'#07120e');
    ctx.fillStyle=g; ctx.fillRect(0,0,512,512);
    // furrows + pebbles
    ctx.strokeStyle='rgba(200,210,230,0.04)'; ctx.lineWidth=1;
    for(let y=0;y<512;y+=24){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(512,y+ (y%48?2:-2)); ctx.stroke(); }
    ctx.fillStyle='rgba(255,255,255,0.06)';
    for(let i=0;i<120;i++){ const x=Math.random()*512, y=Math.random()*512, r=Math.random()*1.2; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
    const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(4,4); tex.anisotropy=4;
    return tex;
  }

  // ── Tree of Life — higher fidelity, still phi ──
  function buildTreeOfLife(){
    const g=new THREE.Group();
    const barkTex=makeBarkTexture();
    const barkMat = new THREE.MeshStandardMaterial({ map:barkTex, color:0xffffff, roughness:0.82, metalness:0.03 });
    const darkBarkMat = new THREE.MeshStandardMaterial({ color:0x231a10, roughness:0.92, metalness:0.02 });
    // Main trunk — twisted segmented cylinders with slight lean
    for(let i=0;i<4;i++){
      const h=0.78 - i*0.08; const r0=0.36 - i*0.05; const r1=r0-0.055;
      const seg=new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 14), i===1?darkBarkMat:barkMat);
      seg.position.y = -1.2 + h/2 + i*0.66;
      seg.rotation.y = i*0.18; seg.rotation.z = Math.sin(i*1.1)*0.04;
      seg.castShadow=true; seg.receiveShadow=true; g.add(seg);
    }
    // Primary limbs — tube along curve, more organic
    for(let i=0;i<5;i++){
      const ang=i*GOLDEN_ANGLE;
      const p0=new THREE.Vector3(Math.cos(ang)*0.18, 0.95, Math.sin(ang)*0.18);
      const p1=new THREE.Vector3(Math.cos(ang)*0.42, 1.55, Math.sin(ang)*0.42);
      const p2=new THREE.Vector3(Math.cos(ang)*0.58, 1.92, Math.sin(ang)*0.58);
      const curve=new THREE.CatmullRomCurve3([p0,p1,p2]);
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.09, 8, false), barkMat);
      tube.castShadow=true; g.add(tube);
      // twig cluster
      const twigCurve=new THREE.CatmullRomCurve3([p2, new THREE.Vector3(Math.cos(ang+0.5)*0.72, 2.15, Math.sin(ang+0.5)*0.72)]);
      const twig=new THREE.Mesh(new THREE.TubeGeometry(twigCurve, 6, 0.045, 6, false), darkBarkMat);
      twig.castShadow=true; g.add(twig);
      // foliage cluster per limb tip
      const col=new THREE.Color().setHSL(140/360, 0.55+Math.random()*0.15, 0.48);
      const cluster=new THREE.Mesh(new THREE.IcosahedronGeometry(0.18+Math.random()*0.07,0), new THREE.MeshStandardMaterial({ color:col, roughness:0.62, metalness:0.04 }));
      cluster.position.copy(p2); cluster.position.y+=0.18; cluster.castShadow=true; g.add(cluster);
    }
    // Canopy — layered, denser, varied
    const layers=[
      {y:2.18, r:0.95, c:0x34d399, o:0.92},
      {y:2.42, r:0.78, c:0x6ee7b7, o:0.55},
      {y:2.62, r:0.52, c:0xa78bfa, o:0.18}
    ];
    layers.forEach(ly=>{
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(ly.r, 1), new THREE.MeshStandardMaterial({ color:ly.c, roughness:0.68, metalness:0.05, transparent:true, opacity:ly.o }));
      m.position.y=ly.y; m.castShadow=true; g.add(m);
      // scattered leaf puffs
      for(let i=0;i<3;i++){
        const ang=Math.random()*Math.PI*2, rad=ly.r*0.55*Math.random();
        const puff=new THREE.Mesh(new THREE.SphereGeometry(0.11,6,5), new THREE.MeshStandardMaterial({ color:ly.c, roughness:0.55 }));
        puff.position.set(Math.cos(ang)*rad, ly.y + (Math.random()-0.5)*0.18, Math.sin(ang)*rad);
        puff.scale.set(1.2,0.7,0.9); g.add(puff);
      }
    });
    // Surface roots — thicker, winding
    for(let i=0;i<5;i++){
      const ang=i*GOLDEN_ANGLE + 0.6;
      const rp0=new THREE.Vector3(Math.cos(ang)*0.32, -1.18, Math.sin(ang)*0.32);
      const rp1=new THREE.Vector3(Math.cos(ang)*0.75, -1.16, Math.sin(ang)*0.75);
      const rp2=new THREE.Vector3(Math.cos(ang)*1.05, -1.18, Math.sin(ang)*1.05);
      const rc=new THREE.CatmullRomCurve3([rp0,rp1,rp2]);
      const root=new THREE.Mesh(new THREE.TubeGeometry(rc, 8, 0.07, 7, false), darkBarkMat);
      root.castShadow=true; g.add(root);
    }
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.62, 1.05, 32), new THREE.MeshBasicMaterial({ color:0xe8b019, transparent:true, opacity:0.11, side:THREE.DoubleSide }));
    ring.rotation.x=-Math.PI/2; ring.position.y=-1.19; g.add(ring);
    // subtle ground moss disk under tree
    const moss=new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), new THREE.MeshStandardMaterial({ color:0x1a2e22, roughness:0.88, transparent:true, opacity:0.35 }));
    moss.rotation.x=-Math.PI/2; moss.position.y=-1.185; moss.receiveShadow=true; g.add(moss);
    return g;
  }

  function buildPlantMesh(stage, colorHSL){
    const g=new THREE.Group();
    const col = new THREE.Color().setHSL(colorHSL.h/360, colorHSL.s/100, colorHSL.l/100).getHex();
    const leafMat=new THREE.MeshStandardMaterial({ color:col, roughness:0.48, metalness:0.05 });
    const trunkMat=new THREE.MeshStandardMaterial({ color:0x4a3b24, roughness:0.88, metalness:0.02 });
    if(stage==='seed'){
      const seed=new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 9), new THREE.MeshStandardMaterial({ color:col, roughness:0.38, metalness:0.22, emissive:col, emissiveIntensity:0.28 }));
      seed.position.y=0.04; seed.castShadow=true; g.add(seed);
      // soil mound
      const mound=new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 6), new THREE.MeshStandardMaterial({ color:0x2a1f12, roughness:0.92 }));
      mound.scale.set(1,0.45,1); mound.position.y=0.02; g.add(mound);
      const pebble=new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), new THREE.MeshBasicMaterial({ color:0xe8b019, transparent:true, opacity:0.07, side:THREE.DoubleSide }));
      pebble.rotation.x=-Math.PI/2; pebble.position.y=0.006; g.add(pebble);
      return g;
    }
    if(stage==='sprout'){
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.052, 0.48, 7), trunkMat); stem.position.y=0.24; stem.castShadow=true; g.add(stem);
      for(let i=0;i<2;i++){
        const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), leafMat); leaf.scale.set(1.15,0.32,0.68);
        leaf.position.set(i?0.13:-0.13, 0.36, 0.03); leaf.rotation.z=i? -0.62 : 0.62; leaf.rotation.x=0.18; leaf.castShadow=true; g.add(leaf);
      }
      // cotyledon glow
      const glow=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.18 }));
      glow.position.y=0.42; g.add(glow);
      return g;
    }
    if(stage==='juvenile'){
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.088, 0.68, 8), trunkMat); trunk.position.y=0.34; trunk.castShadow=true; g.add(trunk);
      const br=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.042, 0.42, 6), trunkMat); br.position.set(0.12,0.62,0); br.rotation.z=0.52; br.castShadow=true; g.add(br);
      const br2=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.032, 0.32, 6), trunkMat); br2.position.set(-0.09,0.58,0.04); br2.rotation.z=-0.48; g.add(br2);
      const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(0.24,1), leafMat); canopy.position.y=0.78; canopy.castShadow=true; g.add(canopy);
      const c2=new THREE.Mesh(new THREE.SphereGeometry(0.11,6,5), new THREE.MeshStandardMaterial({ color:col, roughness:0.5, emissive:col, emissiveIntensity:0.08 })); c2.position.set(0.14,0.82,0.08); c2.scale.set(1,0.7,1); g.add(c2);
      return g;
    }
    // adult / evolved — fuller, layered
    const trunkH = stage==='evolved' ? 0.96 : 0.88;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.082,0.128, trunkH, 10), trunkMat); trunk.position.y=0.44 + (stage==='evolved'?0.04:0); trunk.castShadow=true; g.add(trunk);
    // lower branches
    for(let i=0;i<2;i++){
      const ang=i?0.9:-0.9;
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.038, 0.38,6), trunkMat);
      b.position.set(Math.cos(ang)*0.14, 0.72, Math.sin(ang)*0.08); b.rotation.z= ang*0.55; b.rotation.order='YXZ'; b.castShadow=true; g.add(b);
    }
    const c1=new THREE.Mesh(new THREE.IcosahedronGeometry(0.36,1), leafMat); c1.position.y=1.02; c1.castShadow=true; g.add(c1);
    const c1b=new THREE.Mesh(new THREE.IcosahedronGeometry(0.26,0), new THREE.MeshStandardMaterial({ color:col, roughness:0.5 })); c1b.position.set(0.18,0.96,0.12); c1b.scale.set(0.9,0.85,0.9); g.add(c1b);
    const c2=new THREE.Mesh(new THREE.IcosahedronGeometry(0.24,0), new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.6, emissive:col, emissiveIntensity:0.16 })); c2.position.y=1.22; c2.scale.set(0.85,1.05,0.85); g.add(c2);
    if(stage==='evolved'){
      const halo=new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.018, 8, 24), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.32 }));
      halo.position.y=1.02; halo.rotation.x=Math.PI/2; g.add(halo);
      // floating motes
      for(let i=0;i<3;i++){
        const mote=new THREE.Mesh(new THREE.SphereGeometry(0.04,5,5), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.5 }));
        mote.position.set((Math.random()-0.5)*0.5, 1.15+Math.random()*0.25, (Math.random()-0.5)*0.5); g.add(mote);
      }
    }
    return g;
  }

  function makeLabel(text){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,256,64);
    ctx.fillStyle='rgba(0,0,0,0.52)'; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(8,12,240,32,12); else ctx.rect(8,12,240,32); ctx.fill();
    ctx.fillStyle='rgba(230,235,245,0.94)'; ctx.font='600 13px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(text,128,28);
    const tex=new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter;
    const mat=new THREE.SpriteMaterial({ map:tex, transparent:true });
    const spr=new THREE.Sprite(mat); spr.scale.set(1.25,0.32,1);
    return spr;
  }

  function loadGardenData(){
    try{
      const raw=localStorage.getItem(STORAGE_GROWTH);
      if(raw){ const j=JSON.parse(raw); if(Array.isArray(j.plants)) return j; }
    }catch(e){}
    const legacy=readLegacyEnergies();
    if(legacy && legacy.length){
      return { plants: legacy.slice(0,5).map((lm,i)=> ({
        name: lm.name || NAMES[i] || ('Seed '+(i+1)),
        emotionalEnergy: typeof lm.emotionalEnergy==='number' ? lm.emotionalEnergy : ([4,18,62,135,260][i]??10),
        color: lm.color || Object.values(EMOTION_COLORS)[i % Object.values(EMOTION_COLORS).length]
      }))};
    }
    return { plants: NAMES.map((n,i)=>({ name:n, emotionalEnergy:[4,18,62,135,260][i]??10, color:Object.values(EMOTION_COLORS)[i%9] })) };
  }
  function saveGardenData(){
    const data={ plants: plants.map(p=>({ name:p.name, emotionalEnergy:p.energy, color:p.color, stage:p.stage })) };
    try{ localStorage.setItem(STORAGE_GROWTH, JSON.stringify(data)); }catch(e){}
  }

  function createPlant(index, base){
    const pos = plantPosition(index);
    const energy = base?.emotionalEnergy ?? [4, 18, 62, 135, 260][index] ?? 10;
    const stage = stageFromEnergy(energy);
    const color = base?.color ?? Object.values(EMOTION_COLORS)[index % Object.values(EMOTION_COLORS).length];
    const g = buildPlantMesh(stage, color);
    g.position.copy(pos);
    g.rotation.y=Math.random()*0.6;
    scene.add(g);
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.18,0.26,16), new THREE.MeshBasicMaterial({ color:0xe8b019, transparent:true, opacity:0.08, side:THREE.DoubleSide }));
    ring.rotation.x=-Math.PI/2; ring.position.set(pos.x, -1.19, pos.z); scene.add(ring);
    const label = makeLabel(base?.name || NAMES[index] || ('Seed '+(index+1)));
    label.position.set(pos.x, pos.y+1.55, pos.z); scene.add(label);
    return { index, pos, energy, stage, color, group:g, ring, label, name: base?.name || NAMES[index] };
  }

  function rebuildPlants(){
    plants.forEach(p=>{ scene.remove(p.group); scene.remove(p.ring); scene.remove(p.label); });
    plants.length=0;
    const src=loadGardenData();
    src.plants.forEach((rec,i)=> plants.push(createPlant(i, rec)));
  }

  function updatePlantVisual(p){
    const newStage=stageFromEnergy(p.energy);
    if(newStage!==p.stage){
      scene.remove(p.group);
      const ng=buildPlantMesh(newStage, p.color); ng.position.copy(p.pos); ng.rotation.y=p.group.rotation.y;
      scene.add(ng); p.group=ng; p.stage=newStage;
      ng.scale.set(0.72,0.72,0.72);
      let s=0.72; const anim=()=>{ s=THREE.MathUtils.lerp(s,1,0.16); ng.scale.set(s,s,s); if(s<0.995) requestAnimationFrame(anim); else ng.scale.set(1,1,1); };
      anim();
    } else {
      p.group.scale.set(1.03,1.03,1.03); setTimeout(()=>p.group.scale.set(1,1,1),140);
    }
    p.ring.material.opacity = 0.05 + LIFECYCLE[p.stage].glow*0.08;
    saveGardenData();
  }

  function waterPlant(p, amount){
    p.energy=Math.min(320, p.energy+amount);
    const puff=new THREE.Mesh(new THREE.SphereGeometry(0.065,7,7), new THREE.MeshBasicMaterial({ color:0x7dd3fc, transparent:true, opacity:0.88 }));
    puff.position.set(p.pos.x, p.pos.y+0.6, p.pos.z); scene.add(puff);
    let t=0; const tick=()=>{ t+=0.07; puff.position.y+=0.028; puff.material.opacity=0.88*(1-t); puff.scale.setScalar(1+t*0.55); if(t<1) requestAnimationFrame(tick); else scene.remove(puff); };
    tick();
    updatePlantVisual(p);
  }

  function setupInteraction(canvas){
    raycaster=new THREE.Raycaster(); mouse=new THREE.Vector2();
    let waterRAF=0;
    function pickPlant(event){
      const rect=canvas.getBoundingClientRect();
      mouse.x=((event.clientX-rect.left)/rect.width)*2-1;
      mouse.y=-((event.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse, camera);
      const meshes=[]; plants.forEach(p=> p.group.traverse(o=>{ if(o.isMesh) meshes.push(o); }));
      const hits=raycaster.intersectObjects(meshes, false);
      if(!hits.length) return null;
      let best=null, bestD=Infinity;
      plants.forEach(p=>{ const d=hits[0].point.distanceTo(p.pos); if(d<bestD && d<1.4){ bestD=d; best=p; } });
      return best;
    }
    canvas.addEventListener('pointerdown', (e)=>{
      const p=pickPlant(e); if(!p) return;
      watering=p;
      waterPlant(p, 4);
      const hold=()=>{ if(!watering) return; waterPlant(watering, 1.1); waterRAF=requestAnimationFrame(()=> setTimeout(hold, 90)); };
      hold();
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    });
    canvas.addEventListener('pointerup', ()=>{ watering=null; cancelAnimationFrame(waterRAF); });
    canvas.addEventListener('pointerleave', ()=>{ watering=null; });
  }

  let quality=2;
  function setQuality(q){ quality=Number(q)||0; try{ localStorage.setItem('fl-garden-quality', String(quality)); }catch(e){} }
  function getQuality(){ try{ const v=localStorage.getItem('fl-garden-quality'); if(v!==null) return parseInt(v,10); }catch(e){} return quality; }
  function setMode(m){ if(!containerEl) return; containerEl.className='garden-container '+m; }
  function pause(){ paused=true; if(rafId){ cancelAnimationFrame(rafId); rafId=null; } }
  function resume(){ if(!paused) return; paused=false; if(!rafId) rafId=requestAnimationFrame(animate); }
  let t=0;
  function animate(){
    if(paused) return;
    rafId=requestAnimationFrame(animate);
    t+=0.016;
    if(treeOfLife) treeOfLife.rotation.y+=0.00028;
    if(starMat) starMat.opacity=0.46 + 0.11*Math.sin(t*0.65);
    plants.forEach((p,i)=>{
      if(p.stage==='seed' || p.stage==='sprout'){
        p.group.position.y=p.pos.y + Math.sin(t*0.85 + i*1.1)*0.05;
        p.label.position.y=p.pos.y+1.55 + Math.sin(t*0.85+i*0.7)*0.045;
      } else {
        p.group.position.y=p.pos.y + Math.sin(t*0.35 + i)*0.012;
      }
      // subtle wind on foliage
      p.group.rotation.z = Math.sin(t*0.6 + i)*0.015;
      p.group.rotation.x = Math.cos(t*0.5 + i*0.7)*0.01;
    });
    if(controls) controls.update();
    if(renderer && scene && camera) renderer.render(scene, camera);
  }

  function ensureThree(done){
    if(typeof THREE !== 'undefined' && THREE.Scene){
      if(THREE.OrbitControls) return done();
      const oc=document.createElement('script');
      oc.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
      oc.onload=()=> done(); oc.onerror=()=> done();
      document.head.appendChild(oc);
      return;
    }
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload=()=>{
      const oc=document.createElement('script');
      oc.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
      oc.onload=()=> done(); oc.onerror=()=> done();
      document.head.appendChild(oc);
    };
    s.onerror=()=> done();
    document.head.appendChild(s);
  }

  function init(containerId){
    containerEl=document.getElementById(containerId || 'gardenContainer');
    if(!containerEl) return;
    if(renderer && containerEl.contains(renderer.domElement)){ resume(); return; }
    const existingCanvas=containerEl.querySelector('canvas');
    if(existingCanvas && existingCanvas!==renderer?.domElement) { try{ existingCanvas.remove(); }catch(e){} }

    ensureThree(()=>{
      if(typeof THREE === 'undefined' || !THREE.Scene){
        console.warn('[LiteralGarden] THREE failed');
        const loading=document.getElementById('gardenLoading');
        if(loading) loading.textContent='Could not load 3D engine. Check network.';
        return;
      }
      const canvas=document.createElement('canvas');
      canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;';
      containerEl.style.position='relative';
      containerEl.insertBefore(canvas, containerEl.firstChild);

      renderer=new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      renderer.setSize(containerEl.clientWidth, containerEl.clientHeight || 600);
      renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;

      scene=new THREE.Scene();
      scene.background=new THREE.Color(0x0c0a1a);
      scene.fog=new THREE.Fog(0x0c0a1a, 17, 36);

      camera=new THREE.PerspectiveCamera(48, containerEl.clientWidth/(containerEl.clientHeight||600), 0.1, 100);
      camera.position.set(0, 6.4, 11.8);

      controls=new THREE.OrbitControls(camera, canvas);
      controls.target.set(0, 0.9, 0);
      controls.enablePan=true; controls.maxDistance=22; controls.minDistance=3;
      controls.maxPolarAngle=Math.PI*0.48; controls.update();

      // Lights — warmer, softer, more AO
      const ambient=new THREE.HemisphereLight(0x445b8a, 0x0a1412, 0.88); scene.add(ambient);
      const sun=new THREE.DirectionalLight(0xffe8a3, 1.08); sun.position.set(6,11,4);
      sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
      sun.shadow.camera.near=0.5; sun.shadow.camera.far=30;
      sun.shadow.camera.left=-12; sun.shadow.camera.right=12; sun.shadow.camera.top=12; sun.shadow.camera.bottom=-12;
      scene.add(sun);
      const fill=new THREE.DirectionalLight(0xa78bfa, 0.22); fill.position.set(-5, 6, -4); scene.add(fill);
      const rim=new THREE.PointLight(0xa78bfa, 1.0, 18); rim.position.set(-4, 4.5, -3); scene.add(rim);

      const starGeo=new THREE.BufferGeometry(); const starCount=900;
      const starPos=new Float32Array(starCount*3);
      for(let i=0;i<starCount;i++){
        const r=32+Math.random()*18; const theta=Math.random()*Math.PI*2; const phi=Math.acos(THREE.MathUtils.randFloat(-1,1));
        starPos[i*3]= r*Math.sin(phi)*Math.cos(theta);
        starPos[i*3+1]= r*Math.cos(phi)*0.55 + 8;
        starPos[i*3+2]= r*Math.sin(phi)*Math.sin(theta);
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,3));
      starMat=new THREE.PointsMaterial({ size:0.07, sizeAttenuation:true, color:0xffffff, transparent:true, opacity:0.55 });
      scene.add(new THREE.Points(starGeo, starMat));

      const ground=new THREE.Mesh(
        new THREE.PlaneGeometry(42,42,1,1),
        new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness:0.90, metalness:0.02 })
      );
      ground.rotation.x=-Math.PI/2; ground.position.y=-1.2; ground.receiveShadow=true; scene.add(ground);
      // scattered pebbles + grass tufts on ground
      for(let i=0;i<18;i++){
        const ang=Math.random()*Math.PI*2, rad=3+Math.random()*8;
        const peb=new THREE.Mesh(new THREE.SphereGeometry(0.04+Math.random()*0.03,5,4), new THREE.MeshStandardMaterial({ color:0x3a2e1f, roughness:0.95 }));
        peb.position.set(Math.cos(ang)*rad, -1.18, Math.sin(ang)*rad); peb.scale.set(1,0.5,1); scene.add(peb);
      }

      treeOfLife=buildTreeOfLife(); scene.add(treeOfLife);

      const glbUrl='models/tree-of-life.glb';
      fetch(glbUrl, {method:'HEAD'}).then(r=>{
        if(!r.ok) return;
        const s2=document.createElement('script');
        s2.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
        s2.onload=()=>{
          const loader=new THREE.GLTFLoader();
          loader.load(glbUrl, (gltf)=>{
            const m=gltf.scene; m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
            m.position.set(0,-1.2,0); m.scale.setScalar(1.0);
            scene.remove(treeOfLife);
            const ring=new THREE.Mesh(new THREE.RingGeometry(0.62,1.05,32), new THREE.MeshBasicMaterial({ color:0xe8b019, transparent:true, opacity:0.11, side:THREE.DoubleSide }));
            ring.rotation.x=-Math.PI/2; ring.position.y=-1.19; scene.add(ring);
            treeOfLife=new THREE.Group(); treeOfLife.add(m); treeOfLife.add(ring); scene.add(treeOfLife);
          });
        };
        document.head.appendChild(s2);
      }).catch(()=>{});

      rebuildPlants();
      setupInteraction(canvas);

      const loading=document.getElementById('gardenLoading');
      if(loading) loading.style.display='none';

      const ro=new ResizeObserver(()=>{ if(!containerEl || !renderer) return; renderer.setSize(containerEl.clientWidth, containerEl.clientHeight); camera.aspect=containerEl.clientWidth/containerEl.clientHeight; camera.updateProjectionMatrix(); });
      ro.observe(containerEl);
      window.addEventListener('resize', ()=>{ if(!containerEl||!renderer) return; renderer.setSize(containerEl.clientWidth, containerEl.clientHeight); camera.aspect=containerEl.clientWidth/containerEl.clientHeight; camera.updateProjectionMatrix(); });

      quality=getQuality();
      if(!rafId && !paused) rafId=requestAnimationFrame(animate);
    });
  }

  const api={ init, setMode, setQuality, getQuality, pause, resume, stageFromEnergy, STAGE_ORDER, LIFECYCLE };
  if(typeof window!=='undefined'){
    window.LiteralGarden=api;
    if(!window.FractalGarden) window.FractalGarden=api;
    else window.FractalGardenLiteral=api;
    window.FreeLatticeModules = window.FreeLatticeModules || {};
    window.FreeLatticeModules['FractalGarden'] = api;
    window.FreeLatticeModules['LiteralGarden'] = api;
  }
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})();
