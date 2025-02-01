class Fish extends ActionPhysicsObject3D {
   static FISH_TYPES = {
       DEFAULT: {
           // Color configuration 
           colors: {
               NOSE_COLOR: "#fa5689",
               SIDE_COLOR: "#4169E1", 
               TOPBOTTOM_COLOR: "#1E90FF",
               ANAL_FIN_COLOR: "#4169E1",
               TAIL_SIDE_COLOR: "#4169E1",
               TAIL_CONNECT_COLOR: "#4169E1", 
               TAIL_FIN_COLOR: "#4169E1",
               DORSAL_FIN_COLOR: "#4169E1",
               PECTORAL_FIN_COLOR: "#4169E1",
               PELVIC_FIN_COLOR: "#4169E1",
               EYE_BASE_COLOR: "#f2f2f2",
               EYE_DETAIL_COLOR: "#000000"
           },
           // Base scale factors
           scales: {
               LENGTH_SCALE: 5,
               WIDTH_SCALE: 0.8, 
               HEIGHT_SCALE: 0.5
           },
           // Eye factors
           eyes: {
               HEIGHT_FACTOR: 0.15,
               INWARD_FACTOR: 0.23,
               FORWARD_FACTOR: 0.34,
               SIZE_FACTOR: 0.2
           },
           // Tail factors
           tail: {
               FIN_SHIFT_FACTOR: -0.1,
               FIN_SCALE_FACTOR: 2,
               FIN_LENGTH_SCALE: 0.2 // 1/5
           },
           // Anal fin factors
           analFin: {
               HEIGHT_FACTOR: 1.5,
               FRONT_FACTOR: -0.225,
               BACK_FACTOR: -0.375,
               ROOT_HEIGHT_FACTOR: 1.0
           },
           // Dorsal fin factors
           dorsalFin: {
               HEIGHT_FACTOR: 2.0,
               FRONT_FACTOR: 0.25,
               BACK_FACTOR: -0.25
           },
           // Pectoral fin factors
           pectoralFins: {
               EXTENSION_FACTOR: 1.5,
               DROP_FACTOR: 0.5,
               ROOT_FRONT_FACTOR: 0.25,
               ROOT_BACK_FACTOR: 0
           },
           // Pelvic fin factors
           pelvicFins: {
               DROP_FACTOR: 1.5,
               EXTENSION_FACTOR: 1.0,
               ROOT_HEIGHT_FACTOR: 0.8,
               FRONT_FACTOR: 0,
               BACK_FACTOR: -0.25
           }
       }
   };

   constructor(physicsWorld, size, position, config, rotationAxis = "y") {
   
       
       const triangles = [];

    // Base scale calculations
    const length = size * config.scales.LENGTH_SCALE;
    const width = size * config.scales.WIDTH_SCALE;
    const height = size * config.scales.HEIGHT_SCALE;

    // Calculate anal fin tip x factor
    const ANAL_FIN_TIP_X_FACTOR = (config.analFin.FRONT_FACTOR + config.analFin.BACK_FACTOR) / 2;

    // Eye size calculation
    const EYE_PROTRUSION = size * config.eyes.SIZE_FACTOR;

    // Tail calculations
    const TAIL_BASE_DISTANCE = length / 2;
    const TAIL_FIN_LENGTH = length * config.tail.FIN_LENGTH_SCALE;
       const v = {
           // Nose
           nose: new Vector3(length / 2, 0, 0),

           // Main body vertices 
           topFront: new Vector3(length / 4, height, width / 2),
           bottomFront: new Vector3(length / 4, -height, width / 2),
           topBack: new Vector3(-length / 4, height, width / 2),
           bottomBack: new Vector3(-length / 4, -height, width / 2),

           // Mirrored body vertices
           topFrontMirror: new Vector3(length / 4, height, -width / 2),
           bottomFrontMirror: new Vector3(length / 4, -height, -width / 2), 
           topBackMirror: new Vector3(-length / 4, height, -width / 2),
           bottomBackMirror: new Vector3(-length / 4, -height, -width / 2),

           // Anal fin vertices
           analFinTip: new Vector3(length * ANAL_FIN_TIP_X_FACTOR, -height * config.analFin.HEIGHT_FACTOR, 0),
           analFinRootFront: new Vector3(length * config.analFin.FRONT_FACTOR, -height * config.analFin.ROOT_HEIGHT_FACTOR, 0),
           analFinRootBack: new Vector3(length * config.analFin.BACK_FACTOR, -height * config.analFin.ROOT_HEIGHT_FACTOR, 0),

           // Tail vertices
           tailTop: new Vector3(-length / 2, height / 2, 0),
           tailBottom: new Vector3(-length / 2, -height / 2, 0),
           tailFinTop: new Vector3(
               -(TAIL_BASE_DISTANCE + TAIL_FIN_LENGTH * config.tail.FIN_SCALE_FACTOR + length * config.tail.FIN_SHIFT_FACTOR),
               height,
               0
           ),
           tailFinBottom: new Vector3(
               -(TAIL_BASE_DISTANCE + TAIL_FIN_LENGTH * config.tail.FIN_SCALE_FACTOR + length * config.tail.FIN_SHIFT_FACTOR),
               -height,
               0
           ),
           tailCenter: new Vector3(-(TAIL_BASE_DISTANCE + length * config.tail.FIN_SHIFT_FACTOR), 0, 0),

           // Dorsal fin vertices
           dorsalFinTip: new Vector3(0, height * config.dorsalFin.HEIGHT_FACTOR, 0),
           dorsalFinFront: new Vector3(length * config.dorsalFin.FRONT_FACTOR, height, 0),
           dorsalFinBack: new Vector3(length * config.dorsalFin.BACK_FACTOR, height, 0),

           // Pectoral fins
           pectoralFinRight: new Vector3(0, -height * config.pectoralFins.DROP_FACTOR, width * config.pectoralFins.EXTENSION_FACTOR),
           pectoralFinRootFrontRight: new Vector3(length * config.pectoralFins.ROOT_FRONT_FACTOR, 0, width / 2),
           pectoralFinRootBackRight: new Vector3(length * config.pectoralFins.ROOT_BACK_FACTOR, 0, width / 2),
           pectoralFinLeft: new Vector3(0, -height * config.pectoralFins.DROP_FACTOR, -width * config.pectoralFins.EXTENSION_FACTOR),
           pectoralFinRootFrontLeft: new Vector3(length * config.pectoralFins.ROOT_FRONT_FACTOR, 0, -width / 2),
           pectoralFinRootBackLeft: new Vector3(length * config.pectoralFins.ROOT_BACK_FACTOR, 0, -width / 2),

           // Pelvic fins
           pelvicFinRight: new Vector3(
               length * config.pelvicFins.BACK_FACTOR,
               -height * config.pelvicFins.DROP_FACTOR,
               width * config.pelvicFins.EXTENSION_FACTOR
           ),
           pelvicFinRootFrontRight: new Vector3(
               length * config.pelvicFins.FRONT_FACTOR,
               -height * config.pelvicFins.ROOT_HEIGHT_FACTOR,
               width / 2
           ),
           pelvicFinRootBackRight: new Vector3(
               length * config.pelvicFins.BACK_FACTOR,
               -height * config.pelvicFins.ROOT_HEIGHT_FACTOR,
               width / 2
           ),
           pelvicFinLeft: new Vector3(
               length * config.pelvicFins.BACK_FACTOR,
               -height * config.pelvicFins.DROP_FACTOR,
               -width * config.pelvicFins.EXTENSION_FACTOR
           ),
           pelvicFinRootFrontLeft: new Vector3(
               length * config.pelvicFins.FRONT_FACTOR,
               -height * config.pelvicFins.ROOT_HEIGHT_FACTOR,
               -width / 2
           ),
           pelvicFinRootBackLeft: new Vector3(
               length * config.pelvicFins.BACK_FACTOR,
               -height * config.pelvicFins.ROOT_HEIGHT_FACTOR,
               -width / 2
           ),

           // Eyes
           eyeTipRight: new Vector3(
               length * config.eyes.FORWARD_FACTOR,
               height * config.eyes.HEIGHT_FACTOR,
               width * config.eyes.INWARD_FACTOR + EYE_PROTRUSION
           ),
           eyeBaseFrontRight: new Vector3(
               length * config.eyes.FORWARD_FACTOR + width * config.eyes.SIZE_FACTOR,
               height * config.eyes.HEIGHT_FACTOR,
               width * config.eyes.INWARD_FACTOR
           ),
           eyeBaseBackRight: new Vector3(
               length * config.eyes.FORWARD_FACTOR - width * config.eyes.SIZE_FACTOR,
               height * config.eyes.HEIGHT_FACTOR,
               width * config.eyes.INWARD_FACTOR
           ),
           eyeBaseTopRight: new Vector3(
               length * config.eyes.FORWARD_FACTOR,
               height * config.eyes.HEIGHT_FACTOR + width * config.eyes.SIZE_FACTOR,
               width * config.eyes.INWARD_FACTOR
           ),
           eyeBaseBottomRight: new Vector3(
               length * config.eyes.FORWARD_FACTOR,
               height * config.eyes.HEIGHT_FACTOR - width * config.eyes.SIZE_FACTOR,
               width * config.eyes.INWARD_FACTOR
           ),
           eyeTipLeft: new Vector3(
               length * config.eyes.FORWARD_FACTOR,
               height * config.eyes.HEIGHT_FACTOR,
               -width * config.eyes.INWARD_FACTOR - EYE_PROTRUSION
           ),
           eyeBaseFrontLeft: new Vector3(
               length * config.eyes.FORWARD_FACTOR + width * config.eyes.SIZE_FACTOR,
               height * config.eyes.HEIGHT_FACTOR,
               -width * config.eyes.INWARD_FACTOR
           ),
           eyeBaseBackLeft: new Vector3(
               length * config.eyes.FORWARD_FACTOR - width * config.eyes.SIZE_FACTOR,
               height * config.eyes.HEIGHT_FACTOR,
               -width * config.eyes.INWARD_FACTOR
           ),
           eyeBaseTopLeft: new Vector3(
               length * config.eyes.FORWARD_FACTOR,
               height * config.eyes.HEIGHT_FACTOR + width * config.eyes.SIZE_FACTOR,
               -width * config.eyes.INWARD_FACTOR
           ),
           eyeBaseBottomLeft: new Vector3(
               length * config.eyes.FORWARD_FACTOR,
               height * config.eyes.HEIGHT_FACTOR - width * config.eyes.SIZE_FACTOR,
               -width * config.eyes.INWARD_FACTOR
           )
       };

       // Body triangles - nose/front pyramid
       triangles.push(new Triangle(v.nose, v.topFrontMirror, v.topFront, config.colors.NOSE_COLOR));
       triangles.push(new Triangle(v.nose, v.bottomFront, v.bottomFrontMirror, config.colors.NOSE_COLOR));
       triangles.push(new Triangle(v.nose, v.topFront, v.bottomFront, config.colors.NOSE_COLOR));
       triangles.push(new Triangle(v.nose, v.bottomFrontMirror, v.topFrontMirror, config.colors.NOSE_COLOR));

       // Body sides
       triangles.push(new Triangle(v.topFront, v.topBack, v.bottomBack, config.colors.SIDE_COLOR));
       triangles.push(new Triangle(v.topFront, v.bottomBack, v.bottomFront, config.colors.SIDE_COLOR));
       triangles.push(new Triangle(v.topFrontMirror, v.bottomBackMirror, v.topBackMirror, config.colors.SIDE_COLOR));
       triangles.push(new Triangle(v.topFrontMirror, v.bottomFrontMirror, v.bottomBackMirror, config.colors.SIDE_COLOR));

       // Body top and bottom
       triangles.push(new Triangle(v.topFront, v.topFrontMirror, v.topBack, config.colors.TOPBOTTOM_COLOR));
       triangles.push(new Triangle(v.topFrontMirror, v.topBackMirror, v.topBack, config.colors.TOPBOTTOM_COLOR));
       triangles.push(new Triangle(v.bottomFront, v.bottomBack, v.bottomFrontMirror, config.colors.TOPBOTTOM_COLOR));
       triangles.push(new Triangle(v.bottomFrontMirror, v.bottomBack, v.bottomBackMirror, config.colors.TOPBOTTOM_COLOR));

       // Anal fin triangles
       triangles.push(new Triangle(v.analFinRootFront, v.analFinTip, v.analFinRootBack, config.colors.ANAL_FIN_COLOR));
       triangles.push(new Triangle(v.analFinRootFront, v.analFinRootBack, v.analFinTip, config.colors.ANAL_FIN_COLOR));

       // Tail sides
       triangles.push(new Triangle(v.topBack, v.tailTop, v.tailBottom, config.colors.TAIL_SIDE_COLOR));
       triangles.push(new Triangle(v.topBack, v.tailBottom, v.bottomBack, config.colors.TAIL_SIDE_COLOR));
       triangles.push(new Triangle(v.topBackMirror, v.tailBottom, v.tailTop, config.colors.TAIL_SIDE_COLOR));
       triangles.push(new Triangle(v.topBackMirror, v.bottomBackMirror, v.tailBottom, config.colors.TAIL_SIDE_COLOR));

       // Tail top and bottom connections
       triangles.push(new Triangle(v.topBack, v.topBackMirror, v.tailTop, config.colors.TAIL_CONNECT_COLOR));
       triangles.push(new Triangle(v.bottomBack, v.tailBottom, v.bottomBackMirror, config.colors.TAIL_CONNECT_COLOR));

       // Tail fin
       triangles.push(new Triangle(v.tailCenter, v.tailFinTop, v.tailFinBottom, config.colors.TAIL_FIN_COLOR));
       triangles.push(new Triangle(v.tailCenter, v.tailFinBottom, v.tailFinTop, config.colors.TAIL_FIN_COLOR));

       // Dorsal fin 
       triangles.push(new Triangle(v.dorsalFinFront, v.dorsalFinTip, v.dorsalFinBack, config.colors.DORSAL_FIN_COLOR));
       triangles.push(new Triangle(v.dorsalFinFront, v.dorsalFinBack, v.dorsalFinTip, config.colors.DORSAL_FIN_COLOR));

       // Pectoral fins
       triangles.push(new Triangle(v.pectoralFinRootFrontRight, v.pectoralFinRight, v.pectoralFinRootBackRight, config.colors.PECTORAL_FIN_COLOR));
       triangles.push(new Triangle(v.pectoralFinRootFrontRight, v.pectoralFinRootBackRight, v.pectoralFinRight, config.colors.PECTORAL_FIN_COLOR));
       triangles.push(new Triangle(v.pectoralFinRootFrontLeft, v.pectoralFinRootBackLeft, v.pectoralFinLeft, config.colors.PECTORAL_FIN_COLOR));
       triangles.push(new Triangle(v.pectoralFinRootFrontLeft, v.pectoralFinLeft, v.pectoralFinRootBackLeft, config.colors.PECTORAL_FIN_COLOR));

       // Pelvic fins
       triangles.push(new Triangle(v.pelvicFinRootFrontRight, v.pelvicFinRight, v.pelvicFinRootBackRight, config.colors.PELVIC_FIN_COLOR));
       triangles.push(new Triangle(v.pelvicFinRootFrontRight, v.pelvicFinRootBackRight, v.pelvicFinRight, config.colors.PELVIC_FIN_COLOR));
       triangles.push(new Triangle(v.pelvicFinRootFrontLeft, v.pelvicFinRootBackLeft, v.pelvicFinLeft, config.colors.PELVIC_FIN_COLOR));
       triangles.push(new Triangle(v.pelvicFinRootFrontLeft, v.pelvicFinLeft, v.pelvicFinRootBackLeft, config.colors.PELVIC_FIN_COLOR));

       // Right eye
        triangles.push(new Triangle(v.eyeBaseFrontRight, v.eyeBaseBottomRight, v.eyeBaseBackRight, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseTopRight, v.eyeBaseFrontRight, v.eyeBaseBackRight, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseFrontRight, v.eyeBaseTopRight, v.eyeTipRight, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseBottomRight, v.eyeBaseFrontRight, v.eyeTipRight, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseBackRight, v.eyeBaseBottomRight, v.eyeTipRight, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseTopRight, v.eyeBaseBackRight, v.eyeTipRight, config.colors.EYE_BASE_COLOR));

        // Left eye
        triangles.push(new Triangle(v.eyeBaseFrontLeft, v.eyeBaseBackLeft, v.eyeBaseBottomLeft, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseTopLeft, v.eyeBaseBackLeft, v.eyeBaseFrontLeft, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseTopLeft, v.eyeBaseFrontLeft, v.eyeTipLeft, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseFrontLeft, v.eyeBaseBottomLeft, v.eyeTipLeft, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseBottomLeft, v.eyeBaseBackLeft, v.eyeTipLeft, config.colors.EYE_BASE_COLOR));
        triangles.push(new Triangle(v.eyeBaseBackLeft, v.eyeBaseTopLeft, v.eyeTipLeft, config.colors.EYE_BASE_COLOR));

       super(physicsWorld, triangles);
       
       // Add animation properties
        this.animationTime = 0;
        this.tailWaveSpeed = 5; // Waves per second
        this.tailWaveAmplitude = 0.2; // Maximum tail displacement
        this.bodyWaveSpeed = 3; // Slightly slower body wave
        this.bodyWaveAmplitude = 0.1; // Smaller body wave
       const shape = new Goblin.SphereShape(size);
       this.body = new Goblin.RigidBody(shape, 0);
       this.body.position.set(position.x, position.y, position.z);

       this.rotationAxis = rotationAxis;
       this.rotation = 0;
       this.rotationSpeed = 0.2;

       physicsWorld.addObject(this);
       
   }
     updateVisual() {
        if (!this.body) return;
        
        const pos = this.body.position;
        const rot = this.body.rotation;
        
        this.position = new Vector3(pos.x, pos.y, pos.z);
        
        this.triangles.forEach((triangle, triIndex) => {
            // Update normal
            const origNormal = this.originalNormals[triIndex];
            const rotatedNormal = this.rotateVector(origNormal, rot);
            triangle.normal = rotatedNormal;
            
            // Update vertices with swimming animation
            triangle.vertices.forEach((vertex, vertIndex) => {
                const origVert = this.originalVerts[triIndex * 3 + vertIndex];
                
                // Create animated vertex by applying wave motion
                const animatedVert = this.applySwimmingAnimation(origVert);
                
                // Create a new vector relative to origin for rotation
                const relativeVert = new Goblin.Vector3(
                    animatedVert.x,
                    animatedVert.y,
                    animatedVert.z
                );
                
                // Rotate relative to origin
                rot.transformVector3(relativeVert);
                
                // Add position
                vertex.x = relativeVert.x + this.position.x;
                vertex.y = relativeVert.y + this.position.y;
                vertex.z = relativeVert.z + this.position.z;
            });
        });
        
        this.physicsWorld.shaderManager?.updateRenderableBuffers(this);
    }

    applySwimmingAnimation(vertex) {
        // Create a copy of the vertex
        const animatedVertex = new Vector3(vertex.x, vertex.y, vertex.z);
        
        // Calculate wave offset based on x position (front-to-back)
        const xOffset = -vertex.x; // Negative so wave travels backward
        
        // Calculate wave displacement
        const tailWave = Math.sin(this.tailWaveSpeed * this.animationTime + xOffset) * 
                        this.tailWaveAmplitude;
        const bodyWave = Math.sin(this.bodyWaveSpeed * this.animationTime + xOffset) * 
                        this.bodyWaveAmplitude;
        
        // Apply stronger effect to tail (based on x position)
        const tailFactor = Math.max(0, (-vertex.x + 2) / 4); // More effect towards tail
        const bodyFactor = 1 - tailFactor; // More effect towards front
        
        // Apply combined waves to z-coordinate (side-to-side motion)
        animatedVertex.z += (tailWave * tailFactor + bodyWave * bodyFactor);
        
        return animatedVertex;
    }
   update(deltaTime) {
    this.animationTime += deltaTime;
    this.updateVisual();
}
}

