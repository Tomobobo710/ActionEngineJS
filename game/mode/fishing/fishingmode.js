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

const FISH_TYPES = {
    BASS: new FishProfile({
        name: "Bass",
        classification: "predator",
        colors: {
            NOSE_COLOR: "#ff0066",
            SIDE_COLOR: "#8b0000",
            TOPBOTTOM_COLOR: "#4a0000",
            ANAL_FIN_COLOR: "#ff4d94",
            TAIL_SIDE_COLOR: "#ff1a1a",
            TAIL_CONNECT_COLOR: "#cc0000",
            TAIL_FIN_COLOR: "#ff6666",
            DORSAL_FIN_COLOR: "#ff3333",
            PECTORAL_FIN_COLOR: "#ff9999",
            PELVIC_FIN_COLOR: "#ff4d4d",
            EYE_BASE_COLOR: "#ffcccc",
            EYE_DETAIL_COLOR: "#660000"
        },
        scales: {
            LENGTH_SCALE: 5.5,
            WIDTH_SCALE: 0.9,
            HEIGHT_SCALE: 0.6
        },
        eyes: {
            HEIGHT_FACTOR: 0.15,
            INWARD_FACTOR: 0.23,
            FORWARD_FACTOR: 0.34,
            SIZE_FACTOR: 0.2
        },
        tail: {
            FIN_SHIFT_FACTOR: -0.1,
            FIN_SCALE_FACTOR: 2.2,
            FIN_LENGTH_SCALE: 0.2
        },
        analFin: {
            HEIGHT_FACTOR: 1.5,
            FRONT_FACTOR: -0.225,
            BACK_FACTOR: -0.375,
            ROOT_HEIGHT_FACTOR: 1.0
        },
        dorsalFin: {
            HEIGHT_FACTOR: 2.2,
            FRONT_FACTOR: 0.25,
            BACK_FACTOR: -0.25
        },
        pectoralFins: {
            EXTENSION_FACTOR: 1.5,
            DROP_FACTOR: 0.5,
            ROOT_FRONT_FACTOR: 0.25,
            ROOT_BACK_FACTOR: 0
        },
        pelvicFins: {
            DROP_FACTOR: 1.5,
            EXTENSION_FACTOR: 1.0,
            ROOT_HEIGHT_FACTOR: 0.8,
            FRONT_FACTOR: 0,
            BACK_FACTOR: -0.25
        },
        sizeRange: {
            min: 1.5,
            max: 2.5
        }
    }),

    TROUT: new FishProfile({
        name: "Trout",
        classification: "game_fish",
        colors: {
            NOSE_COLOR: "#00ffaa",
            SIDE_COLOR: "#006622",
            TOPBOTTOM_COLOR: "#004d1a",
            ANAL_FIN_COLOR: "#00ff88",
            TAIL_SIDE_COLOR: "#00cc44",
            TAIL_CONNECT_COLOR: "#008833",
            TAIL_FIN_COLOR: "#66ffb3",
            DORSAL_FIN_COLOR: "#00e64d",
            PECTORAL_FIN_COLOR: "#33ff77",
            PELVIC_FIN_COLOR: "#00cc55",
            EYE_BASE_COLOR: "#e6fff2",
            EYE_DETAIL_COLOR: "#004d00"
        },
        scales: {
            LENGTH_SCALE: 5.5,
            WIDTH_SCALE: 0.7,
            HEIGHT_SCALE: 0.45
        },
        eyes: {
            HEIGHT_FACTOR: 0.15,
            INWARD_FACTOR: 0.23,
            FORWARD_FACTOR: 0.34,
            SIZE_FACTOR: 0.2
        },
        tail: {
            FIN_SHIFT_FACTOR: -0.08,
            FIN_SCALE_FACTOR: 1.8,
            FIN_LENGTH_SCALE: 0.2
        },
        analFin: {
            HEIGHT_FACTOR: 1.3,
            FRONT_FACTOR: -0.225,
            BACK_FACTOR: -0.375,
            ROOT_HEIGHT_FACTOR: 0.9
        },
        dorsalFin: {
            HEIGHT_FACTOR: 1.8,
            FRONT_FACTOR: 0.2,
            BACK_FACTOR: -0.3
        },
        pectoralFins: {
            EXTENSION_FACTOR: 1.3,
            DROP_FACTOR: 0.4,
            ROOT_FRONT_FACTOR: 0.25,
            ROOT_BACK_FACTOR: 0
        },
        pelvicFins: {
            DROP_FACTOR: 1.3,
            EXTENSION_FACTOR: 0.9,
            ROOT_HEIGHT_FACTOR: 0.8,
            FRONT_FACTOR: 0,
            BACK_FACTOR: -0.25
        },
        sizeRange: {
            min: 1.0,
            max: 2.0
        }
    }),

    SWORDFISH: new FishProfile({
        name: "Swordfish",
        classification: "pelagic_predator",
        colors: {
            NOSE_COLOR: "#1a1aff",
            SIDE_COLOR: "#000099",
            TOPBOTTOM_COLOR: "#00004d",
            ANAL_FIN_COLOR: "#4d4dff",
            TAIL_SIDE_COLOR: "#0000ff",
            TAIL_CONNECT_COLOR: "#0000cc",
            TAIL_FIN_COLOR: "#8080ff",
            DORSAL_FIN_COLOR: "#3333ff",
            PECTORAL_FIN_COLOR: "#6666ff",
            PELVIC_FIN_COLOR: "#3333cc",
            EYE_BASE_COLOR: "#ccd9ff",
            EYE_DETAIL_COLOR: "#000066"
        },
        scales: {
            LENGTH_SCALE: 7,
            WIDTH_SCALE: 0.5,
            HEIGHT_SCALE: 0.4
        },
        eyes: {
            HEIGHT_FACTOR: 0.15,
            INWARD_FACTOR: 0.23,
            FORWARD_FACTOR: 0.34,
            SIZE_FACTOR: 0.2
        },
        tail: {
            FIN_SHIFT_FACTOR: -0.05,
            FIN_SCALE_FACTOR: 2.5,
            FIN_LENGTH_SCALE: 0.2
        },
        analFin: {
            HEIGHT_FACTOR: 1.2,
            FRONT_FACTOR: -0.225,
            BACK_FACTOR: -0.375,
            ROOT_HEIGHT_FACTOR: 0.8
        },
        dorsalFin: {
            HEIGHT_FACTOR: 2.5,
            FRONT_FACTOR: 0.15,
            BACK_FACTOR: -0.4
        },
        pectoralFins: {
            EXTENSION_FACTOR: 1.2,
            DROP_FACTOR: 0.3,
            ROOT_FRONT_FACTOR: 0.25,
            ROOT_BACK_FACTOR: 0
        },
        pelvicFins: {
            DROP_FACTOR: 1.2,
            EXTENSION_FACTOR: 0.8,
            ROOT_HEIGHT_FACTOR: 0.7,
            FRONT_FACTOR: 0,
            BACK_FACTOR: -0.25
        },
        sizeRange: {
            min: 3.0,
            max: 4.5
        }
    })
};

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

