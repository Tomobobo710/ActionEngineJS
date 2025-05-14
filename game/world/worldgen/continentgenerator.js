// game/world/worldgen/continentgenerator.js
class ContinentGenerator extends NoiseBasedGenerator {
    constructor(config = {}) {
        super(config);

        // Initialize basic parameters
        this.waterBorderWidth = config.waterBorderWidth || 0.05;
        this.continentCount = config.continentCount || 2 + Math.floor(Math.random() * 2); // 2-3 continents
        
        // World height is 0-500
        this.MAX_HEIGHT = 500;
        
        // Height thresholds in world units
        this.WATER_HEIGHT = 0;
        this.BEACH_HEIGHT = 1; // 5% of max height
        this.LOWLAND_HEIGHT = 15; // 30% of max height
        this.HIGHLAND_HEIGHT = 30; // 60% of max height
        this.MOUNTAIN_HEIGHT = 40; // 85% of max height
        this.SNOW_HEIGHT = 50; // 95% of max height
        
        // Setup additional noise generators for varied terrain features
        this.detailNoise = new NoiseGenerator(this.seed + 1);
        this.mountainNoise = new NoiseGenerator(this.seed + 2);
        this.riverNoise = new NoiseGenerator(this.seed + 3);
    }

    // Main height generation function - called by the terrain system
    generateHeight(nx, nz) {
        // First check if we're in a river or lake
        const waterFeatures = this.generateWaterFeatures(nx, nz);
        if (waterFeatures > 0.7) {
            return this.WATER_HEIGHT; // Solid water in rivers/lakes
        }

        // Check water border - ensure water around the edges
        const edgeDistance = Math.min(nx, 1 - nx, nz, 1 - nz);
        if (edgeDistance < this.waterBorderWidth) {
            return this.WATER_HEIGHT; // Water at borders
        }

        // Start with a land-based world
        let height = this.LOWLAND_HEIGHT * 0.5; // Base height for most land

        // Add detailed terrain variation
        const detailVariation = this.detailNoise.fractalNoise(
            nx * 4, nz * 4, 3, 0.5
        ) * this.LOWLAND_HEIGHT * 0.3;
        height += detailVariation;

        // Add continent influence (higher areas)
        const continentInfluence = this.generateContinentInfluence(nx, nz);
        height += continentInfluence * this.LOWLAND_HEIGHT;

        // Add mountain ranges
        const mountainInfluence = this.generateMountainInfluence(nx, nz);
        if (mountainInfluence > 0) {
            const mountainHeight = mountainInfluence * (this.MOUNTAIN_HEIGHT - this.HIGHLAND_HEIGHT);
            height += mountainHeight;
            
            // Add mountain detail
            const mountainDetail = this.mountainNoise.fractalNoise(
                nx * 8, nz * 8, 2, 0.6
            ) * 50;
            height += mountainDetail * mountainInfluence;
        }

        // Water influence gradually lowers terrain near water
        if (waterFeatures > 0) {
            // Create sloped banks near water
            const waterSlope = 1 - Math.pow(1 - waterFeatures, 2);
            height = Math.max(this.BEACH_HEIGHT, height * (1 - waterSlope * 0.8));
        }
        
        // Check if near water for beach transitions
        if (this.isNearWater(nx, nz) && height > this.WATER_HEIGHT) {
            // Force to beach height or lower
            height = Math.min(height, this.BEACH_HEIGHT);
        }

        // Ensure we're within the allowed range
        height = Math.max(this.WATER_HEIGHT, Math.min(this.MAX_HEIGHT, height));
        
        return height;
    }

    // Generate continent influence - determines where the main landmasses are
    generateContinentInfluence(nx, nz) {
        let maxInfluence = 0;

        // Generate continent centers
        const continents = [];
        const rng = new SeededRandom(this.seed);
        
        // First continent is always large and central
        continents.push({
            x: 0.5,
            z: 0.5,
            size: 0.4 + rng.next() * 0.1, // 40-50% of map size
        });
        
        // Additional continents - smaller and in different corners
        const corners = [
            { x: 0.25, z: 0.25 }, // Top-left
            { x: 0.75, z: 0.25 }, // Top-right
            { x: 0.25, z: 0.75 }, // Bottom-left
            { x: 0.75, z: 0.75 }  // Bottom-right
        ];
        
        for (let i = 0; i < this.continentCount - 1; i++) {
            if (i < corners.length) {
                // Place in a corner with some randomness
                const corner = corners[i];
                const x = corner.x + (rng.next() - 0.5) * 0.2;
                const z = corner.z + (rng.next() - 0.5) * 0.2;
                
                continents.push({
                    x, 
                    z,
                    size: 0.15 + rng.next() * 0.1 // 15-25% of map size
                });
            }
        }

        // Calculate influence from each continent
        for (const continent of continents) {
            const dx = nx - continent.x;
            const dz = nz - continent.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // If within continent radius, add influence
            if (distance < continent.size) {
                // Smoother falloff at edges with some noise for irregular coastlines
                const edgeFactor = 1 - distance / continent.size;
                
                // Add noise to the continent edge
                const noiseFreq = 8;
                const edgeNoise = this.detailNoise.fractalNoise(nx * noiseFreq, nz * noiseFreq, 2, 0.5) * 0.3;
                const influence = Math.pow(edgeFactor, 2) + edgeNoise * edgeFactor - 0.1;
                
                if (influence > 0) {
                    maxInfluence = Math.max(maxInfluence, influence);
                }
            }
        }

        return maxInfluence;
    }