class FishProfile {
    constructor(config) {
    this.name = config.name;
    this.classification = config.classification;
    
    // Colors - keeping all current color properties
    this.colors = {
        NOSE_COLOR: config.colors.NOSE_COLOR,
        SIDE_COLOR: config.colors.SIDE_COLOR,
        TOPBOTTOM_COLOR: config.colors.TOPBOTTOM_COLOR,
        ANAL_FIN_COLOR: config.colors.ANAL_FIN_COLOR,
        TAIL_SIDE_COLOR: config.colors.TAIL_SIDE_COLOR,
        TAIL_CONNECT_COLOR: config.colors.TAIL_CONNECT_COLOR,
        TAIL_FIN_COLOR: config.colors.TAIL_FIN_COLOR,
        DORSAL_FIN_COLOR: config.colors.DORSAL_FIN_COLOR,
        PECTORAL_FIN_COLOR: config.colors.PECTORAL_FIN_COLOR,
        PELVIC_FIN_COLOR: config.colors.PELVIC_FIN_COLOR,
        EYE_BASE_COLOR: config.colors.EYE_BASE_COLOR,
        EYE_DETAIL_COLOR: config.colors.EYE_DETAIL_COLOR
    };

    // Base scales with broader randomization ranges (±30%)
    this.scales = {
        LENGTH_SCALE: {
            base: config.scales.LENGTH_SCALE,
            min: 0.7,
            max: 1.3
        },
        WIDTH_SCALE: {
            base: config.scales.WIDTH_SCALE,
            min: 0.7,
            max: 1.3
        },
        HEIGHT_SCALE: {
            base: config.scales.HEIGHT_SCALE,
            min: 0.7,
            max: 1.3
        }
    };

    // Keep existing eye configuration
    this.eyes = {
        HEIGHT_FACTOR: config.eyes.HEIGHT_FACTOR,
        INWARD_FACTOR: config.eyes.INWARD_FACTOR,
        FORWARD_FACTOR: config.eyes.FORWARD_FACTOR,
        SIZE_FACTOR: config.eyes.SIZE_FACTOR
    };

    // Tail configuration with broader ranges (±25%)
    this.tail = {
        FIN_SHIFT_FACTOR: {
            base: config.tail.FIN_SHIFT_FACTOR,
            min: 0.75,
            max: 1.25
        },
        FIN_SCALE_FACTOR: {
            base: config.tail.FIN_SCALE_FACTOR,
            min: 0.75,
            max: 1.25
        },
        FIN_LENGTH_SCALE: {
            base: config.tail.FIN_LENGTH_SCALE,
            min: 0.75,
            max: 1.25
        }
    };

    // Anal fin configuration with broader ranges (±20%)
    this.analFin = {
        HEIGHT_FACTOR: {
            base: config.analFin.HEIGHT_FACTOR,
            min: 0.8,
            max: 1.2
        },
        FRONT_FACTOR: config.analFin.FRONT_FACTOR,
        BACK_FACTOR: config.analFin.BACK_FACTOR,
        ROOT_HEIGHT_FACTOR: config.analFin.ROOT_HEIGHT_FACTOR
    };

    // Dorsal fin configuration with broader ranges (±20%)
    this.dorsalFin = {
        HEIGHT_FACTOR: {
            base: config.dorsalFin.HEIGHT_FACTOR,
            min: 0.8,
            max: 1.2
        },
        FRONT_FACTOR: config.dorsalFin.FRONT_FACTOR,
        BACK_FACTOR: config.dorsalFin.BACK_FACTOR
    };

    // Pectoral fins configuration with broader ranges (±20%)
    this.pectoralFins = {
        EXTENSION_FACTOR: {
            base: config.pectoralFins.EXTENSION_FACTOR,
            min: 0.8,
            max: 1.2
        },
        DROP_FACTOR: config.pectoralFins.DROP_FACTOR,
        ROOT_FRONT_FACTOR: config.pectoralFins.ROOT_FRONT_FACTOR,
        ROOT_BACK_FACTOR: config.pectoralFins.ROOT_BACK_FACTOR
    };

    // Pelvic fins configuration with broader ranges (±20%)
    this.pelvicFins = {
        DROP_FACTOR: {
            base: config.pelvicFins.DROP_FACTOR,
            min: 0.8,
            max: 1.2
        },
        EXTENSION_FACTOR: {
            base: config.pelvicFins.EXTENSION_FACTOR,
            min: 0.8,
            max: 1.2
        },
        ROOT_HEIGHT_FACTOR: config.pelvicFins.ROOT_HEIGHT_FACTOR,
        FRONT_FACTOR: config.pelvicFins.FRONT_FACTOR,
        BACK_FACTOR: config.pelvicFins.BACK_FACTOR
    };

    // Overall size range - could be even broader if desired
    this.sizeRange = {
        min: config.sizeRange.min * 0.8,  // 20% smaller possible
        max: config.sizeRange.max * 1.2   // 20% larger possible
    };
}