class Fisher {
    constructor(game, position = new Vector3(0, 10, -50)) { // Default position on shore/boat
        this.game = game;
        this.position = position;
        this.lure = null;
        this.state = 'ready'; // ready, casting, reeling
        this.castDirection = new Vector3(1, -0.5, 0).normalize();
        this.aimAngle = 0; // Horizontal aim angle
        this.aimElevation = -0.5; // Vertical aim angle
        // Casting parameters
        this.castPower = 0;
        this.maxCastPower = 10;
        this.castPowerRate = 5; // Power increase per second
        this.isChargingCast = false;
        // Create the visual model
        this.model = new FishermanModel(game.physicsWorld, 10, position);
    }

    attachLure(lure) {
        this.lure = lure;
        this.lure.setFisher(this);
        this.lure.state = 'inactive';
    }

    update(deltaTime, input) {
        // In Fisher class, update method:
if (this.state === 'ready') {
    // Adjust aim left/right with corrected angles
    if (input.isKeyPressed('DirLeft')) {
        this.aimAngle += 1.5 * deltaTime;
    }
    if (input.isKeyPressed('DirRight')) {
        this.aimAngle -= 1.5 * deltaTime;
    }
    
    // Adjust aim up/down with corrected elevation
    if (input.isKeyPressed('DirUp')) {
        this.aimElevation = Math.min(this.aimElevation + deltaTime, -0.1);
    }
    if (input.isKeyPressed('DirDown')) {
        this.aimElevation = Math.max(this.aimElevation - deltaTime, -0.8);
    }

    // Update cast direction based on corrected aim
    this.castDirection = new Vector3(
        Math.sin(this.aimAngle),
        Math.sin(this.aimElevation),
        Math.cos(this.aimAngle)
    ).normalize();
}
        switch(this.state) {
            case 'ready':
                // Handle cast charging
                if (input.isKeyPressed('Action2')) {
                    this.isChargingCast = true;
                    this.castPower = Math.min(this.maxCastPower, 
                        this.castPower + this.castPowerRate * deltaTime);
                } else if (this.isChargingCast) {
                    this.isChargingCast = false;
                    this.cast();
                }
                break;

            case 'casting':
                // Update lure trajectory
                if (this.lure.state === 'inWater') {
                    this.state = 'fishing';
                }
                break;

            case 'fishing':
                this.handleLureMovement(input, deltaTime);
                
                if (input.isKeyPressed('Action1')) {
                    this.state = 'reeling';
                }
                break;

            case 'reeling':
                this.handleReeling(deltaTime);
                break;
        }
    }

    handleLureMovement(input, deltaTime) {
        const moveSpeed = 30 * deltaTime;
        
        if (input.isKeyPressed('DirUp')) {
            this.lure.move('forward', moveSpeed);
        }
        if (input.isKeyPressed('DirDown')) {
            this.lure.move('backward', moveSpeed);
        }
        if (input.isKeyPressed('DirRight')) {
            this.lure.move('left', moveSpeed);
        }
        if (input.isKeyPressed('DirLeft')) {
            this.lure.move('right', moveSpeed);
        }
    }

    handleReeling(deltaTime) {
        const distanceToFisher = this.lure.position.distanceTo(this.position);
        
        if (distanceToFisher < 1) {
            this.state = 'ready';
            this.castPower = 0;
            this.lure.reset();
            this.game.fishingArea.setLure(this.lure); // Update fishing area
        } else {
            const direction = this.position.subtract(this.lure.position).normalize();
            this.lure.position = this.lure.position.add(direction.scale(50 * deltaTime));
        }
    }

    cast() {
        if (this.state !== 'ready' || !this.lure) return;
        
        const castVelocity = this.castDirection.scale(this.castPower);
        this.lure.visible = true;
        this.lure.startCast(this.position, castVelocity, this.castDirection);
        // Log the initial cast for debugging
        console.log('Cast starting at:', this.position);
        console.log('Cast velocity:', castVelocity);
        
        this.state = 'casting';
        this.castPower = 0;
    }
    

    getCastPowerPercentage() {
        return (this.castPower / this.maxCastPower) * 100;
    }
}