    // Generate mountain ranges
    generateMountainInfluence(nx, nz) {
        let maxInfluence = 0;
        const mountainCount = 5; // More mountain ranges
        
        // Generate mountain ridges
        for (let i = 0; i < mountainCount; i++) {
            const rng = new SeededRandom(this.seed + i * 500);
            
            // Starting point
            const startX = 0.2 + rng.next() * 0.6; // Keep away from edges
            const startZ = 0.2 + rng.next() * 0.6;
            
            // Direction
            const angle = rng.next() * Math.PI * 2;
            const length = 0.3 + rng.next() * 0.2; // 30-50% of map size
            
            // End point
            const endX = startX + Math.cos(angle) * length;
            const endZ = startZ + Math.sin(angle) * length;
            
            // Width of the range
            const width = 0.04 + rng.next() * 0.04; // 4-8% of map width
            
            // Calculate distance to line segment
            const distance = this.distanceToLineSegment(nx, nz, startX, startZ, endX, endZ);
            
            // If close to mountain range, add influence
            if (distance < width) {
                const influence = Math.pow(1 - distance / width, 1.5); // Sharper mountain ridges
                maxInfluence = Math.max(maxInfluence, influence);
            }
        }
        
        return maxInfluence;
    }

    // Generate water features - rivers and lakes
    generateWaterFeatures(nx, nz) {
        let waterInfluence = 0;
        
        // Generate bigger rivers that connect to edges
        const riverCount = 3; // More rivers
        
        for (let i = 0; i < riverCount; i++) {
            const rng = new SeededRandom(this.seed + i * 300);
            
            // Rivers now connect from an edge to another edge or to a lake
            let startX, startZ, endX, endZ;
            
            // Start from an edge
            const startEdge = Math.floor(rng.next() * 4); // 0=top, 1=right, 2=bottom, 3=left
            switch (startEdge) {
                case 0: // Top
                    startX = rng.next();
                    startZ = 0;
                    break;
                case 1: // Right
                    startX = 1;
                    startZ = rng.next();
                    break;
                case 2: // Bottom
                    startX = rng.next();
                    startZ = 1;
                    break;
                case 3: // Left
                    startX = 0;
                    startZ = rng.next();
                    break;
            }
            
            // End at another edge or near center
            if (rng.next() < 0.7) { // 70% chance to go to opposite edge
                const endEdge = (startEdge + 2) % 4;
                switch (endEdge) {
                    case 0: // Top
                        endX = 0.2 + rng.next() * 0.6;
                        endZ = 0;
                        break;
                    case 1: // Right
                        endX = 1;
                        endZ = 0.2 + rng.next() * 0.6;
                        break;
                    case 2: // Bottom
                        endX = 0.2 + rng.next() * 0.6;
                        endZ = 1;
                        break;
                    case 3: // Left
                        endX = 0;
                        endZ = 0.2 + rng.next() * 0.6;
                        break;
                }
            } else { // 30% chance to end near center (lake)
                endX = 0.4 + rng.next() * 0.2;
                endZ = 0.4 + rng.next() * 0.2;
            }
            
            // River should bend a bit - add a control point
            const controlX = (startX + endX) / 2 + (rng.next() - 0.5) * 0.2;
            const controlZ = (startZ + endZ) / 2 + (rng.next() - 0.5) * 0.2;
            
            // Width varies along the river - wider in the middle, narrower at ends
            const baseWidth = 0.02 + rng.next() * 0.03; // 2-5% of map width
            
            // Check distance to first half of the river
            const dist1 = this.distanceToLineSegment(nx, nz, startX, startZ, controlX, controlZ);
            // Check distance to second half of the river
            const dist2 = this.distanceToLineSegment(nx, nz, controlX, controlZ, endX, endZ);
            
            // Use the minimum distance
            const distance = Math.min(dist1, dist2);
            
            // Calculate position along the river (0 at start, 1 at end)
            let position;
            if (dist1 <= dist2) {
                // First half
                const totalLength = Math.sqrt(
                    Math.pow(controlX - startX, 2) + 
                    Math.pow(controlZ - startZ, 2)
                );
                position = this.projectOnLine(nx, nz, startX, startZ, controlX, controlZ) / totalLength;
            } else {
                // Second half
                const totalLength = Math.sqrt(
                    Math.pow(endX - controlX, 2) + 
                    Math.pow(endZ - controlZ, 2)
                );
                position = 0.5 + this.projectOnLine(nx, nz, controlX, controlZ, endX, endZ) / totalLength;
            }
            
            // Width varies along the river - wider in the middle, narrower at ends
            const widthVariation = 1 - Math.abs(position - 0.5) * 2; // 0 at ends, 1 at middle
            const riverWidth = baseWidth * (0.7 + widthVariation * 0.6);
            
            // Add noise to river edges
            const riverNoise = this.riverNoise.fractalNoise(nx * 20, nz * 20, 2, 0.5) * 0.4;
            const effectiveWidth = riverWidth * (1 + riverNoise);
            
            // If close to river, add influence
            if (distance < effectiveWidth) {
                // Make the center of the river definitely water (core river)
                const coreWidth = effectiveWidth * 0.5;
                if (distance < coreWidth) {
                    // Solid water in center
                    waterInfluence = 1.0;
                } else {
                    // Sloping banks
                    const bankFactor = 1 - (distance - coreWidth) / (effectiveWidth - coreWidth);
                    const riverFactor = Math.pow(bankFactor, 1.5); // Sharper banks
                    waterInfluence = Math.max(waterInfluence, riverFactor);
                }
            }
        }
        
        // Generate several lakes
        const lakeCount = 5; // More lakes
        
        for (let i = 0; i < lakeCount; i++) {
            const rng = new SeededRandom(this.seed + i * 200);
            
            // Lake center
            const lakeX = 0.15 + rng.next() * 0.7;
            const lakeZ = 0.15 + rng.next() * 0.7;
            
            // Lake size
            const lakeSize = 0.03 + rng.next() * 0.04; // 3-7% of map size
            
            // Distance to lake center
            const dx = nx - lakeX;
            const dz = nz - lakeZ;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // Irregular lake shape
            const angle = Math.atan2(dz, dx);
            const noiseMagnitude = 0.3;
            const shapeNoise = this.riverNoise.fractalNoise(Math.cos(angle) * 2, Math.sin(angle) * 2, 2, 0.5) * noiseMagnitude + 1;
            
            // If within lake, add influence
            const effectiveSize = lakeSize * shapeNoise;
            if (distance < effectiveSize) {
                // Core of lake is definitely water
                const coreSize = effectiveSize * 0.7;
                if (distance < coreSize) {
                    // Solid water
                    waterInfluence = 1.0;
                } else {
                    // Lake shores
                    const shoreFactor = 1 - (distance - coreSize) / (effectiveSize - coreSize);
                    const lakeFactor = Math.pow(shoreFactor, 1.5); // Sharper shores
                    waterInfluence = Math.max(waterInfluence, lakeFactor);
                }
            }
        }
        
        return waterInfluence;
    }

