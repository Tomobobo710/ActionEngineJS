class FishermanModel extends ActionPhysicsObject3D {
    constructor(physicsWorld, height = 10, position = new Vector3(0, 0, 0)) {
        const triangles = [];
        const colors = {
            BODY_COLOR: "#3f2a14", // Brown for clothing
            HEAD_COLOR: "#ffd6b1", // Skin tone
            HAT_COLOR: "#ec00ff", // Blue hat
            ARM_COLOR: "#ff4e00", // Darker brown for arms
            LEG_COLOR: "#1a1a1a" // Dark gray for legs
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
            bodyTopFront: new Vector3(bodyWidth / 2, height * 0.8, bodyDepth / 2),
            bodyTopBack: new Vector3(bodyWidth / 2, height * 0.8, -bodyDepth / 2),
            bodyBottomFront: new Vector3(bodyWidth / 2, height * 0.3, bodyDepth / 2),
            bodyBottomBack: new Vector3(bodyWidth / 2, height * 0.3, -bodyDepth / 2),
            bodyTopFrontMirror: new Vector3(-bodyWidth / 2, height * 0.8, bodyDepth / 2),
            bodyTopBackMirror: new Vector3(-bodyWidth / 2, height * 0.8, -bodyDepth / 2),
            bodyBottomFrontMirror: new Vector3(-bodyWidth / 2, height * 0.3, bodyDepth / 2),
            bodyBottomBackMirror: new Vector3(-bodyWidth / 2, height * 0.3, -bodyDepth / 2),
            // Hat vertices
            hatFrontLeft: new Vector3(-headSize * 0.6, height + headSize * 0.6, headSize * 0.6),
            hatFrontRight: new Vector3(headSize * 0.6, height + headSize * 0.6, headSize * 0.6),
            hatBackLeft: new Vector3(-headSize * 0.6, height + headSize * 0.6, -headSize * 0.6),
            hatBackRight: new Vector3(headSize * 0.6, height + headSize * 0.6, -headSize * 0.6),
            hatTop: new Vector3(0, height + headSize * 2, 0),
            // Replace the head vertices with more points to create a smoother sphere-like shape
            // Front vertices
            frontTopMid: new Vector3(0, height + headSize / 2, headSize / 2),
            frontBottomMid: new Vector3(0, height - headSize / 2, headSize / 2),
            frontRight: new Vector3(headSize / 2, height, headSize / 2),
            frontLeft: new Vector3(-headSize / 2, height, headSize / 2),
            // Back vertices
            backTopMid: new Vector3(0, height + headSize / 2, -headSize / 2),
            backBottomMid: new Vector3(0, height - headSize / 2, -headSize / 2),
            backRight: new Vector3(headSize / 2, height, -headSize / 2),
            backLeft: new Vector3(-headSize / 2, height, -headSize / 2),
            // Top vertices
            topFront: new Vector3(0, height + headSize / 2, headSize / 3),
            topBack: new Vector3(0, height + headSize / 2, -headSize / 3),
            topRight: new Vector3(headSize / 3, height + headSize / 2, 0),
            topLeft: new Vector3(-headSize / 3, height + headSize / 2, 0),
            // Bottom vertices
            bottomFront: new Vector3(0, height - headSize / 2, headSize / 3),
            bottomBack: new Vector3(0, height - headSize / 2, -headSize / 3),
            bottomRight: new Vector3(headSize / 3, height - headSize / 2, 0),
            bottomLeft: new Vector3(-headSize / 3, height - headSize / 2, 0),
            // Arms vertices
            // Right arm vertices
            rightShoulderTop: new Vector3(bodyWidth / 2, height * 0.75, bodyDepth / 4),
            rightShoulderBack: new Vector3(bodyWidth / 2, height * 0.75, -bodyDepth / 4),
            rightShoulderTopMirror: new Vector3(bodyWidth / 2 + bodyWidth / 8, height * 0.75, bodyDepth / 4),
            rightShoulderBackMirror: new Vector3(bodyWidth / 2 + bodyWidth / 8, height * 0.75, -bodyDepth / 4),
            rightHandFront: new Vector3(bodyWidth / 2 + bodyWidth / 4, height * 0.4, bodyDepth / 4),
            rightHandBack: new Vector3(bodyWidth / 2 + bodyWidth / 4, height * 0.4, -bodyDepth / 4),
            rightHandFrontMirror: new Vector3(
                bodyWidth / 2 + bodyWidth / 4 + bodyWidth / 8,
                height * 0.4,
                bodyDepth / 4
            ),
            rightHandBackMirror: new Vector3(
                bodyWidth / 2 + bodyWidth / 4 + bodyWidth / 8,
                height * 0.4,
                -bodyDepth / 4
            ),
            // Left arm vertices
            leftShoulderTop: new Vector3(-bodyWidth / 2, height * 0.75, bodyDepth / 4),
            leftShoulderBack: new Vector3(-bodyWidth / 2, height * 0.75, -bodyDepth / 4),
            leftShoulderTopMirror: new Vector3(-bodyWidth / 2 - bodyWidth / 8, height * 0.75, bodyDepth / 4),
            leftShoulderBackMirror: new Vector3(-bodyWidth / 2 - bodyWidth / 8, height * 0.75, -bodyDepth / 4),
            leftHandFront: new Vector3(-bodyWidth / 2 - bodyWidth / 4, height * 0.4, bodyDepth / 4),
            leftHandBack: new Vector3(-bodyWidth / 2 - bodyWidth / 4, height * 0.4, -bodyDepth / 4),
            leftHandFrontMirror: new Vector3(
                -bodyWidth / 2 - bodyWidth / 4 - bodyWidth / 8,
                height * 0.4,
                bodyDepth / 4
            ),
            leftHandBackMirror: new Vector3(
                -bodyWidth / 2 - bodyWidth / 4 - bodyWidth / 8,
                height * 0.4,
                -bodyDepth / 4
            ),
            // Legs
            // Right leg vertices
            rightHipTop: new Vector3(bodyWidth / 4, height * 0.3, bodyDepth / 4),
            rightHipBack: new Vector3(bodyWidth / 4, height * 0.3, -bodyDepth / 4),
            rightHipTopMirror: new Vector3(bodyWidth / 8, height * 0.3, bodyDepth / 4),
            rightHipBackMirror: new Vector3(bodyWidth / 8, height * 0.3, -bodyDepth / 4),
            rightFootFront: new Vector3(bodyWidth / 4, 0, bodyDepth / 4),
            rightFootBack: new Vector3(bodyWidth / 4, 0, -bodyDepth / 4),
            rightFootFrontMirror: new Vector3(bodyWidth / 8, 0, bodyDepth / 4),
            rightFootBackMirror: new Vector3(bodyWidth / 8, 0, -bodyDepth / 4),
            // Left leg vertices
            leftHipTop: new Vector3(-bodyWidth / 4, height * 0.3, bodyDepth / 4),
            leftHipBack: new Vector3(-bodyWidth / 4, height * 0.3, -bodyDepth / 4),
            leftHipTopMirror: new Vector3(-bodyWidth / 8, height * 0.3, bodyDepth / 4),
            leftHipBackMirror: new Vector3(-bodyWidth / 8, height * 0.3, -bodyDepth / 4),
            leftFootFront: new Vector3(-bodyWidth / 4, 0, bodyDepth / 4),
            leftFootBack: new Vector3(-bodyWidth / 4, 0, -bodyDepth / 4),
            leftFootFrontMirror: new Vector3(-bodyWidth / 8, 0, bodyDepth / 4),
            leftFootBackMirror: new Vector3(-bodyWidth / 8, 0, -bodyDepth / 4)
        };

        // Add body triangles
        // Front
        triangles.push(new Triangle(v.bodyTopFront, v.bodyTopFrontMirror, v.bodyBottomFront, colors.BODY_COLOR));
        triangles.push(
            new Triangle(v.bodyBottomFront, v.bodyTopFrontMirror, v.bodyBottomFrontMirror, colors.BODY_COLOR)
        );
        // Back
        triangles.push(new Triangle(v.bodyTopBack, v.bodyBottomBack, v.bodyTopBackMirror, "#00FF00"));
        triangles.push(new Triangle(v.bodyBottomBack, v.bodyBottomBackMirror, v.bodyTopBackMirror, "#00FF00"));
        // Right Side
        triangles.push(new Triangle(v.bodyTopFront, v.bodyBottomBack, v.bodyTopBack, colors.BODY_COLOR));
        triangles.push(new Triangle(v.bodyTopFront, v.bodyBottomFront, v.bodyBottomBack, colors.BODY_COLOR));
        // Left Side
        triangles.push(
            new Triangle(v.bodyTopFrontMirror, v.bodyTopBackMirror, v.bodyBottomBackMirror, colors.BODY_COLOR)
        );
        triangles.push(
            new Triangle(v.bodyTopFrontMirror, v.bodyBottomBackMirror, v.bodyBottomFrontMirror, colors.BODY_COLOR)
        );
        // Top
        triangles.push(new Triangle(v.bodyTopFront, v.bodyTopBack, v.bodyTopFrontMirror, colors.BODY_COLOR));
        triangles.push(new Triangle(v.bodyTopFrontMirror, v.bodyTopBack, v.bodyTopBackMirror, colors.BODY_COLOR));
        // Bottom
        triangles.push(new Triangle(v.bodyBottomFront, v.bodyBottomFrontMirror, v.bodyBottomBack, colors.BODY_COLOR));
        triangles.push(
            new Triangle(v.bodyBottomFrontMirror, v.bodyBottomBackMirror, v.bodyBottomBack, colors.BODY_COLOR)
        );
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
        triangles.push(new Triangle(v.topFront, v.topRight, v.topLeft, colors.HEAD_COLOR)); //center
        triangles.push(new Triangle(v.topBack, v.topLeft, v.topRight, colors.HEAD_COLOR)); //center
        triangles.push(new Triangle(v.topFront, v.frontTopMid, v.topRight, colors.HEAD_COLOR)); //center front
        triangles.push(new Triangle(v.topFront, v.topLeft, v.frontTopMid, colors.HEAD_COLOR)); //center front
        triangles.push(new Triangle(v.topBack, v.topRight, v.backTopMid, colors.HEAD_COLOR)); //center back
        triangles.push(new Triangle(v.topBack, v.backTopMid, v.topLeft, colors.HEAD_COLOR)); //centerback
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
        triangles.push(
            new Triangle(v.rightHandFront, v.rightHandFrontMirror, v.rightShoulderTopMirror, colors.ARM_COLOR)
        );
        // Back
        triangles.push(new Triangle(v.rightShoulderBack, v.rightShoulderBackMirror, v.rightHandBack, colors.ARM_COLOR));
        triangles.push(
            new Triangle(v.rightHandBack, v.rightShoulderBackMirror, v.rightHandBackMirror, colors.ARM_COLOR)
        );
        // Right side (outer)
        triangles.push(new Triangle(v.rightShoulderTop, v.rightShoulderBack, v.rightHandBack, colors.ARM_COLOR));
        triangles.push(new Triangle(v.rightShoulderTop, v.rightHandBack, v.rightHandFront, colors.ARM_COLOR));
        // Left side (inner)
        triangles.push(
            new Triangle(v.rightShoulderTopMirror, v.rightHandBackMirror, v.rightShoulderBackMirror, colors.ARM_COLOR)
        );
        triangles.push(
            new Triangle(v.rightShoulderTopMirror, v.rightHandFrontMirror, v.rightHandBackMirror, colors.ARM_COLOR)
        );
        // Top
        triangles.push(
            new Triangle(v.rightShoulderTop, v.rightShoulderTopMirror, v.rightShoulderBack, colors.ARM_COLOR)
        );
        triangles.push(
            new Triangle(v.rightShoulderTopMirror, v.rightShoulderBackMirror, v.rightShoulderBack, colors.ARM_COLOR)
        );
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
        triangles.push(
            new Triangle(v.leftShoulderTopMirror, v.leftShoulderBackMirror, v.leftHandBackMirror, colors.ARM_COLOR)
        );
        triangles.push(
            new Triangle(v.leftShoulderTopMirror, v.leftHandBackMirror, v.leftHandFrontMirror, colors.ARM_COLOR)
        );
        // Top
        triangles.push(new Triangle(v.leftShoulderTop, v.leftShoulderBack, v.leftShoulderTopMirror, colors.ARM_COLOR));
        triangles.push(
            new Triangle(v.leftShoulderTopMirror, v.leftShoulderBack, v.leftShoulderBackMirror, colors.ARM_COLOR)
        );
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
        triangles.push(
            new Triangle(v.rightHipTopMirror, v.rightHipBackMirror, v.rightFootBackMirror, colors.LEG_COLOR)
        );
        triangles.push(
            new Triangle(v.rightHipTopMirror, v.rightFootBackMirror, v.rightFootFrontMirror, colors.LEG_COLOR)
        );
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

        this.timeSinceLastUpdate = 0;
        physicsWorld.addObject(this);
    }
}