class FishermanModel extends ActionPhysicsObject3D {
    constructor(physicsWorld, height = 10, position = new Vector3(0, 0, 0)) {
        const triangles = [];
        const colors = {
            BODY_COLOR: "#3f2a14",      // Brown for clothing
            HEAD_COLOR: "#ffd6b1",      // Skin tone
            HAT_COLOR: "#ec00ff",       // Blue hat
            ARM_COLOR: "#ff4e00",       // Darker brown for arms
            LEG_COLOR: "#1a1a1a"        // Dark gray for legs
        };

        // Scale factors
        const bodyWidth = height * 0.4;
        const bodyDepth = height * 0.3;
        const headSize = height * 0.2;
        const armLength = height * 0.6;
        const armWidth = height * 0.1;
        const legLength = height * 0.5;
        const legWidth = height * 0.15;

        const v = {
        // Body vertices
            bodyTopFront: new Vector3(bodyWidth/2, height*0.8, bodyDepth/2),
            bodyTopBack: new Vector3(bodyWidth/2, height*0.8, -bodyDepth/2),
            bodyBottomFront: new Vector3(bodyWidth/2, height*0.3, bodyDepth/2),
            bodyBottomBack: new Vector3(bodyWidth/2, height*0.3, -bodyDepth/2),
            bodyTopFrontMirror: new Vector3(-bodyWidth/2, height*0.8, bodyDepth/2),
            bodyTopBackMirror: new Vector3(-bodyWidth/2, height*0.8, -bodyDepth/2),
            bodyBottomFrontMirror: new Vector3(-bodyWidth/2, height*0.3, bodyDepth/2),
            bodyBottomBackMirror: new Vector3(-bodyWidth/2, height*0.3, -bodyDepth/2),
        // Hat vertices
            hatFrontLeft: new Vector3(-headSize*0.6, height + headSize*0.6, headSize*0.6),
            hatFrontRight: new Vector3(headSize*0.6, height + headSize*0.6, headSize*0.6),
            hatBackLeft: new Vector3(-headSize*0.6, height + headSize*0.6, -headSize*0.6),
            hatBackRight: new Vector3(headSize*0.6, height + headSize*0.6, -headSize*0.6),
            hatTop: new Vector3(0, height + headSize*2, 0),
        // Replace the head vertices with more points to create a smoother sphere-like shape
        // Front vertices
            frontTopMid: new Vector3(0, height + headSize/2, headSize/2),
            frontBottomMid: new Vector3(0, height - headSize/2, headSize/2),
            frontRight: new Vector3(headSize/2, height, headSize/2),
            frontLeft: new Vector3(-headSize/2, height, headSize/2),
        // Back vertices
            backTopMid: new Vector3(0, height + headSize/2, -headSize/2),
            backBottomMid: new Vector3(0, height - headSize/2, -headSize/2),
            backRight: new Vector3(headSize/2, height, -headSize/2),
            backLeft: new Vector3(-headSize/2, height, -headSize/2),
        // Top vertices
            topFront: new Vector3(0, height + headSize/2, headSize/3),
            topBack: new Vector3(0, height + headSize/2, -headSize/3),
            topRight: new Vector3(headSize/3, height + headSize/2, 0),
            topLeft: new Vector3(-headSize/3, height + headSize/2, 0),
        // Bottom vertices
            bottomFront: new Vector3(0, height - headSize/2, headSize/3),
            bottomBack: new Vector3(0, height - headSize/2, -headSize/3),
            bottomRight: new Vector3(headSize/3, height - headSize/2, 0),
            bottomLeft: new Vector3(-headSize/3, height - headSize/2, 0),
        // Arms vertices
        // Right arm vertices
            rightShoulderTop: new Vector3(bodyWidth/2, height*0.75, bodyDepth/4),
            rightShoulderBack: new Vector3(bodyWidth/2, height*0.75, -bodyDepth/4),
            rightShoulderTopMirror: new Vector3(bodyWidth/2 + bodyWidth/8, height*0.75, bodyDepth/4),
            rightShoulderBackMirror: new Vector3(bodyWidth/2 + bodyWidth/8, height*0.75, -bodyDepth/4),
            rightHandFront: new Vector3(bodyWidth/2 + bodyWidth/4, height*0.4, bodyDepth/4),
            rightHandBack: new Vector3(bodyWidth/2 + bodyWidth/4, height*0.4, -bodyDepth/4),
            rightHandFrontMirror: new Vector3(bodyWidth/2 + bodyWidth/4 + bodyWidth/8, height*0.4, bodyDepth/4),
            rightHandBackMirror: new Vector3(bodyWidth/2 + bodyWidth/4 + bodyWidth/8, height*0.4, -bodyDepth/4),
        // Left arm vertices            
            leftShoulderTop: new Vector3(-bodyWidth/2, height*0.75, bodyDepth/4),
            leftShoulderBack: new Vector3(-bodyWidth/2, height*0.75, -bodyDepth/4),
            leftShoulderTopMirror: new Vector3(-bodyWidth/2 - bodyWidth/8, height*0.75, bodyDepth/4),
            leftShoulderBackMirror: new Vector3(-bodyWidth/2 - bodyWidth/8, height*0.75, -bodyDepth/4),
            leftHandFront: new Vector3(-bodyWidth/2 - bodyWidth/4, height*0.4, bodyDepth/4),
            leftHandBack: new Vector3(-bodyWidth/2 - bodyWidth/4, height*0.4, -bodyDepth/4),
            leftHandFrontMirror: new Vector3(-bodyWidth/2 - bodyWidth/4 - bodyWidth/8, height*0.4, bodyDepth/4),
            leftHandBackMirror: new Vector3(-bodyWidth/2 - bodyWidth/4 - bodyWidth/8, height*0.4, -bodyDepth/4),
        // Legs
        // Right leg vertices
            rightHipTop: new Vector3(bodyWidth/4, height*0.3, bodyDepth/4),
            rightHipBack: new Vector3(bodyWidth/4, height*0.3, -bodyDepth/4),
            rightHipTopMirror: new Vector3(bodyWidth/8, height*0.3, bodyDepth/4),
            rightHipBackMirror: new Vector3(bodyWidth/8, height*0.3, -bodyDepth/4),
            rightFootFront: new Vector3(bodyWidth/4, 0, bodyDepth/4),
            rightFootBack: new Vector3(bodyWidth/4, 0, -bodyDepth/4),
            rightFootFrontMirror: new Vector3(bodyWidth/8, 0, bodyDepth/4),
            rightFootBackMirror: new Vector3(bodyWidth/8, 0, -bodyDepth/4),
        // Left leg vertices            
            leftHipTop: new Vector3(-bodyWidth/4, height*0.3, bodyDepth/4),
            leftHipBack: new Vector3(-bodyWidth/4, height*0.3, -bodyDepth/4),
            leftHipTopMirror: new Vector3(-bodyWidth/8, height*0.3, bodyDepth/4),
            leftHipBackMirror: new Vector3(-bodyWidth/8, height*0.3, -bodyDepth/4),
            leftFootFront: new Vector3(-bodyWidth/4, 0, bodyDepth/4),
            leftFootBack: new Vector3(-bodyWidth/4, 0, -bodyDepth/4),
            leftFootFrontMirror: new Vector3(-bodyWidth/8, 0, bodyDepth/4),
            leftFootBackMirror: new Vector3(-bodyWidth/8, 0, -bodyDepth/4)
        };

        // Add body triangles
            // Front
            triangles.push(new Triangle(v.bodyTopFront, v.bodyTopFrontMirror, v.bodyBottomFront, colors.BODY_COLOR));
            triangles.push(new Triangle(v.bodyBottomFront, v.bodyTopFrontMirror, v.bodyBottomFrontMirror, colors.BODY_COLOR));
            // Back
triangles.push(new Triangle(v.bodyTopBack, v.bodyBottomBack, v.bodyTopBackMirror, '#00FF00'));
triangles.push(new Triangle(v.bodyBottomBack, v.bodyBottomBackMirror, v.bodyTopBackMirror, '#00FF00'));
            // Right Side
            triangles.push(new Triangle(v.bodyTopFront, v.bodyBottomBack, v.bodyTopBack, colors.BODY_COLOR));
            triangles.push(new Triangle(v.bodyTopFront, v.bodyBottomFront, v.bodyBottomBack, colors.BODY_COLOR));
            // Left Side
            triangles.push(new Triangle(v.bodyTopFrontMirror, v.bodyTopBackMirror, v.bodyBottomBackMirror, colors.BODY_COLOR));
            triangles.push(new Triangle(v.bodyTopFrontMirror, v.bodyBottomBackMirror, v.bodyBottomFrontMirror, colors.BODY_COLOR));
            // Top
            triangles.push(new Triangle(v.bodyTopFront, v.bodyTopBack, v.bodyTopFrontMirror, colors.BODY_COLOR));
            triangles.push(new Triangle(v.bodyTopFrontMirror, v.bodyTopBack, v.bodyTopBackMirror, colors.BODY_COLOR));
            // Bottom
            triangles.push(new Triangle(v.bodyBottomFront, v.bodyBottomFrontMirror, v.bodyBottomBack, colors.BODY_COLOR));
            triangles.push(new Triangle(v.bodyBottomFrontMirror, v.bodyBottomBackMirror, v.bodyBottomBack, colors.BODY_COLOR));
        // Hat triangles
           // Front
            triangles.push(new Triangle(v.hatTop, v.hatFrontLeft, v.hatFrontRight, colors.HAT_COLOR));
            // Back
            triangles.push(new Triangle(v.hatTop, v.hatBackRight, v.hatBackLeft, colors.HAT_COLOR));
            // Left
            triangles.push(new Triangle(v.hatTop, v.hatBackLeft, v.hatFrontLeft, colors.HAT_COLOR));
            // Right
            triangles.push(new Triangle(v.hatTop, v.hatFrontRight, v.hatBackRight, colors.HAT_COLOR));
            // Bottom (front)
            triangles.push(new Triangle(v.hatFrontLeft, v.hatBackRight, v.hatFrontRight, colors.HAT_COLOR));
            // Bottom (back)
            triangles.push(new Triangle(v.hatFrontLeft, v.hatBackLeft, v.hatBackRight, colors.HAT_COLOR));
        //head
            // Front face (viewed from front, CCW winding)
            triangles.push(new Triangle(v.frontTopMid, v.frontLeft, v.frontRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontBottomMid, v.frontRight, v.frontLeft, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontTopMid, v.topRight, v.frontRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontTopMid, v.frontLeft, v.topLeft, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontBottomMid, v.frontRight, v.bottomRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontBottomMid, v.bottomLeft, v.frontLeft, colors.HEAD_COLOR));
            // Back face (viewed from back, CCW winding)
            triangles.push(new Triangle(v.backTopMid, v.backRight, v.backLeft, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.backBottomMid, v.backLeft, v.backRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.backTopMid, v.topRight, v.backRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.backTopMid, v.backLeft, v.topLeft, colors.HEAD_COLOR)); 
            triangles.push(new Triangle(v.backBottomMid, v.bottomRight, v.backRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.backBottomMid, v.backLeft, v.bottomLeft, colors.HEAD_COLOR));
            // Right side (viewed from right, CCW winding)
            triangles.push(new Triangle(v.frontRight, v.bottomRight, v.backRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontRight, v.backRight, v.topRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.backBottomMid, v.backRight, v.bottomRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.backTopMid, v.topRight, v.backRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontBottomMid, v.bottomRight, v.frontRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontTopMid, v.frontRight, v.topRight, colors.HEAD_COLOR));
            // Left side (viewed from left, CCW winding)
            triangles.push(new Triangle(v.frontLeft, v.backLeft, v.bottomLeft, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontLeft, v.topLeft, v.backLeft, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.backBottomMid, v.bottomLeft, v.backLeft, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.backTopMid, v.backLeft, v.topLeft, colors.HEAD_COLOR)); 
            triangles.push(new Triangle(v.frontBottomMid, v.frontLeft, v.bottomLeft, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.frontTopMid, v.topLeft, v.frontLeft, colors.HEAD_COLOR));
            // Top (viewed from above, CCW winding)
            triangles.push(new Triangle(v.topFront, v.topRight, v.topLeft, colors.HEAD_COLOR));//center
            triangles.push(new Triangle(v.topBack, v.topLeft, v.topRight, colors.HEAD_COLOR));//center
            triangles.push(new Triangle(v.topFront, v.frontTopMid, v.topRight, colors.HEAD_COLOR));//center front
            triangles.push(new Triangle(v.topFront, v.topLeft, v.frontTopMid, colors.HEAD_COLOR));//center front
            triangles.push(new Triangle(v.topBack, v.topRight, v.backTopMid, colors.HEAD_COLOR));//center back
            triangles.push(new Triangle(v.topBack, v.backTopMid, v.topLeft, colors.HEAD_COLOR));//centerback
            // Bottom (viewed from below, CCW winding)
            triangles.push(new Triangle(v.bottomFront, v.bottomLeft, v.bottomRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.bottomBack, v.bottomRight, v.bottomLeft, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.bottomFront, v.bottomLeft, v.frontBottomMid, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.bottomFront, v.frontBottomMid, v.bottomRight, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.bottomBack, v.bottomLeft, v.backBottomMid, colors.HEAD_COLOR));
            triangles.push(new Triangle(v.bottomBack, v.backBottomMid, v.bottomRight, colors.HEAD_COLOR));
        // Right arm
            // Front
            triangles.push(new Triangle(v.rightShoulderTop, v.rightHandFront, v.rightShoulderTopMirror, colors.ARM_COLOR));
            triangles.push(new Triangle(v.rightHandFront, v.rightHandFrontMirror, v.rightShoulderTopMirror, colors.ARM_COLOR));
            // Back
            triangles.push(new Triangle(v.rightShoulderBack, v.rightShoulderBackMirror, v.rightHandBack, colors.ARM_COLOR));
            triangles.push(new Triangle(v.rightHandBack, v.rightShoulderBackMirror, v.rightHandBackMirror, colors.ARM_COLOR));
            // Right side (outer)
            triangles.push(new Triangle(v.rightShoulderTop, v.rightShoulderBack, v.rightHandBack, colors.ARM_COLOR));
            triangles.push(new Triangle(v.rightShoulderTop, v.rightHandBack, v.rightHandFront, colors.ARM_COLOR));
            // Left side (inner)
            triangles.push(new Triangle(v.rightShoulderTopMirror, v.rightHandBackMirror, v.rightShoulderBackMirror, colors.ARM_COLOR));
            triangles.push(new Triangle(v.rightShoulderTopMirror, v.rightHandFrontMirror, v.rightHandBackMirror, colors.ARM_COLOR));
            // Top
            triangles.push(new Triangle(v.rightShoulderTop, v.rightShoulderTopMirror, v.rightShoulderBack, colors.ARM_COLOR));
            triangles.push(new Triangle(v.rightShoulderTopMirror, v.rightShoulderBackMirror, v.rightShoulderBack, colors.ARM_COLOR));
            // Bottom
            triangles.push(new Triangle(v.rightHandFront, v.rightHandBack, v.rightHandFrontMirror, colors.ARM_COLOR));
            triangles.push(new Triangle(v.rightHandFrontMirror, v.rightHandBack, v.rightHandBackMirror, colors.ARM_COLOR));
        // Left arm
            // Front
            triangles.push(new Triangle(v.leftShoulderTop, v.leftShoulderTopMirror, v.leftHandFront, colors.ARM_COLOR));
            triangles.push(new Triangle(v.leftHandFront, v.leftShoulderTopMirror, v.leftHandFrontMirror, colors.ARM_COLOR));
            // Back
            triangles.push(new Triangle(v.leftShoulderBack, v.leftHandBack, v.leftShoulderBackMirror, colors.ARM_COLOR));
            triangles.push(new Triangle(v.leftHandBack, v.leftHandBackMirror, v.leftShoulderBackMirror, colors.ARM_COLOR));
            // Left side (outer)
            triangles.push(new Triangle(v.leftShoulderTop, v.leftHandBack, v.leftShoulderBack, colors.ARM_COLOR));
            triangles.push(new Triangle(v.leftShoulderTop, v.leftHandFront, v.leftHandBack, colors.ARM_COLOR));
            // Right side (inner)
            triangles.push(new Triangle(v.leftShoulderTopMirror, v.leftShoulderBackMirror, v.leftHandBackMirror, colors.ARM_COLOR));
            triangles.push(new Triangle(v.leftShoulderTopMirror, v.leftHandBackMirror, v.leftHandFrontMirror, colors.ARM_COLOR));
            // Top
            triangles.push(new Triangle(v.leftShoulderTop, v.leftShoulderBack, v.leftShoulderTopMirror, colors.ARM_COLOR));
            triangles.push(new Triangle(v.leftShoulderTopMirror, v.leftShoulderBack, v.leftShoulderBackMirror, colors.ARM_COLOR));
            // Bottom
            triangles.push(new Triangle(v.leftHandFront, v.leftHandFrontMirror, v.leftHandBack, colors.ARM_COLOR));
            triangles.push(new Triangle(v.leftHandFrontMirror, v.leftHandBackMirror, v.leftHandBack, colors.ARM_COLOR));
        //Right leg
            // Front
            triangles.push(new Triangle(v.rightHipTop, v.rightHipTopMirror, v.rightFootFront, colors.LEG_COLOR));
            triangles.push(new Triangle(v.rightFootFront, v.rightHipTopMirror, v.rightFootFrontMirror, colors.LEG_COLOR));
            // Back
            triangles.push(new Triangle(v.rightHipBack, v.rightFootBack, v.rightHipBackMirror, colors.LEG_COLOR));
            triangles.push(new Triangle(v.rightFootBack, v.rightFootBackMirror, v.rightHipBackMirror, colors.LEG_COLOR));
            // Right side (outter)
            triangles.push(new Triangle(v.rightHipTop, v.rightFootBack, v.rightHipBack, colors.LEG_COLOR));
            triangles.push(new Triangle(v.rightHipTop, v.rightFootFront, v.rightFootBack, colors.LEG_COLOR));
            // Left side (inner)
            triangles.push(new Triangle(v.rightHipTopMirror, v.rightHipBackMirror, v.rightFootBackMirror, colors.LEG_COLOR));
            triangles.push(new Triangle(v.rightHipTopMirror, v.rightFootBackMirror, v.rightFootFrontMirror, colors.LEG_COLOR));
            // Top
            triangles.push(new Triangle(v.rightHipTop, v.rightHipBack, v.rightHipTopMirror, colors.LEG_COLOR));
            triangles.push(new Triangle(v.rightHipTopMirror, v.rightHipBack, v.rightHipBackMirror, colors.LEG_COLOR));
            // Bottom
            triangles.push(new Triangle(v.rightFootFront, v.rightFootFrontMirror, v.rightFootBack, colors.LEG_COLOR));
            triangles.push(new Triangle(v.rightFootFrontMirror, v.rightFootBackMirror, v.rightFootBack, colors.LEG_COLOR));
        // Left leg
            // Front
            triangles.push(new Triangle(v.leftHipTop, v.leftFootFront, v.leftHipTopMirror, colors.LEG_COLOR));
            triangles.push(new Triangle(v.leftFootFront, v.leftFootFrontMirror, v.leftHipTopMirror, colors.LEG_COLOR));
            // Back
            triangles.push(new Triangle(v.leftHipBack, v.leftHipBackMirror, v.leftFootBack, colors.LEG_COLOR));
            triangles.push(new Triangle(v.leftFootBack, v.leftHipBackMirror, v.leftFootBackMirror, colors.LEG_COLOR));
            // Left side (outer)
            triangles.push(new Triangle(v.leftHipTop, v.leftHipBack, v.leftFootBack, colors.LEG_COLOR));
            triangles.push(new Triangle(v.leftHipTop, v.leftFootBack, v.leftFootFront, colors.LEG_COLOR));
            // Right side (inner)
            triangles.push(new Triangle(v.leftHipTopMirror, v.leftFootBackMirror, v.leftHipBackMirror, colors.LEG_COLOR));
            triangles.push(new Triangle(v.leftHipTopMirror, v.leftFootFrontMirror, v.leftFootBackMirror, colors.LEG_COLOR));
            // Top
            triangles.push(new Triangle(v.leftHipTop, v.leftHipTopMirror, v.leftHipBack, colors.LEG_COLOR));
            triangles.push(new Triangle(v.leftHipTopMirror, v.leftHipBackMirror, v.leftHipBack, colors.LEG_COLOR));
            // Bottom
            triangles.push(new Triangle(v.leftFootFront, v.leftFootBack, v.leftFootFrontMirror, colors.LEG_COLOR));
            triangles.push(new Triangle(v.leftFootFrontMirror, v.leftFootBack, v.leftFootBackMirror, colors.LEG_COLOR));

        super(physicsWorld, triangles);

        // Set up physics body
        const shape = new Goblin.BoxShape(bodyWidth, height, bodyDepth);
        this.body = new Goblin.RigidBody(shape, 0); // 0 mass for static body
        this.body.position.set(position.x, position.y, position.z);

        physicsWorld.addObject(this);
    }