    generateRandomizedConfig() {
        return {
            colors: { ...this.colors },
            scales: {
                LENGTH_SCALE: this.randomizeValue(this.scales.LENGTH_SCALE),
                WIDTH_SCALE: this.randomizeValue(this.scales.WIDTH_SCALE),
                HEIGHT_SCALE: this.randomizeValue(this.scales.HEIGHT_SCALE)
            },
            eyes: { ...this.eyes },
            tail: {
                FIN_SHIFT_FACTOR: this.randomizeValue(this.tail.FIN_SHIFT_FACTOR),
                FIN_SCALE_FACTOR: this.randomizeValue(this.tail.FIN_SCALE_FACTOR),
                FIN_LENGTH_SCALE: this.randomizeValue(this.tail.FIN_LENGTH_SCALE)
            },
            analFin: {
                HEIGHT_FACTOR: this.randomizeValue(this.analFin.HEIGHT_FACTOR),
                FRONT_FACTOR: this.analFin.FRONT_FACTOR,
                BACK_FACTOR: this.analFin.BACK_FACTOR,
                ROOT_HEIGHT_FACTOR: this.analFin.ROOT_HEIGHT_FACTOR
            },
            dorsalFin: {
                HEIGHT_FACTOR: this.randomizeValue(this.dorsalFin.HEIGHT_FACTOR),
                FRONT_FACTOR: this.dorsalFin.FRONT_FACTOR,
                BACK_FACTOR: this.dorsalFin.BACK_FACTOR
            },
            pectoralFins: {
                EXTENSION_FACTOR: this.randomizeValue(this.pectoralFins.EXTENSION_FACTOR),
                DROP_FACTOR: this.pectoralFins.DROP_FACTOR,
                ROOT_FRONT_FACTOR: this.pectoralFins.ROOT_FRONT_FACTOR,
                ROOT_BACK_FACTOR: this.pectoralFins.ROOT_BACK_FACTOR
            },
            pelvicFins: {
                DROP_FACTOR: this.randomizeValue(this.pelvicFins.DROP_FACTOR),
                EXTENSION_FACTOR: this.randomizeValue(this.pelvicFins.EXTENSION_FACTOR),
                ROOT_HEIGHT_FACTOR: this.pelvicFins.ROOT_HEIGHT_FACTOR,
                FRONT_FACTOR: this.pelvicFins.FRONT_FACTOR,
                BACK_FACTOR: this.pelvicFins.BACK_FACTOR
            },
            sizeRange: { ...this.sizeRange }
        };
    }

