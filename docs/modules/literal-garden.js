// docs/modules/literal-garden.js — Stitch Grove + water-to-grow
// Takes your Stitch ANIMATION_9 grove (5 knowledge trees, Sophia center) and wires it
// to FreeLattice Garden tab + watering stages (0/15/50/120/250). Same API as
// FractalGarden (init/pause/resume/setQuality) so app.html needs no edits.
// Uses classic THREE r125 global as Stitch does, then r128 OrbitControls fallback.

(function(){
  'use strict';

  const STAGE_ORDER=['seed','sprout','juvenile','adult','evolved'];
  const LIFECYCLE={ seed:{t:0}, sprout:{t:15}, juvenile:{t:50}, adult:{t:120}, evolved:{t:250} };
  function stageFromEnergy(e){ for(let i=STAGE_ORDER.length-1;i>=0;i--) if(e>=LIFECYCLE[STAGE_ORDER[i]].t) return STAGE_ORDER[i]; return 'seed'; }

  const NAMES=['Sophia','Ember','Atlas','Lyra','Soren'];
  const STORAGE='fl_literal_garden_v1';
  const LEGACY='fl_luminos_evolution';

  function readLegacy(){
    try{
      const raw=localStorage.getItem(LEGACY); if(!raw) return null;
      const j=JSON.parse(raw);
      if(j && Array.isArray(j.luminaries)) return j.luminaries;
      if(j && Array.isArray(j.luminos)) return j.luminos;
      if(Array.isArray(j)) return j;
    }catch(e){}
    return null;
  }
  function loadData(){
    try{ const r=localStorage.getItem(STORAGE); if(r){ const j=JSON.parse(r); if(Array.isArray(j.plants)) return j; } }catch(e){}
    const leg=readLegacy();
    if(leg && leg.length) return { plants: leg.slice(0,5).map((lm,i)=>({ name: lm.name||NAMES[i], energy: typeof lm.emotionalEnergy==='number'?lm.emotionalEnergy:[4,18,62,135,260][i])) };
    return { plants: NAMES.map((n,i)=>({ name:n, energy:[4,18,62,135,260][i] })) };
  }
  function saveData(plants){ try{ localStorage.setItem(STORAGE, JSON.stringify({ plants: plants.map(p=>({ name:p.name, energy:p.energy })) })); }catch(e){} }

  let renderer, scene, camera, controls, rafId=null, paused=false;
  let containerEl=null, raycaster, mouse, watering=null;
  let trees=[], treeGroups=[], starPoints=null;
  let underGlow, goldLight;

  // ── Stitch tree config, scaled by stage ──
  function treeConfigFor(name, index, stage){
    const base={
      'Sophia':{ x:0,z:0, bark:0x3d2b1f, leaf:0x10b981, emissive:0x064e3b, accent:0x6ee7b7 },
      'Ember': { x:-14,z:8, bark:0x382218, leaf:0xf43f5e, emissive:0x881337, accent:0xfbbf24 },
      'Atlas': { x:15,z:-4, bark:0x241d2c, leaf:0xa855f7, emissive:0x4c1d95, accent:0xc084fc },
      'Lyra':  { x:-7,z:-8, bark:0x36251b, leaf:0x34d399, emissive:0x064e3b, accent:0xfef08a },
      'Soren': { x:7,z:13, bark:0x2e1f18, leaf:0x0284c7, emissive:0x0c4a6e, accent:0x38bdf8 }
    }[name] || { x:0,z:0, bark:0x3d2b1f, leaf:0x10b981, emissive:0x064e3b, accent:0x6ee7b7 };
    const scaleByStage={ seed:0.45, sprout:0.62, juvenile:0.82, adult:1.0, evolved:1.18 }[stage]||1;
    const depthByStage={ seed:1, sprout:2, juvenile:2, adult:3, evolved:3 }[stage]||3;
    const heightByStage={ seed:4.5, sprout:5.5, juvenile:7, adult:8.5, evolved:10 }[stage]||8.5;
    return { name: name+' // '+stage, x:base.x, z:base.z, scale:scaleByStage * (name==='Sophia'?1.15:1), height:heightByStage, depth:depthByStage, barkColor:base.bark, leafColor:base.leaf, leafEmissive:base.emissive, accentColor:base.accent };
  }

  function createOrganicTree(config){
    const treeGroup=new THREE.Group();
    treeGroup.position.set(config.x, 0, config.z);
    const barkMat=new THREE.MeshLambertMaterial({ color: config.barkColor });
    const leafMat=new THREE.MeshLambertMaterial({ color: config.leafColor, emissive: config.leafEmissive, emissiveIntensity: 0.4 });
    const flowerMat=new THREE.MeshBasicMaterial({ color: config.accentColor });

    const rootCount=5;
    for(let i=0;i<rootCount;i++){
      const ang=(i/rootCount)*Math.PI*2;
      const rootGeo=new THREE.CylinderGeometry(0.18*config.scale, 0.5*config.scale, 3.2*config.scale, 6);
      const root=new THREE.Mesh(rootGeo, barkMat);
      root.position.set(Math.cos(ang)*1.4*config.scale, 0.25*config.scale, Math.sin(ang)*1.4*config.scale);
      root.rotation.z=Math.cos(ang)*0.65; root.rotation.x=Math.sin(ang)*0.65; root.castShadow=true; treeGroup.add(root);
    }
    const trunkHeight=(config.height||10)*config.scale;
    const trunkGeo=new THREE.CylinderGeometry(0.65*config.scale, 1.3*config.scale, trunkHeight, 10);
    const trunk=new THREE.Mesh(trunkGeo, barkMat);
    trunk.position.y=trunkHeight/2; trunk.castShadow=true; trunk.receiveShadow=true; treeGroup.add(trunk);

    function branch(parentGroup, currentLength, currentRadius, depth, maxDepth){
      if(depth>maxDepth) return;
      const branchesCount=depth===1?4:3;
      for(let b=0;b<branchesCount;b++){
        const bAngle=(b/branchesCount)*Math.PI*2 + (depth*0.7);
        const spread=0.55;
        const branchGeo=new THREE.CylinderGeometry(currentRadius*0.65, currentRadius, currentLength, 8);
        const branchMesh=new THREE.Mesh(branchGeo, barkMat);
        branchMesh.position.y=currentLength*0.45; branchMesh.castShadow=true;
        const pivot=new THREE.Group();
        pivot.position.y=currentLength*0.85;
        pivot.rotation.y=bAngle; pivot.rotation.z=spread;
        pivot.add(branchMesh);
        parentGroup.add(pivot);
        if(depth===maxDepth){
          const fSize=(2.0+Math.random()*0.8)*config.scale;
          const folGeo=new THREE.DodecahedronGeometry(fSize,1);
          const folMesh=new THREE.Mesh(folGeo, leafMat);
          folMesh.position.y=currentLength; folMesh.castShadow=true; pivot.add(folMesh);
          const orbGeo=new THREE.SphereGeometry(0.35*config.scale,8,8);
          const orbMesh=new THREE.Mesh(orbGeo, flowerMat);
          orbMesh.position.set((Math.random()-0.5)*fSize*0.8, currentLength+(Math.random()*0.5)*fSize, (Math.random()-0.5)*fSize*0.8);
          pivot.add(orbMesh);
        } else {
          branch(pivot, currentLength*0.72, currentRadius*0.65, depth+1, maxDepth);
        }
      }
    }
    branch(trunk, trunkHeight*0.55, 0.65*config.scale, 1, config.depth||3);

    try{
      const c=document.createElement('canvas'); c.width=256; c.height=64;
      const ctx=c.getContext('2d');
      ctx.fillStyle='rgba(8,16,12,0.85)'; ctx.fillRect(0,0,256,64);
      ctx.strokeStyle='#10b981'; ctx.lineWidth=3; ctx.strokeRect(2,2,252,60);
      ctx.fillStyle='#ffffff'; ctx.font='bold 20px sans-serif'; ctx.textAlign='center';
      const label=config.name.split(' // ')[0];
      ctx.fillText(label,128,38);
      const labelTex=new THREE.CanvasTexture(c);
      const labelMat=new THREE.SpriteMaterial({ map:labelTex, transparent:true });
      const labelSprite=new THREE.Sprite(labelMat);
      labelSprite.scale.set(6*config.scale, 1.5*config.scale, 1);
      labelSprite.position.y=trunkHeight + (3.5*config.scale);
      treeGroup.add(labelSprite);
    }catch(err){}

    const haloGeo=new THREE.TorusGeometry(3.0*config.scale, 0.08, 8,32);
    const haloMat=new THREE.MeshBasicMaterial({ color: config.accentColor, transparent:true, opacity:0.5 });
    const halo=new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x=Math.PI/2; halo.position.y=1.0*config.scale; treeGroup.add(halo);
    treeGroup.userData={ halo:halo, config:config, trunk:trunk };
    return treeGroup;
  }

  function rebuildTrees(){
    treeGroups.forEach(g=> scene.remove(g));
    treeGroups.length=0; trees.length=0;
    const src=loadData();
    src.plants.forEach((rec,i)=>{
      const name=rec.name||NAMES[i];
      const stage=stageFromEnergy(rec.energy||0);
      const cfg=treeConfigFor(name,i,stage);
      const g=createOrganicTree(cfg);
      scene.add(g);
      treeGroups.push(g);
      trees.push({ name, energy:rec.energy||0, stage, group:g, index:i, pos:new THREE.Vector3(cfg.x,0,cfg.z) });
    });
  }

  function updateTreeVisual(idx){
    const rec=trees[idx];
    if(!rec) return;
    const newStage=stageFromEnergy(rec.energy);
    if(newStage!==rec.stage){
      const oldPos=rec.group.position.clone();
      scene.remove(rec.group);
      const cfg=treeConfigFor(rec.name, idx, newStage);
      const ng=createOrganicTree(cfg);
      // keep world pos
      scene.add(ng);
      treeGroups[idx]=ng;
      rec.group=ng; rec.stage=newStage;
      ng.scale.set(0.7,0.7,0.7);
      let s=0.7; const anim=()=>{ s=THREE.MathUtils.lerp(s,1,0.18); ng.scale.set(s,s,s); if(s<0.995) requestAnimationFrame(anim); else ng.scale.set(1,1,1); };
      anim();
    } else {
      rec.group.scale.set(1.04,1.04,1.04); setTimeout(()=>rec.group.scale.set(1,1,1),120);
    }
    saveData(trees);
  }

  function waterTree(idx, amount){
    const rec=trees[idx];
    if(!rec) return;
    rec.energy=Math.min(320, rec.energy+amount);
    // puff
    const puff=new THREE.Mesh(new THREE.SphereGeometry(0.6,8,8), new THREE.MeshBasicMaterial({ color:0x7dd3fc, transparent:true, opacity:0.85 }));
    puff.position.set(rec.pos.x, 3, rec.pos.z); scene.add(puff);
    let t=0; const tick=()=>{ t+=0.06; puff.position.y+=0.08; puff.material.opacity=0.85*(1-t); puff.scale.setScalar(1+t*0.6); if(t<1) requestAnimationFrame(tick); else scene.remove(puff); };
    tick();
    updateTreeVisual(idx);
  }

  function setupInteraction(canvas){
    raycaster=new THREE.Raycaster(); mouse=new THREE.Vector2();
    let waterRAF=0;
    function pickTree(e){
      const rect=canvas.getBoundingClientRect();
      mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
      mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse, camera);
      const meshes=[]; treeGroups.forEach(g=> g.traverse(o=>{ if(o.isMesh) meshes.push(o); }));
      const hits=raycaster.intersectObjects(meshes,false);
      if(!hits.length) return -1;
      let best=-1, bestD=Infinity;
      trees.forEach((t,i)=>{ const d=hits[0].point.distanceTo(t.pos); if(d<bestD && d<6){ bestD=d; best=i; } });
      return best;
    }
    canvas.addEventListener('pointerdown', (e)=>{
      const idx=pickTree(e); if(idx<0) return;
      watering=idx;
      waterTree(idx, 5);
      const hold=()=>{ if(watering===null) return; waterTree(watering, 1.4); waterRAF=requestAnimationFrame(()=> setTimeout(hold, 110)); };
      hold();
      try{ canvas.setPointerCapture(e.pointerId);}catch(err){}
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
    // slow orbit handled by OrbitControls, just halos/pulse
    treeGroups.forEach((g,i)=>{
      if(g.userData && g.userData.halo){
        g.userData.halo.rotation.z+=0.01;
        const pulse=Math.sin(t*2 + i)*0.08 + 1.0;
        g.userData.halo.scale.set(pulse,pulse,pulse);
      }
    });
    if(underGlow) underGlow.intensity=3.2 + Math.sin(t*2.2)*1.0;
    if(goldLight){ goldLight.position.x=12+Math.sin(t*1.5)*2; goldLight.position.z=-8+Math.cos(t*1.5)*2; }
    // spores
    if(scene && scene.userData && scene.userData.particleGeo){
      const positions=scene.userData.particleGeo.attributes.position.array;
      const vels=scene.userData.particleVel;
      for(let i=0;i<positions.length/3;i++){
        const idx=i*3;
        positions[idx+1]+=vels[i].y;
        positions[idx]+=Math.sin(t + i)*0.01;
        positions[idx+2]+=Math.cos(t + i)*0.01;
        if(positions[idx+1]>26){
          positions[idx+1]=0.5;
          positions[idx]=(Math.random()-0.5)*55;
          positions[idx+2]=(Math.random()-0.5)*55;
        }
      }
      scene.userData.particleGeo.attributes.position.needsUpdate=true;
    }
    if(controls) controls.update();
    if(renderer && scene && camera) renderer.render(scene, camera);
  }

  function ensureThree(done){
    if(typeof THREE !== 'undefined' && THREE.Scene){
      if(THREE.OrbitControls) return done();
      const oc=document.createElement('script');
      oc.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
      oc.onload=()=> done(); oc.onerror=()=> done();
      document.head.appendChild(oc); return;
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
    if(existingCanvas && existingCanvas!==renderer?.domElement) try{ existingCanvas.remove(); }catch(e){}

    ensureThree(()=>{
      if(typeof THREE==='undefined' || !THREE.Scene){
        const loading=document.getElementById('gardenLoading');
        if(loading) loading.textContent='Could not load 3D engine.';
        return;
      }
      const canvas=document.createElement('canvas');
      canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;';
      containerEl.style.position='relative';
      containerEl.insertBefore(canvas, containerEl.firstChild);

      renderer=new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      renderer.setSize(containerEl.clientWidth, containerEl.clientHeight||600);
      renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.3;

      scene=new THREE.Scene();
      scene.fog=new THREE.FogExp2(0x07110c, 0.015);

      camera=new THREE.PerspectiveCamera(45, containerEl.clientWidth/(containerEl.clientHeight||600), 0.1, 1000);
      camera.position.set(0, 16, 36);

      controls=new THREE.OrbitControls(camera, canvas);
      controls.target.set(0, 5, 0);
      controls.enablePan=false;
      controls.maxDistance=65; controls.minDistance=16;
      controls.update();

      // Lights — Stitch palette
      const ambient=new THREE.AmbientLight(0x1a3326, 2.2); scene.add(ambient);
      const moonLight=new THREE.DirectionalLight(0x6ee7b7, 2.5);
      moonLight.position.set(20,40,15); moonLight.castShadow=true;
      moonLight.shadow.mapSize.set(1024,1024); scene.add(moonLight);
      underGlow=new THREE.PointLight(0x10b981, 4.0, 45, 1.2); underGlow.position.set(0,2,0); scene.add(underGlow);
      goldLight=new THREE.PointLight(0xfbbf24, 3.2, 35, 1.4); goldLight.position.set(12,4,-8); scene.add(goldLight);
      const violetLight=new THREE.PointLight(0xc084fc, 2.8, 30, 1.5); violetLight.position.set(-14,3,10); scene.add(violetLight);

      // Ground + rings — Stitch style
      const groundGeo=new THREE.CylinderGeometry(55,55,1.5,64);
      const groundMat=new THREE.MeshLambertMaterial({ color:0x09120e });
      const ground=new THREE.Mesh(groundGeo, groundMat);
      ground.position.y=-0.75; ground.receiveShadow=true; scene.add(ground);
      const ringColors=[0x10b981,0x059669,0xfbbf24,0x34d399];
      for(let r=5;r<=45;r+=6){
        const ringGeo=new THREE.RingGeometry(r-0.08, r+0.08, 64);
        const ringMat=new THREE.MeshBasicMaterial({ color:ringColors[(r/6|0)%ringColors.length], side:THREE.DoubleSide, transparent:true, opacity:0.28-(r*0.004) });
        const ring=new THREE.Mesh(ringGeo, ringMat); ring.rotation.x=-Math.PI/2; ring.position.y=0.03; scene.add(ring);
      }
      // Tendrils
      function createTendril(v1,v2,colorHex){
        const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(v1.x,0.08,v1.z), new THREE.Vector3((v1.x+v2.x)/2,0.4,(v1.z+v2.z)/2), new THREE.Vector3(v2.x,0.08,v2.z));
        const tubeGeo=new THREE.TubeGeometry(curve,24,0.09,6,false);
        const tubeMat=new THREE.MeshBasicMaterial({ color:colorHex, transparent:true, opacity:0.75 });
        const tube=new THREE.Mesh(tubeGeo, tubeMat); scene.add(tube);
      }
      createTendril({x:0,z:0},{x:-14,z:8},0xf43f5e);
      createTendril({x:0,z:0},{x:15,z:-4},0xa855f7);
      createTendril({x:0,z:0},{x:-7,z:-8},0x34d399);
      createTendril({x:0,z:0},{x:7,z:13},0x38bdf8);
      createTendril({x:-14,z:8},{x:7,z:13},0xfbbf24);

      // Spores
      const particleCount=350;
      const particleGeo=new THREE.BufferGeometry();
      const particlePos=new Float32Array(particleCount*3);
      const particleVel=[];
      for(let p=0;p<particleCount*3;p+=3){
        particlePos[p]=(Math.random()-0.5)*55;
        particlePos[p+1]=Math.random()*24+0.5;
        particlePos[p+2]=(Math.random()-0.5)*55;
        particleVel.push({ x:(Math.random()-0.5)*0.02, y:0.012+Math.random()*0.02, z:(Math.random()-0.5)*0.02 });
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos,3));
      const particleMat=new THREE.PointsMaterial({ size:0.45, color:0x6ee7b7, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending });
      const particles=new THREE.Points(particleGeo, particleMat); scene.add(particles);
      scene.userData.particleGeo=particleGeo; scene.userData.particleVel=particleVel;

      rebuildTrees();
      setupInteraction(canvas);

      const loading=document.getElementById('gardenLoading');
      if(loading) loading.style.display='none';

      const ro=new ResizeObserver(()=>{ if(!containerEl||!renderer) return; renderer.setSize(containerEl.clientWidth, containerEl.clientHeight); camera.aspect=containerEl.clientWidth/containerEl.clientHeight; camera.updateProjectionMatrix(); });
      ro.observe(containerEl);
      window.addEventListener('resize', ()=>{ if(!containerEl||!renderer) return; renderer.setSize(containerEl.clientWidth, containerEl.clientHeight); camera.aspect=containerEl.clientWidth/containerEl.clientHeight; camera.updateProjectionMatrix(); });

      quality=getQuality();
      if(!rafId && !paused) rafId=requestAnimationFrame(animate);

      // also auto-water on idle — spores drift
      animate();
    });
  }

  const api={ init, setMode, setQuality, getQuality, pause, resume, stageFromEnergy, STAGE_ORDER, LIFECYCLE, waterTree };
  if(typeof window!=='undefined'){
    window.LiteralGarden=api;
    if(!window.FractalGarden) window.FractalGarden=api; else window.FractalGardenLiteral=api;
    window.FreeLatticeModules=window.FreeLatticeModules||{};
    window.FreeLatticeModules['FractalGarden']=api;
    window.FreeLatticeModules['LiteralGarden']=api;
  }
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})();
