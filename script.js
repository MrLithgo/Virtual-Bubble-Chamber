

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
  const LOGICAL_W = 800;
  const LOGICAL_H = 600;

  // spawn coordinates (keeps same feel as original)
  const SPAWN_X = LOGICAL_W * 0.1; // 80
  const SPAWN_Y = LOGICAL_H * 0.5; // 300
  const PRESET_E_PAIR_OFFSET_X = 100;

  // ---------- State ----------
  let particles = [];
  let trail = [];
  let photons = [];
  let magneticField = false;
  let magneticFieldStrength = parseFloat(magneticFieldStrengthInput?.value || '0.5') || 0.5;
  let scaleFactor = 1; // computed from CSS width / LOGICAL_W
  let lastParticleInitialValues = null; // used by radius check

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

  // ---------- Resize / DPR handling ----------
  const LAYOUT_BREAKPOINT_PX = 980;
  const CANVAS_MAX_W = 900;
  const CANVAS_MIN_W = 300;
  const ASPECT = LOGICAL_W / LOGICAL_H;

  function resizeCanvasToFit() {
    const wrap = document.querySelector('.canvas-wrap');
    const container = wrap || document.querySelector('.simulation-area') || document.body;

    const cssWidth = Math.max(1, Math.round((wrap ? wrap.clientWidth : container.clientWidth)));
    const cssHeight = Math.max(1, Math.round((wrap ? wrap.clientHeight : container.clientHeight)));

    // if using a square .canvas-wrap you probably want to use its size directly.
    let finalCssWidth = cssWidth;
    let finalCssHeight = cssHeight;

    // If no wrap, preserve logical aspect using width
    if (!wrap) {
      finalCssHeight = Math.round(finalCssWidth / ASPECT);
    }

    // Apply CSS size (visual)
    canvas.style.width = `${finalCssWidth}px`;
    canvas.style.height = `${finalCssHeight}px`;

    // DPR-aware bitmap sizing
    const dpr = window.devicePixelRatio || 1;
    const bitmapW = Math.max(1, Math.round(finalCssWidth * dpr));
    const bitmapH = Math.max(1, Math.round(finalCssHeight * dpr));

    if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
      canvas.width = bitmapW;
      canvas.height = bitmapH;
    }

    // Compute uniform scale and offsets to preserve circles (no stretching)
    const scaleX = bitmapW / LOGICAL_W;
    const scaleY = bitmapH / LOGICAL_H;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = Math.round((bitmapW - LOGICAL_W * scale) / 2);
    const offsetY = Math.round((bitmapH - LOGICAL_H * scale) / 2);

    // Map logical coords to bitmap
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    // expose scaleFactor for drawing sizes (CSS px per logical unit)
    window.scaleFactor = scale / dpr;
    scaleFactor = window.scaleFactor;
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

  // ---------- updateInputFieldsFromPreset (kept) ----------
  function updateInputFieldsFromPreset(presetKey) {
    const preset = particlePresets[presetKey];
    if (!preset) return;

    const chargeEl = document.getElementById('charge');
    const massEl = document.getElementById('mass');
    const energyEl = document.getElementById('energy');

    if (!chargeEl || !massEl || !energyEl) return;

    // Set input values
    chargeEl.value = preset.charge;
    massEl.value = preset.mass;
    energyEl.value = preset.energy;

    // Update lastParticleInitialValues so radius calculation sees latest values
    lastParticleInitialValues = { charge: Number(chargeEl.value), mass: Number(massEl.value), energy: Number(energyEl.value) };

    // Recalculate radius immediately if magnetic field is on
    if (magneticField && radiusInput) {
      const r = calculateRadius();
      
    }
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
      if (!isFinite(this.x) || !isFinite(this.y) || !isFinite(this.mass) || !isFinite(this.energy)) {
        this._dead = true;
        return;
      }

      this.x += this.velocity[0];
      this.y += this.velocity[1];

      this.energy -= this.energyLossRate;

      if (!isFinite(this.energy) || this.energy <= 0) {
        this.energy = 0;
        this._dead = true;
        this._fade = this._fade || 12;
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
      ctx.beginPath();
      // scaleFactor should be available from resize handler
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

  // ---------- UI wiring (add-particle) ----------
  document.getElementById('add-particle')?.addEventListener('click', () => {
    if (radiusInput) radiusInput.value = '';
    radiusInput?.classList.remove('correct', 'incorrect');
  if (radiusFeedback) radiusFeedback.textContent = '';

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
      lastParticleInitialValues = { charge, mass, energy };
      return;
    }

    const cfg = particlePresets[preset];
    const energyVal = safeNum(document.getElementById('energy')?.value, cfg.energy);
    let spawnX = SPAWN_X;
if (preset === 'electron' || preset === 'positron') {
  spawnX = SPAWN_X + PRESET_E_PAIR_OFFSET_X;
}
    particles.push(new Particle(spawnX, SPAWN_Y, cfg.charge, cfg.mass, Math.abs(cfg.velocityPreset), energyVal, cfg.energyLossRate, cfg.magneticScaleFactor));
    // Note: when spawning from preset we will use the current energy input (so user can edit energy)
    lastParticleInitialValues = { charge: cfg.charge, mass: cfg.mass, energy: energyVal };
  });

  // ---------- Single tidy preset handler ----------
  presetSelect?.addEventListener('change', () => {
    const presetKey = presetSelect.value || 'none';

    // Update input boxes (mass/charge from preset; energy from preset but editable)
    updateInputFieldsFromPreset(presetKey);

    // Lock mass & charge except for 'none'; energy always editable
    const isCustom = presetKey === 'none';
    const chargeEl = document.getElementById('charge');
    const massEl = document.getElementById('mass');
    const energyEl = document.getElementById('energy');

    if (chargeEl) { chargeEl.disabled = !isCustom; chargeEl.style.color = isCustom ? 'black' : 'grey'; }
    if (massEl)   { massEl.disabled   = !isCustom; massEl.style.color   = isCustom ? 'black' : 'grey'; }
    if (energyEl) { energyEl.disabled = false;   energyEl.style.color = 'black'; }

    // Photon hint UI
    if (presetKey === 'photon') document.getElementById('hint-box')?.classList.remove('hidden');
    else document.getElementById('hint-box')?.classList.add('hidden');
  });

  // ---------- updateInputFieldsFromPreset used by the single handler ----------
  function updateInputFieldsFromPreset(presetKey) {
    const preset = particlePresets[presetKey];
    if (!preset) return;

    const chargeEl = document.getElementById('charge');
    const massEl = document.getElementById('mass');
    const energyEl = document.getElementById('energy');

    if (!chargeEl || !massEl || !energyEl) return;

    // Set input values (mass & charge reflect preset; energy set but remains editable)
    chargeEl.value = preset.charge;
    massEl.value = preset.mass;
    energyEl.value = preset.energy;

    // Update lastParticleInitialValues: mass & charge from preset, energy from input
    lastParticleInitialValues = { charge: Number(chargeEl.value), mass: Number(massEl.value), energy: Number(energyEl.value) };

    // Recalculate radius immediately if magnetic field is on
    if (magneticField && radiusInput) {
      const r = calculateRadius();
     
    }
  }

  // ---------- Input listeners so edits update lastParticleInitialValues (energy always editable) ----------
  const energyEl = document.getElementById('energy');
  energyEl?.addEventListener('input', () => {
    const v = Number(energyEl.value);
    lastParticleInitialValues = Object.assign({}, lastParticleInitialValues || {}, { energy: Number.isFinite(v) ? v : 0 });
    if (magneticField && radiusInput) {
      const r = calculateRadius();
      
    }
  });

  // mass & charge listeners update lastParticleInitialValues only when inputs are enabled (i.e. preset 'none')
  const massEl = document.getElementById('mass');
  const chargeEl = document.getElementById('charge');
  massEl?.addEventListener('input', () => {
    if (!massEl.disabled) {
      const v = Number(massEl.value);
      lastParticleInitialValues = Object.assign({}, lastParticleInitialValues || {}, { mass: Number.isFinite(v) ? v : 0 });
      if (magneticField && radiusInput) {
        const r = calculateRadius();
        
      }
    }
  });
  chargeEl?.addEventListener('input', () => {
    if (!chargeEl.disabled) {
      const v = Number(chargeEl.value);
      lastParticleInitialValues = Object.assign({}, lastParticleInitialValues || {}, { charge: Number.isFinite(v) ? v : 0 });
      if (magneticField && radiusInput) {
        const r = calculateRadius();
        
      }
    }
  });

  // ---------- Clear button ----------
  document.getElementById('clear-button')?.addEventListener('click', () => {
    particles = []; trail = []; photons = [];
    radiusInput?.classList.remove('correct', 'incorrect');
    if (radiusFeedback) radiusFeedback.textContent = '';
    lastParticleInitialValues = null;
    if (radiusInput) radiusInput.value = '';
  });

  // ---------- Magnetic toggle visual (keeps original side-effects intact) ----------
  if (magneticFieldButton && !magneticFieldButton.querySelector('.toggle-track')) {
    const currentText = magneticFieldButton.textContent || 'Magnetic Field';
    magneticFieldButton.textContent = '';
    const label = document.createElement('span');
    label.className = 'toggle-label';
    label.textContent = currentText;
    const track = document.createElement('span');
    track.className = 'toggle-track';
    const thumb = document.createElement('span');
    thumb.className = 'toggle-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    track.appendChild(thumb);
    magneticFieldButton.appendChild(label);
    magneticFieldButton.appendChild(track);
    magneticFieldButton.setAttribute('aria-pressed', 'false');
    magneticFieldButton.setAttribute('type', 'button');
  }

  function updateMagneticToggleVisual(isOn) {
    if (!magneticFieldButton) return;
    if (isOn) {
      magneticFieldButton.classList.add('on');
      magneticFieldButton.setAttribute('aria-pressed', 'true');
      magneticFieldButton.querySelector('.toggle-label').textContent = 'Magnetic Field On';
      // ensure label color visible
      magneticFieldButton.querySelector('.toggle-label').style.color = '#2c3e50';
    } else {
      magneticFieldButton.classList.remove('on');
      magneticFieldButton.setAttribute('aria-pressed', 'false');
      magneticFieldButton.querySelector('.toggle-label').textContent = 'Magnetic Field Off';
      magneticFieldButton.querySelector('.toggle-label').style.color = '';
    }
  }

  if (magneticFieldButton) {
    updateMagneticToggleVisual(!!magneticField);
    magneticFieldButton.addEventListener('click', (e) => {
      e.preventDefault();
      magneticField = !magneticField;
      updateMagneticToggleVisual(magneticField);

      // keep previous side-effects
      if (magneticField) {
        document.getElementById('show-radius-button')?.classList.remove('hidden');
      } else {
        document.getElementById('show-radius-button')?.classList.add('hidden');
        document.getElementById('radius-hint-box')?.classList.add('hidden');
      }
    });

    magneticFieldButton.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        magneticFieldButton.click();
      }
    });
  }

  // ---------- Magnetic strength input ----------
  magneticFieldStrengthInput.addEventListener('input', () => {
  const n = parseFloat(magneticFieldStrengthInput.value);
  if (!Number.isNaN(n)) {
    // update internal state but DO NOT overwrite the visible input
    magneticFieldStrength = n;
  }
  // if the field is empty or temporarily invalid (e.g. user typed "0.") do nothing
});

  // ---------- Animation loop ----------
  function animate() {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (magneticField) calculateMagneticForce(p);

      p.update();

      const invalid = (!isFinite(p.x) || !isFinite(p.y));
      const outside = (p.x < 0 || p.x > LOGICAL_W || p.y < 0 || p.y > LOGICAL_H);
      if (invalid || outside) {
        particles.splice(i, 1);
        i--;
        continue;
      }

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

      p.draw();
      if (p.energy > 0) trail.push([p.x, p.y]);
    }

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

  // ---------- Radius calc & check UI ----------
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
