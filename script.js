const canvas = document.getElementById('canvas');  
const ctx = canvas.getContext('2d');  
let particles = [];  
let trail = [];  
let magneticField = false;  
const massInput = document.getElementById('mass');  
let magneticFieldStrength = 0.5;  
let magneticScaleFactor = 2;  
const velocityScale = 1;  
//let energy = 1;  
  
const magneticFieldStrengthInput = document.getElementById('magnetic-field-strength');  
  
const magneticFieldButton = document.getElementById('toggle-magnetic-field');  
  
const particlePresets = {  
  electron: {  
   charge: -1,  
   mass: 1 / 1836,  
   velocityPreset: 0.03,  
   energy: 1,  
   energyLossRate: 0.015 , 
    magneticScaleFactor: 0.23
  },  
  positron: {  
   charge: 1,  
   mass: 1 / 1836,  
   velocityPreset: 0.03,  
   energy: 1,  
   energyLossRate: 0.015 ,
    magneticScaleFactor: 0.23
  },  
  neutron: {  
   charge: 0,  
   mass: 1.008,  
   velocityPreset: 20,  
   energy: 0.01,  
   energyLossRate: 0.000001 ,
    magneticScaleFactor: 0.23
  },  
  proton: {  
   charge: 1,  
   mass: 1,  
   velocityPreset: 40,  
   energy: 0.1,  
   energyLossRate: 0.0008 ,
    magneticScaleFactor: 3
  },  
  photon: {  
   charge: 0,  
   mass: 0,  
   velocityPreset: 1,  
   energy: 1,  
   energyLossRate: 0.00  ,
    magneticScaleFactor: 1
  },  
  alphaParticle: {  
   charge: 2,  
   mass: 4.0015,  
   velocityPreset: 3,  
   energy: 3,  
   energyLossRate: 0.02  ,
    magneticScaleFactor: 2
  },  
  none: {  
   charge: 1,  
   mass: 1,  
   velocityPreset: 40,  
   energy: 0.5,  
   energyLossRate: 0.002 ,
    magneticScaleFactor: 3
  }  
};  
 window.addEventListener('resize', () => {  
  const screenWidth = window.innerWidth;  
  const controlsWidth = controls.offsetWidth;  
  const canvasWidth = Math.min(800,screenWidth - controlsWidth - 50);
    const canvasHeight = 0.75*canvasWidth;
   particles = [];  
  trail = [];  
 canvas.style.width = `${canvasWidth}px`;  
canvas.style.height = `${canvasHeight}px`;  

   ctx.setTransform(canvasWidth / 800, 0, 0, canvasHeight/600, 0, 0);
});




 
function updateInputFields(preset) {  
  const chargeInput = document.getElementById('charge');  
  const massInput = document.getElementById('mass');  
  const energyInput = document.getElementById('energy');  
  energyInput.value = particlePresets[preset].energy;  
  chargeInput.value = particlePresets[preset].charge;  
  massInput.value = particlePresets[preset].mass;  
}  
  

const presetButtons = document.querySelectorAll('.preset-button');  
presetButtons.forEach((button) => {  
  button.addEventListener('click', () => {  
   const preset = button.dataset.preset;  
   updateInputFields(preset);  
  });  
});  
  
const presetSelect = document.getElementById('preset-select');  
presetSelect.addEventListener('change', () => {  
  const preset = presetSelect.value;  
  updateInputFields(preset);  
});  
  
const energyInput = document.getElementById('energy');  
energyInput.addEventListener('input', () => {  
  const energy = parseFloat(energyInput.value);  
  //console.log('Energy updated:', energy);  
});  
  
let lastParticleInitialValues = null;  

class Particle {  
  constructor(x, y, charge, mass, velocityPreset, energy, energyLossRate, magneticScaleFactor) {  
   this.x = x;  
   this.y = y;  
   this.charge = charge;  
   this.mass = mass;  
   this.velocity = [velocityPreset, 0];  
   this.velocityFactor = velocityPreset;  
   this.energy = energy;  
   this.energyLossRate = energyLossRate; 
    this.magneticScaleFactor = magneticScaleFactor;
    this.lastParticleInitialValues = {  
    mass: mass,
    velocity: velocityPreset,
    energy: energy,  
    charge: charge, 
    };
   //this.trails = []; 
   console.log("Initial values:", x,y);  
  console.log("Charge:", charge);  
  console.log("Mass:", mass);  
  console.log("VelocityPreset:", velocityPreset);  
  console.log("Energy:", energy);  
  console.log("MagneticScale:", magneticScaleFactor); 
  }  
  
