// Configuration constants for the Hexagonal Grid layout
const HEX_SIZE = 10; 

/**
 * Converts structural hex coordinates (column, row) into real 2D space coordinates.
 * Uses an "odd-r" horizontal layout (pointy-topped hexes with shifted rows).
 */
function hexToCartesian(col, row) {
    const hexWidth = Math.sqrt(3) * HEX_SIZE;
    const hexHeight = 2 * HEX_SIZE;

    // Shift every odd row by half a hex width horizontally
    let x = hexWidth * (col + (row & 1) * 0.5);
    let y = hexHeight * row * 0.75;
    
    return { x, y };
}

/**
 * Standard Fractal Brownian Motion (FBM) helper optimized for hex coordinates.
 */
function fractalNoiseHex(noise3D, col, row, octaves, persistence, frequency, zSeed = 0) {
    const worldPos = hexToCartesian(col, row);
    
    let total = 0;
    let amplitude = 1;
    let maxValue = 0;
    let freq = frequency;

    for (let i = 0; i < octaves; i++) {
        // Sample 3D noise using the passed-in noise function
        let noiseValue = noise3D(worldPos.x * freq, worldPos.y * freq, zSeed);
        
        // Normalize from [-1, 1] to [0, 1]
        noiseValue = (noiseValue + 1) / 2;

        total += noiseValue * amplitude;
        maxValue += amplitude;

        amplitude *= persistence;
        freq *= 2;
    }

    return total / maxValue;
}

/**
 * 1. ELEVATION NOISE
 * Generates sharp ridged structures for mountains and continental splits.
 */
function getHexElevation(noise3D, col, row) {
    const worldPos = hexToCartesian(col, row);
    let total = 0;
    let frequency = 0.05; 
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < 5; i++) {
        let v = noise3D(worldPos.x * frequency, worldPos.y * frequency, 100.0);
        v = 1 - Math.abs(v); // Inverted absolute noise for ridges
        v = Math.pow(v, 2);  // Flattens out low areas

        total += v * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return total / maxValue; 
}

/**
 * 2. OCEAN DEPTH NOISE
 * Smooth, low-octave noise to determine underwater shelves and deep trenches.
 */
function getHexOceanDepth(noise3D, col, row) {
    let raw = fractalNoiseHex(noise3D, col, row, 3, 0.4, 0.04, 200.0);
    return Math.pow(raw, 1.5);
}

/**
 * 3. RIVER MASK NOISE
 * Generates narrow, twisting veins representing river pathways.
 */
function getHexRiverMask(noise3D, col, row) {
    const worldPos = hexToCartesian(col, row);
    let total = 0;
    let maxValue = 0;
    let amplitude = 1;
    let frequency = 0.08;

    for (let i = 0; i < 4; i++) {
        let v = noise3D(worldPos.x * frequency, worldPos.y * frequency, 300.0);
        v = 1 - Math.abs(v);
        v = Math.pow(v, 16); // High exponential power for thin channels

        total += v * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return total / maxValue;
}

/**
 * 4. MOISTURE NOISE
 * Uses domain warping (distorted inputs) to create organic, splotchy climate cells.
 */
function getHexMoisture(noise3D, col, row) {
    const worldPos = hexToCartesian(col, row);
    
    // Calculate coordinate distortions using separate noise samples
    let warpX = noise3D(worldPos.x * 0.02, worldPos.y * 0.02, 400.0) * 5;
    let warpY = noise3D(worldPos.x * 0.02, worldPos.y * 0.02, 500.0) * 5;

    let freq = 0.03;
    let total = noise3D((worldPos.x + warpX) * freq, (worldPos.y + warpY) * freq, 600.0);
    return (total + 1) / 2;
}

/**
 * 5. TEMPERATURE NOISE
 * Combines global vertical latitude scales, soft noise, and elevation penalties.
 */
function getHexTemperature(noise3D, col, row, maxRows, elevation) {
    // Civ style global gradient: Cold at map limits (0 and maxRows), hot at center equator
    let distanceToEquator = Math.abs(row - (maxRows / 2)) / (maxRows / 2);
    let latitudeFactor = 1 - distanceToEquator; 

    // Soft organic climate shifts
    let climateNoise = fractalNoiseHex(noise3D, col, row, 2, 0.5, 0.02, 700.0);
    
    let baseTemp = (latitudeFactor * 0.75) + (climateNoise * 0.25);
    
    // Altitude check: Higher positions dramatically lower the regional temperature
    let temperature = baseTemp - (elevation * 0.35);

    return Math.max(0, Math.min(1, temperature));
}

/**
 * ENGINE LOOP
 * Generates the complete array matrix evaluating every grid point profile.
 * Accepts the `noise3D` implementation directly as its first parameter.
 */
function generateHexWorld(noise3D, numCols, numRows) {
    const hexGrid = {};

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            
            // 1. Gather all raw procedural layers, passing the noise instance forward
            let elevation   = getHexElevation(noise3D, col, row);
            let oceanDepth  = getHexOceanDepth(noise3D, col, row);
            let riverMask   = getHexRiverMask(noise3D, col, row);
            let moisture    = getHexMoisture(noise3D, col, row);
            let temperature = getHexTemperature(noise3D, col, row, numRows, elevation);

            // 2. Combine inputs into concrete Civilization style Biomes
            let terrainType = "Plains";
            
            if (elevation < 0.25) {
                terrainType = oceanDepth > 0.5 ? "Deep Ocean" : "Coast";
            } else if (elevation > 0.75) {
                terrainType = "Mountain";
            } else {
                // Land Biome assignment based on temperature/moisture matrix
                if (temperature < 0.2) {
                    terrainType = "Tundra";
                } else if (temperature > 0.6 && moisture < 0.3) {
                    terrainType = "Desert";
                } else if (moisture > 0.7) {
                    terrainType = "Tropical Rainforest";
                } else if (moisture < 0.4) {
                    terrainType = "Grassland";
                }
            }

            // 3. Construct tile entity payload
            hexGrid[[col,row]]={
                terrain: terrainType,
                hasRiverSource: riverMask > 0.85,
                elevation,
                moisture,
                temperature
            };
        }
    }
    return hexGrid;
}