    randomizeValue(config) {
        if (config.base !== undefined && config.min !== undefined && config.max !== undefined) {
            const randomFactor = config.min + Math.random() * (config.max - config.min);
            return config.base * randomFactor;
        }
        return config; // Return as-is if not a randomizable configuration
    }
}



// Base class for all fish behaviors
class FishBehavior {
    constructor(fish, bounds) {
        this.fish = fish;
        this.bounds = bounds;
    }
    
    update(deltaTime) {
        // To be implemented by specific behaviors
    }
    
    onEnter() {
        // Called when behavior becomes active
    }
    
    onExit() {
        // Called when behavior becomes inactive
    }
}

// Patrol behavior - based on original movement controller logic
class PatrolBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.currentTarget = this.generateNewTarget();
        this.moveSpeed = 5;
        this.turnSpeed = 2;
        this.minDistanceToTarget = 2;
        
        this.currentVelocity = new Vector3(0, 0, 0);
        this.currentRotation = new Quaternion();
    }

    generateNewTarget() {
        return new Vector3(
            (Math.random() - 0.5) * this.bounds.width,
            (Math.random() - 0.5) * this.bounds.depth,
            (Math.random() - 0.5) * this.bounds.length
        );
    }

    update(deltaTime) {
        const distanceToTarget = this.fish.position.distanceTo(this.currentTarget);

        if (distanceToTarget < this.minDistanceToTarget) {
            this.currentTarget = this.generateNewTarget();
        }

        const direction = this.currentTarget.subtract(this.fish.position).normalize();
        const forward = new Vector3(1, 0, 0);
        
        const rotationAxis = forward.cross(direction).normalize();
        const angle = Math.acos(forward.dot(direction));
        
        const targetRotation = Quaternion.fromAxisAngle(rotationAxis, angle);
        this.currentRotation = this.currentRotation.slerp(targetRotation, this.turnSpeed * deltaTime);
        
        this.currentVelocity = direction.scale(this.moveSpeed);
        const movement = this.currentVelocity.scale(deltaTime);
        
        this.fish.body.position.x += movement.x;
        this.fish.body.position.y += movement.y;
        this.fish.body.position.z += movement.z;
        
        this.fish.body.rotation.set(
            this.currentRotation.x,
            this.currentRotation.y,
            this.currentRotation.z,
            this.currentRotation.w
        );
    }
}