    updateVisual() {
        if (!this.body) return;
        
        const pos = this.body.position;
        const rot = this.body.rotation;
        
        this.position = new Vector3(pos.x, pos.y, pos.z);
        
        this.triangles.forEach((triangle, triIndex) => {
            const origNormal = this.originalNormals[triIndex];
            const rotatedNormal = this.rotateVector(origNormal, rot);
            triangle.normal = rotatedNormal;
            
            triangle.vertices.forEach((vertex, vertIndex) => {
                const origVert = this.originalVerts[triIndex * 3 + vertIndex];
                const relativeVert = new Goblin.Vector3(
                    origVert.x,
                    origVert.y,
                    origVert.z
                );
                
                rot.transformVector3(relativeVert);
                
                vertex.x = relativeVert.x + this.position.x;
                vertex.y = relativeVert.y + this.position.y;
                vertex.z = relativeVert.z + this.position.z;
            });
        });
        
        this.physicsWorld.shaderManager?.updateRenderableBuffers(this);
    }
}

class FishGenerator {
    static generate(physicsWorld, type, position, rotationAxis = "y") {
        // Get base configuration for fish type
        const profile = FISH_TYPES[type];
        if (!profile) {
            console.warn(`Unknown fish type: ${type}, using BASS`);
            profile = FISH_TYPES.BASS;
        }

        // Get a randomized configuration from the profile
        const config = profile.generateRandomizedConfig();
        
        // Generate random size within type's range
        const size = this.randomRange(config.sizeRange.min, config.sizeRange.max);

        // Create the fish with the generated configuration
        return new Fish(physicsWorld, size, position, config, rotationAxis);
    }

