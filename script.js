

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

  // ---------- State ----------
  let particles = [];
  let trail = [];
  let photons = [];
  let magneticField = false;
  let magneticFieldStrength = parseFloat(magneticFieldStrengthInput?.value || '0.5') || 0.5;
  let scaleFactor = 1; // computed from CSS width / 800

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
  const ASPECT = 4 / 3;

  function resizeCanvasToFit() {
    const container = document.querySelector('.canvas-wrap') || document.querySelector('.simulation-area') || document.body;
    const containerRect = container.getBoundingClientRect();

    const stacked = window.innerWidth <= LAYOUT_BREAKPOINT_PX;
    let availableWidth = containerRect.width;
    // (we keep it simple: use container width which reflects layout)
    availableWidth = Math.max(0, availableWidth);

    const gutter = 20;
    let cssWidth = Math.min(CANVAS_MAX_W, Math.max(CANVAS_MIN_W, Math.floor(availableWidth - gutter)));
    const cssHeight = Math.round(cssWidth / ASPECT);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const dpr = window.devicePixelRatio || 1;
    const bitmapW = Math.round(cssWidth * dpr);
    const bitmapH = Math.round(cssHeight * dpr);

    if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
      canvas.width = bitmapW;
      canvas.height = bitmapH;
      // Map logical 800x600 to bitmap
      ctx.setTransform(bitmapW / 800, 0, 0, bitmapH / 600, 0, 0);
    }

    // logical scale for drawing circle radii etc.
    scaleFactor = cssWidth / 800;
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
    constructor(x = 80, y = 300, charge = 1, mass = 1, velocityPreset = 40, energy = 0.5, energyLossRate = 0.002, magneticScaleFactor = 1) {
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
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2 * Math.max(scaleFactor, 1), 0, Math.PI * 2);
      ctx.fillStyle = 'black';
      ctx.fill();
    }
  }
function updateInputFields(preset) {
  const chargeInput = document.getElementById('charge');
  const massInputEl = document.getElementById('mass');
  const energyInput = document.getElementById('energy');
  if (particlePresets[preset]) {
    energyInput.value = particlePresets[preset].energy;
    chargeInput.value = particlePresets[preset].charge;
    massInputEl.value = particlePresets[preset].mass;
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
    photons.push({ x: 0, y: 300, energy: particlePresets.photon.energy });
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
      particles.push(new Particle(80, 300, charge, mass, cfg.velocityPreset, energy, cfg.energyLossRate, cfg.magneticScaleFactor));
      lastParticleInitialValues = { mass, energy, charge };
      return;
    }

    const cfg = particlePresets[preset];
    const energyVal = safeNum(document.getElementById('energy')?.value, cfg.energy);
    particles.push(new Particle(80, 300, cfg.charge, cfg.mass, Math.abs(cfg.velocityPreset), energyVal, cfg.energyLossRate, cfg.magneticScaleFactor));
    lastParticleInitialValues = { mass: cfg.mass, energy: cfg.energy, charge: cfg.charge };
  });

  // preset select behaviour (photon hint)
  // Preset select behaviour
presetSelect?.addEventListener('change', () => {
  const preset = presetSelect.value;

  // Update input boxes when a preset is chosen
  updateInputFields(preset);

  // Photon hint (optional)
  if (preset === 'photon') document.getElementById('hint-box')?.classList.remove('hidden');
  else document.getElementById('hint-box')?.classList.add('hidden');

  // Disable charge/mass inputs if not 'none'
  if (preset !== 'none') {
    document.getElementById('charge').disabled = true;
    document.getElementById('mass').disabled = true;
    document.getElementById('charge').style.color = 'grey';
    document.getElementById('mass').style.color = 'grey';
  } else {
    document.getElementById('charge').disabled = false;
    document.getElementById('mass').disabled = false;
    document.getElementById('charge').style.color = 'black';
    document.getElementById('mass').style.color = 'black';
  }
});

// Initialize input boxes to match starting preset
updateInputFields(presetSelect?.value || 'none');


  // clear button
  document.getElementById('clear-button')?.addEventListener('click', () => {
    particles = []; trail = []; photons = [];
    radiusInput?.classList.remove('correct', 'incorrect');
    if (radiusFeedback) radiusFeedback.textContent = '';
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
    // clear logical drawing space 800x600 (ctx transform maps this to bitmap)
    ctx.clearRect(0, 0, 800, 600);

    // update/draw particles with robust removal/fade
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (magneticField) calculateMagneticForce(p);

      p.update();

      // invalid/out-of-bounds removal (use logical 800x600)
      const invalid = (!isFinite(p.x) || !isFinite(p.y));
      const outside = (p.x < 0 || p.x > 800 || p.y < 0 || p.y > 600);
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
      if (photon.x > 800) {
        photons.splice(i, 1); i--; continue;
      }
      if (photon.energy > 1.022 * particlePresets.electron.energy && photon.x > 800 / 3) {
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
