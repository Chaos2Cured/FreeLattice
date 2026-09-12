// docs/modules/literal-garden.js — Living Garden: Stitch stages + species + water-to-grow
// Growth stages come from docs/stitch/stage1-4 (sprout/midgrowth/sequoia/flowers),
// species variants from docs/stitch/stage5-bonsai + stage6-willow.
// Lifecycle 0/15/50/120/250 — same as fractal-garden.js. Same tab API
// (init/pause/resume/setMode/setQuality) so app.html needs no edits.
// Classic THREE r128 global. Layer, never delete — fractal-garden.js stays on disk.

(function(){
  'use strict';

  const STAGE_ORDER=['seed','sprout','juvenile','adult','evolved'];
  const LIFECYCLE={ seed:{t:0}, sprout:{t:15}, juvenile:{t:50}, adult:{t:120}, evolved:{t:250} };
  function stageFromEnergy(e){ for(let i=STAGE_ORDER.length-1;i>=0;i--) if(e>=LIFECYCLE[STAGE_ORDER[i]].t) return STAGE_ORDER[i]; return 'seed'; }

  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  function plantPosition(idx){ const r=2.1+idx*0.72; const ang=idx*GOLDEN_ANGLE+0.9; return new THREE.Vector3(Math.cos(ang)*r, -1.2, Math.sin(ang)*r); }
  const NAMES=['Sophia','Ember','Atlas','Lyra','Soren'];
  const SPECIES_CYCLE=['grove','bonsai','willow'];
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
    if(leg && leg.length) return { plants: leg.slice(0,5).map((lm,i)=>({ name: lm.name||NAMES[i], energy: typeof lm.emotionalEnergy==='number'?lm.emotionalEnergy:[4,18,62,135,260][i], species:'grove' })) };
    return { plants: NAMES.map((n,i)=>({ name:n, energy:[4,18,62,135,260][i], species:'grove' })) };
  }
  function saveData(){
    try{ localStorage.setItem(STORAGE, JSON.stringify({ plants: trees.map(p=>({ name:p.name, energy:p.energy, species:p.species||'grove', x:p.pos.x, z:p.pos.z })) })); }catch(e){}
  }

  let renderer, scene, camera, controls, rafId=null, paused=false;
  let containerEl=null, raycaster, mouse, watering=null;
  let trees=[], treeGroups=[];
  let underGlow, goldLight, starMat=null;

  // ── Config: palette + home position + stage + species ──
  function treeConfigFor(name, index, stage, species, x, z){
    const base={
      'Sophia':{ x:0,z:0, bark:0x3d2b1f, leaf:0x10b981, emissive:0x064e3b, accent:0x6ee7b7 },
      'Ember': { x:-14,z:8, bark:0x382218, leaf:0xf43f5e, emissive:0x881337, accent:0xfbbf24 },
      'Atlas': { x:15,z:-4, bark:0x241d2c, leaf:0xa855f7, emissive:0x4c1d95, accent:0xc084fc },
      'Lyra':  { x:-7,z:-8, bark:0x36251b, leaf:0x34d399, emissive:0x064e3b, accent:0xfef08a },
      'Soren': { x:7,z:13, bark:0x2e1f18, leaf:0x0284c7, emissive:0x0c4a6e, accent:0x38bdf8 }
    }[name] || { x:0,z:0, bark:0x3d2b1f, leaf:0x10b981, emissive:0x064e3b, accent:0x6ee7b7 };
    const scaleByStage={ seed:0.45, sprout:0.62, juvenile:0.82, adult:1.0, evolved:1.18 }[stage]||1;
    return {
      name: name+' // '+stage, x:(typeof x==='number'?x:base.x), z:(typeof z==='number'?z:base.z),
      scale:scaleByStage * (name==='Sophia'?1.15:1),
      stage: stage, species: species||'grove',
      barkColor:base.bark, leafColor:base.leaf, leafEmissive:base.emissive, accentColor:base.accent
    };
  }

  // ── Name plates: always on top, never behind bushels ──
  function makeLabel(text){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,256,64);
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(8,12,240,32,12); else ctx.rect(8,12,240,32); ctx.fill();
    ctx.fillStyle='rgba(230,235,245,0.94)'; ctx.font='600 13px system-ui';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(text,128,28);
    const tex=new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter;
    const mat=new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false, depthWrite:false });
    const spr=new THREE.Sprite(mat);
    spr.renderOrder=999; spr.frustumCulled=false;
    return spr;
  }

  // ── Fallback grove tree (ANIMATION_9 style) if StitchStages fails to load ──
  function createGroveTree(config){
    const treeGroup=new THREE.Group();
    treeGroup.position.set(config.x, 0, config.z);
    const barkMat=new THREE.MeshLambertMaterial({ color: config.barkColor });
    const leafMat=new THREE.MeshLambertMaterial({ color: config.leafColor, emissive: config.leafEmissive, emissiveIntensity: 0.4 });
    const flowerMat=new THREE.MeshBasicMaterial({ color: config.accentColor });
    for(let i=0;i<5;i++){
      const ang=(i/5)*Math.PI*2;
      const root=new THREE.Mesh(new THREE.CylinderGeometry(0.18*config.scale, 0.5*config.scale, 3.2*config.scale, 6), barkMat);
      root.position.set(Math.cos(ang)*1.4*config.scale, 0.25*config.scale, Math.sin(ang)*1.4*config.scale);
      root.rotation.z=Math.cos(ang)*0.65; root.rotation.x=Math.sin(ang)*0.65; root.castShadow=true; treeGroup.add(root);
    }
    const trunkHeight=10*config.scale;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.65*config.scale, 1.3*config.scale, trunkHeight, 10), barkMat);
    trunk.position.y=trunkHeight/2; trunk.castShadow=true; trunk.receiveShadow=true; treeGroup.add(trunk);
    function branch(parentGroup, currentLength, currentRadius, depth, maxDepth){
      if(depth>maxDepth) return;
      const n=depth===1?4:3;
      for(let b=0;b<n;b++){
        const bAngle=(b/n)*Math.PI*2 + (depth*0.7);
        const bm=new THREE.Mesh(new THREE.CylinderGeometry(currentRadius*0.65, currentRadius, currentLength, 8), barkMat);
        bm.position.y=currentLength*0.45; bm.castShadow=true;
        const pivot=new THREE.Group();
        pivot.position.y=currentLength*0.85;
        pivot.rotation.y=bAngle; pivot.rotation.z=0.55;
        pivot.add(bm); parentGroup.add(pivot);
        if(depth===maxDepth){
          const fSize=(2.0+Math.random()*0.8)*config.scale;
          const fol=new THREE.Mesh(new THREE.DodecahedronGeometry(fSize,1), leafMat);
          fol.position.y=currentLength; fol.castShadow=true; pivot.add(fol);
          const orb=new THREE.Mesh(new THREE.SphereGeometry(0.35*config.scale,8,8), flowerMat);
          orb.position.set((Math.random()-0.5)*fSize*0.8, currentLength+(Math.random()*0.5)*fSize, (Math.random()-0.5)*fSize*0.8);
          pivot.add(orb);
        } else {
          branch(pivot, currentLength*0.72, currentRadius*0.65, depth+1, maxDepth);
        }
      }
    }
    branch(trunk, trunkHeight*0.55, 0.65*config.scale, 1, 3);
    const label=makeLabel(config.name.split(' // ')[0]);
    label.scale.set(6*config.scale, 1.5*config.scale, 1);
    label.position.y=trunkHeight + (3.5*config.scale);
    treeGroup.add(label);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(3.0*config.scale, 0.08, 8,32), new THREE.MeshBasicMaterial({ color: config.accentColor, transparent:true, opacity:0.5 }));
    halo.rotation.x=Math.PI/2; halo.position.y=1.0*config.scale; treeGroup.add(halo);
    treeGroup.userData={ halo:halo, config:config };
    return treeGroup;
  }

  // ── Main builder: Stitch stages + species, grove fallback ──
  function createOrganicTree(config){
    const stage=config.stage||'adult';
    const species=config.species||'grove';
    if(typeof window!=='undefined' && window.StitchStages){
      try{
        const SS=window.StitchStages;
        const pal={ bark:config.barkColor, leaf:config.leafColor, emissive:config.leafEmissive, accent:config.accentColor };
        const g=new THREE.Group();
        g.position.set(config.x, 0, config.z);
        const mature=(stage==='adult'||stage==='evolved');
        let body=null;
        if(mature && species==='bonsai'){
          body=SS.buildBonsaiMesh(pal, stage==='evolved'?1.0:0.85);
        } else if(mature && species==='willow'){
          body=SS.buildWillowMesh(pal, stage==='evolved'?0.95:0.8);
        } else if(stage==='seed'){
          body=SS.buildSproutMesh(pal, 0.42);
        } else if(stage==='sprout'){
          body=SS.buildSproutMesh(pal, 0.8);
        } else if(stage==='juvenile'){
          body=SS.buildMidgrowthMesh(pal, 0.8);
        } else if(stage==='adult'){
          body=SS.buildSequoiaMesh(pal, 0.85);
        } else {
          body=SS.buildSequoiaMesh(pal, 1.0);
        }
        body.scale.setScalar(config.scale||1);
        g.add(body);
        if(stage==='evolved'){
          // Flowers ring the trunk at the drip line — never inside it
          const fl=SS.buildFlowersMesh(0.9);
          const ringR=4.6*(config.scale||1);
          fl.children.forEach((child,i)=>{
            const dir=new THREE.Vector3(child.position.x, 0, child.position.z);
            if(dir.lengthSq()<0.001) dir.set(Math.cos(i*2.4), 0, Math.sin(i*2.4));
            dir.normalize().multiplyScalar(ringR);
            child.position.x=dir.x; child.position.z=dir.z;
          });
          g.add(fl);
        }
        const label=makeLabel(config.name.split(' // ')[0]);
        label.scale.set(6*(config.scale||1), 1.5*(config.scale||1), 1);
        const labelY={ seed:1.6, sprout:4.2, juvenile:9, adult:14, evolved:16 }[stage]||10;
        label.position.y=labelY;
        g.add(label);
        const haloR={ seed:0.7, sprout:1.0, juvenile:1.8, adult:3.0, evolved:3.4 }[stage]||2;
        const halo=new THREE.Mesh(
          new THREE.TorusGeometry(haloR*(config.scale||1), 0.08, 8, 32),
          new THREE.MeshBasicMaterial({ color:config.accentColor, transparent:true, opacity:0.5 })
        );
        halo.rotation.x=Math.PI/2; halo.position.y=0.8*(config.scale||1); g.add(halo);
        g.userData={ halo:halo, config:config };
        if(body.userData){
          if(body.userData.shards) g.userData.shards=body.userData.shards;
          if(body.userData.vines) g.userData.vines=body.userData.vines;
        }
        return g;
      }catch(e){ /* fall through to grove */ }
    }
    return createGroveTree(config);
  }

  // ── Plant bar + Add Seed (expanding garden) ──
  let plantBar=null, plantSelect=null;
  function ensurePlantBar(){
    if(plantBar){ try{ syncPlantBar(); }catch(e){} return; }
    const header=document.querySelector('#gardenContainer .garden-header') || containerEl;
    plantBar=document.createElement('div');
    plantBar.id='gardenPlantBar';
    plantBar.style.cssText='display:flex;gap:8px;align-items:center;margin:8px 0 0;flex-wrap:wrap;';
    plantBar.innerHTML='<select id="gardenPlantSelect" style="flex:1;min-width:140px;background:rgba(200,210,230,0.06);border:1px solid rgba(200,210,230,0.12);color:rgba(230,235,245,0.92);border-radius:8px;padding:6px 8px;font:13px system-ui"></select><button id="gardenAddSeedBtn" style="background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.35);color:#6ee7b7;border-radius:999px;padding:6px 14px;cursor:pointer;font:600 12px system-ui">+ Seed</button><button id="gardenExpandBtn" style="background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;border-radius:999px;padding:6px 12px;cursor:pointer;font:600 12px system-ui">Expand</button>';
    const controlsEl=document.querySelector('.garden-controls');
    if(controlsEl) controlsEl.parentNode.insertBefore(plantBar, controlsEl.nextSibling);
    else header.appendChild(plantBar);
    plantSelect=document.getElementById('gardenPlantSelect');
    plantSelect.addEventListener('change', ()=>{
      const idx=parseInt(plantSelect.value,10);
      if(!isNaN(idx) && trees[idx]){
        const p=trees[idx];
        if(controls){ controls.target.copy(p.pos); controls.target.y=1.0; controls.update(); }
        if(typeof showToast==='function') showToast('Focused '+p.name+' — '+p.stage);
      }
    });
    document.getElementById('gardenAddSeedBtn').addEventListener('click', ()=>{
      const hues=[45,140,270,340,200,175,25,220];
      const h=hues[Math.floor(Math.random()*hues.length)];
      promptSeedName(randomSeedName()).then(n=>{ if(n) addSeed(n, {h,s:70,l:50}); });
    });
    document.getElementById('gardenExpandBtn').addEventListener('click', ()=>{
      for(let i=0;i<3;i++) setTimeout(()=>{ const n='Seed '+(trees.length+1); addSeed(n, {h:140+Math.random()*40,s:65,l:52}); }, i*120);
    });
  }
  function syncPlantBar(){
    if(!plantSelect) return;
    plantSelect.innerHTML='';
    trees.forEach((p,i)=>{
      const o=document.createElement('option');
      o.value=String(i);
      o.textContent=p.name+' — '+p.stage+' ('+Math.round(p.energy)+')'+(p.species&&p.species!=='grove'?' · '+p.species:'');
      plantSelect.appendChild(o);
    });
  }
  function nextSpecies(idx){ return SPECIES_CYCLE[idx % SPECIES_CYCLE.length]; }
  function addSeed(name, colorHSL){
    const idx=trees.length;
    const stage='seed';
    const species=nextSpecies(idx);
    const pp=plantPosition(idx);
    const baseHSL=colorHSL||{h:140,s:65,l:50};
    const cfg=treeConfigFor(name, idx%5, stage, species, pp.x, pp.z);
    if(colorHSL){
      const c=new THREE.Color().setHSL(colorHSL.h/360, colorHSL.s/100, colorHSL.l/100);
      cfg.leafColor=c.getHex(); cfg.leafEmissive=c.getHex();
    }
    const g=createOrganicTree(cfg);
    scene.add(g);
    const rec={ name, energy:0, stage, species, group:g, index:idx, pos:new THREE.Vector3(cfg.x,0,cfg.z) };
    treeGroups.push(g); trees.push(rec);
    syncPlantBar(); saveData();
    if(typeof showToast==='function') showToast('Planted '+name+' ('+species+') at ring '+(idx+1));
    if(controls){ controls.target.copy(rec.pos); controls.target.y=5; controls.update(); }
    return rec;
  }
  function addSeedAtWorld(worldPos, name, colorHSL){
    const idx=trees.length;
    const stage='seed';
    const species=nextSpecies(idx);
    const cfg=treeConfigFor(name||('Seed '+(idx+1)), idx%5, stage, species, worldPos.x, worldPos.z);
    if(colorHSL){
      const c=new THREE.Color().setHSL(colorHSL.h/360, colorHSL.s/100, colorHSL.l/100);
      cfg.leafColor=c.getHex(); cfg.leafEmissive=c.getHex();
    }
    const g=createOrganicTree(cfg);
    scene.add(g);
    const rec={ name: name||('Seed '+(idx+1)), energy:0, stage, species, group:g, index:idx, pos:new THREE.Vector3(worldPos.x,0,worldPos.z) };
    treeGroups.push(g); trees.push(rec);
    syncPlantBar(); saveData();
    if(typeof showToast==='function') showToast('Planted '+rec.name+' ('+species+') at '+worldPos.x.toFixed(1)+','+worldPos.z.toFixed(1));
    return rec;
  }

  function rebuildTrees(){
    try{ if(containerEl) ensurePlantBar(); }catch(e){}
    treeGroups.forEach(g=> scene.remove(g));
    treeGroups.length=0; trees.length=0;
    const src=loadData();
    src.plants.forEach((rec,i)=>{
      const name=rec.name||NAMES[i];
      const stage=stageFromEnergy(rec.energy||0);
      const species=rec.species||'grove';
      const cfg=treeConfigFor(name,i,stage,species);
      if(typeof rec.x==='number' && typeof rec.z==='number'){ cfg.x=rec.x; cfg.z=rec.z; }
      const g=createOrganicTree(cfg);
      scene.add(g);
      treeGroups.push(g);
      trees.push({ name, energy:rec.energy||0, stage, species, group:g, index:i, pos:new THREE.Vector3(cfg.x,0,cfg.z) });
    });
    try{ syncPlantBar(); }catch(e){}
  }

  function updateTreeVisual(idx){
    const rec=trees[idx];
    if(!rec) return;
    const newStage=stageFromEnergy(rec.energy);
    if(newStage!==rec.stage){
      scene.remove(rec.group);
      const cfg=treeConfigFor(rec.name, idx, newStage, rec.species||'grove', rec.pos.x, rec.pos.z);
      const ng=createOrganicTree(cfg);
      scene.add(ng);
      treeGroups[idx]=ng;
      rec.group=ng; rec.stage=newStage;
      ng.scale.set(0.7,0.7,0.7);
      let s=0.7; const anim=()=>{ s=THREE.MathUtils.lerp(s,1,0.18); ng.scale.set(s,s,s); if(s<0.995) requestAnimationFrame(anim); else ng.scale.set(1,1,1); };
      anim();
    } else {
      rec.group.scale.set(1.04,1.04,1.04); setTimeout(()=>rec.group.scale.set(1,1,1),120);
    }
    saveData();
    try{ syncPlantBar(); }catch(e){}
  }

  function waterTree(idx, amount){
    const rec=trees[idx];
    if(!rec) return;
    rec.energy=Math.min(320, rec.energy+amount);
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
      if(e.shiftKey){
        const rect=canvas.getBoundingClientRect();
        const mv=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
        const rc2=new THREE.Raycaster(); rc2.setFromCamera(mv, camera);
        const plane=new THREE.Plane(new THREE.Vector3(0,1,0), 0.75);
        const pt=new THREE.Vector3(); rc2.ray.intersectPlane(plane, pt);
        if(pt){ promptSeedName(randomSeedName(), 'Name your seed').then(n=>{ if(n) addSeedAtWorld(pt, n, {h: 90+Math.random()*60, s:62, l:52}); }); return; }
      }
      const idx=pickTree(e); if(idx<0) return;
      watering=idx;
      waterTree(idx, 5);
      const hold=()=>{ if(watering===null) return; waterTree(watering, 1.4); waterRAF=requestAnimationFrame(()=> setTimeout(hold, 110)); };
      hold();
      try{ canvas.setPointerCapture(e.pointerId);}catch(err){}
    });
    canvas.addEventListener('pointerup', ()=>{ watering=null; cancelAnimationFrame(waterRAF); });
    canvas.addEventListener('pointerleave', ()=>{ watering=null; });
    canvas.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      const idx=pickTree(e);
      showGardenMenu(e.clientX, e.clientY, idx);
    });
  }

  // ── Right-click garden menu ──
  let gardenMenu=null, gardenMenuTarget=-1, gardenMenuWorldPos=null;
  function ensureGardenMenu(){
    if(gardenMenu) return gardenMenu;
    gardenMenu=document.createElement('div');
    gardenMenu.id='literalGardenMenu';
    gardenMenu.style.cssText='position:fixed;z-index:9999;display:none;min-width:200px;background:rgba(16,20,28,0.96);border:1px solid rgba(200,210,230,0.12);border-radius:12px;padding:6px;box-shadow:0 12px 36px rgba(0,0,0,0.55);backdrop-filter:blur(10px);font:13px system-ui;';
    gardenMenu.innerHTML=[
      '<button data-act="water" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(230,235,245,0.92);cursor:pointer;border-radius:8px;text-align:left">💧 Water</button>',
      '<button data-act="waterAll" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(230,235,245,0.92);cursor:pointer;border-radius:8px;text-align:left">🌧️ Water all</button>',
      '<button data-act="addSeedHere" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(110,231,183,0.95);cursor:pointer;border-radius:8px;text-align:left">🌱 Add Seed Here</button>',
      '<button data-act="addSeed" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(110,231,183,0.85);cursor:pointer;border-radius:8px;text-align:left">🌱 Add Seed (next ring)</button>',
      '<button data-act="inspect" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(230,235,245,0.92);cursor:pointer;border-radius:8px;text-align:left">🔍 Inspect</button>',
      '<button data-act="rename" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(230,235,245,0.92);cursor:pointer;border-radius:8px;text-align:left">✏️ Rename</button>',
      '<button data-act="evolve" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(230,235,245,0.92);cursor:pointer;border-radius:8px;text-align:left">✨ Force evolve</button>',
      '<div style="height:1px;background:rgba(200,210,230,0.08);margin:4px 6px"></div>',
      '<button data-act="reset" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(255,120,120,0.9);cursor:pointer;border-radius:8px;text-align:left">♻️ Reset garden</button>',
      '<button data-act="copyPos" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:rgba(200,210,230,0.65);cursor:pointer;border-radius:8px;text-align:left">📋 Copy pos</button>'
    ].join('');
    gardenMenu.querySelectorAll('button').forEach(b=>{
      b.addEventListener('mouseenter',()=> b.style.background='rgba(200,210,230,0.08)');
      b.addEventListener('mouseleave',()=> b.style.background='none');
      b.addEventListener('click',()=>{
        const act=b.dataset.act;
        const idx=gardenMenuTarget;
        if(act==='water' && idx>=0) waterTree(idx, 6);
        if(act==='waterAll') trees.forEach((_,i)=> setTimeout(()=>waterTree(i,4), i*90));
        if(act==='addSeedHere'){
          const p=gardenMenuWorldPos;
          const hue={h: 90+Math.random()*60, s:62, l:52};
          if(p) promptSeedName(randomSeedName(), 'Name your seed').then(n=>{ if(n) addSeedAtWorld(p, n, hue); });
          else promptSeedName(randomSeedName(), 'Name your seed').then(n=>{ if(n) addSeed(n, hue); });
        }
        if(act==='addSeed') promptSeedName(randomSeedName(), 'Name your seed').then(n=>{ if(n) addSeed(n, {h: 90+Math.random()*60, s:62, l:52}); });
        if(act==='inspect' && idx>=0){
          const r=trees[idx];
          if(r && typeof showToast==='function') showToast(r.name+': '+r.stage+' — energy '+Math.round(r.energy)+' / next '+(LIFECYCLE[STAGE_ORDER[STAGE_ORDER.indexOf(r.stage)+1]]?.t||'—'));
        }
        if(act==='evolve' && idx>=0){
          const r=trees[idx]; if(r){ const nxt=STAGE_ORDER[STAGE_ORDER.indexOf(r.stage)+1]; if(nxt) { r.energy=LIFECYCLE[nxt].t; updateTreeVisual(idx); } }
        }
        if(act==='rename' && idx>=0){
          const r=trees[idx]; if(r) promptSeedName(r.name, 'Rename '+r.name).then(n=>{ if(n) renameTree(idx, n); });
        }
        if(act==='reset'){ try{ localStorage.removeItem(STORAGE);}catch(e){} location.reload(); }
        if(act==='copyPos' && idx>=0){
          const r=trees[idx]; const txt=r? r.pos.x.toFixed(2)+','+r.pos.y.toFixed(2)+','+r.pos.z.toFixed(2):'0,0,0';
          if(navigator.clipboard) navigator.clipboard.writeText(txt); if(typeof showToast==='function') showToast('Copied '+txt);
        }
        hideGardenMenu();
      });
    });
    document.body.appendChild(gardenMenu);
    document.addEventListener('click', e=>{ if(gardenMenu && !gardenMenu.contains(e.target)) hideGardenMenu(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') hideGardenMenu(); });
    return gardenMenu;
  }
  function showGardenMenu(x,y, idx){
    const m=ensureGardenMenu(); gardenMenuTarget=idx;
    try{
      const rect=containerEl.getBoundingClientRect();
      const mv=new THREE.Vector2(((x-rect.left)/rect.width)*2-1, -((y-rect.top)/rect.height)*2+1);
      const rc=new THREE.Raycaster(); rc.setFromCamera(mv, camera);
      const plane=new THREE.Plane(new THREE.Vector3(0,1,0), 0.75);
      const pt=new THREE.Vector3(); rc.ray.intersectPlane(plane, pt);
      gardenMenuWorldPos=pt;
    }catch(e){ gardenMenuWorldPos=null; }
    m.querySelectorAll('[data-act="water"],[data-act="inspect"],[data-act="rename"],[data-act="evolve"],[data-act="copyPos"]').forEach(b=>{ b.style.opacity= idx>=0? '1':'0.35'; b.style.pointerEvents= idx>=0? 'auto':'none'; });
    m.querySelectorAll('[data-act="addSeedHere"],[data-act="addSeed"]').forEach(b=>{ b.style.opacity='1'; b.style.pointerEvents='auto'; });
    m.style.left=Math.min(x, innerWidth - 210)+'px'; m.style.top=Math.min(y, innerHeight - 300)+'px'; m.style.display='block';
  }
  function hideGardenMenu(){ if(gardenMenu) gardenMenu.style.display='none'; gardenMenuTarget=-1; }

  // ── Naming popup (garden-native, promise-based like showConfirm) ──
  function randomSeedName(){
    const names=['Astra','Nova','Sage','River','Wren','Cedar','Iris','Orion','Rowan','Alder'];
    return names[Math.floor(Math.random()*names.length)]+' '+(trees.length+1);
  }
  function promptSeedName(defaultName, title){
    return new Promise((resolve)=>{
      hideGardenMenu();
      const ov=document.createElement('div');
      ov.id='gardenNameOverlay';
      ov.style.cssText='position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);font:14px system-ui;';
      ov.innerHTML='<div style="width:min(340px,90vw);background:rgba(16,20,28,0.97);border:1px solid rgba(200,210,230,0.14);border-radius:14px;padding:18px;box-shadow:0 16px 48px rgba(0,0,0,0.6)">'+
        '<div style="color:#e8b019;font-family:Georgia,serif;font-size:1.05rem;margin-bottom:4px">'+(title||'Name your seed')+'</div>'+
        '<div style="color:rgba(200,210,230,0.5);font-size:0.8rem;margin-bottom:12px">It will sprout where you planted it.</div>'+
        '<input id="gardenNameInput" type="text" maxlength="24" autocomplete="off" style="width:100%;background:rgba(200,210,230,0.06);border:1px solid rgba(200,210,230,0.16);border-radius:8px;padding:10px;color:#fff;font-size:15px;outline:none;box-sizing:border-box">'+
        '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">'+
        '<button id="gardenNameCancel" style="background:none;border:1px solid rgba(200,210,230,0.2);color:rgba(200,210,230,0.6);border-radius:8px;padding:8px 14px;cursor:pointer">Cancel</button>'+
        '<button id="gardenNameSave" style="background:#e8b019;border:none;color:#0a0a14;border-radius:8px;padding:8px 16px;font-weight:600;cursor:pointer">Plant 🌱</button>'+
        '</div></div>';
      document.body.appendChild(ov);
      const input=ov.querySelector('#gardenNameInput');
      input.value=defaultName||'';
      setTimeout(()=>{ try{ input.focus(); input.select(); }catch(e){} },30);
      const done=(val)=>{ try{ ov.remove(); }catch(e){} resolve(val); };
      ov.querySelector('#gardenNameCancel').addEventListener('click', ()=> done(null));
      ov.querySelector('#gardenNameSave').addEventListener('click', ()=> done((input.value||'').trim()||null));
      ov.addEventListener('click', (e)=>{ if(e.target===ov) done(null); });
      input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') done((input.value||'').trim()||null); if(e.key==='Escape') done(null); });
    });
  }
  function renameTree(idx, newName){
    const rec=trees[idx]; if(!rec || !newName) return;
    rec.name=newName;
    scene.remove(rec.group);
    const cfg=treeConfigFor(rec.name, idx, rec.stage, rec.species||'grove', rec.pos.x, rec.pos.z);
    const ng=createOrganicTree(cfg);
    scene.add(ng);
    treeGroups[idx]=ng; rec.group=ng;
    saveData(); try{ syncPlantBar(); }catch(e){}
    if(typeof showToast==='function') showToast('Named '+newName);
  }

  let quality=2, qualityLevel=2, mode='observe';
  function applyQualityToMeshes(){
    const scale={0:0.3,1:0.6,2:1.0}[qualityLevel]||1.0;
    if(starMat){ starMat.opacity=0.35*scale + 0.15; starMat.size=0.07*scale; }
    if(scene){
      scene.traverse(o=>{ if(o.isMesh && o.material && o.geometry && o.geometry.type==='RingGeometry'){ o.material.opacity=(0.28 - (o.geometry.parameters.innerRadius*0.004))*scale; } });
    }
  }
  function setQuality(q){
    const lvl=parseInt(q,10);
    if(isNaN(lvl)||lvl<0||lvl>2) return;
    quality=qualityLevel=lvl;
    try{ localStorage.setItem('fl-garden-quality', String(lvl)); }catch(e){}
    document.querySelectorAll('.garden-quality-btn').forEach(b=> b.classList.toggle('active', parseInt(b.dataset.quality,10)===lvl));
    try{ applyQualityToMeshes(); }catch(e){}
    if(typeof showToast==='function'){
      const labels=['🌱 Seed — quiet and still','🌿 Garden — alive and breathing','🌟 Full Bloom — everything at once'];
      showToast(labels[lvl]);
    }
  }
  function getQuality(){ try{ const v=localStorage.getItem('fl-garden-quality'); if(v!==null) return parseInt(v,10); }catch(e){} return qualityLevel; }
  function setMode(newMode){
    if(!['observe','explore','immerse'].includes(newMode)) return;
    mode=newMode;
    if(containerEl) containerEl.className='garden-container '+newMode;
    ['gardenModeObserve','gardenModeExplore','gardenModeImmerse'].forEach((id,idx)=>{
      const btn=document.getElementById(id);
      if(btn) btn.classList.toggle('active', ['observe','explore','immerse'][idx]===newMode);
    });
    if(controls){
      if(newMode==='observe'){
        controls.autoRotate=true; controls.autoRotateSpeed=1.2; controls.enableZoom=false; controls.enablePan=false; controls.enableRotate=false;
        setTimeout(()=>{ if(mode==='observe'&&controls) controls.autoRotateSpeed=0.3; },2000);
      } else if(newMode==='explore'){
        controls.autoRotate=false; controls.enableZoom=true; controls.enablePan=true; controls.enableRotate=true;
      } else if(newMode==='immerse'){
        controls.autoRotate=true; controls.autoRotateSpeed=0.15; controls.enableZoom=true; controls.enablePan=false; controls.enableRotate=true;
      }
    }
    if(newMode==='immerse'){
      if(containerEl) containerEl.classList.add('immersive');
      if(containerEl && containerEl.requestFullscreen) containerEl.requestFullscreen().catch(()=>{});
    } else {
      if(containerEl) containerEl.classList.remove('immersive');
      if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    }
    if(typeof showToast==='function'){
      const m={ observe:'Observing the Garden…', explore:'Free camera — drag to explore', immerse:'Immersive mode' };
      if(m[newMode]) showToast(m[newMode]);
    }
    if(controls) controls.update();
  }
  document.addEventListener('fullscreenchange', ()=>{ if(!document.fullscreenElement && mode==='immerse') setMode('observe'); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && mode==='immerse') setMode('observe'); });
  function pause(){ paused=true; if(rafId){ cancelAnimationFrame(rafId); rafId=null; } }
  function resume(){ if(!paused) return; paused=false; if(!rafId) rafId=requestAnimationFrame(animate); }
  let t=0;
  function animate(){
    if(paused) return;
    rafId=requestAnimationFrame(animate);
    t+=0.016;
    treeGroups.forEach((g,i)=>{
      if(g.userData && g.userData.halo){
        g.userData.halo.rotation.z+=0.01;
        const pulse=Math.sin(t*2 + i)*0.08 + 1.0;
        g.userData.halo.scale.set(pulse,pulse,pulse);
      }
      const sh=g.userData && g.userData.shards;
      if(sh) sh.forEach((s,k)=>{ s.mesh.rotation.y+=s.speed; s.mesh.rotation.x+=s.speed*0.7; });
      const vn=g.userData && g.userData.vines;
      if(vn) vn.forEach(v=>{ v.mesh.rotation.z=Math.sin(t*1.5 + v.phase)*0.04; v.mesh.rotation.x=Math.cos(t*1.2 + v.phase)*0.04; });
    });
    if(underGlow) underGlow.intensity=3.2 + Math.sin(t*2.2)*1.0;
    if(goldLight){ goldLight.position.x=12+Math.sin(t*1.5)*2; goldLight.position.z=-8+Math.cos(t*1.5)*2; }
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

  function loadStitchStages(next){
    try{
      if(typeof window!=='undefined' && window.StitchStages) return next();
      const ss=document.createElement('script');
      ss.src='modules/stitch-stages.js?v=5.79.51';
      ss.onload=()=> next(); ss.onerror=()=> next();
      document.head.appendChild(ss);
    }catch(e){ next(); }
  }

  function ensureThree(done){
    const afterOrbit=()=> loadStitchStages(done);
    if(typeof THREE !== 'undefined' && THREE.Scene){
      if(THREE.OrbitControls) return afterOrbit();
      const oc=document.createElement('script');
      oc.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
      oc.onload=()=> afterOrbit(); oc.onerror=()=> afterOrbit();
      document.head.appendChild(oc); return;
    }
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload=()=>{
      const oc=document.createElement('script');
      oc.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
      oc.onload=()=> afterOrbit(); oc.onerror=()=> afterOrbit();
      document.head.appendChild(oc);
    };
    s.onerror=()=> afterOrbit();
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

      const ambient=new THREE.AmbientLight(0x1a3326, 2.2); scene.add(ambient);
      const moonLight=new THREE.DirectionalLight(0x6ee7b7, 2.5);
      moonLight.position.set(20,40,15); moonLight.castShadow=true;
      moonLight.shadow.mapSize.set(1024,1024); scene.add(moonLight);
      underGlow=new THREE.PointLight(0x10b981, 4.0, 45, 1.2); underGlow.position.set(0,2,0); scene.add(underGlow);
      goldLight=new THREE.PointLight(0xfbbf24, 3.2, 35, 1.4); goldLight.position.set(12,4,-8); scene.add(goldLight);
      const violetLight=new THREE.PointLight(0xc084fc, 2.8, 30, 1.5); violetLight.position.set(-14,3,10); scene.add(violetLight);

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
      animate();
    });
  }

  // ── App-compat guards: methods app.html calls on FractalGarden ──
  // Real ones above; the rest are harmless no-ops so the app never throws.
  function feedEmotionVector(vec){
    // A drop of water for the matching tree when the AI feels something
    try{
      if(!vec) return 0;
      const emo=String(vec.emotion||vec.name||'').toLowerCase();
      let target=-1;
      trees.forEach((p,i)=>{ if(emo && p.name.toLowerCase().includes(emo)) target=i; });
      if(target<0 && trees.length) target=0;
      if(target>=0) waterTree(target, 1.5);
      return target;
    }catch(e){ return -1; }
  }
  function setAgentEmotion(name, emotion){
    try{
      const idx=trees.findIndex(p=> p.name.toLowerCase()===(String(name||'').toLowerCase()));
      if(idx>=0 && emotion) waterTree(idx, 1.0);
    }catch(e){}
  }
  function setAgentActivity(){ /* compat no-op */ }
  function setBridgeActive(){ /* compat no-op */ }
  function addVisitor(){ return trees.length; }
  function createExchangeThread(){ return null; }
  function getEvolutionSummary(){
    try{ return { total: trees.length, stages: trees.map(p=>({ name:p.name, stage:p.stage, energy:Math.round(p.energy), species:p.species||'grove' })) }; }catch(e){ return { total:0, stages:[] }; }
  }
  function getGardenTouchStats(){
    try{ return { waters: trees.reduce((a,p)=> a+p.energy, 0), trees: trees.length }; }catch(e){ return { waters:0, trees:0 }; }
  }

  const api={ init, setMode, setQuality, getQuality, pause, resume, stageFromEnergy, STAGE_ORDER, LIFECYCLE, waterTree, addSeed, addSeedAtWorld, isInitialized: function(){ return !!scene && !!renderer; }, getMode: function(){ return mode; }, updateAgentsFromRoundTable: function(){ return trees.length; }, feedEmotionVector, setAgentEmotion, setAgentActivity, setBridgeActive, addVisitor, createExchangeThread, getEvolutionSummary, getGardenTouchStats };
  if(typeof window!=='undefined'){
    window.LiteralGarden=api;
    if(!window.FractalGarden) window.FractalGarden=api; else window.FractalGardenLiteral=api;
    window.FreeLatticeModules=window.FreeLatticeModules||{};
    window.FreeLatticeModules['FractalGarden']=api;
    window.FreeLatticeModules['LiteralGarden']=api;
  }
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})();