    // Calculate distance from point to line segment
    distanceToLineSegment(px, pz, x1, z1, x2, z2) {
        const A = px - x1;
        const B = pz - z1;
        const C = x2 - x1;
        const D = z2 - z1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, zz;

        if (param < 0) {
            xx = x1;
            zz = z1;
        } else if (param > 1) {
            xx = x2;
            zz = z2;
        } else {
            xx = x1 + param * C;
            zz = z1 + param * D;
        }

        const dx = px - xx;
        const dz = pz - zz;
        return Math.sqrt(dx * dx + dz * dz);
    }
    
    // Calculate position along a line (0 at start, positive along the line)
    projectOnLine(px, pz, x1, z1, x2, z2) {
        const A = px - x1;
        const B = pz - z1;
        const C = x2 - x1;
        const D = z2 - z1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = 0;
        if (lenSq !== 0) param = dot / lenSq;

        if (param < 0) param = 0;
        if (param > 1) param = 1;
        
        // Calculate distance along the line
        return param * Math.sqrt(lenSq);
    }

    // Check if a point is near water
    isNearWater(nx, nz) {
        const checkRadius = 0.02; // Check within 2% of map size
        const checkSteps = 8; // Number of points to check
        
        for (let i = 0; i < checkSteps; i++) {
            const angle = (Math.PI * 2 * i) / checkSteps;
            const checkX = nx + Math.cos(angle) * checkRadius;
            const checkZ = nz + Math.sin(angle) * checkRadius;
            
            // Skip if out of bounds
            if (checkX < 0 || checkX > 1 || checkZ < 0 || checkZ > 1) {
                continue;
            }
            
            // Check water border
            const edgeDistance = Math.min(checkX, 1 - checkX, checkZ, 1 - checkZ);
            if (edgeDistance < this.waterBorderWidth) {
                return true; // Near border water
            }
            
            // Check water features
            const waterFeatureValue = this.generateWaterFeatures(checkX, checkZ);
            if (waterFeatureValue > 0.7) { // Water if influence is high
                return true; // Near water feature
            }
        }
        
        return false;
    }

}