    static randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }
}

class FishingMode {
   constructor(canvases, input, audio) {
       this.canvas = canvases.gameCanvas;
       this.guiCanvas = canvases.guiCanvas;
       this.debugCanvas = canvases.debugCanvas;
       this.input = input;
       this.physicsWorld = new ActionPhysicsWorld3D();
       this.renderer3d = new ActionRenderer3D(this.canvas);
       this.guiContext = this.guiCanvas.getContext('2d');
       this.fishes = [];

       // Initialize camera
       this.camera = new ActionCamera(
           new Vector3(0, 20, -60),
           new Vector3(0, 0, 0)
       );

       this.cameraState = 'fisher';
       this.cameraAngle = Math.PI;
       this.cameraRadius = 20;
       this.cameraHeight = 20;

       this.shaderManager = new ShaderManager(this.renderer3d.gl);
       this.shaderManager.registerAllShaders(this.renderer3d);
       this.physicsWorld.setShaderManager(this.shaderManager);
       
       this.fishingArea = new FishingArea();
       this.fisher = new Fisher(this, new Vector3(0, 30, -50));
       this.lure = new Lure(this.physicsWorld);
       this.lure.visible = false;
       this.fisher.attachLure(this.lure);

       this.hookingBarVisible = false;
       this.hookingProgress = 0;

       this.generateInitialFish(50);

       this.lastTime = performance.now();
   }