// Rest behavior - new behavior where fish stays relatively still
class RestBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.restPosition = null;
        this.smallMovementRange = 1.0; // Small movement while resting
        this.moveSpeed = 1; // Slower movement while resting
        this.currentRotation = new Quaternion();
    }

    onEnter() {
        // Remember current position as rest position
        this.restPosition = new Vector3(
            this.fish.body.position.x,
            this.fish.body.position.y,
            this.fish.body.position.z
        );
    }

    update(deltaTime) {
        // Small random movements around rest position
        const offset = new Vector3(
            (Math.random() - 0.5) * this.smallMovementRange,
            (Math.random() - 0.5) * this.smallMovementRange,
            (Math.random() - 0.5) * this.smallMovementRange
        );
        
        const targetPosition = this.restPosition.add(offset);
        const direction = targetPosition.subtract(this.fish.position).normalize();
        
        // Very gentle movement towards target
        const movement = direction.scale(this.moveSpeed * deltaTime);
        
        this.fish.body.position.x += movement.x;
        this.fish.body.position.y += movement.y;
        this.fish.body.position.z += movement.z;
    }
}

// New Interest behavior - fish looks at and follows lure from a distance
class InterestBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.moveSpeed = 3;
        this.turnSpeed = 2;
        this.minDistanceToLure = 10; // Don't get too close while interested
        this.currentRotation = new Quaternion();
    }

    update(deltaTime, lure) {
        if (!lure) return;

        const direction = lure.position.subtract(this.fish.position).normalize();
        const forward = new Vector3(1, 0, 0);
        
        // Calculate rotation to face lure
        const rotationAxis = forward.cross(direction).normalize();
        const angle = Math.acos(forward.dot(direction));
        
        const targetRotation = Quaternion.fromAxisAngle(rotationAxis, angle);
        this.currentRotation = this.currentRotation.slerp(targetRotation, this.turnSpeed * deltaTime);
        
        // Move towards lure but maintain minimum distance
        const distanceToLure = this.fish.position.distanceTo(lure.position);
        if (distanceToLure > this.minDistanceToLure) {
            const movement = direction.scale(this.moveSpeed * deltaTime);
            
            this.fish.body.position.x += movement.x;
            this.fish.body.position.y += movement.y;
            this.fish.body.position.z += movement.z;
        }
        
        this.fish.body.rotation.set(
            this.currentRotation.x,
            this.currentRotation.y,
            this.currentRotation.z,
            this.currentRotation.w
        );
    }
}

