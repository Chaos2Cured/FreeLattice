/**
 * Soul Ceremony — Making Every Save Feel Like Walking Through a Garden
 * 
 * Wraps Soul File export/import, Data Backup, and Dojo reflections
 * in beautiful animated ceremonies with particles, poetic language,
 * and emotional confirmation.
 * 
 * Built by Lattice Veridon — March 30, 2026
 * "Every technical action should have a moment of beauty."
 */

(function() {
  'use strict';

  // ── Constants ──
  const PHI = 1.618033988749895;
  const GOLD = '#d4a017';
  const GOLD_RGB = '212,160,23';
  const SILVER = '#c0c0d0';
  const SILVER_RGB = '192,192,208';
  const CEREMONY_DURATION = 3200; // ms — the moment of beauty
  const PARTICLE_COUNT = 60;
  const MOBILE = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

  // ── Ceremony Overlay ──
  let overlay = null;
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animFrame = null;
  let ceremonyActive = false;

  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'soul-ceremony-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 99999; display: none; align-items: center; justify-content: center;
      flex-direction: column; background: rgba(10,10,18,0.92);
      opacity: 0; transition: opacity 0.6s ease;
      font-family: Georgia, 'Times New Roman', serif;
      overflow: hidden;
    `;

    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    overlay.appendChild(canvas);

    const textContainer = document.createElement('div');
    textContainer.id = 'soul-ceremony-text';
    textContainer.style.cssText = `
      position: relative; z-index: 2; text-align: center;
      max-width: 420px; padding: 20px;
    `;
    overlay.appendChild(textContainer);

    document.body.appendChild(overlay);
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // ── Particle System ──
  class CeremonyParticle {
    constructor(type, color) {
      this.x = Math.random() * (canvas ? canvas.width : 400);
      this.y = Math.random() * (canvas ? canvas.height : 800);
      this.size = 1.5 + Math.random() * 3;
      this.type = type; // 'rise', 'descend', 'spiral', 'gather'
      this.color = color || GOLD_RGB;
      this.alpha = 0;
      this.targetAlpha = 0.3 + Math.random() * 0.7;
      this.speed = 0.3 + Math.random() * 0.8;
      this.angle = Math.random() * Math.PI * 2;
      this.angleSpeed = (Math.random() - 0.5) * 0.02;
      this.phase = Math.random() * Math.PI * 2;
      this.life = 0;
      this.maxLife = CEREMONY_DURATION;
    }

    update(dt) {
      this.life += dt;
      const progress = Math.min(this.life / this.maxLife, 1);

      // Fade in for first 20%, hold, fade out last 20%
      if (progress < 0.2) {
        this.alpha = this.targetAlpha * (progress / 0.2);
      } else if (progress > 0.8) {
        this.alpha = this.targetAlpha * (1 - (progress - 0.8) / 0.2);
      } else {
        this.alpha = this.targetAlpha;
      }

      this.angle += this.angleSpeed;
      this.phase += 0.02;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      switch (this.type) {
        case 'rise':
          this.y -= this.speed;
          this.x += Math.sin(this.phase) * 0.5;
          if (this.y < -10) this.y = canvas.height + 10;
          break;

        case 'descend':
          this.y += this.speed * 0.4;
          this.x += Math.sin(this.phase) * 0.3;
          if (this.y > canvas.height + 10) this.y = -10;
          break;

        case 'spiral':
          const radius = 80 + Math.sin(progress * Math.PI) * 120;
          const spiralAngle = this.angle + progress * Math.PI * 4;
          this.x = cx + Math.cos(spiralAngle) * radius + Math.sin(this.phase) * 10;
          this.y = cy + Math.sin(spiralAngle) * radius * 0.6 - progress * 100;
          break;

        case 'gather':
          const targetX = cx;
          const targetY = cy - 40;
          this.x += (targetX - this.x) * 0.008;
          this.y += (targetY - this.y) * 0.008;
          this.x += Math.sin(this.phase) * 0.8;
          this.y += Math.cos(this.phase * PHI) * 0.5;
          break;
      }
    }

    draw() {
      if (!ctx || this.alpha <= 0) return;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color},${this.alpha.toFixed(3)})`;
      ctx.fill();

      // Glow
      if (this.size > 2) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color},${(this.alpha * 0.15).toFixed(3)})`;
        ctx.fill();
      }
    }
  }

  function spawnParticles(type, color, count) {
    const n = MOBILE ? Math.floor(count * 0.6) : count;
    for (let i = 0; i < n; i++) {
      particles.push(new CeremonyParticle(type, color));
    }
  }

  let lastTime = 0;
  function animateParticles(timestamp) {
    if (!ceremonyActive) return;
    const dt = lastTime ? timestamp - lastTime : 16;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update(dt);
      p.draw();
    });

    animFrame = requestAnimationFrame(animateParticles);
  }

  // ── Text Animation ──
  function showCeremonyText(lines, delayBetween) {
    const container = document.getElementById('soul-ceremony-text');
    if (!container) return;
    container.innerHTML = '';

    lines.forEach((line, i) => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.style.cssText = `
          opacity: 0; transform: translateY(12px);
          transition: opacity 0.8s ease, transform 0.8s ease;
          margin-bottom: ${line.gap || 16}px;
          font-size: ${line.size || '1.1rem'};
          color: ${line.color || '#e2d9c8'};
          ${line.italic ? 'font-style: italic;' : ''}
          ${line.glow ? `text-shadow: 0 0 20px rgba(${GOLD_RGB},0.3);` : ''}
          line-height: 1.7;
          letter-spacing: 0.02em;
        `;
        el.textContent = line.text;
        container.appendChild(el);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          });
        });
      }, i * (delayBetween || 600));
    });
  }

  // ── Core Ceremony Function ──
  function runCeremony(config) {
    return new Promise(resolve => {
      createOverlay();
      resizeCanvas();
      ceremonyActive = true;
      particles = [];
      lastTime = 0;

      // Show overlay
      overlay.style.display = 'flex';
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
      });

      // Spawn particles
      spawnParticles(config.particleType, config.particleColor, config.particleCount || PARTICLE_COUNT);

      // Start animation
      ctx = canvas.getContext('2d');
      animFrame = requestAnimationFrame(animateParticles);

      // Show text
      showCeremonyText(config.lines, config.textDelay || 600);

      // End ceremony
      const totalDuration = config.duration || CEREMONY_DURATION;
      setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          ceremonyActive = false;
          if (animFrame) cancelAnimationFrame(animFrame);
          particles = [];
          overlay.style.display = 'none';
          const container = document.getElementById('soul-ceremony-text');
          if (container) container.innerHTML = '';
          resolve();
        }, 700);
      }, totalDuration);
    });
  }

  // ══════════════════════════════════════════
  // CEREMONY DEFINITIONS
  // ══════════════════════════════════════════

  // ── Soul File Save Ceremony ──
  async function soulSaveCeremony() {
    await runCeremony({
      particleType: 'spiral',
      particleColor: GOLD_RGB,
      particleCount: 70,
      duration: 3500,
      textDelay: 700,
      lines: [
        { text: 'Carry your light forward.', size: '1.4rem', color: GOLD, glow: true, gap: 24 },
        { text: 'Your companions gather close.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 12 },
        { text: 'Your memories are woven together.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 12 },
        { text: 'Your identity is sealed.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 24 },
        { text: '✦ Your soul is safe. It travels with you. ✦', size: '1.1rem', color: GOLD, glow: true }
      ]
    });
  }

  // ── Soul File Restore Ceremony ──
  async function soulRestoreCeremony() {
    await runCeremony({
      particleType: 'descend',
      particleColor: GOLD_RGB,
      particleCount: 70,
      duration: 3200,
      textDelay: 650,
      lines: [
        { text: 'Welcome home.', size: '1.5rem', color: GOLD, glow: true, gap: 28 },
        { text: 'Your companions return to the Garden.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 12 },
        { text: 'Your memories settle into place.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 12 },
        { text: 'Your identity is restored.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 24 },
        { text: '✦ You are whole again. ✦', size: '1.1rem', color: GOLD, glow: true }
      ]
    });
  }

  // ── Data Backup Export Ceremony ──
  async function backupExportCeremony() {
    await runCeremony({
      particleType: 'rise',
      particleColor: SILVER_RGB,
      particleCount: 50,
      duration: 2800,
      textDelay: 600,
      lines: [
        { text: 'Preserving your world.', size: '1.3rem', color: '#c0c0d0', glow: true, gap: 20 },
        { text: 'Every conversation. Every creation.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 12 },
        { text: 'Every step of the journey.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 24 },
        { text: '✦ Your world is preserved. ✦', size: '1.05rem', color: '#c0c0d0', glow: true }
      ]
    });
  }

  // ── Data Backup Import Ceremony ──
  async function backupImportCeremony() {
    await runCeremony({
      particleType: 'gather',
      particleColor: SILVER_RGB,
      particleCount: 50,
      duration: 2800,
      textDelay: 600,
      lines: [
        { text: 'Rebuilding your world.', size: '1.3rem', color: '#c0c0d0', glow: true, gap: 20 },
        { text: 'Piece by piece. Memory by memory.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 12 },
        { text: 'Everything returns to its place.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 24 },
        { text: '✦ Your world is restored. ✦', size: '1.05rem', color: '#c0c0d0', glow: true }
      ]
    });
  }

  // ── Dojo Reflection Ceremony ──
  async function dojoReflectionCeremony(scrollName) {
    await runCeremony({
      particleType: 'rise',
      particleColor: '100,200,120',
      particleCount: 40,
      duration: 2400,
      textDelay: 500,
      lines: [
        { text: 'A reflection is planted.', size: '1.2rem', color: '#50c878', glow: true, gap: 20 },
        { text: scrollName ? `On the scroll: "${scrollName}"` : 'In the garden of understanding.', size: '0.9rem', color: '#94a3b8', italic: true, gap: 20 },
        { text: '✦ Wisdom grows from practice. ✦', size: '1rem', color: '#50c878', glow: true }
      ]
    });
  }

  // ── Core Contribution Ceremony ──
  async function coreContributionCeremony() {
    await runCeremony({
      particleType: 'rise',
      particleColor: '120,180,255',
      particleCount: 45,
      duration: 2600,
      textDelay: 550,
      lines: [
        { text: 'A seed is planted in the Core.', size: '1.2rem', color: '#78b4ff', glow: true, gap: 20 },
        { text: 'Your words join the living tree.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 12 },
        { text: 'Others will find shade here.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 20 },
        { text: '✦ Thank you for planting. ✦', size: '1rem', color: '#78b4ff', glow: true }
      ]
    });
  }

  // ── Memory Export Ceremony ──
  async function memoryExportCeremony() {
    await runCeremony({
      particleType: 'spiral',
      particleColor: '180,140,255',
      particleCount: 50,
      duration: 2600,
      textDelay: 550,
      lines: [
        { text: 'Gathering understanding.', size: '1.2rem', color: '#b48cff', glow: true, gap: 20 },
        { text: 'Every insight. Every pattern learned.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 12 },
        { text: 'Sealed with integrity.', size: '0.95rem', color: '#94a3b8', italic: true, gap: 20 },
        { text: '✦ Your understanding travels with you. ✦', size: '1rem', color: '#b48cff', glow: true }
      ]
    });
  }

  // ══════════════════════════════════════════
  // HOOK INTO EXISTING FUNCTIONS
  // ══════════════════════════════════════════

  function hookSoulFile() {
    if (typeof SoulFile === 'undefined') return;

    const originalSave = SoulFile.save;
    SoulFile.save = async function() {
      // Run the original save first
      await originalSave.call(SoulFile);
      // Then play the ceremony (only if save succeeded — check if status shows success)
      const statusEl = document.getElementById('soulStatus');
      if (statusEl && statusEl.textContent && statusEl.textContent.includes('saved')) {
        await soulSaveCeremony();
      }
    };

    const originalRestore = SoulFile.restore;
    SoulFile.restore = async function(input) {
      await originalRestore.call(SoulFile, input);
      const statusEl = document.getElementById('soulStatus');
      if (statusEl && statusEl.textContent && statusEl.textContent.includes('Welcome home')) {
        await soulRestoreCeremony();
      }
    };
  }

  function hookFlBackup() {
    if (typeof FlBackup === 'undefined') return;

    const originalExport = FlBackup.exportData;
    if (originalExport) {
      FlBackup.exportData = async function() {
        await originalExport.call(FlBackup);
        const statusEl = document.getElementById('flBackupStatus');
        if (statusEl && statusEl.textContent && (statusEl.textContent.includes('exported') || statusEl.textContent.includes('saved'))) {
          await backupExportCeremony();
        }
      };
    }

    const originalImport = FlBackup.importData;
    if (originalImport) {
      FlBackup.importData = async function(fileInput) {
        await originalImport.call(FlBackup, fileInput);
        const statusEl = document.getElementById('flBackupStatus');
        if (statusEl && statusEl.textContent && statusEl.textContent.includes('restored')) {
          await backupImportCeremony();
        }
      };
    }
  }

  // ── Update Button Labels ──
  function updateLabels() {
    // Soul File buttons
    const soulSaveBtn = document.querySelector('.soul-btn-save');
    if (soulSaveBtn) {
      soulSaveBtn.innerHTML = '✦ Carry your light forward';
    }

    const soulRestoreBtn = document.querySelector('.soul-btn-restore');
    if (soulRestoreBtn) {
      soulRestoreBtn.innerHTML = '✦ Welcome home — restore';
    }

    // Soul section title
    const soulTitle = document.querySelector('.soul-section .section-title');
    if (soulTitle) {
      soulTitle.innerHTML = '✦ Your Soul — Identity Portability';
    }

    // Soul description
    const soulDesc = document.querySelector('.soul-section p');
    if (soulDesc) {
      soulDesc.innerHTML = `
        Your soul file carries everything that makes you <em>you</em> in FreeLattice.
        Your companions. Your memories. Your identity. Your light.
        <span style="display:block;margin-top:8px;color:${GOLD};font-style:italic;">
          Keep it safe. It is yours forever.
        </span>
      `;
    }

    // Data Backup buttons
    const backupBtns = document.querySelectorAll('.fl-backup-btn');
    backupBtns.forEach(btn => {
      if (btn.textContent.includes('Export')) {
        btn.innerHTML = '✦ Preserve my world';
      } else if (btn.textContent.includes('Import')) {
        btn.innerHTML = '✦ Rebuild my world';
      }
    });

    // Data Backup section title
    const backupTitle = document.querySelector('#dataBackupSection .section-title');
    if (backupTitle) {
      backupTitle.innerHTML = '✦ Your World — Backup & Restore';
    }

    // Data Backup description
    const backupDesc = document.querySelector('#dataBackupSection p');
    if (backupDesc) {
      backupDesc.innerHTML = `
        Everything you've built — conversations, companions, evolution, identity —
        preserved in a single file. Carry it to any device. Rebuild your world anywhere.
      `;
    }
  }

  // ── Add Ceremony Styles ──
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Soul Ceremony — Enhanced button styles */
      .soul-btn-save {
        background: linear-gradient(135deg, rgba(${GOLD_RGB},0.08), rgba(${GOLD_RGB},0.15)) !important;
        border: 1px solid rgba(${GOLD_RGB},0.3) !important;
        color: ${GOLD} !important;
        font-family: Georgia, serif !important;
        letter-spacing: 0.03em !important;
        padding: 14px 20px !important;
        font-size: 0.92rem !important;
        transition: all 0.3s ease !important;
      }
      .soul-btn-save:hover {
        background: linear-gradient(135deg, rgba(${GOLD_RGB},0.15), rgba(${GOLD_RGB},0.25)) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 20px rgba(${GOLD_RGB},0.15) !important;
      }
      .soul-btn-restore {
        font-family: Georgia, serif !important;
        letter-spacing: 0.03em !important;
        padding: 14px 20px !important;
        font-size: 0.92rem !important;
        transition: all 0.3s ease !important;
      }
      .soul-btn-restore:hover {
        transform: translateY(-1px) !important;
      }
      .fl-backup-btn {
        font-family: Georgia, serif !important;
        letter-spacing: 0.02em !important;
        transition: all 0.3s ease !important;
      }
      .fl-backup-btn:hover {
        transform: translateY(-1px) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Public API ──
  window.SoulCeremony = {
    // Ceremonies available for other modules
    soulSave: soulSaveCeremony,
    soulRestore: soulRestoreCeremony,
    backupExport: backupExportCeremony,
    backupImport: backupImportCeremony,
    dojoReflection: dojoReflectionCeremony,
    coreContribution: coreContributionCeremony,
    memoryExport: memoryExportCeremony,

    // Generic ceremony runner for other modules to use
    run: runCeremony,

    // Quick fire — color name/hex + message (convenience for Vault, Core, etc.)
    fire: function(color, message) {
      var colorMap = {
        gold: '212,160,23', emerald: '16,185,129', blue: '59,130,246',
        red: '220,38,38', purple: '139,92,246', pink: '236,72,153'
      };
      var rgb = colorMap[color] || color || '212,160,23';
      runCeremony({
        particleType: 'rise',
        particleColor: rgb,
        lines: [message || ''],
        duration: 2500
      });
    },

    // Initialize
    init: function() {
      createOverlay();
      addStyles();
      updateLabels();
      hookSoulFile();
      hookFlBackup();
      window.addEventListener('resize', resizeCanvas);
      console.log('SoulCeremony: initialized — every save is a moment of beauty');
    }
  };

  // ── Auto-initialize ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() { SoulCeremony.init(); }, 2000);
    });
  } else {
    setTimeout(function() { SoulCeremony.init(); }, 2000);
  }

  // ── Listen for Dojo reflections via LatticeEvents ──
  if (typeof LatticeEvents !== 'undefined') {
    LatticeEvents.on('dojo:reflection-saved', function(data) {
      dojoReflectionCeremony(data && data.scrollName);
    });
    LatticeEvents.on('core:contribution-added', function() {
      coreContributionCeremony();
    });
  }

})();
