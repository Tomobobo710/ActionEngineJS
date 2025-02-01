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
            analFinRootFront: new Vector3(
                length * config.analFin.FRONT_FACTOR,
                -height * config.analFin.ROOT_HEIGHT_FACTOR,
                0
            ),
            analFinRootBack: new Vector3(
                length * config.analFin.BACK_FACTOR,
                -height * config.analFin.ROOT_HEIGHT_FACTOR,
                0
            ),

            // Tail vertices
            tailTop: new Vector3(-length / 2, height / 2, 0),
            tailBottom: new Vector3(-length / 2, -height / 2, 0),
            tailFinTop: new Vector3(
                -(
                    TAIL_BASE_DISTANCE +
                    TAIL_FIN_LENGTH * config.tail.FIN_SCALE_FACTOR +
                    length * config.tail.FIN_SHIFT_FACTOR
                ),
                height,
                0
            ),
            tailFinBottom: new Vector3(
                -(
                    TAIL_BASE_DISTANCE +
                    TAIL_FIN_LENGTH * config.tail.FIN_SCALE_FACTOR +
                    length * config.tail.FIN_SHIFT_FACTOR
                ),
                -height,
                0
            ),
            tailCenter: new Vector3(-(TAIL_BASE_DISTANCE + length * config.tail.FIN_SHIFT_FACTOR), 0, 0),

            // Dorsal fin vertices
            dorsalFinTip: new Vector3(0, height * config.dorsalFin.HEIGHT_FACTOR, 0),
            dorsalFinFront: new Vector3(length * config.dorsalFin.FRONT_FACTOR, height, 0),
            dorsalFinBack: new Vector3(length * config.dorsalFin.BACK_FACTOR, height, 0),

            // Pectoral fins
            pectoralFinRight: new Vector3(
                0,
                -height * config.pectoralFins.DROP_FACTOR,
                width * config.pectoralFins.EXTENSION_FACTOR
            ),
            pectoralFinRootFrontRight: new Vector3(length * config.pectoralFins.ROOT_FRONT_FACTOR, 0, width / 2),
            pectoralFinRootBackRight: new Vector3(length * config.pectoralFins.ROOT_BACK_FACTOR, 0, width / 2),
            pectoralFinLeft: new Vector3(
                0,
                -height * config.pectoralFins.DROP_FACTOR,
                -width * config.pectoralFins.EXTENSION_FACTOR
            ),
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
        triangles.push(
            new Triangle(v.topFrontMirror, v.bottomFrontMirror, v.bottomBackMirror, config.colors.SIDE_COLOR)
        );

        // Body top and bottom
        triangles.push(new Triangle(v.topFront, v.topFrontMirror, v.topBack, config.colors.TOPBOTTOM_COLOR));
        triangles.push(new Triangle(v.topFrontMirror, v.topBackMirror, v.topBack, config.colors.TOPBOTTOM_COLOR));
        triangles.push(new Triangle(v.bottomFront, v.bottomBack, v.bottomFrontMirror, config.colors.TOPBOTTOM_COLOR));
        triangles.push(
            new Triangle(v.bottomFrontMirror, v.bottomBack, v.bottomBackMirror, config.colors.TOPBOTTOM_COLOR)
        );

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
        triangles.push(
            new Triangle(
                v.pectoralFinRootFrontRight,
                v.pectoralFinRight,
                v.pectoralFinRootBackRight,
                config.colors.PECTORAL_FIN_COLOR
            )
        );
        triangles.push(
            new Triangle(
                v.pectoralFinRootFrontRight,
                v.pectoralFinRootBackRight,
                v.pectoralFinRight,
                config.colors.PECTORAL_FIN_COLOR
            )
        );
        triangles.push(
            new Triangle(
                v.pectoralFinRootFrontLeft,
                v.pectoralFinRootBackLeft,
                v.pectoralFinLeft,
                config.colors.PECTORAL_FIN_COLOR
            )
        );
        triangles.push(
            new Triangle(
                v.pectoralFinRootFrontLeft,
                v.pectoralFinLeft,
                v.pectoralFinRootBackLeft,
                config.colors.PECTORAL_FIN_COLOR
            )
        );

        // Pelvic fins
        triangles.push(
            new Triangle(
                v.pelvicFinRootFrontRight,
                v.pelvicFinRight,
                v.pelvicFinRootBackRight,
                config.colors.PELVIC_FIN_COLOR
            )
        );
        triangles.push(
            new Triangle(
                v.pelvicFinRootFrontRight,
                v.pelvicFinRootBackRight,
                v.pelvicFinRight,
                config.colors.PELVIC_FIN_COLOR
            )
        );
        triangles.push(
            new Triangle(
                v.pelvicFinRootFrontLeft,
                v.pelvicFinRootBackLeft,
                v.pelvicFinLeft,
                config.colors.PELVIC_FIN_COLOR
            )
        );
        triangles.push(
            new Triangle(
                v.pelvicFinRootFrontLeft,
                v.pelvicFinLeft,
                v.pelvicFinRootBackLeft,
                config.colors.PELVIC_FIN_COLOR
            )
        );

        // Right eye
        triangles.push(
            new Triangle(v.eyeBaseFrontRight, v.eyeBaseBottomRight, v.eyeBaseBackRight, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(
            new Triangle(v.eyeBaseTopRight, v.eyeBaseFrontRight, v.eyeBaseBackRight, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(
            new Triangle(v.eyeBaseFrontRight, v.eyeBaseTopRight, v.eyeTipRight, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(
            new Triangle(v.eyeBaseBottomRight, v.eyeBaseFrontRight, v.eyeTipRight, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(
            new Triangle(v.eyeBaseBackRight, v.eyeBaseBottomRight, v.eyeTipRight, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(
            new Triangle(v.eyeBaseTopRight, v.eyeBaseBackRight, v.eyeTipRight, config.colors.EYE_BASE_COLOR)
        );

        // Left eye
        triangles.push(
            new Triangle(v.eyeBaseFrontLeft, v.eyeBaseBackLeft, v.eyeBaseBottomLeft, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(
            new Triangle(v.eyeBaseTopLeft, v.eyeBaseBackLeft, v.eyeBaseFrontLeft, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(new Triangle(v.eyeBaseTopLeft, v.eyeBaseFrontLeft, v.eyeTipLeft, config.colors.EYE_BASE_COLOR));
        triangles.push(
            new Triangle(v.eyeBaseFrontLeft, v.eyeBaseBottomLeft, v.eyeTipLeft, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(
            new Triangle(v.eyeBaseBottomLeft, v.eyeBaseBackLeft, v.eyeTipLeft, config.colors.EYE_BASE_COLOR)
        );
        triangles.push(new Triangle(v.eyeBaseBackLeft, v.eyeBaseTopLeft, v.eyeTipLeft, config.colors.EYE_BASE_COLOR));

        super(physicsWorld, triangles);

        // Add animation properties
        this.animationTime = 0;
        this.tailWaveSpeed = 5; // Waves per second
        this.tailWaveAmplitude = 0.2; // Maximum tail displacement
        this.bodyWaveSpeed = 3;
        this.bodyWaveAmplitude = 0.1;
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
                const relativeVert = new Goblin.Vector3(animatedVert.x, animatedVert.y, animatedVert.z);

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
        const xOffset = -vertex.x;

        // Calculate wave displacement
        const tailWave = Math.sin(this.tailWaveSpeed * this.animationTime + xOffset) * this.tailWaveAmplitude;
        const bodyWave = Math.sin(this.bodyWaveSpeed * this.animationTime + xOffset) * this.bodyWaveAmplitude;

        // Apply stronger effect to tail (based on x position)
        const tailFactor = Math.max(0, (-vertex.x + 2) / 4);
        const bodyFactor = 1 - tailFactor;

        // Apply combined waves to z-coordinate (side-to-side motion)
        animatedVertex.z += tailWave * tailFactor + bodyWave * bodyFactor;

        return animatedVertex;
    }
    
    update(deltaTime) {
        this.animationTime += deltaTime;
        this.updateVisual();
    }
}