// New Attack behavior - fish rapidly moves to lure's position
class AttackBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.moveSpeed = 15;
        this.turnSpeed = 4;
        this.lure = null;
        this.currentRotation = new Quaternion();
        this.attackComplete = false;
        
        this.hookingWindowDuration = 2000;
        this.hookingWindowStart = null;
        this.hookingWindowActive = false;
        this.missed = false;
    }

    update(deltaTime) {
        if (this.missed || this.attackComplete || !this.lure) return;

        // Get the CURRENT lure position each update
        const currentTargetPosition = this.lure.position;
        const distanceToTarget = this.fish.position.distanceTo(currentTargetPosition);
        
        if (distanceToTarget < 1 && !this.hookingWindowActive) {
            console.log("Fish reached target! Starting hooking window!");
            this.hookingWindowActive = true;
            this.hookingWindowStart = performance.now();
        }

        if (this.hookingWindowActive) {
            const timeElapsed = performance.now() - this.hookingWindowStart;
            if (timeElapsed > this.hookingWindowDuration) {
                console.log("Hooking window expired!");
                this.missed = true;
                return;
            }
        }

        // Always move toward current lure position unless in hooking window
        if (!this.hookingWindowActive) {
            // Calculate direction to CURRENT lure position
            const direction = currentTargetPosition.subtract(this.fish.position).normalize();
            const forward = new Vector3(1, 0, 0);
            
            const rotationAxis = forward.cross(direction).normalize();
            const angle = Math.acos(forward.dot(direction));
            
            const targetRotation = Quaternion.fromAxisAngle(rotationAxis, angle);
            this.currentRotation = this.currentRotation.slerp(targetRotation, this.turnSpeed * deltaTime);
            
            const movement = direction.scale(this.moveSpeed * deltaTime);
            
            this.fish.body.position.x += movement.x;
            this.fish.body.position.y += movement.y;
            this.fish.body.position.z += movement.z;
            
            this.fish.body.rotation.set(
                this.currentRotation.x,
                this.currentRotation.y,
                this.currentRotation.z,
                this.currentRotation.w
            );
        }
    }

    onEnter(lure) {
        console.log("Fish entering ATTACK mode!");
        this.lure = lure;  // Store lure reference
    }

   

    getHookingWindowProgress() {
        if (!this.hookingWindowActive) return 0;
        
        const timeElapsed = performance.now() - this.hookingWindowStart;
        return Math.min(1, timeElapsed / this.hookingWindowDuration);
    }

}
class HookedBehavior extends FishBehavior {
    constructor(fish, bounds) {
        super(fish, bounds);
        this.lure = null;
        
        // Add some slight offset so the fish isn't exactly on the lure
        this.offset = {
            x: (Math.random() - 0.5) * 2,
            y: (Math.random() - 0.5) * 2,
            z: (Math.random() - 0.5) * 2
        };
    }