   generateInitialFish(count) {
    const types = ["BASS", "TROUT", "SWORDFISH"];
    
    // Divide the fishing area into sectors
    const sectorsPerDimension = Math.ceil(Math.cbrt(count)); // Cubic root for 3D division
    const sectorWidth = this.fishingArea.bounds.width / sectorsPerDimension;
    const sectorDepth = this.fishingArea.bounds.depth / sectorsPerDimension;
    const sectorLength = this.fishingArea.bounds.length / sectorsPerDimension;

    // Create array of all possible sectors
    const sectors = [];
    for (let x = 0; x < sectorsPerDimension; x++) {
        for (let y = 0; y < sectorsPerDimension; y++) {
            for (let z = 0; z < sectorsPerDimension; z++) {
                sectors.push({x, y, z});
            }
        }
    }

    // Shuffle sectors array for random distribution
    for (let i = sectors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sectors[i], sectors[j]] = [sectors[j], sectors[i]];
    }

    // Generate fish in different sectors
    for (let i = 0; i < count; i++) {
        // Get sector for this fish
        const sector = sectors[i % sectors.length];
        
        // Calculate position within sector (with some randomization within the sector)
        const position = new Vector3(
            ((sector.x + Math.random()) * sectorWidth - this.fishingArea.bounds.width/2),
            ((sector.y + Math.random()) * sectorDepth - this.fishingArea.bounds.depth/2),
            ((sector.z + Math.random()) * sectorLength - this.fishingArea.bounds.length/2)
        );

        const rotationAxis = ["x", "y", "z"][Math.floor(Math.random() * 3)];
        const randomType = types[Math.floor(Math.random() * types.length)];

        const fish = FishGenerator.generate(
            this.physicsWorld,
            randomType,
            position,
            rotationAxis
        );
        
        this.fishes.push(fish);
        this.fishingArea.addFish(fish);
    }
}
    lerpVector(start, end, t) {
    return new Vector3(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t,
        start.z + (end.z - start.z) * t
    );
}
   updateCamera(deltaTime) {
    if (this.camera.isDetached) return;

    const CAMERA_LERP_SPEED = 3;
    const CAMERA_ROTATION_SPEED = 2;
    let targetPos, targetLookAt;

    switch(this.fisher.state) {
        case 'ready':
            // Align camera with fisher's orientation
            const cameraOffset = new Vector3(
                -Math.sin(this.fisher.aimAngle), // Use negative sin for correct left/right
                1.5,  // Height above fisher
                -Math.cos(this.fisher.aimAngle)  // Use negative cos for correct forward/back
            ).scale(40);
            
            targetPos = this.fisher.position.add(cameraOffset);
            targetLookAt = this.fisher.position.add(
                new Vector3(
                    Math.sin(this.fisher.aimAngle),
                    0,
                    Math.cos(this.fisher.aimAngle)
                ).scale(20)
            );
            break;

        case 'casting':
        // Maintain behind view during cast
        const castViewOffset = new Vector3(
            Math.cos(this.fisher.aimAngle + Math.PI), // Add PI to keep behind view
            1.5,
            Math.sin(this.fisher.aimAngle + Math.PI)  // Add PI to keep behind view
        ).scale(30);

        targetPos = this.lure.position.add(castViewOffset);
        targetLookAt = this.lure.position;
        break;

        case 'fishing':
    // Start with the base angle that matches our initial behind view
    if (!this.initialFishingAngle) {
        this.initialFishingAngle = 0; // Start at 0 to face the back
    }
    
    // Allow rotation but start from behind perspective
    if (this.input.isKeyPressed('Numpad4')) {
        this.initialFishingAngle += CAMERA_ROTATION_SPEED * deltaTime;
    }
    if (this.input.isKeyPressed('Numpad6')) {
        this.initialFishingAngle -= CAMERA_ROTATION_SPEED * deltaTime;
    }

    const fishingOffset = new Vector3(
        -Math.sin(this.initialFishingAngle),
        1.5,
        -Math.cos(this.initialFishingAngle)
    ).scale(30);
    
    targetPos = this.lure.position.add(fishingOffset);
    targetLookAt = this.lure.position;
    break;

        case 'reeling':
            const distanceToFisher = this.lure.position.distanceTo(this.fisher.position);
            if (distanceToFisher < 15) {
                // Transition back to fisher view when close
                const returnOffset = new Vector3(
                    -Math.sin(this.fisher.aimAngle),
                    1.5,
                    -Math.cos(this.fisher.aimAngle)
                ).scale(40);
                targetPos = this.fisher.position.add(returnOffset);
                targetLookAt = this.fisher.position;
            } else {
                // Keep following lure while reeling
                const reelingOffset = new Vector3(
                    -Math.sin(this.cameraAngle),
                    1.5,
                    -Math.cos(this.cameraAngle)
                ).scale(30);
                targetPos = this.lure.position.add(reelingOffset);
                targetLookAt = this.lure.position;
            }
            break;
    }

    // Smooth camera movement
    this.camera.position = this.lerpVector(
        this.camera.position, 
        targetPos, 
        deltaTime * CAMERA_LERP_SPEED
    );
    this.camera.target = this.lerpVector(
        this.camera.target,
        targetLookAt,
        deltaTime * CAMERA_LERP_SPEED
    );
}
   tryHookFish() {
        console.log("Attempting to hook fish!");
        for (const fish of this.fishes) {
            const fishAI = this.fishingArea.fish.get(fish);
            if (fishAI.tryHook(this.lure)) {
                console.log('Fish successfully hooked!');
                break;
            }
        }
    }
   drawCastingPowerMeter(percentage) {
        const barWidth = 200;
        const barHeight = 20;
        const x = (this.guiCanvas.width - barWidth) / 2;
        const y = this.guiCanvas.height - 100;

        this.guiContext.fillStyle = '#333';
        this.guiContext.fillRect(x, y, barWidth, barHeight);

        this.guiContext.fillStyle = '#0f0';
        this.guiContext.fillRect(x, y, barWidth * (percentage / 100), barHeight);

        this.guiContext.fillStyle = '#fff';
        this.guiContext.font = '16px Arial';
        this.guiContext.textAlign = 'center';
        this.guiContext.fillText('Casting Power', x + barWidth / 2, y - 10);
    }
  drawUI() {
    // Draw instructions
    this.guiContext.fillStyle = '#fff';
    this.guiContext.font = '16px Arial';
    this.guiContext.textAlign = 'left';
    this.guiContext.fillText('Hold SHIFT to charge cast', 10, 30);
    this.guiContext.fillText('Release SHIFT to cast', 10, 50);
    this.guiContext.fillText('WASD to move lure', 10, 70);
    this.guiContext.fillText('SPACE to reel in', 10, 90);

    // Draw hooking bar if active
    if (this.hookingBarVisible) {
        this.drawHookingBar(this.hookingProgress);
    }

    // Draw casting power meter when charging
    if (this.fisher.isChargingCast) {
        this.drawCastingPowerMeter(this.fisher.getCastPowerPercentage());
    }
}
  
    drawHookingBar(progress) {
    const barWidth = 200;
    const barHeight = 20;
    const x = (this.guiCanvas.width - barWidth) / 2;
    const y = this.guiCanvas.height - 50;

    // Draw background
    this.guiContext.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.guiContext.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    // Draw progress bar background
    this.guiContext.fillStyle = '#333';
    this.guiContext.fillRect(x, y, barWidth, barHeight);

    // Draw progress (filling from right to left)
    this.guiContext.fillStyle = '#0f0';
    const progressWidth = barWidth * (1 - progress);
    this.guiContext.fillRect(x, y, progressWidth, barHeight);

    // Draw "HOOK!" text
    this.guiContext.fillStyle = '#fff';
    this.guiContext.font = '16px Arial';
    this.guiContext.textAlign = 'center';
    this.guiContext.fillText('HOOK!', x + barWidth / 2, y - 10);
}

   update(deltaTime) {
       // Reset hooking UI state at start of update
       this.hookingBarVisible = false;
       this.hookingProgress = 0;

       // Update fisher and check for state changes
       this.fisher.update(deltaTime, this.input);
       
       // Update lure
       this.lure.update(deltaTime);
       
       // Update camera
       this.updateCamera(deltaTime);
       
       // Update fishing area (which updates fish movement)
       this.fishingArea.update(deltaTime);
       
       // Check for attackable fish and update UI
       for (const fish of this.fishes) {
           const fishAI = this.fishingArea.fish.get(fish);
           if (fishAI.currentBehavior === fishAI.behaviors.attack && 
               fishAI.canBeHooked) {
               this.hookingBarVisible = true;
               this.hookingProgress = fishAI.currentBehavior.getHookingWindowProgress();
           }
       }

       // Handle hook input
       if (this.input.isKeyJustPressed('Action1')) {
           this.tryHookFish();
       }

       // Draw casting power meter when charging
       if (this.fisher.isChargingCast) {
           this.drawCastingPowerMeter(this.fisher.getCastPowerPercentage());
       }

       this.fishes.forEach(fish => { fish.update(deltaTime); });
       this.physicsWorld.update(deltaTime);
   }

   draw() {
       // Clear the GUI canvas first
       this.guiContext.clearRect(0, 0, this.guiCanvas.width, this.guiCanvas.height);

       // Draw 3D scene
       const bufferInfo = this.shaderManager.getBufferInfo();
       this.renderer3d.render({
           renderableBuffers: bufferInfo.renderableBuffers,
           renderableIndexCount: bufferInfo.renderableIndexCount,
           camera: this.camera,
           renderableObjects: Array.from(this.physicsWorld.objects)
       });

       // Draw UI elements
       this.drawUI();
   }

   pause() {
       this.physicsWorld.pause();
   }

   resume() {
       this.lastTime = performance.now();
       this.physicsWorld.resume();
   }

   cleanup() {
       if (this.physicsWorld) {
           this.physicsWorld.reset();
           this.physicsWorld = null;
       }

       if (this.renderer3d) {
           // TODO: Add proper renderer cleanup
           this.renderer3d = null;
       }

       if (this.shaderManager) {
           // TODO: Add proper shader cleanup
           this.shaderManager = null;
       }

       this.fishes = [];
       this.camera = null;
       this.fisher = null;
       this.lure = null;
       this.fishingArea = null;

       // Clear canvases
       if (this.guiContext) {
           this.guiContext.clearRect(0, 0, 800, 600);
       }

       this.input.clearAllElements();
       
       // Clear references
       this.canvas = null;
       this.guiCanvas = null;
       this.debugCanvas = null;
       this.guiContext = null;
       this.input = null;
   }
}

