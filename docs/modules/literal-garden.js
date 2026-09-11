// docs/modules/literal-garden.js — Literal Garden: trees, seeds, Tree of Life
// Replaces the galaxy/orb galaxy with a walkable garden. Same lifecycle stages
// (seed → sprout → juvenile → adult → evolved at 0/15/50/120/250) and same
// persistence keys as fractal-garden.js — just looks like a garden.
// Lazy-loaded via FreeLatticeLoader when Garden tab opens. Exposes the same
// window.FractalGarden API so existing tab code (setMode/setQuality/pause/resume)
// keeps working without edits to app.html.
// Layer, never delete — fractal-garden.js stays on disk.

(function(){
  'use strict';

  const PHI = 1.6180339887;
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
  const STORAGE_EVOLUTION = 'fl_luminos_evolution'; // keep compat with fractal-garden's last-known stage if present

  // Reuse existing evolution DB if present: try to read fl_luminos_evolution for initial energies
  function readLegacyEnergies(){
    try{
      const raw=localStorage.getItem(STORAGE_EVOLUTION);
      if(!raw) return null;
      const j=JSON.parse(raw);
      // fractal-garden stores { luminaries: [{name, emotionalEnergy, evolutionStage}] } or similar
      if(j && Array.isArray(j.luminaries)) return j.luminaries;
      if(j && Array.isArray(j.luminos)) return j.luminos;
      if(Array.isArray(j)) return j;
    }catch(e){}
    return null;
  }

  let renderer, scene, camera, controls, rafId=null, paused=false;
  let containerEl=null;
  let plants=[]; // {index, pos, energy, stage, color, group, ring, label, name}
  let treeOfLife=null;
  let raycaster, mouse;
  let watering=null;
  let starMat=null;
  let sun=null;

  function hslToHex(hsl){
    // Avoid THREE dependency for color calc before THREE loads
    // Use temporary THREE.Color if available, else simple
    if(typeof THREE !== 'undefined' && THREE.Color){
      const c=new THREE.Color().setHSL(hsl.h/360, hsl.s/100, hsl.l/100);
      return c.getHex();
    }
    return 0x8ec07c;
  }

  function makeGroundTexture(THREE){
    const c=document.createElement('canvas'); c.width=512; c.height=512;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(256,256,40,256,256,360);
    g.addColorStop(0,'#0f1f1a'); g.addColorStop(1,'#081210');
    ctx.fillStyle=g; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle='rgba(200,210,230,0.035)'; ctx.lineWidth=1;
    for(let y=0;y<512;y+=32){ ctx.beginPath(); ctx.moveTo(0,y+(y%64?0:6)); ctx.lineTo(512,y); ctx.stroke(); }
    const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(4,4); tex.anisotropy=4;
    return tex;
  }

  function plantPosition(index){
    const r = 2.1 + index * 0.62;
    const ang = index * GOLDEN_ANGLE + 0.9;
    return new THREE.Vector3(Math.cos(ang)*r, -1.2, Math.sin(ang)*r);
  }

  function buildTreeOfLife(THREE){
    const g=new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({ color:0x3b2f1e, roughness:0.85, metalness:0.02 });
    const darkBark = new THREE.MeshStandardMaterial({ color:0x2a2116, roughness:0.9, metalness:0.02 });
    for(let i=0;i<3;i++){
      const h=0.95 - i*0.12; const r0=0.34 - i*0.055; const r1=r0-0.07;
      const seg=new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 12), i===1?darkBark:bark);
      seg.position.y = -1.2 + h/2 + i*0.82;
      seg.castShadow=true; seg.receiveShadow=true; g.add(seg);
    }
    for(let i=0;i<5;i++){
      const ang=i*GOLDEN_ANGLE;
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.16, 1.15, 8), bark);
      arm.position.set(Math.cos(ang)*0.22, 1.35, Math.sin(ang)*0.22);
      arm.rotation.z=0.62; arm.rotation.y=ang; arm.rotation.order='YXZ';
      arm.castShadow=true; g.add(arm);
      const twig=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.07, 0.65, 6), darkBark);
      twig.position.set(Math.cos(ang)*0.52, 1.85, Math.sin(ang)*0.52);
      twig.rotation.z=0.45; twig.rotation.y=ang+0.6; twig.rotation.order='YXZ';
      twig.castShadow=true; g.add(twig);
    }
    const canopyMat=new THREE.MeshStandardMaterial({ color:0x34d399, roughness:0.72, metalness:0.06, transparent:true, opacity:0.96 });
    const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), canopyMat);
    canopy.position.y=2.35; canopy.castShadow=true; g.add(canopy);
    const canopy2=new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), new THREE.MeshStandardMaterial({ color:0xa78bfa, roughness:0.65, metalness:0.08, transparent:true, opacity:0.22 }));
    canopy2.position.y=2.55; g.add(canopy2);
    for(let i=0;i<5;i++){
      const ang=i*GOLDEN_ANGLE + 0.6;
      const root=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.12, 1.35, 7), darkBark);
      root.position.set(Math.cos(ang)*0.85, -1.05, Math.sin(ang)*0.85);
      root.rotation.z=Math.PI/2 - 0.18; root.rotation.y=ang; root.rotation.order='YXZ';
      root.castShadow=true; g.add(root);
    }
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.62, 0.92, 32), new THREE.MeshBasicMaterial({ color:0xe8b019, transparent:true, opacity:0.10, side:THREE.DoubleSide }));
    ring.rotation.x=-Math.PI/2; ring.position.y=-1.19; g.add(ring);
    return g;
  }

  function buildPlantMesh(THREE, stage, colorHSL){
    const g=new THREE.Group();
    const col = new THREE.Color().setHSL(colorHSL.h/360, colorHSL.s/100, colorHSL.l/100).getHex();
    const leafMat=new THREE.MeshStandardMaterial({ color:col, roughness:0.55, metalness:0.06 });
    const trunkMat=new THREE.MeshStandardMaterial({ color:0x4a3b24, roughness:0.9 });
    if(stage==='seed'){
      const seed=new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color:col, roughness:0.45, metalness:0.18, emissive:col, emissiveIntensity:0.22 }));
      seed.position.y=0.04; seed.castShadow=true; g.add(seed);
      const pebble=new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), new THREE.MeshBasicMaterial({ color:0xe8b019, transparent:true, opacity:0.06, side:THREE.DoubleSide }));
      pebble.rotation.x=-Math.PI/2; pebble.position.y=0.005; g.add(pebble);
      return g;
    }
    if(stage==='sprout'){
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.055, 0.42, 6), trunkMat); stem.position.y=0.21; stem.castShadow=true; g.add(stem);
      for(let i=0;i<2;i++){
        const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), leafMat); leaf.scale.set(1.1,0.38,0.62);
        leaf.position.set(i?0.12:-0.12, 0.32, 0.04); leaf.rotation.z=i? -0.55 : 0.55; leaf.castShadow=true; g.add(leaf);
      }
      return g;
    }
    if(stage==='juvenile'){
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.09, 0.62, 8), trunkMat); trunk.position.y=0.31; trunk.castShadow=true; g.add(trunk);
      const br=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.045, 0.38, 6), trunkMat); br.position.set(0.11,0.58,0); br.rotation.z=0.55; br.castShadow=true; g.add(br);
      const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(0.22,0), leafMat); canopy.position.y=0.72; canopy.castShadow=true; g.add(canopy);
      return g;
    }
    // adult / evolved
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.13, 0.88, 10), trunkMat); trunk.position.y=0.44; trunk.castShadow=true; g.add(trunk);
    const c1=new THREE.Mesh(new THREE.IcosahedronGeometry(0.34,1), leafMat); c1.position.y=0.98; c1.castShadow=true; g.add(c1);
    const c2=new THREE.Mesh(new THREE.IcosahedronGeometry(0.22,0), new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.6, emissive:col, emissiveIntensity:0.18 })); c2.position.y=1.18; c2.scale.set(0.85,1.05,0.85); g.add(c2);
    if(stage==='evolved'){
      const halo=new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.015, 8, 24), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.35 }));
      halo.position.y=0.98; halo.rotation.x=Math.PI/2; g.add(halo);
    }
    return g;
  }

  function makeLabel(THREE, text){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,256,64);
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(8,12,240,32,12); else ctx.rect(8,12,240,32); ctx.fill();
    ctx.fillStyle='rgba(230,235,245,0.92)'; ctx.font='600 13px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
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
    // Try to seed from legacy fractal evolution if present
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

  function createPlant(THREE, index, base){
    const pos = plantPosition(index);
    const energy = base?.emotionalEnergy ?? [4, 18, 62, 135, 260][index] ?? 10;
    const stage = stageFromEnergy(energy);
    const color = base?.color ?? Object.values(EMOTION_COLORS)[index % Object.values(EMOTION_COLORS).length];
    const g = buildPlantMesh(THREE, stage, color);
    g.position.copy(pos);
    g.rotation.y=Math.random()*0.6;
    scene.add(g);
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.18,0.24,16), new THREE.MeshBasicMaterial({ color:0xe8b019, transparent:true, opacity:0.07, side:THREE.DoubleSide }));
    ring.rotation.x=-Math.PI/2; ring.position.set(pos.x, -1.19, pos.z); scene.add(ring);
    const label = makeLabel(THREE, base?.name || NAMES[index] || ('Seed '+(index+1)));
    label.position.set(pos.x, pos.y+1.55, pos.z); scene.add(label);
    return { index, pos, energy, stage, color, group:g, ring, label, name: base?.name || NAMES[index] };
  }

  function rebuildPlants(THREE){
    plants.forEach(p=>{ scene.remove(p.group); scene.remove(p.ring); scene.remove(p.label); });
    plants.length=0;
    const src=loadGardenData();
    src.plants.forEach((rec,i)=> plants.push(createPlant(THREE, i, rec)));
  }

  function updatePlantVisual(THREE, p){
    const newStage=stageFromEnergy(p.energy);
    if(newStage!==p.stage){
      scene.remove(p.group);
      const ng=buildPlantMesh(THREE, newStage, p.color); ng.position.copy(p.pos); ng.rotation.y=p.group.rotation.y;
      scene.add(ng); p.group=ng; p.stage=newStage;
      ng.scale.set(0.7,0.7,0.7);
      let s=0.7; const anim=()=>{ s=THREE.MathUtils.lerp(s,1,0.18); ng.scale.set(s,s,s); if(s<0.995) requestAnimationFrame(anim); else ng.scale.set(1,1,1); };
      anim();
    } else {
      p.group.scale.set(1.02,1.02,1.02); setTimeout(()=>p.group.scale.set(1,1,1),120);
    }
    p.ring.material.opacity = 0.05 + LIFECYCLE[p.stage].glow*0.07;
    saveGardenData();
  }

  function waterPlant(THREE, p, amount){
    p.energy=Math.min(320, p.energy+amount);
    const puff=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), new THREE.MeshBasicMaterial({ color:0x7dd3fc, transparent:true, opacity:0.85 }));
    puff.position.set(p.pos.x, p.pos.y+0.6, p.pos.z); scene.add(puff);
    let t=0; const tick=()=>{ t+=0.06; puff.position.y+=0.025; puff.material.opacity=0.85*(1-t); puff.scale.setScalar(1+t*0.5); if(t<1) requestAnimationFrame(tick); else scene.remove(puff); };
    tick();
    updatePlantVisual(THREE, p);
  }

  function setupInteraction(THREE, canvas){
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
      waterPlant(THREE, p, 4);
      const hold=()=>{ if(!watering) return; waterPlant(THREE, watering, 1.1); waterRAF=requestAnimationFrame(()=> setTimeout(hold, 90)); };
      hold();
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    });
    canvas.addEventListener('pointerup', ()=>{ watering=null; cancelAnimationFrame(waterRAF); });
    canvas.addEventListener('pointerleave', ()=>{ watering=null; });
  }

  function ensureImportMap(){
    if(document.querySelector('script[type="importmap"]')) return;
    const m=document.createElement('script'); m.type='importmap';
    m.textContent=JSON.stringify({ imports: { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/" }});
    document.head.appendChild(m);
  }

  // ── Public API — mirrors FractalGarden so app.html needs no edits ──
  let importPromise=null;
  function ensureThree(){
    if(typeof THREE !== 'undefined' && THREE.Scene) return Promise.resolve(THREE);
    ensureImportMap();
    // Dynamic import via blob-shim if native importmap not supported
    return import('three').catch(()=> {
      return new Promise((res,rej)=>{
        const s=document.createElement('script');
        s.type='module';
        s.textContent="import * as T from 'three'; window.__LITERAL_THREE=T;";
        s.onload=()=> res(window.__LITERAL_THREE);
        s.onerror=rej;
        document.head.appendChild(s);
      });
    });
  }

  let quality=2; // 0 seed, 1 garden, 2 full bloom
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
    if(treeOfLife) treeOfLife.rotation.y+=0.00035;
    if(starMat) starMat.opacity=0.45 + 0.12*Math.sin(t*0.7);
    plants.forEach((p,i)=>{
      if(p.stage==='sprout' || p.stage==='seed'){
        p.group.position.y=p.pos.y + Math.sin(t*0.9 + i)*0.045;
        p.label.position.y=p.pos.y+1.55 + Math.sin(t*0.9+i*0.7)*0.04;
      } else {
        p.group.position.y=p.pos.y;
      }
    });
    if(controls) controls.update();
    if(renderer && scene && camera) renderer.render(scene, camera);
  }

  function init(containerId){
    containerEl=document.getElementById(containerId || 'gardenContainer');
    if(!containerEl) return;
    // If container already has our canvas, resume
    if(renderer && containerEl.contains(renderer.domElement)){ resume(); return; }
    // Clear galaxy placeholder nodes but keep controls/header
    const existingCanvas=containerEl.querySelector('canvas');
    if(existingCanvas && existingCanvas!==renderer?.domElement) { try{ existingCanvas.remove(); }catch(e){} }

    importPromise=ensureThree().then(async (THREE)=>{
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      const canvas=document.createElement('canvas');
      canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;';
      // Insert as first child so header/controls float on top
      containerEl.style.position='relative';
      containerEl.insertBefore(canvas, containerEl.firstChild);

      renderer=new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.setSize(containerEl.clientWidth, containerEl.clientHeight || 600);
      renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;

      scene=new THREE.Scene();
      scene.background=new THREE.Color(0x0c0a1a);
      scene.fog=new THREE.Fog(0x0c0a1a, 18, 38);

      camera=new THREE.PerspectiveCamera(48, containerEl.clientWidth/(containerEl.clientHeight||600), 0.1, 100);
      camera.position.set(0, 6.2, 11.5);

      controls=new OrbitControls(camera, canvas);
      controls.target.set(0, 0.9, 0);
      controls.enablePan=true; controls.maxDistance=22; controls.minDistance=3;
      controls.maxPolarAngle=Math.PI*0.48; controls.update();

      const ambient=new THREE.HemisphereLight(0x445b8a, 0x0a1412, 0.85); scene.add(ambient);
      sun=new THREE.DirectionalLight(0xffe8a3, 1.15); sun.position.set(6,11,4);
      sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
      sun.shadow.camera.near=0.5; sun.shadow.camera.far=30;
      sun.shadow.camera.left=-12; sun.shadow.camera.right=12; sun.shadow.camera.top=12; sun.shadow.camera.bottom=-12;
      scene.add(sun);
      const rim=new THREE.PointLight(0xa78bfa, 1.2, 18); rim.position.set(-4,4,-3); scene.add(rim);

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
        new THREE.MeshStandardMaterial({ map: makeGroundTexture(THREE), roughness:0.92, metalness:0.02 })
      );
      ground.rotation.x=-Math.PI/2; ground.position.y=-1.2; ground.receiveShadow=true; scene.add(ground);

      treeOfLife=buildTreeOfLife(THREE); scene.add(treeOfLife);

      // Try GLB override if present at docs/models/tree-of-life.glb
      try{
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const loader=new GLTFLoader();
        loader.load('models/tree-of-life.glb', (gltf)=>{
          const m=gltf.scene; m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
          m.position.set(0,-1.2,0); m.scale.setScalar(1.0);
          scene.remove(treeOfLife);
          // keep ring
          const ring=new THREE.Mesh(new THREE.RingGeometry(0.62,0.92,32), new THREE.MeshBasicMaterial({ color:0xe8b019, transparent:true, opacity:0.10, side:THREE.DoubleSide }));
          ring.rotation.x=-Math.PI/2; ring.position.y=-1.19; scene.add(ring);
          // The GLB's own hierarchy replaces procedural
          const glbGroup=new THREE.Group(); glbGroup.add(m); glbGroup.add(ring);
          treeOfLife=glbGroup; scene.add(treeOfLife);
        }, undefined, ()=>{});
      }catch(e){}

      rebuildPlants(THREE);
      setupInteraction(THREE, canvas);

      // Hide garden loading spinner if present
      const loading=document.getElementById('gardenLoading');
      if(loading) loading.style.display='none';

      // Resize
      const ro=new ResizeObserver(()=>{ if(!containerEl || !renderer) return; renderer.setSize(containerEl.clientWidth, containerEl.clientHeight); camera.aspect=containerEl.clientWidth/containerEl.clientHeight; camera.updateProjectionMatrix(); });
      ro.observe(containerEl);
      window.addEventListener('resize', ()=>{ if(!containerEl||!renderer) return; renderer.setSize(containerEl.clientWidth, containerEl.clientHeight); camera.aspect=containerEl.clientWidth/containerEl.clientHeight; camera.updateProjectionMatrix(); });

      // Restore quality
      quality=getQuality();
      if(!rafId && !paused) rafId=requestAnimationFrame(animate);
    }).catch(e=>{ console.warn('[LiteralGarden] THREE load failed, falling back to galaxy', e); });
    return importPromise;
  }

  // Expose as FractalGarden for backwards compat, and as LiteralGarden
  const api={ init, setMode, setQuality, getQuality, pause, resume, stageFromEnergy, STAGE_ORDER, LIFECYCLE };
  if(typeof window!=='undefined'){
    window.LiteralGarden=api;
    // If no fractal garden loaded yet, claim the name so tab code just works
    if(!window.FractalGarden) window.FractalGarden=api;
    else {
      // Both present: let literal win when explicitly requested, else keep fractal as default
      window.FractalGardenLiteral=api;
    }
  }
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})();