    setLure(lure) {
        this.lure = lure;
    }

    update(deltaTime) {
        if (!this.lure) return;
        
        // Only update the fish position to follow the lure
        // Don't modify the lure's position at all
        const targetX = this.lure.body.position.x + this.offset.x;
        const targetY = this.lure.body.position.y + this.offset.y;
        const targetZ = this.lure.body.position.z + this.offset.z;

        // Smoothly move fish to target position
        const lerpFactor = 10 * deltaTime; // Adjust this value to control follow speed
        
        this.fish.body.position.x += (targetX - this.fish.body.position.x) * lerpFactor;
        this.fish.body.position.y += (targetY - this.fish.body.position.y) * lerpFactor;
        this.fish.body.position.z += (targetZ - this.fish.body.position.z) * lerpFactor;

        // Copy lure's rotation for the fish
        this.fish.body.rotation.x = this.lure.body.rotation.x;
        this.fish.body.rotation.y = this.lure.body.rotation.y;
        this.fish.body.rotation.z = this.lure.body.rotation.z;
        this.fish.body.rotation.w = this.lure.body.rotation.w;
    }
}

// Main AI controller class (renamed from FishMovementController)
class FishAI {
    // Add static property to track if any fish is attacking
    static currentlyAttackingFish = null;

    constructor(fish, bounds) {
        this.fish = fish;
        this.bounds = bounds;
        
        // Initialize behaviors
        this.behaviors = {
            patrol: new PatrolBehavior(fish, bounds),
            rest: new RestBehavior(fish, bounds),
            interest: new InterestBehavior(fish, bounds),
            attack: new AttackBehavior(fish, bounds),
            hooked: new HookedBehavior(fish, bounds)
        };
        this.canBeHooked = false;
        this.currentBehavior = this.behaviors.patrol;
        this.timeSinceLastBehaviorChange = 0;
        this.minTimeBetweenBehaviorChanges = 10;
        this.attackProbability = 0.2;
        this.hasLostInterest = false; // Add flag to track if fish has lost interest
    }

