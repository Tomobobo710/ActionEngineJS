class DungeonBuilding extends ActionPhysicsObject3D {
    constructor(physicsWorld, worldMode, width = 10, height = 6, depth = 10, position) {
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        // Create vertices for dungeon shape (keeping same visual geometry)
        const COLORS = {
    MAIN_STONE: "#847E87",      // Main archway stone
    DARK_STONE: "#4A474F",      // Shadowed areas
    ACCENT_STONE: "#6B6773",    // Decorative elements
    RUBBLE: "#5D5A63",         // Fallen stones
    FLOOR: "#3D3B41"           // Ground
};
/*
// Arch factors
const ARCH_INNER_FACTOR = 0.8;
const ARCH_HEIGHT_FACTOR = 1.2;
const ARCH_DEPTH_FACTOR = 2.0;
const ARCH_DETAIL_SCALE = 0.1;

// Stone detail factors
const STONE_SPACING = 0.2;
const STONE_DEPTH = 0.1;
const DECORATIVE_DEPTH = 0.15;

// Rubble factors
const RUBBLE_SCALE = 0.3;
const RUBBLE_SCATTER = 0.8;
        
// Wall section factors
const WALL_ANGLE = 0.3;
const WALL_DEPTH_FACTOR = 0.8;
const WALL_SEGMENT_FACTOR = 0.6;

const v = {
    // Main arch structure
    archway: {
        outerTop: new Vector3(0, height * ARCH_HEIGHT_FACTOR, depth/2),
        outerLeft: new Vector3(-width/2, height * 0.8, depth/2),
        outerRight: new Vector3(width/2, height * 0.8, depth/2),
        
        innerTop: new Vector3(0, height * ARCH_HEIGHT_FACTOR * ARCH_INNER_FACTOR, depth/3),
        innerLeft: new Vector3(-width/3, height * 0.7, depth/3),
        innerRight: new Vector3(width/3, height * 0.7, depth/3)
    },
    
    // Decorative stonework
    decoration: {
        topLeft: new Vector3(-width/2 * 0.9, height * 0.9, depth/2 + DECORATIVE_DEPTH),
        topRight: new Vector3(width/2 * 0.9, height * 0.9, depth/2 + DECORATIVE_DEPTH),
        keystone: new Vector3(0, height * ARCH_HEIGHT_FACTOR * 1.1, depth/2 + DECORATIVE_DEPTH)
    },
    
    // Wall sections
    walls: {
        leftTop: new Vector3(-width, height, depth/2),
        leftBottom: new Vector3(-width, -height/2, depth/2),
        rightTop: new Vector3(width, height, depth/2),
        rightBottom: new Vector3(width, -height/2, depth/2)
    },
    
     // Main body points
    body: {
        peak: new Vector3(0, height * 0.8, 0),
        front: new Vector3(width * 0.4, height * 0.3, 0),
        bottom: new Vector3(-width * 0.2, -height * 0.2, 0),
        back: new Vector3(-width * 0.4, height * 0.1, 0)
    },
    
    gothicArch: {
        peak: new Vector3(0, height * 2.0, depth/2),
        leftSpire: new Vector3(-width/3, height * 1.8, depth/2),
        rightSpire: new Vector3(width/3, height * 1.8, depth/2)
    },
    
    buttress: {
        leftOuter: new Vector3(-width * 0.8, height * 0.6, depth * 0.8),
        leftInner: new Vector3(-width * 0.6, height * 1.2, depth * 0.6),
        rightOuter: new Vector3(width * 0.8, height * 0.6, depth * 0.8),
        rightInner: new Vector3(width * 0.6, height * 1.2, depth * 0.6)
    },
    
     mesh: {
        // Front frame
        frontTop: new Vector3(0, height * 0.5, depth * 0.3),
        frontLeft: new Vector3(-width * 0.4, height * 0.2, depth * 0.3),
        frontRight: new Vector3(width * 0.4, height * 0.2, depth * 0.3),
        frontBottom: new Vector3(0, -height * 0.2, depth * 0.3),
        
        // Back frame
        backTop: new Vector3(0, height * 0.4, -depth * 0.3),
        backLeft: new Vector3(-width * 0.3, height * 0.1, -depth * 0.3),
        backRight: new Vector3(width * 0.3, height * 0.1, -depth * 0.3),
        backBottom: new Vector3(0, -height * 0.15, -depth * 0.3)
    },
    
    // Sharp wing/beak extensions
    points: {
        topSpike: new Vector3(width * 0.7, height, 0),
        frontSpike: new Vector3(width * 0.9, height * 0.5, 0),
        lowerSpike: new Vector3(width * 0.3, -height * 0.3, 0),
        backSpike: new Vector3(-width * 0.5, height * 0.4, 0)
    },
    
    // Inner detail shapes
    inner: {
        center: new Vector3(width * 0.2, height * 0.4, 0),
        upper: new Vector3(width * 0.4, height * 0.6, 0),
        lower: new Vector3(width * 0.1, height * 0.2, 0)
    },
    
    // Red line points
    line: {
        top: new Vector3(width * 0.9, height, 0),
        right: new Vector3(width * 0.9, -height * 0.5, 0),
        bottom: new Vector3(-width * 0.5, -height * 0.5, 0)
    },
    
    // Floor and rubble
    ground: {
        center: new Vector3(0, -height/2, 0),
        left: new Vector3(-width/2, -height/2, depth/2),
        right: new Vector3(width/2, -height/2, depth/2),
        
        // Rubble pieces
        debris: [
            new Vector3(-width/3, -height/2 + RUBBLE_SCALE, depth/3),
            new Vector3(width/4, -height/2 + RUBBLE_SCALE * 0.7, depth/4),
            new Vector3(-width/5, -height/2 + RUBBLE_SCALE * 0.5, depth/5)
        ]
    },
    
    // Depth perspective
    tunnel: {
        farCenter: new Vector3(0, height * 0.7, -depth),
        farLeft: new Vector3(-width/3, height * 0.6, -depth),
        farRight: new Vector3(width/3, height * 0.6, -depth)
    },
    // Additional angular wall sections
    leftWalls: {
        outer: new Vector3(-width, height * 0.8, depth/2),
        inner: new Vector3(-width * 0.7, height * 0.9, depth * 0.7),
        lower: new Vector3(-width * 0.8, -height * 0.3, depth * 0.6),
        angled: new Vector3(-width * 0.9, height * 0.5, depth * 0.8),
        deep: new Vector3(-width * 1.2, height * 0.6, depth * 0.3)
    },
    
    rightWalls: {
        outer: new Vector3(width, height * 0.8, depth/2),
        inner: new Vector3(width * 0.7, height * 0.9, depth * 0.7),
        lower: new Vector3(width * 0.8, -height * 0.3, depth * 0.6),
        angled: new Vector3(width * 0.9, height * 0.5, depth * 0.8),
        deep: new Vector3(width * 1.2, height * 0.6, depth * 0.3)
    },
    
    ceiling: {
        peak: new Vector3(0, height * 1.2, 0),
        leftEdge: new Vector3(-width * 0.6, height, depth * 0.4),
        rightEdge: new Vector3(width * 0.6, height, depth * 0.4),
        backPeak: new Vector3(0, height * 1.1, -depth * 0.5)
    },
    
    alcoves: {
        leftUpper: new Vector3(-width * 0.75, height * 0.7, depth * 0.4),
        leftLower: new Vector3(-width * 0.75, height * 0.3, depth * 0.4),
        rightUpper: new Vector3(width * 0.75, height * 0.7, depth * 0.4),
        rightLower: new Vector3(width * 0.75, height * 0.3, depth * 0.4)
    }
};


const triangles = [];
        
// Gothic arch peak
triangles.push(new Triangle(v.gothicArch.peak, v.gothicArch.leftSpire, v.gothicArch.rightSpire, COLORS.MAIN_STONE));

// Flying buttresses
triangles.push(new Triangle(v.buttress.leftOuter, v.buttress.leftInner, v.walls.leftTop, COLORS.MAIN_STONE));
triangles.push(new Triangle(v.buttress.rightOuter, v.walls.rightTop, v.buttress.rightInner, COLORS.MAIN_STONE));        

// Main arch structure
triangles.push(new Triangle(v.archway.outerLeft, v.archway.outerTop, v.archway.innerLeft, COLORS.MAIN_STONE));
triangles.push(new Triangle(v.archway.outerLeft, v.archway.innerLeft, v.archway.outerTop, COLORS.MAIN_STONE)); // Reverse

triangles.push(new Triangle(v.archway.outerRight, v.archway.outerTop, v.archway.innerRight, COLORS.MAIN_STONE));
triangles.push(new Triangle(v.archway.outerRight, v.archway.innerRight, v.archway.outerTop, COLORS.MAIN_STONE)); // Reverse

triangles.push(new Triangle(v.archway.innerLeft, v.archway.innerTop, v.archway.innerRight, COLORS.DARK_STONE));
triangles.push(new Triangle(v.archway.innerLeft, v.archway.innerRight, v.archway.innerTop, COLORS.DARK_STONE)); // Reverse

// Decorative stonework
triangles.push(new Triangle(v.decoration.topLeft, v.decoration.keystone, v.decoration.topRight, COLORS.ACCENT_STONE));
triangles.push(new Triangle(v.decoration.topLeft, v.decoration.topRight, v.decoration.keystone, COLORS.ACCENT_STONE)); // Reverse

triangles.push(new Triangle(v.archway.outerTop, v.decoration.keystone, v.archway.innerTop, COLORS.ACCENT_STONE));
triangles.push(new Triangle(v.archway.outerTop, v.archway.innerTop, v.decoration.keystone, COLORS.ACCENT_STONE)); // Reverse

// Side walls
triangles.push(new Triangle(v.walls.leftTop, v.walls.leftBottom, v.archway.outerLeft, COLORS.MAIN_STONE));
triangles.push(new Triangle(v.walls.leftTop, v.archway.outerLeft, v.walls.leftBottom, COLORS.MAIN_STONE)); // Reverse

triangles.push(new Triangle(v.walls.rightTop, v.walls.rightBottom, v.archway.outerRight, COLORS.MAIN_STONE));
triangles.push(new Triangle(v.walls.rightTop, v.archway.outerRight, v.walls.rightBottom, COLORS.MAIN_STONE)); // Reverse

// Floor and rubble
triangles.push(new Triangle(v.ground.left, v.ground.center, v.ground.right, COLORS.FLOOR));
triangles.push(new Triangle(v.ground.left, v.ground.right, v.ground.center, COLORS.FLOOR)); // Reverse

// Add rubble pieces
v.ground.debris.forEach(debris => {
    triangles.push(new Triangle(debris, 
        new Vector3(debris.x + RUBBLE_SCALE, debris.y, debris.z),
        new Vector3(debris.x, debris.y, debris.z + RUBBLE_SCALE),
        COLORS.RUBBLE));
    // Reverse face
    triangles.push(new Triangle(debris,
        new Vector3(debris.x, debris.y, debris.z + RUBBLE_SCALE),
        new Vector3(debris.x + RUBBLE_SCALE, debris.y, debris.z),
        COLORS.RUBBLE));
});

// Tunnel depth
triangles.push(new Triangle(v.tunnel.farCenter, v.tunnel.farLeft, v.tunnel.farRight, COLORS.DARK_STONE));
triangles.push(new Triangle(v.tunnel.farCenter, v.tunnel.farRight, v.tunnel.farLeft, COLORS.DARK_STONE)); // Reverse

triangles.push(new Triangle(v.archway.innerTop, v.tunnel.farCenter, v.archway.innerRight, COLORS.DARK_STONE));
triangles.push(new Triangle(v.archway.innerTop, v.archway.innerRight, v.tunnel.farCenter, COLORS.DARK_STONE)); // Reverse

triangles.push(new Triangle(v.archway.innerLeft, v.tunnel.farCenter, v.archway.innerTop, COLORS.DARK_STONE));
triangles.push(new Triangle(v.archway.innerLeft, v.archway.innerTop, v.tunnel.farCenter, COLORS.DARK_STONE)); // Reverse

// Left wall sections
triangles.push(new Triangle(v.leftWalls.outer, v.leftWalls.inner, v.leftWalls.angled, COLORS.MAIN_STONE));
triangles.push(new Triangle(v.leftWalls.outer, v.leftWalls.angled, v.leftWalls.inner, COLORS.MAIN_STONE)); // Reverse

triangles.push(new Triangle(v.leftWalls.inner, v.leftWalls.lower, v.leftWalls.deep, COLORS.DARK_STONE));
triangles.push(new Triangle(v.leftWalls.inner, v.leftWalls.deep, v.leftWalls.lower, COLORS.DARK_STONE)); // Reverse

// Right wall sections
triangles.push(new Triangle(v.rightWalls.outer, v.rightWalls.angled, v.rightWalls.inner, COLORS.MAIN_STONE));
triangles.push(new Triangle(v.rightWalls.outer, v.rightWalls.inner, v.rightWalls.angled, COLORS.MAIN_STONE)); // Reverse

triangles.push(new Triangle(v.rightWalls.inner, v.rightWalls.deep, v.rightWalls.lower, COLORS.DARK_STONE));
triangles.push(new Triangle(v.rightWalls.inner, v.rightWalls.lower, v.rightWalls.deep, COLORS.DARK_STONE)); // Reverse

// Ceiling sections
triangles.push(new Triangle(v.ceiling.peak, v.ceiling.leftEdge, v.ceiling.rightEdge, COLORS.MAIN_STONE));
triangles.push(new Triangle(v.ceiling.peak, v.ceiling.rightEdge, v.ceiling.leftEdge, COLORS.MAIN_STONE)); // Reverse

triangles.push(new Triangle(v.ceiling.peak, v.ceiling.backPeak, v.ceiling.leftEdge, COLORS.DARK_STONE));
triangles.push(new Triangle(v.ceiling.peak, v.ceiling.leftEdge, v.ceiling.backPeak, COLORS.DARK_STONE)); // Reverse

// Alcoves
triangles.push(new Triangle(v.alcoves.leftUpper, v.alcoves.leftLower, v.leftWalls.inner, COLORS.DEEP_SHADOW));
triangles.push(new Triangle(v.alcoves.leftUpper, v.leftWalls.inner, v.alcoves.leftLower, COLORS.DEEP_SHADOW)); // Reverse

triangles.push(new Triangle(v.alcoves.rightUpper, v.rightWalls.inner, v.alcoves.rightLower, COLORS.DEEP_SHADOW));
triangles.push(new Triangle(v.alcoves.rightUpper, v.alcoves.rightLower, v.rightWalls.inner, COLORS.DEEP_SHADOW)); // Reverse

// Connecting triangles for depth
triangles.push(new Triangle(v.leftWalls.deep, v.ceiling.backPeak, v.rightWalls.deep, COLORS.DEEP_SHADOW));
triangles.push(new Triangle(v.leftWalls.deep, v.rightWalls.deep, v.ceiling.backPeak, COLORS.DEEP_SHADOW)); // Reverse        
     
// Main black shape triangles
triangles.push(new Triangle(v.body.peak, v.points.topSpike, v.points.frontSpike, COLORS.MAIN_BLACK));
triangles.push(new Triangle(v.body.peak, v.points.frontSpike, v.points.topSpike, COLORS.MAIN_BLACK)); // Reverse

triangles.push(new Triangle(v.body.front, v.points.frontSpike, v.points.lowerSpike, COLORS.MAIN_BLACK));
triangles.push(new Triangle(v.body.front, v.points.lowerSpike, v.points.frontSpike, COLORS.MAIN_BLACK)); // Reverse

triangles.push(new Triangle(v.body.bottom, v.body.back, v.points.backSpike, COLORS.MAIN_BLACK));
triangles.push(new Triangle(v.body.bottom, v.points.backSpike, v.body.back, COLORS.MAIN_BLACK)); // Reverse

// Inner brown accent triangles
triangles.push(new Triangle(v.inner.center, v.inner.upper, v.inner.lower, COLORS.ACCENT_BROWN));
triangles.push(new Triangle(v.inner.center, v.inner.lower, v.inner.upper, COLORS.ACCENT_BROWN)); // Reverse

// Red line triangles (thin to appear as lines)
triangles.push(new Triangle(v.line.top, v.line.right, new Vector3(v.line.right.x, v.line.right.y + 0.1, 0), COLORS.ACCENT_RED));
triangles.push(new Triangle(v.line.right, v.line.bottom, new Vector3(v.line.bottom.x, v.line.bottom.y + 0.1, 0), COLORS.ACCENT_RED));
        
// Front face
triangles.push(new Triangle(v.mesh.frontLeft, v.mesh.frontTop, v.mesh.frontRight, COLORS.DARK_STONE));
triangles.push(new Triangle(v.mesh.frontLeft, v.mesh.frontRight, v.mesh.frontTop, COLORS.DARK_STONE)); // Reverse

triangles.push(new Triangle(v.mesh.frontLeft, v.mesh.frontBottom, v.mesh.frontRight, COLORS.DARK_STONE));
triangles.push(new Triangle(v.mesh.frontLeft, v.mesh.frontRight, v.mesh.frontBottom, COLORS.DARK_STONE)); // Reverse

// Back face
triangles.push(new Triangle(v.mesh.backLeft, v.mesh.backTop, v.mesh.backRight, COLORS.DARK_STONE));
triangles.push(new Triangle(v.mesh.backLeft, v.mesh.backRight, v.mesh.backTop, COLORS.DARK_STONE)); // Reverse

triangles.push(new Triangle(v.mesh.backLeft, v.mesh.backBottom, v.mesh.backRight, COLORS.DARK_STONE));
triangles.push(new Triangle(v.mesh.backLeft, v.mesh.backRight, v.mesh.backBottom, COLORS.DARK_STONE)); // Reverse

// Connecting sides
triangles.push(new Triangle(v.mesh.frontLeft, v.mesh.backLeft, v.mesh.frontTop, COLORS.DARK_STONE));
triangles.push(new Triangle(v.mesh.frontLeft, v.mesh.frontTop, v.mesh.backLeft, COLORS.DARK_STONE)); // Reverse

triangles.push(new Triangle(v.mesh.frontRight, v.mesh.backRight, v.mesh.frontTop, COLORS.DARK_STONE));
triangles.push(new Triangle(v.mesh.frontRight, v.mesh.frontTop, v.mesh.backRight, COLORS.DARK_STONE)); // Reverse

// Bottom connections
triangles.push(new Triangle(v.mesh.frontBottom, v.mesh.backBottom, v.mesh.frontLeft, COLORS.DARK_STONE));
triangles.push(new Triangle(v.mesh.frontBottom, v.mesh.frontLeft, v.mesh.backBottom, COLORS.DARK_STONE)); // Reverse

triangles.push(new Triangle(v.mesh.frontBottom, v.mesh.backBottom, v.mesh.frontRight, COLORS.DARK_STONE));
triangles.push(new Triangle(v.mesh.frontBottom, v.mesh.frontRight, v.mesh.backBottom, COLORS.DARK_STONE)); // Reverse
*/
        const characterModel = GLBLoader.loadModel(dungeonModel);
        
        const triangles = characterModel.triangles;
        
        super(physicsWorld, triangles);
        
        this.animator = new ModelAnimationController(characterModel);
        this.animator.play(0, true);
        
        // Physics setup
        const shape = new Goblin.BoxShape(width / 2, height / 2, depth / 2);
        this.body = new Goblin.RigidBody(shape, 0);
        this.body.position.set(position.x, position.y + hh, position.z);
        this.body.addListener(
            'contact',
            function( other_body, contact ) {
                // this body has come in `contact with` other_body and the details are provided by `contact`
                console.log("Dungeon");
                // Queue the mode switch for next frame
                requestAnimationFrame(() => {
                    worldMode.gameModeManager.switchMode('battle');
                });
            }
        );
        this.physicsWorld.addObject(this); // Add self to world
    }
}