  update() {  
   this.x += this.velocity[0];  
   this.y += this.velocity[1];  
   // console.log("velocity", this.velocity);
    
   //console.log("Updated values:", this.x ,this.y);  
    
   //console.log("Energy:", this.energy); 
   //this.trails.push([this.x, this.y]);  
   this.energy -= this.energyLossRate;  
   const newVelocityMagnitude = Math.sqrt(this.velocityFactor*2 * this.energy / this.mass);  
   const direction = Math.atan2(this.velocity[1], this.velocity[0]);  
   this.velocity[0] = newVelocityMagnitude * Math.cos(direction);  
   this.velocity[1] = newVelocityMagnitude * Math.sin(direction);  
   if (this.energy <= 0.00001) {  
    particles.splice(particles.indexOf(this), 1);  
   }  
  }  
  
  draw() {  
   ctx.beginPath();  
   ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI);  
   ctx.fillStyle = 'black';  
   ctx.fill();  
    
  }  
}  

let photons = [];  
  
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
  const photon = {  
   x: 0,  
   y: canvas.height / 2,  
   energy: particlePresets.photon.energy,
  };  
  photons.push(photon);  
}  
  


let animatingPhoton = false;  

magneticFieldStrengthInput.addEventListener('input', () => {  
  magneticFieldStrength = parseFloat(magneticFieldStrengthInput.value);  
});  
  
document.getElementById('add-particle').addEventListener('click', () => {  
  const preset = document.getElementById('preset-select').value;  
  if (preset === 'photon') {  
    createPhoton();  
   const energyInput = document.getElementById('energy');  
   photons[photons.length - 1].energy = parseFloat(energyInput.value);
    
  } else 
  if (preset === 'none') {  
   const charge = parseFloat(document.getElementById('charge').value);  
   const mass = parseFloat(document.getElementById('mass').value);  
   const energy = parseFloat(energyInput.value);  
   const velocityPreset = particlePresets[preset].velocityPreset;  
   const velocityMagnitude = Math.sqrt(velocityPreset * 2 * energy / mass);  
   const energyLossRate = particlePresets[preset].energyLossRate;  
    const magneticScaleFactor = particlePresets[preset].magneticScaleFactor;  
   particles.push(new Particle(canvas.width / 10, canvas.height / 2, charge, mass, velocityPreset, energy, energyLossRate, magneticScaleFactor));  
    lastParticleInitialValues = {  
    mass: mass,  
    energy: energy,  
    charge: charge,  
   };  
  } else {  
    const energyLossRate = particlePresets[preset].energyLossRate * (1 + Math.random() * 0.1 - 0.05);

   const particle = particlePresets[preset];  
   const energy = parseFloat(document.getElementById('energy').value);  
   const velocityPreset = particle.velocityPreset;  
   const velocityMagnitude = Math.sqrt(particle.velocityPreset * 2 * particle.energy / particle.mass);  
   particles.push(new Particle(canvas.width / 10, canvas.height / 2, particle.charge, particle.mass, Math.abs(velocityPreset), energy, particle.energyLossRate, particle.magneticScaleFactor));  lastParticleInitialValues = {  
    mass: particle.mass,  
    energy: particle.energy,  
    charge: particle.charge,  
   };  
  }  
});  
  
massInput.addEventListener('input', () => {  
  if (massInput.value < 0) {  
   massInput.value = 0;  
  }  
});  
  
magneticFieldStrengthInput.addEventListener('input', () => {  
  magneticFieldStrengthInput.value = Math.round(magneticFieldStrengthInput.value * 10) / 10;  
  magneticFieldStrength = parseFloat(magneticFieldStrengthInput.value);  
});  
  
// Toggle magnetic field button click handler  
document.getElementById('toggle-magnetic-field').addEventListener('click', () => {  
  magneticField = !magneticField;  
  if (magneticField) {  
   magneticFieldButton.textContent = 'Magnetic Field On';  
   magneticFieldButton.style.backgroundColor = 'green';  
   magneticFieldButton.style.color = 'white';
    showRadiusButton.style.display = 'block'; 
  } else {  
   magneticFieldButton.textContent = 'Magnetic Field Off';  
   magneticFieldButton.style.backgroundColor = 'red';  
   magneticFieldButton.style.color = 'white';  
    showRadiusButton.style.display = 'none'; 
  }  
});  
  
document.getElementById('clear-button').addEventListener('click', () => {  
  particles = [];  
  trail = [];  
});  
  
document.getElementById('preset-select').addEventListener('change', () => {  
  const preset = document.getElementById('preset-select').value;  
  if (preset === 'photon') {  
   document.getElementById('hint-box').style.display = 'block';  
    showRadiusButton.style.display = 'none'; 
  } else {  
   document.getElementById('hint-box').style.display = 'none'; 
    showRadiusButton.style.display = 'block'; 
  }  
});