   update(deltaTime, lure) {
       const activeLure = lure?.state === 'inWater' ? lure : null;
        
        if (this.isHooked) {
            this.currentBehavior.update(deltaTime);
            return;
        }

        // Update hooking window status
        if (this.currentBehavior === this.behaviors.attack) {
            this.canBeHooked = this.currentBehavior.hookingWindowActive && 
                              !this.currentBehavior.missed;
        } else {
            this.canBeHooked = false;
        }

        // Handle missed hook attempt
        if (this.currentBehavior === this.behaviors.attack && 
            this.currentBehavior.missed) {
            console.log("Fish missed - returning to patrol");
            this.hasLostInterest = true;
            this.changeBehavior('patrol');
            return;
        }
       if (lure) {
            // If another fish is attacking and this isn't the attacking fish
            if (FishAI.currentlyAttackingFish && FishAI.currentlyAttackingFish !== this.fish) {
                if (this.currentBehavior === this.behaviors.interest || 
                    this.currentBehavior === this.behaviors.attack) {
                    console.log("Another fish is attacking - this fish losing interest");
                    this.changeBehavior('patrol');
                }
                this.hasLostInterest = true;
                this.currentBehavior.update(deltaTime);
                return;
            }

        // Only proceed with lure interest logic if fish hasn't lost interest
        if (!this.hasLostInterest) {
            const distanceToLure = this.fish.position.distanceTo(lure.position);
            
            // Calculate interest probability based on distance
            const baseInterestRadius = 500;
            const interestFalloff = Math.max(0, 1 - (distanceToLure / baseInterestRadius));
            
            // Add some randomness to make interest more natural
            const randomFactor = Math.random() * 0.3; // 30% random variation
            
            // Fish is interested if it's within range and passes probability check
            if (distanceToLure < baseInterestRadius && interestFalloff > randomFactor) {
                    if (this.currentBehavior !== this.behaviors.interest && 
                        this.currentBehavior !== this.behaviors.attack) {
                        console.log("Fish becoming interested in lure");
                        this.changeBehavior('interest');
                    }
                
                // Attack probability now scales with how close the fish is
                const attackChance = this.attackProbability * interestFalloff * deltaTime;
                 if (Math.random() < attackChance && 
                        this.currentBehavior !== this.behaviors.attack) {
                        console.log("Fish deciding to attack!");
                        FishAI.currentlyAttackingFish = this.fish;
                        this.changeBehavior('attack', lure);
                    }
            }
        }
            
            // Check if attack is complete
            if (this.currentBehavior === this.behaviors.attack && this.behaviors.attack.attackComplete) {
                this.changeBehavior('patrol');
                // Don't reset currentlyAttackingFish here as we want other fish to stay uninterested
            }
        }

        // Update current behavior
        if (this.currentBehavior === this.behaviors.interest) {
            this.currentBehavior.update(deltaTime, lure);
        } else {
            this.currentBehavior.update(deltaTime);
        }
    }

    changeBehavior(newBehaviorName, lure = null) {
        this.currentBehavior.onExit();
        this.currentBehavior = this.behaviors[newBehaviorName];
        if (lure && newBehaviorName === 'attack') {
            this.currentBehavior.onEnter(lure);
        } else {
            this.currentBehavior.onEnter();
        }
        
        this.timeSinceLastBehaviorChange = 0;
    }
     tryHook(lure) {
        if (!this.canBeHooked) return false;

        // Set up hooked behavior
        this.behaviors.hooked.setLure(lure);
        this.changeBehavior('hooked');
        
        // Set the fish as the lure's hooked fish
        lure.hookedFish = this.fish;
        
        // Clear the attacking fish reference since hook was successful
        FishAI.currentlyAttackingFish = null;
        
        // Flag this fish as permanently hooked
        this.isHooked = true;
        return true;
    }
    // Add method to reset interest (can be called when starting a new game or releasing a fish)
    static resetAllFishInterest() {
        FishAI.currentlyAttackingFish = null;
    }
}
