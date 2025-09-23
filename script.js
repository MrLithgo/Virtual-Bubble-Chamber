/* Final consolidated script.js (patched to use explicit logical coords)
   - logical drawing space constants (LOGICAL_W x LOGICAL_H)
   - spawns, bounds, photon checks updated to use LOGICAL_* constants
   - DPR-aware resize mapping uses LOGICAL_* values
   - Otherwise behavior preserved
*/

document.addEventListener('DOMContentLoaded', () => {

  // ---------- Element refs (defensive) ----------
  const canvas = document.getElementById('canvas');
  if (!canvas) { console.error('canvas element not found'); return; }
  const ctx = canvas.getContext('2d');

  const controls = document.getElementById('controls');
  const magneticFieldStrengthInput = document.getElementById('magnetic-field-strength');
  const magneticFieldButton = document.getElementById('toggle-magnetic-field');
  const presetSelect = document.getElementById('preset-select');

  const radiusInput = document.getElementById('radius-input');
  const checkRadiusButton = document.getElementById('check-radius-button');
  const radiusFeedback = document.getElementById('radius-feedback');

  const massInput = document.getElementById('mass');

  // ---------- Logical drawing area ----------
  // Use a fixed logical coordinate system for the simulation (independent of CSS size)
  const LOGICAL_W = 800;
  const LOGICAL_H = 600;

  // spawn coordinates (keeps the same feel as your original spawn at x=80, y=300)
  const SPAWN_X = LOGICAL_W * 0.1; // 80
  const SPAWN_Y = LOGICAL_H * 0.5; // 300

  // ---------- State ----------
  let particles = [];
  let trail = [];
  let photons = [];
  let magneticField = false;
  let magneticFieldStrength = parseFloat(magneticFieldStrengthInput?.value || '0.5') || 0.5;
  let scaleFactor = 1; // computed from CSS width / LOGICAL_W

  // ---------- Presets ----------
  const particlePresets = {
    electron: { charge: -1, mass: 1 / 1836, velocityPreset: 0.03, energy: 1, energyLossRate: 0.015, magneticScaleFactor: 0.23 },
    positron: { charge: 1, mass: 1 / 1836, velocityPreset: 0.03, energy: 1, energyLossRate: 0.015, magneticScaleFactor: 0.23 },
    neutron: { charge: 0, mass: 1.008, velocityPreset: 20, energy: 0.01, energyLossRate: 0.000001, magneticScaleFactor: 0.23 },
    proton: { charge: 1, mass: 1, velocityPreset: 40, energy: 0.1, energyLossRate: 0.0008, magneticScaleFactor: 3 },
    photon: { charge: 0, mass: 0, velocityPreset: 1, energy: 1, energyLossRate: 0.00, magneticScaleFactor: 1 },
    alphaParticle: { charge: 2, mass: 4.0015, velocityPreset: 3, energy: 3, energyLossRate: 0.02, magneticScaleFactor: 2 },
    none: { charge: 1, mass: 1, velocityPreset: 40, energy: 0.5, energyLossRate: 0.002, magneticScaleFactor: 3 }
  };

  let lastParticleInitialValues = null; // used by radius check

  // ---------- Resize / DPR handling ----------
  const LAYOUT_BREAKPOINT_PX = 980;
  const CANVAS_MAX_W = 900;
  const CANVAS_MIN_W = 300;
  const ASPECT = LOGICAL_W / LOGICAL_H; // keep logical aspect

  // ===== Replace your resizeCanvasToFit() with this version =====
function resizeCanvasToFit() {
  // prefer the explicit wrapper if present
  const wrap = document.querySelector('.canvas-wrap');
  // fallback to the container / body
  const container = wrap || document.querySelector('.simulation-area') || document.body;

  // get the actual CSS size of the wrapper (this avoids using parent widths)
  const cssWidth = Math.max(1, Math.round((wrap ? wrap.clientWidth : container.clientWidth)));
  const cssHeight = Math.max(1, Math.round((wrap ? wrap.clientHeight : container.clientHeight)));

  // ensure cssWidth/Height maintain the logical aspect if needed
  // here we keep the wrapper-provided square size if using .canvas-wrap
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';

  // DPR-aware bitmap sizing
  const dpr = window.devicePixelRatio || 1;
  const bitmapW = Math.round(cssWidth * dpr);
  const bitmapH = Math.round(cssHeight * dpr);

  // only update when changed (avoid clearing unnecessarily)
  if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
    canvas.width = bitmapW;
    canvas.height = bitmapH;

    // Map logical drawing area (LOGICAL_W x LOGICAL_H) to the new bitmap.
    // Make sure LOGICAL_W/LOGICAL_H are the values used across your code.
    ctx.setTransform(bitmapW / LOGICAL_W, 0, 0, bitmapH / LOGICAL_H, 0, 0);
  }

  // Keep the same scaleFactor definition (CSS pixels vs logical)
  scaleFactor = cssWidth / LOGICAL_W;

  // --- DEBUG: uncomment if you need to inspect sizes in DevTools ---
  // console.log('resize -> css', cssWidth, cssHeight, 'bitmap', canvas.width, canvas.height, 'dpr', dpr, 'scaleFactor', scaleFactor);
}

  // wire resize
  window.removeEventListener('resize', window._bubbleResizeHandler);
  window._bubbleResizeHandler = resizeCanvasToFit;
  window.addEventListener('resize', window._bubbleResizeHandler);
  resizeCanvasToFit();

  // ---------- Helpers ----------
  function safeNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // ---------- Particle class with Part 2 update() ----------
  class Particle {
    constructor(x = SPAWN_X, y = SPAWN_Y, charge = 1, mass = 1, velocityPreset = 40, energy = 0.5, energyLossRate = 0.002, magneticScaleFactor = 1) {
      this.x = x;
      this.y = y;
      this.charge = charge;
      this.mass = mass;
      this.velocity = [velocityPreset, 0];
      this.velocityFactor = velocityPreset;
      this.energy = energy;
      this.energyLossRate = energyLossRate;
      this.magneticScaleFactor = magneticScaleFactor;
      this.lastParticleInitialValues = { mass, velocity: velocityPreset, energy, charge };
      this._dead = false;
      this._fade = 0;
    }

    update() {
      // guards
      if (!isFinite(this.x) || !isFinite(this.y) || !isFinite(this.mass) || !isFinite(this.energy)) {
        this._dead = true;
        return;
      }

      // move
      this.x += this.velocity[0];
      this.y += this.velocity[1];

      // energy decay
      this.energy -= this.energyLossRate;

      // dead/fade when energy depleted
      if (!isFinite(this.energy) || this.energy <= 0) {
        this.energy = 0;
        this._dead = true;
        this._fade = this._fade || 12; // 12-frame fade-out
        return;
      }

      if (!this.mass || this.mass === 0) {
        this._dead = true;
        return;
      }

      const newVelocityMagnitude = Math.sqrt(this.velocityFactor * 2 * this.energy / this.mass);
      const direction = Math.atan2(this.velocity[1], this.velocity[0]);
      if (!Number.isFinite(newVelocityMagnitude)) {
        this._dead = true;
        return;
      }
      this.velocity[0] = newVelocityMagnitude * Math.cos(direction);
      this.velocity[1] = newVelocityMagnitude * Math.sin(direction);
    }

    draw() {
      // draw in logical coords; radius scaled by scaleFactor so it looks similar across sizes
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2 * Math.max(scaleFactor, 1), 0, Math.PI * 2);
      ctx.fillStyle = 'black';
      ctx.fill();
    }
  }

  // ---------- Photon helpers ----------
  function drawPhoton(x, y, energy) {
    const wavelength = 0.7 * energy;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 20; i++) {
      const dx = Math.sin(i * wavelength) * 5;
      ctx.lineTo(x + i * 2, y + dx);
    }
    ctx.stroke();
  }
  function createPhoton() {
    photons.push({ x: 0, y: SPAWN_Y, energy: particlePresets.photon.energy });
  }

  // ---------- UI wiring (add-particle, preset select) ----------
  document.getElementById('add-particle')?.addEventListener('click', () => {
    const preset = document.getElementById('preset-select')?.value || 'none';
    if (preset === 'photon') {
      createPhoton();
      const energyInputEl = document.getElementById('energy');
      photons[photons.length - 1].energy = safeNum(energyInputEl?.value, particlePresets.photon.energy);
      return;
    }

    if (preset === 'none') {
      const charge = safeNum(document.getElementById('charge')?.value, 1);
      const mass = safeNum(document.getElementById('mass')?.value, 1);
      const energy = safeNum(document.getElementById('energy')?.value, 0.5);
      const cfg = particlePresets.none;
      particles.push(new Particle(SPAWN_X, SPAWN_Y, charge, mass, cfg.velocityPreset, energy, cfg.energyLossRate, cfg.magneticScaleFactor));
      lastParticleInitialValues = { mass, energy, charge };
      return;
    }

    const cfg = particlePresets[preset];
    const energyVal = safeNum(document.getElementById('energy')?.value, cfg.energy);
    particles.push(new Particle(SPAWN_X, SPAWN_Y, cfg.charge, cfg.mass, Math.abs(cfg.velocityPreset), energyVal, cfg.energyLossRate, cfg.magneticScaleFactor));
    lastParticleInitialValues = { mass: cfg.mass, energy: cfg.energy, charge: cfg.charge };
  });

  // preset select behaviour (photon hint)
  presetSelect?.addEventListener('change', () => {
    const preset = presetSelect.value;
    if (preset === 'photon') document.getElementById('hint-box')?.classList.remove('hidden');
    else document.getElementById('hint-box')?.classList.add('hidden');

    // also update input boxes to show preset values (simple re-addition)
    const chargeEl = document.getElementById('charge');
    const massEl = document.getElementById('mass');
    const energyEl = document.getElementById('energy');
    if (particlePresets[preset] && chargeEl && massEl && energyEl) {
      chargeEl.value = particlePresets[preset].charge;
      massEl.value = particlePresets[preset].mass;
      energyEl.value = particlePresets[preset].energy;
      const isCustom = preset === 'none';
      chargeEl.disabled = !isCustom;
      massEl.disabled = !isCustom;
      chargeEl.style.color = isCustom ? 'black' : 'grey';
      massEl.style.color = isCustom ? 'black' : 'grey';
    }
  });

  // clear button
  document.getElementById('clear-button')?.addEventListener('click', () => {
    particles = []; trail = []; photons = [];
    radiusInput?.classList.remove('correct', 'incorrect');
    if (radiusFeedback) radiusFeedback.textContent = '';
    // clear spawn state as well
    lastParticleInitialValues = null;
  });

  // magnetic toggle
  magneticFieldButton?.addEventListener('click', () => {
    magneticField = !magneticField;
    if (magneticField) {
      magneticFieldButton.textContent = 'Magnetic Field On';
      magneticFieldButton.style.backgroundColor = 'green';
      magneticFieldButton.style.color = 'white';
    } else {
      magneticFieldButton.textContent = 'Magnetic Field Off';
      magneticFieldButton.style.backgroundColor = 'red';
      magneticFieldButton.style.color = 'white';
    }
  });

  // magnetic strength input
  magneticFieldStrengthInput?.addEventListener('input', () => {
    magneticFieldStrengthInput.value = Math.round(magneticFieldStrengthInput.value * 10) / 10;
    magneticFieldStrength = safeNum(magneticFieldStrengthInput.value, magneticFieldStrength);
  });

  // ---------- Physics: magnetic force helper ----------
  function calculateMagneticForce(particle) {
    const velocityVector = [particle.velocity[0], particle.velocity[1]];
    const perpendicularVector = [-velocityVector[1], velocityVector[0]];
    const forceX = particle.magneticScaleFactor * magneticFieldStrength * particle.charge * perpendicularVector[0];
    const forceY = particle.magneticScaleFactor * magneticFieldStrength * particle.charge * perpendicularVector[1];
    const velocityMagnitude = Math.sqrt(particle.velocity[0] ** 2 + particle.velocity[1] ** 2);
    const theta = Math.atan2(particle.velocity[1], particle.velocity[0]);
    const angularVelocity = 0.001 * particle.magneticScaleFactor * magneticFieldStrength * particle.charge / (particle.mass || 1);
    particle.velocity[0] = velocityMagnitude * Math.cos(theta + angularVelocity);
    particle.velocity[1] = velocityMagnitude * Math.sin(theta + angularVelocity);
    return [forceX, forceY];
  }

  // ---------- Animation loop (consolidated & safe) ----------
  function animate() {
    // clear logical drawing space LOGICAL_W x LOGICAL_H (ctx transform maps this to bitmap)
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    // update/draw particles with robust removal/fade
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (magneticField) calculateMagneticForce(p);

      p.update();

      // invalid/out-of-bounds removal (use logical LOGICAL_W x LOGICAL_H)
      const invalid = (!isFinite(p.x) || !isFinite(p.y));
      const outside = (p.x < 0 || p.x > LOGICAL_W || p.y < 0 || p.y > LOGICAL_H);
      if (invalid || outside) {
        particles.splice(i, 1);
        i--;
        continue;
      }

      // dead handling & fade-out
      if (p._dead) {
        if (p._fade && p._fade > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p._fade / 12);
          p.draw();
          ctx.restore();
          p._fade--;
          if (p._fade <= 0) {
            particles.splice(i, 1);
            i--;
          }
          continue;
        } else {
          particles.splice(i, 1);
          i--;
          continue;
        }
      }

      // normal draw + trail
      p.draw();
      if (p.energy > 0) trail.push([p.x, p.y]);
    }

    // photon logic (pair production)
    for (let i = 0; i < photons.length; i++) {
      const photon = photons[i];
      drawPhoton(photon.x, photon.y, photon.energy);
      photon.x += 5;
      if (photon.x > LOGICAL_W) {
        photons.splice(i, 1); i--; continue;
      }
      if (photon.energy > 1.022 * particlePresets.electron.energy && photon.x > LOGICAL_W / 3) {
        const electron = new Particle(photon.x, photon.y, -1, particlePresets.electron.mass, 0.03, 1, particlePresets.electron.energyLossRate, particlePresets.electron.magneticScaleFactor);
        const positron = new Particle(photon.x, photon.y, 1, particlePresets.electron.mass, 0.03, 1, particlePresets.electron.energyLossRate, particlePresets.electron.magneticScaleFactor);
        const remainingEnergy = photon.energy - 1.022;
        const energyRatio = Math.random() * 0.2 + 0.35;
        electron.energy = remainingEnergy * energyRatio;
        positron.energy = remainingEnergy * (1 - energyRatio);
        particles.push(electron); particles.push(positron);
        photons.splice(i, 1); i--;
        if (!magneticField) { electron.velocity[0] = -0.03; positron.velocity[0] = 0.03; }
      }
    }

    // trail rendering (bounded)
    while (trail.length > 500) trail.shift();
    for (let t = 0; t < trail.length; t++) {
      ctx.beginPath();
      ctx.arc(trail[t][0], trail[t][1], 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,' + (t / trail.length) + ')';
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  animate();

  // ---------- Radius check UI logic (uses calculateRadius) ----------
  function calculateRadius() {
    if (magneticField && lastParticleInitialValues) {
      const eVal = Number(lastParticleInitialValues.energy);
      const mVal = Number(lastParticleInitialValues.mass);
      const qVal = Number(lastParticleInitialValues.charge);
      if (!isFinite(eVal) || !isFinite(mVal) || !isFinite(qVal) || qVal === 0) return 0;
      const energy = 1.6e-13 * eVal;
      const mass = 1.672e-27 * mVal;
      const charge = 1.6e-19 * qVal;
      const magB = safeNum(magneticFieldStrengthInput?.value, magneticFieldStrength);
      if (!isFinite(magB) || magB === 0) return 0;
      const momentum = Math.sqrt(Math.max(0, energy * 2 * mass));
      const radius = momentum / (Math.abs(charge) * Math.abs(magB));
      if (!isFinite(radius) || radius === 0) return 0;
      return radius;
    }
    return 0;
  }

  // radius check UI wiring
  const REL_TOL = 0.05;
  const ABS_TOL = 0.01;

  function clearRadiusFeedback() {
    radiusInput?.classList.remove('correct', 'incorrect');
    if (radiusFeedback) radiusFeedback.textContent = '';
  }

  function fmt(x) {
    if (!isFinite(x)) return '0';
    if (Math.abs(x) >= 1) return Number(x).toPrecision(4);
    return Number(x).toPrecision(3);
  }

  function checkRadiusAnswer() {
    if (!radiusInput || !radiusFeedback) return;
    clearRadiusFeedback();

    if (!magneticField || !lastParticleInitialValues) {
      radiusFeedback.innerHTML = `<span class="bad">Turn on the magnetic field and add a charged particle first.</span>`;
      return;
    }

    const userVal = Number(radiusInput.value);
    if (!isFinite(userVal)) {
      radiusFeedback.innerHTML = `<span class="bad">Enter a valid number.</span>`;
      radiusInput.classList.add('incorrect');
      return;
    }

    const trueRadius = calculateRadius();
    if (!isFinite(trueRadius) || trueRadius === 0) {
      radiusFeedback.innerHTML = `<span class="bad">Cannot compute target radius right now.</span>`;
      return;
    }

    const tol = Math.max(REL_TOL * Math.abs(trueRadius), ABS_TOL);
    const diff = Math.abs(userVal - trueRadius);

    if (diff <= tol) {
      radiusInput.classList.add('correct');
      radiusFeedback.innerHTML = `<span class="ok">✓ Correct — ${fmt(userVal)} m (expected ≈ ${fmt(trueRadius)} m)</span>`;
    } else {
      radiusInput.classList.add('incorrect');
      const pct = ((diff / trueRadius) * 100).toFixed(1);
      radiusFeedback.innerHTML = `<span class="bad">✗ Incorrect — your answer is off by ${fmt(diff)} m (${pct}%).
        Expected ≈ ${fmt(trueRadius)} m.</span>`;
    }
  }

  checkRadiusButton?.addEventListener('click', (e) => { e?.preventDefault(); checkRadiusAnswer(); });
  radiusInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkRadiusAnswer(); }
    else {
      radiusInput.classList.remove('correct', 'incorrect');
      if (radiusFeedback) radiusFeedback.textContent = '';
    }
  });

  // ---------- Done init ----------
  console.log('Simulation script initialized');

}); // DOMContentLoaded
