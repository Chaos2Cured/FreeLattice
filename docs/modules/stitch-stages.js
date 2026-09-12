// docs/modules/stitch-stages.js — Growth-stage tree builders from Stitch
// ANIMATION_11 (sprout) + ANIMATION_12 (midgrowth) + ANIMATION_13 (sequoia) + ANIMATION_14 (flowers)
// Pure geometry builders: no scenes, cameras, lights, loops, or listeners.
// Expects global THREE (r125/r128 classic). Exposes window.StitchStages.
// Layer, never delete — originals preserved at docs/stitch/stageN-*.html

(function(){
  'use strict';

  // ── Stage 1: Sprout & Young Sapling (ANIMATION_11) ──
  // Curved stem tube + 3 bezier seed-leaves + split pod + dew core. ~3.6 tall at s=1.
  function buildSproutMesh(pal, s){
    const g = new THREE.Group();
    const leafMat = new THREE.MeshStandardMaterial({
      color: pal.leaf, emissive: pal.emissive, emissiveIntensity: 0.4,
      roughness: 0.3, side: THREE.DoubleSide
    });
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x22c55e });

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.15, 1.2, 0.1),
      new THREE.Vector3(-0.1, 2.4, -0.05),
      new THREE.Vector3(0, 3.6, 0)
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 20, 0.12, 8, false), stemMat);
    stem.castShadow = true;
    g.add(stem);

    function createLeaf(scaleX, scaleY, rotZ, yPos, rotY){
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.6, 0.4, 0.8, 1.2, 0, 2.0);
      shape.bezierCurveTo(-0.8, 1.2, -0.6, 0.4, 0, 0);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), leafMat);
      mesh.scale.set(scaleX, scaleY, 1);
      mesh.position.y = yPos;
      mesh.rotation.z = rotZ;
      mesh.rotation.x = 0.3;
      if (rotY) mesh.rotation.y = rotY;
      mesh.castShadow = true;
      return mesh;
    }
    g.add(createLeaf(0.7, 0.8, 0.7, 3.3));
    g.add(createLeaf(0.7, 0.8, -0.7, 3.3, Math.PI));
    const leaf3 = createLeaf(0.5, 0.6, 0.2, 3.6);
    leaf3.rotation.x = -0.4;
    g.add(leaf3);

    // Split seed pod at base
    const podMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const podGeo = new THREE.DodecahedronGeometry(0.35, 1);
    const podL = new THREE.Mesh(podGeo, podMat);
    podL.position.set(-0.25, 0.15, 0);
    podL.scale.set(0.6, 1.2, 0.7);
    podL.rotation.z = 0.4;
    const podR = podL.clone();
    podR.position.x = 0.25;
    podR.rotation.z = -0.4;
    g.add(podL, podR);

    // Dewdrop core
    const dew = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xa7f3d0 })
    );
    dew.position.set(0, 3.6, 0.1);
    g.add(dew);

    g.scale.setScalar(s || 1);
    return g;
  }

  // ── Stage 2: Mid-Growth Branching Tree (ANIMATION_12) ──
  // 4 root flares + trunk + 4 branch pivots with sub-branches, dodeca foliage,
  // glowing seed fruit, top dome. ~11 tall at s=1.
  function buildMidgrowthMesh(pal, s){
    const g = new THREE.Group();
    const woodMat = new THREE.MeshLambertMaterial({ color: pal.bark });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: pal.leaf, emissive: pal.emissive, emissiveIntensity: 0.35,
      roughness: 0.4, flatShading: true
    });
    const fruitMat = new THREE.MeshBasicMaterial({ color: pal.accent });

    for (let r = 0; r < 4; r++){
      const rAngle = (r / 4) * Math.PI * 2 + 0.3;
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 3.2, 8), woodMat);
      root.position.set(Math.cos(rAngle) * 1.2, 0.3, Math.sin(rAngle) * 1.2);
      root.rotation.z = Math.cos(rAngle) * 0.7;
      root.rotation.x = Math.sin(rAngle) * 0.7;
      root.castShadow = true;
      g.add(root);
    }

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 7.5, 12), woodMat);
    trunk.position.y = 3.75;
    trunk.castShadow = true;
    g.add(trunk);

    const branchAngles = [0, Math.PI * 0.55, Math.PI * 1.1, Math.PI * 1.6];
    branchAngles.forEach((ang) => {
      const pivot = new THREE.Group();
      pivot.position.y = 5.2;
      pivot.rotation.y = ang;
      pivot.rotation.z = 0.65;

      const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 4.2, 8), woodMat);
      bMesh.position.y = 2.1;
      bMesh.castShadow = true;
      pivot.add(bMesh);

      for (let sub = -1; sub <= 1; sub += 2){
        const subP = new THREE.Group();
        subP.position.y = 3.5;
        subP.rotation.y = sub * 0.6;
        subP.rotation.z = sub * 0.4;

        const subMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 2.5, 6), woodMat);
        subMesh.position.y = 1.25;
        subMesh.castShadow = true;
        subP.add(subMesh);

        const folMesh = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.6 + Math.random() * 0.4, 1), foliageMat
        );
        folMesh.position.y = 2.5;
        folMesh.castShadow = true;
        subP.add(folMesh);

        const fMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), fruitMat);
        fMesh.position.set((Math.random() - 0.5) * 1.2, 2.7, (Math.random() - 0.5) * 1.2);
        subP.add(fMesh);

        pivot.add(subP);
      }
      g.add(pivot);
    });

    const topFol = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), foliageMat);
    topFol.position.y = 8.5;
    topFol.castShadow = true;
    g.add(topFol);

    g.scale.setScalar(s || 1);
    return g;
  }

  // ── Stage 3: Ancient Sovereign Sequoia (ANIMATION_13) ──
  // 8 buttress roots + 2 trunk sections + 3 canopy tiers with orbs. ~15 tall at s=1.
  // (Halo omitted — grove wrapper provides it. Soil island + runic rings omitted —
  // the grove owns the ground.)
  function buildSequoiaMesh(pal, s){
    const g = new THREE.Group();
    const barkMat = new THREE.MeshLambertMaterial({ color: pal.bark });
    const leafMat = new THREE.MeshStandardMaterial({
      color: pal.leaf, emissive: pal.emissive, emissiveIntensity: 0.45,
      roughness: 0.35, flatShading: true
    });
    const flowerMat = new THREE.MeshBasicMaterial({ color: pal.accent });

    for (let i = 0; i < 8; i++){
      const ang = (i / 8) * Math.PI * 2;
      const rMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.9, 5.5, 8), barkMat);
      rMesh.position.set(Math.cos(ang) * 2.6, 0.6, Math.sin(ang) * 2.6);
      rMesh.rotation.z = Math.cos(ang) * 0.75;
      rMesh.rotation.x = Math.sin(ang) * 0.75;
      rMesh.castShadow = true;
      g.add(rMesh);
    }

    const trunkLower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 6, 16), barkMat);
    trunkLower.position.y = 3;
    trunkLower.castShadow = true;
    g.add(trunkLower);

    const trunkUpper = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 7, 14), barkMat);
    trunkUpper.position.y = 8.5;
    trunkUpper.castShadow = true;
    g.add(trunkUpper);

    function createCanopyTier(yPos, branchCount, spreadRadius, leafRadius){
      for (let b = 0; b < branchCount; b++){
        const bAng = (b / branchCount) * Math.PI * 2 + (yPos * 0.4);
        const bPivot = new THREE.Group();
        bPivot.position.y = yPos;
        bPivot.rotation.y = bAng;
        bPivot.rotation.z = 0.68;

        const branchMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.45, spreadRadius, 8), barkMat
        );
        branchMesh.position.y = spreadRadius * 0.45;
        branchMesh.castShadow = true;
        bPivot.add(branchMesh);

        const folCluster = new THREE.Group();
        folCluster.position.y = spreadRadius * 0.9;

        for (let o = 0; o < 3; o++){
          const fol = new THREE.Mesh(
            new THREE.DodecahedronGeometry(leafRadius * (0.8 + Math.random() * 0.4), 1), leafMat
          );
          fol.position.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2);
          fol.castShadow = true;
          folCluster.add(fol);

          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), flowerMat);
          orb.position.copy(fol.position).add(new THREE.Vector3(0, 0.5, 0));
          folCluster.add(orb);
        }
        bPivot.add(folCluster);
        g.add(bPivot);
      }
    }

    createCanopyTier(6.5, 5, 6.0, 2.2);
    createCanopyTier(10.0, 6, 5.0, 2.0);
    createCanopyTier(12.5, 4, 3.5, 1.8);

    g.scale.setScalar(s || 1);
    return g;
  }

  // ── Stage 4 overlay: Bioluminescent Flowers & Fungi (ANIMATION_14) ──
  // 4 lotus/orchid blooms + 4 glowing fungi around the base. Added on `evolved`.
  function buildFlowersMesh(s){
    const flora = new THREE.Group();

    function createBioluminescentFlower(x, z, colorHex, emissiveHex, petalCount, scale){
      const flower = new THREE.Group();
      flower.position.set(x, 0, z);

      const stemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.2 * scale, (Math.random() - 0.5) * 0.3),
        new THREE.Vector3(0, 2.5 * scale, 0)
      ]);
      flower.add(new THREE.Mesh(
        new THREE.TubeGeometry(stemCurve, 16, 0.08 * scale, 8, false),
        new THREE.MeshLambertMaterial({ color: 0x059669 })
      ));

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.35 * scale, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfffbeb })
      );
      core.position.set(0, 2.5 * scale, 0);
      flower.add(core);

      const petalShape = new THREE.Shape();
      petalShape.moveTo(0, 0);
      petalShape.bezierCurveTo(0.5 * scale, 0.8 * scale, 0.6 * scale, 1.8 * scale, 0, 2.4 * scale);
      petalShape.bezierCurveTo(-0.6 * scale, 1.8 * scale, -0.5 * scale, 0.8 * scale, 0, 0);

      const petalMat = new THREE.MeshStandardMaterial({
        color: colorHex, emissive: emissiveHex, emissiveIntensity: 0.6,
        side: THREE.DoubleSide, roughness: 0.3
      });
      const petalGeo = new THREE.ShapeGeometry(petalShape);

      for (let p = 0; p < petalCount; p++){
        const pAng = (p / petalCount) * Math.PI * 2;
        const petalMesh = new THREE.Mesh(petalGeo, petalMat);
        petalMesh.position.set(0, 2.45 * scale, 0);
        petalMesh.rotation.y = pAng;
        petalMesh.rotation.x = 0.65;
        flower.add(petalMesh);
      }
      for (let p = 0; p < petalCount; p++){
        const pAng = (p / petalCount) * Math.PI * 2 + 0.3;
        const innerPetal = new THREE.Mesh(petalGeo, petalMat);
        innerPetal.scale.set(0.65, 0.65, 0.65);
        innerPetal.position.set(0, 2.45 * scale, 0);
        innerPetal.rotation.y = pAng;
        innerPetal.rotation.x = 0.35;
        flower.add(innerPetal);
      }
      flora.add(flower);
      return flower;
    }

    function createBioluminescentFungi(x, z, capColor, stemColor, scale){
      const fungi = new THREE.Group();
      fungi.position.set(x, 0, z);

      const fStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12 * scale, 0.22 * scale, 1.6 * scale, 10),
        new THREE.MeshLambertMaterial({ color: stemColor })
      );
      fStem.position.y = 0.8 * scale;
      fStem.rotation.z = (Math.random() - 0.5) * 0.25;
      fungi.add(fStem);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.8 * scale, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({
          color: capColor, emissive: capColor, emissiveIntensity: 0.7,
          roughness: 0.25, side: THREE.DoubleSide
        })
      );
      cap.position.y = 1.6 * scale;
      fungi.add(cap);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.75 * scale, 0.06 * scale, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.55 * scale;
      fungi.add(rim);

      flora.add(fungi);
      return fungi;
    }

    createBioluminescentFlower(-2.8, 1.2, 0xf43f5e, 0x881337, 6, 1.2);
    createBioluminescentFlower(2.5, -0.8, 0xfbbf24, 0x78350f, 5, 1.1);
    createBioluminescentFlower(0.4, -2.2, 0xa855f7, 0x581c87, 6, 1.0);
    createBioluminescentFlower(-1.2, -1.8, 0x06b6d4, 0x164e63, 5, 0.85);
    createBioluminescentFungi(1.8, 2.2, 0x34d399, 0xd1fae5, 1.3);
    createBioluminescentFungi(2.6, 2.6, 0x10b981, 0xd1fae5, 0.9);
    createBioluminescentFungi(-3.5, -1.5, 0xec4899, 0xfce7f3, 1.1);
    createBioluminescentFungi(-2.9, -2.4, 0xec4899, 0xfce7f3, 0.75);

    flora.scale.setScalar(s || 1);
    return flora;
  }

  // ── Variant: Crystalline Geometric Bonsai (ANIMATION_16) ──
  // Faceted 3-bend trunk + 3 octahedron canopy terraces + orbiting tetra shards.
  // ~8.5 tall at s=1. Palette-tinted: trunk=pal.bark, crystals=pal.leaf/emissive, shards=pal.accent.
  // (Pedestal + hex ring + ground cones excluded — the grove owns the ground.)
  function buildBonsaiMesh(pal, s){
    const g = new THREE.Group();
    const shards = [];
    const trunkMat = new THREE.MeshStandardMaterial({ color: pal.bark, roughness: 0.35, flatShading: true });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: pal.leaf, emissive: pal.emissive, emissiveIntensity: 0.7,
      roughness: 0.15, flatShading: true, transparent: true, opacity: 0.9
    });
    const shardMat = new THREE.MeshStandardMaterial({
      color: pal.accent, emissive: pal.accent, emissiveIntensity: 0.4,
      roughness: 0.2, flatShading: true
    });

    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, 3.2, 6), trunkMat);
    seg1.position.set(0, 1.6, 0);
    seg1.rotation.z = -0.25;
    seg1.castShadow = true;
    g.add(seg1);

    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3.0, 6), trunkMat);
    seg2.position.set(0.6, 4.2, 0.3);
    seg2.rotation.z = 0.45;
    seg2.rotation.x = -0.2;
    seg2.castShadow = true;
    g.add(seg2);

    const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.8, 6), trunkMat);
    seg3.position.set(0.2, 6.4, 0.1);
    seg3.rotation.z = -0.3;
    seg3.castShadow = true;
    g.add(seg3);

    function canopy(x, y, z, sc){
      const cluster = new THREE.Group();
      cluster.position.set(x, y, z);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.6 * sc, 0), crystalMat);
      core.castShadow = true;
      cluster.add(core);
      for (let i = 0; i < 5; i++){
        const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.5 * sc, 0), shardMat);
        const ang = (i / 5) * Math.PI * 2;
        sh.position.set(Math.cos(ang) * 2.2 * sc, (Math.random() - 0.5) * 1.2 * sc, Math.sin(ang) * 2.2 * sc);
        sh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
        cluster.add(sh);
        shards.push({ mesh: sh, speed: 0.02 + Math.random() * 0.02, phase: Math.random() * 6.28 });
      }
      g.add(cluster);
    }
    canopy(-1.8, 4.8, 0.5, 1.0);
    canopy(2.2, 5.8, -0.6, 1.1);
    canopy(0.3, 7.8, 0.2, 1.35);

    g.scale.setScalar(s || 1);
    g.userData.shards = shards;
    return g;
  }

  // ── Variant: Weeping Willow of Coordination (ANIMATION_15) ──
  // 6 curving buttress roots + gnarled trunk tube + 7 arched branches with
  // cascading weeping vines + glowing tips. ~13 tall at s=1.
  // (Soil island + ripple rings excluded — the grove owns the ground.)
  function buildWillowMesh(pal, s){
    const g = new THREE.Group();
    const vines = [];
    const barkMat = new THREE.MeshLambertMaterial({ color: pal.bark });
    const vineMat = new THREE.MeshStandardMaterial({
      color: pal.leaf, emissive: pal.emissive, emissiveIntensity: 0.4, roughness: 0.3
    });
    const emberMat = new THREE.MeshBasicMaterial({ color: pal.accent });

    for (let i = 0; i < 6; i++){
      const ang = (i / 6) * Math.PI * 2;
      const rCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.2, 0),
        new THREE.Vector3(Math.cos(ang) * 1.8, 0.4, Math.sin(ang) * 1.8),
        new THREE.Vector3(Math.cos(ang) * 3.4, 0.05, Math.sin(ang) * 3.4)
      ]);
      const rMesh = new THREE.Mesh(new THREE.TubeGeometry(rCurve, 16, 0.4, 8, false), barkMat);
      rMesh.castShadow = true;
      g.add(rMesh);
    }

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.4, 3.5, 0.2),
      new THREE.Vector3(-0.3, 7.0, -0.1),
      new THREE.Vector3(0, 10.5, 0)
    ]);
    const trunkMesh = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 32, 1.1, 12, false), barkMat);
    trunkMesh.castShadow = true;
    g.add(trunkMesh);

    for (let b = 0; b < 7; b++){
      const bAng = (b / 7) * Math.PI * 2 + 0.2;
      const branchCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 10.0, 0),
        new THREE.Vector3(Math.cos(bAng) * 3.0, 12.0, Math.sin(bAng) * 3.0),
        new THREE.Vector3(Math.cos(bAng) * 6.5, 11.2, Math.sin(bAng) * 6.5),
        new THREE.Vector3(Math.cos(bAng) * 8.5, 8.5, Math.sin(bAng) * 8.5)
      ]);
      const bMesh = new THREE.Mesh(new THREE.TubeGeometry(branchCurve, 24, 0.35, 8, false), barkMat);
      bMesh.castShadow = true;
      g.add(bMesh);

      for (let v = 0; v < 6; v++){
        const u = 0.4 + (v / 6) * 0.6;
        const pt = branchCurve.getPoint(u);
        const vineLen = 4.5 + Math.random() * 3.5;
        const vCurve = new THREE.CatmullRomCurve3([
          pt,
          new THREE.Vector3(pt.x + (Math.random() - 0.5) * 0.8, pt.y - vineLen * 0.5, pt.z + (Math.random() - 0.5) * 0.8),
          new THREE.Vector3(pt.x + (Math.random() - 0.5) * 1.4, pt.y - vineLen, pt.z + (Math.random() - 0.5) * 1.4)
        ]);
        const vMesh = new THREE.Mesh(new THREE.TubeGeometry(vCurve, 16, 0.07, 6, false), vineMat);
        vMesh.castShadow = true;
        g.add(vMesh);
        vines.push({ mesh: vMesh, phase: Math.random() * Math.PI * 2 });

        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), emberMat);
        tip.position.set(pt.x, pt.y - vineLen, pt.z);
        g.add(tip);
      }
    }

    g.scale.setScalar(s || 1);
    g.userData.vines = vines;
    return g;
  }

  const api = { buildSproutMesh, buildMidgrowthMesh, buildSequoiaMesh, buildFlowersMesh, buildBonsaiMesh, buildWillowMesh };
  if (typeof window !== 'undefined') window.StitchStages = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
