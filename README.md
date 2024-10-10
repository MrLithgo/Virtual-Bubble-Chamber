
<!DOCTYPE html>   
<html>   
<head>   
  <meta charset="UTF-8">   
  <title>Cloud Chamber Simulation</title>   
  <link rel="stylesheet" href="styles.css">   
</head>   
<body>   
  <canvas id="canvas" width="800" height="600"></canvas>   
  <h1 id="title">Virtual Cloud Chamber</h1>  
   
  <div id="controls">   
    <label for="preset-select">Preset:</label>  
<select id="preset-select">   
  <option value="none">none</option>   
  <option value="proton">proton</option>   
  <option value="electron">electron</option>   
  <option value="positron">positron</option>   
  <option value="neutron">neutron</option>   
    
  <option value="photon">photon</option>   
  <option value="alphaParticle">alpha particle</option>   
</select>  
  
   <label for="charge">Relative Charge:</label>   
   <input type="number" id="charge" step="1" value="1">   
   <label for="mass">Relative Mass:</label>   
  <input id="mass" type="number" min="0" step="1" value="1">    
   <label for="energy">Energy(MeV):</label>   
   <input type="number" id="energy" min ="0" step="0.01" value="0.10">  
    
   <label for="magnetic-field-strength">Magnetic Field(T):</label>   
  <input id="magnetic-field-strength" type="number"  step="0.1" value="0.5">  
   <button id="add-particle">Add Particle</button>   
   <button id="toggle-magnetic-field">Turn on magnetic field</button>  
   <button id="clear-button">Clear Chamber</button>   
  </div>   
   
  <script src="script.js"></script>   
</body>   
</html>