presetSelect.addEventListener('change', () => {  
  const preset = presetSelect.value;  
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
  
function calculateMagneticForce(particle) {   
  const velocityVector = [particle.velocity[0], particle.velocity[1]];   
  const perpendicularVector = [-velocityVector[1], velocityVector[0]];   
  const forceX = particle.magneticScaleFactor * magneticFieldStrength * particle.charge * perpendicularVector[0];   
  const forceY = particle.magneticScaleFactor * magneticFieldStrength * particle.charge * perpendicularVector[1];   
  const force = [forceX, forceY];   
   
  const accelerationX = forceX / particle.mass;   
  const accelerationY = forceY / particle.mass;   
   
  const velocityMagnitude = Math.sqrt(particle.velocity[0] ** 2 + particle.velocity[1] ** 2);   
  const theta = Math.atan2(particle.velocity[1], particle.velocity[0]);   
   
  const angularVelocity = 0.001*particle.magneticScaleFactor * magneticFieldStrength * particle.charge / (particle.mass);   
   
  particle.velocity[0] = velocityMagnitude * Math.cos(theta + angularVelocity);   
  particle.velocity[1] = velocityMagnitude * Math.sin(theta + angularVelocity);  
  //console.log("velocity:", particle.velocity);
  return force;   
}

  
function animate() {  
  ctx.clearRect(0, 0, canvas.width, canvas.height);  
  for (let i = 0; i < particles.length; i++) {  
   const particle = particles[i];  
   if (magneticField) {  
    const force = calculateMagneticForce(particle);  
   }  
   particle.update();  
   particle.draw();  
   if (particle.energy > 0) {  
    trail.push([particle.x, particle.y]);  
   }  
   if (particle.x < 0 || particle.x > canvas.width || particle.y < 0 || particle.y > canvas.height) {  
    particles.splice(i, 1);  
   }  
  }  
  for (let i = 0; i < photons.length; i++) {  
   const photon = photons[i];  
   drawPhoton(photon.x, photon.y, photon.energy);  
   photon.x += 5;  
   if (photon.x > canvas.width) {  
    photons.splice(i, 1);  
   } else if (photon.energy > 1.022 * particlePresets.electron.energy && photon.x > canvas.width / 3) {  
     console.log("photon energy:", photon.energy);
     console.log("electron energy:", particlePresets.electron.energy);
    // Pair production  
     const energyLossRate = particlePresets.energyLossRate * (1 + Math.random() * 0.1 - 0.05);

    const electron = new Particle(photon.x, photon.y, -1, particlePresets.electron.mass, 0.03, 1, particlePresets.electron.energyLossRate, particlePresets.electron.magneticScaleFactor);  
    const positron = new Particle(photon.x, photon.y, 1, particlePresets.electron.mass, 0.03, 1, particlePresets.electron.energyLossRate, particlePresets.electron.magneticScaleFactor);  
     const remainingEnergy = photon.energy - 1.022;  
  const energyRatio = Math.random() * 0.2 + 0.35; 
    electron.energy = remainingEnergy * energyRatio;  
    positron.energy = remainingEnergy * (1 - energyRatio);  
    particles.push(electron);  
    particles.push(positron);  
    photons.splice(i, 1);  
     if (!magneticField) {  
   electron.velocity[0] = -0.03;  
   positron.velocity[0] = 0.03;  
  }  
   }  
  }  
  if (trail.length > 500) {  
   trail.shift();  
  }  
  for (let i = 0; i < trail.length; i++) {  
   ctx.beginPath();  
   ctx.arc(trail[i][0], trail[i][1], 2, 0, 2 * Math.PI);  
   ctx.fillStyle = 'rgba(0, 0, 0, ' + (i / trail.length) + ')';  
   ctx.fill();  
  }  
  requestAnimationFrame(animate);  
}
animate();

const showRadiusButton = document.getElementById('show-radius-button');  
const radiusHintBox = document.getElementById('radius-hint-box');  
  showRadiusButton.addEventListener('touchstart', () => {  
  const radius = calculateRadius();  
  radiusHintBox.textContent = `Radius: ${radius}`;  
  radiusHintBox.style.display = 'block';  
});  
  
showRadiusButton.addEventListener('touchend', () => {  
  radiusHintBox.style.display = 'none';  
});  

showRadiusButton.addEventListener('mousedown', () => {  
  if (magneticField) {  
  showRadiusButton.style.display = 'block';  
} else {  
  showRadiusButton.style.display = 'none';  
}

  const radius = calculateRadius();  
  radiusHintBox.textContent = `Radius: ${radius.toPrecision(2)} m`; 
  radiusHintBox.style.display = 'block';  
});  
  
showRadiusButton.addEventListener('mouseup', () => {  
  radiusHintBox.style.display = 'none';  
});  
  
showRadiusButton.addEventListener('mouseout', () => {  
  radiusHintBox.style.display = 'none';  
});
  
function calculateRadius() {  
  if (magneticField) {  
   const energy = 1.6e-13*lastParticleInitialValues.energy;  
   const mass = 1.672e-27*lastParticleInitialValues.mass;  
   const charge = 1.6e-19*lastParticleInitialValues.charge;  
   const magneticFieldStrength = magneticFieldStrengthInput.value;  
  
   const momentum = Math.sqrt(energy * 2 * mass);  
   const radius = momentum / (charge * magneticFieldStrength);  
   return radius;  
  } else {  
   return 0;  
  }  
}