class FishingArea {
    constructor(width = 500, length = 500, depth = 50) {
        this.bounds = {
            width,
            length,
            depth
        };
        
        this.fish = new Map();
        this.lure = null; // Add reference to lure
    }
    addFish(fish) {
        // Create an AI controller for this fish
        const ai = new FishAI(fish, this.bounds);
        this.fish.set(fish, ai);
    }
    setLure(lure) {
        // Store reference but only allow interaction when in water
        this.lure = lure;
    }


    update(deltaTime) {
        // Only update fish AI if there's a lure in water
        const activeLure = this.lure?.state === 'inWater' ? this.lure : null;
        for (const [fish, ai] of this.fish) {
            ai.update(deltaTime, activeLure);
        }
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

class Lure extends ActionPhysicsSphere3D {
    constructor(physicsWorld, radius = 2) {
        super(physicsWorld, radius, 0, new Vector3(0,0,0)); // mass 0
        this.fisher = null;
        this.state = 'inactive'; // inactive, casting, inWater
        this.visible = false;
        
        // Our own physics properties
        this.lureVelocity = new Vector3(0, 0, 0);
        this.lureGravity = -9.8;
        this.maxLureVelocity = 15;
        
        this.bounds = {
            width: 500,
            length: 500,
            depth: 50
        };
		physicsWorld.addObject(this);
    }
setFisher(fisher) {
        this.fisher = fisher;
        this.reset();
    }
    startCast(startPos, castVelocity, castDirection) {
        this.state = 'casting';
        this.position = startPos.clone();
        
        if (castVelocity.length() > this.maxLureVelocity) {
            castVelocity = castVelocity.normalize().scale(this.maxLureVelocity);
        }
        this.lureVelocity = castVelocity;
        this.castDirection = castDirection.clone();
        this.visible = true;
        
        if (this.fisher?.game) {
            this.fisher.game.fishingArea.setLure(this);
        }
    }

    update(deltaTime) {
        if (this.state === 'casting') {
            // Update both position AND body position
            const moveX = this.lureVelocity.x * deltaTime;
            const moveY = this.lureVelocity.y * deltaTime;
            const moveZ = this.lureVelocity.z * deltaTime;

            this.position.x += moveX;
            this.position.y += moveY;
            this.position.z += moveZ;

            this.body.position.x = this.position.x;
            this.body.position.y = this.position.y;
            this.body.position.z = this.position.z;

            this.lureVelocity.y += this.lureGravity * deltaTime;
            if (this.fisher?.game) {
            this.fisher.game.fishingArea.setLure(this);
        }
            this.state = 'inWater';
        }
        this.updateVisual();
    }

    
    updateVisual() {
        if (!this.body) return;
        
        // Update vertices based on current position without resetting it
        this.triangles.forEach((triangle, triIndex) => {
            triangle.vertices.forEach((vertex, vertIndex) => {
                const origVert = this.originalVerts[triIndex * 3 + vertIndex];
                
                vertex.x = origVert.x + this.position.x;
                vertex.y = origVert.y + this.position.y;
                vertex.z = origVert.z + this.position.z;
            });
        });
    }
    move(direction, amount) {
        if (this.state !== 'inWater') return;
        
        switch(direction) {
            case 'forward':
                this.position.z += amount;
                break;
            case 'backward':
                this.position.z -= amount;
                break;
            case 'left':
                this.position.x -= amount;
                break;
            case 'right':
                this.position.x += amount;
                break;
        }
        
        if (this.fisher?.game) {
            this.fisher.game.fishingArea.setLure(this);
        }
    }

    reset() {
        if (!this.fisher) return;
        this.state = 'inactive';
        this.position = this.fisher.position.clone();
        this.visible = false;
        this.lureVelocity = new Vector3(0, 0, 0);
        
        if (this.fisher.game) {
            this.fisher.game.fishingArea.setLure(this);
        }
    }
}