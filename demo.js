/**
 * Welcome to the Action Engine!
 * The Action Engine simplifies the game development process by abstracting away the complexities of setting up and managing common "video game" software components. These vital systems can be tedious to implement, and really take the fun out of game development.
 * All essential systems are already initialized by Action Engine, including input, audio, and other background systems to allow developers to bypass several frustrating hurdles associated with creating and maintaining these neccesary (but boring) software mechanisms.
 * This allows the developer to focus on one thing: THE GAME! With the messy stuff out of the way, we can get right to the fun part!
 * The following DEMO is just an EXAMPLE of how to work with the Action Engine. All systems are well documented and heavily explained so there's no guesswork. By the end of this reading, you'll be a game making pro.
 * So dive in and start creating a masterpiece!
 */

/** THE GAME CLASS
 * The Game class is the heart of the Action Engine and serves as the entry point for your game.
 * Action Engine aims to let developers work in a way where the only domain is the Game class.
 * It is the ONLY required class, but any classes that will become intertwined with Game are welcome. Speaking of dependancies..
 * Like many popular game engines, Action Engine supplies three fully featured mathematic classes to assist with common video game operations.
 * There are 3 engine-provided math classes that the developer can depend on. `Vector2` `Vector3` and `Matrix4`. These are fully-featured, though not fully demonstrated.
 * Along with input and audio, these are the ONLY additonal classes that fall within the developer's expected available API playground.
 * There will still need to be some heavy lifting with any other classes, logic, or math that needs to be handled on a game by game basis.
 */

/**
 * class Game {}
 *
 * When the Game class is constructed, Action Engine will pass necessary information like rendering canvases and references to the input and audio systems.
 * The developer can easily integrate with and control these systems without worrying about configuration or maintenance, just focus on the game logic (and rendering).
 **/
class Game {
	/******* Action Engine Game Class Constructor *******/
	constructor(canvases, input, audio) {
		/*********
		 * Action Engine requires the Game constructor to accept the following parameters:
		 *
		 * `canvases`: An object with three properties - gameCanvas, guiCanvas, and debugCanvas
		 *
		 * These are the three layers that make up the Action Engine canvas rendering system
		 * The canvases are automatically created and managed in the background, no need to setup your screen or anything related to window sizes or anything, it's all handled
		 * This system allows for easy and clear separation of UI elements and actual game content, which is often a headache especially when prototyping and needing to come back to add additional layers
		 * The guiCanvas and debugCanvas are set by the engine to be 2d contexts, to always give developers an option for 2d overlays
		 * The guiCanvas is an optional layer that is by default hidden, but can be toggled with the (ActionDebugToggle) key (defaulted to f9) allowing for the developer to have a clear and separated canvas for debug related info
		 * This separation allows for the developer to choose whether they want a 2d or 3d game with 2d overlays, there is plenty of room for everything
		 *
		 * `input`: The input system of the Action Engine
		 *
		 * This system seamlessly handles keyboard, mouse, and touch input in the background
		 * It provides an automatic and intuitive way for developers to detect input from a variety ofstandard input devices
		 * This allows the developer to worry less about what key does what or how the UI is handled, or the hassles of trying to implement addtional input device support, it's already done!
		 * To interface with the input system, Action Engine has a simple to use API which we will be showcased here in this DEMO.
		 *
		 * `audio`: The audio system of the Action Engine
		 *
		 * Sound really AMPS up a game's presentation!
		 * Action Engine handles sound generation and playback with comprehensive volume control, callback support, and repeat functionality built right in.
		 * The audio system provides individual sound volume control, automatic stacking prevention, sound completion callbacks, and flexible repeat options.
		 * Sound creation is very flexible, with midi instrument sample support for high quality sounds, so you don't need to search around on any sketchy sites for questionably royalty free .wav files
		 * The developer can get creative with the synth sampling and other sound types through an easy to use API, which will be demonstrated throughout this demo
		 * All that with full control over every aspect of audio playback? That's the power of Action Engine!
		 **/

		/************ Core Systems ************/

		// Canvas initialization

		// The DEMO stores references to core engine systems
		this.input = input; // Handles keyboard, mouse, and touch input
		this.audio = audio; // Manages sound generation and playback

		// The main "game" canvas layer
		this.gameCanvas = canvases.gameCanvas; // This is the game canvas. We can grab a 2D or 3D (webgl) context from it, whichever is appropriate for your game.
		
		 // For our DEMO we will be using a 3D context
		this.gl = this.gameCanvas.getContext("webgl2") || this.gameCanvas.getContext("webgl");
		
		// But you could just as easily use a 2D context for a 2D game
		// this.gameCtx = this.gameCanvas.getContext("2d");
		
		// The two additional canvas layers have already had their context chosen for you and are fixed as 2D contexts.
		// They are provided in `canvases` for when you need to reference the canvas objects and not the context.
		this.guiCanvas = canvases.guiCanvas; // !!!ALWAYS 2D!!! overlay for UI elements like menus and HUD
		this.debugCanvas = canvases.debugCanvas; // !!!ALWAYS 2D!!! overlay for development/debugging visualization

		// The GUI Context (2D overlay)
		this.guiCtx = canvases.guiCtx; // Always a 2D context for UI elements

		// The Debug Context (2D overlay)
		this.debugCtx = canvases.debugCtx; // Always a 2D context for debugging

		/************ Initialize 3D Rendering and Physics World ************/
		// Initialize 3D renderer - this handles all WebGL complexity for us!
		this.renderer3D = new ActionRenderer3D(this.gameCanvas);

		// Initialize physics world - handles all physics calculations
		this.physicsWorld = new ActionPhysicsWorld3D();

		// Setup camera - starts in free mode until character is spawned
		this.camera = new ActionCamera();
		this.camera.position = new Vector3(0, 15, -30);
		this.camera.target = new Vector3(0, 0, 0);
		this.camera.isDetached = true; // Set camera to detached mode initially

		// Player is null until spawned
		this.player = null;

		/******** Debug Overlay Configuration ********/
		// Configuration options for the debug overlay
		// This layer displays debug info and hosts our 2D mini-game when toggled!
		this.messages = []; // Array of debug messages to display
		this.maxMessages = 20; // Maximum number of messages to keep in history
		this.lineHeight = 20; // Vertical pixels between debug message lines
		this.padding = 10; // Padding around debug message area
		this.showDebug = false; // Toggle debug overlay visibility

		/*********** Demo Stats Tracking ************/
		// The DEMO tracks click stats for the purpose of demonstrating some simple game logic
		this.totalClicks = 0; // Count of total button clicks
		this.totalButtons = 4; // Number of interactive buttons (includes spawn button)

		/*********** Simple Text Input ************/
		// Canvas-based text input that respects the 800x600 coordinate system
		this.textInputVisible = false;
		this.textInputValue = '';
		this.textInputCursor = 0;
		this.textInputBlinkTime = 0;

		/*********** 2D Game Elements (for debug overlay) ************/
		// Here the DEMO utilizes the built-in Vector2 class to setup the playable 2D character
		// Ship properties (for the 2D game that appears behind debug overlay)
		this.shipPosition = Vector2.create(Game.WIDTH / 2, Game.HEIGHT / 2); // Engine provides Vector2 classes for common 2D operations
		this.shipRotation = 0; // in radians
		this.shipVelocity = Vector2.create();
		this.shipDirection = Vector2.create(0, -1); // Pointing up initially
		this.rotationSpeed = 0.05;
		this.thrust = 0.05;
		this.friction = 0.98;

		// Soccer ball properties (for the 2D game)
		this.ballPosition = Vector2.create(300, 300);
		this.ballVelocity = Vector2.create(2, 1);
		this.ballRadius = 20;
		this.ballRotation = 0;
		this.ballSpinSpeed = 0.03;

		// Last time for delta time calculation
		this.lastTime = performance.now();

		/*********** Initializing Demo Components ********/
		// Set up basic 3D physics objects
		this.setupDemoObjects();

		// Initialize GUI elements and interactive buttons
		this.initializeInteractiveElements();

		// Setup simple text input
		this.setupTextInput();

		// Create sounds for the demo
		this.createGameSounds();

		console.log("[Demo Game] Initialization completed");
	}

	/******* Fixed Coordinate System *******
	 * Internally, the Action Engine uses an 800x600 canvas using fixed dimensions.
	 * The DEMO uses this to it's advantage to reference and position everything by these constants.
	 * This allows for the developer to be worry free about resolution scaling or any of the headaches that come
	 * with viewports, different screen sizes, canvas scaling, aspect ratio, and the like. Forget about it!
	 * Action Engine uses a fixed 4:3 aspect ratio and handles all window resizing and other internal "screen"
	 * handling, leaving the developer a simple way to manage positioning that is straight forward.
	 * In the DEMO, these are stored and are put to use in future positioning calculations:
	 *******/
	static WIDTH = 800;
	static HEIGHT = 600;

	/**
	 * Sets up the basic physics objects for the 3D scene
	 */
	/**
	 * Sets up the basic physics objects for the 3D scene
	 * 
	 * DEMONSTRATES NEW SINGLE COLOR SYSTEM:
	 * - Sphere: White by default (was black/white checkerboard)
	 * - Capsule: Red by default (was red/blue checkerboard) 
	 * - Box: Green by default (was rainbow faces)
	 * 
	 * All shapes now use consistent single-color defaults with optional customization.
	 */
	setupDemoObjects() {
		// Create essential shapes for our 3D world with new color support!
		this.ground = this.createGround();
		
		// Demonstrate the new single color system:
		this.box = this.createBox(5, 5, 5, 1, new Vector3(0, 15, 0), "#FF6B6B"); // Custom red box
		this.sphere = this.createSphere(3, 1, new Vector3(8, 20, 0)); // Default white sphere
		
		// Capsule with custom color (height=8 > 2*radius=3 ✓ valid)
		this.capsule = this.createCapsule(1.5, 8, 1, new Vector3(-8, 18, 0), "#45B7D1"); // Custom blue capsule

		this.addMessage("[Game] Created colorful physics objects with new single-color system!");
	}

	/**
	 * Here the DEMO Adds a timestamped message to the debug message queue
	 * Maintains maximum message limit by removing oldest messages to display on the debugCanvas
	 */
	addMessage(msg) {
		this.messages.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
		if (this.messages.length > this.maxMessages) {
			this.messages.pop();
		}
	}

	/*** Physics object creation methods ***/

	/**
	 * Create a box with physics - Single Color System
	 * 
	 * BREAKING CHANGE: Boxes now default to green instead of rainbow faces.
	 * 
	 * Supports multiple color options:
	 * - null: Green default (consistent with other shapes)
	 * - string: Single color for all faces ("#FF0000")
	 * - array: Custom color per face (["#FF0000", "#00FF00", ...])
	 * 
	 * @param {number} width - Box width (default: 5)
	 * @param {number} height - Box height (default: 5) 
	 * @param {number} depth - Box depth (default: 5)
	 * @param {number} mass - Physics mass (default: 1)
	 * @param {Vector3} position - World position (default: 0,15,0)
	 * @param {string|Array|null} color - Color option or null for green default
	 * @returns {ActionPhysicsBox3D} The created box
	 */
	createBox(width = 5, height = 5, depth = 5, mass = 1, position = new Vector3(0, 15, 0), color = null) {
		// Only pass color if it's not null, let constructor use its green default
		// This prevents null from overriding the constructor's default behavior
		const box = color !== null 
			? new ActionPhysicsBox3D(this.physicsWorld, width, height, depth, mass, position, color)
			: new ActionPhysicsBox3D(this.physicsWorld, width, height, depth, mass, position);
		this.physicsWorld.addObject(box);
		return box;
	}

	/**
	 * Create a sphere with physics - Single Color System
	 * 
	 * @param {number} radius - Sphere radius (default: 3)
	 * @param {number} mass - Physics mass (default: 1) 
	 * @param {Vector3} position - World position (default: 8,20,0)
	 * @param {string|null} color - Hex color like "#FF0000" or null for default white
	 * @returns {ActionPhysicsSphere3D} The created sphere
	 */
	createSphere(radius = 3, mass = 1, position = new Vector3(8, 20, 0), color = null) {
		// Only pass color if it's not null, let constructor use its default (#FFFFFF)
		// This prevents null from overriding the constructor's default color
		const sphere = color !== null 
			? new ActionPhysicsSphere3D(this.physicsWorld, radius, mass, position, color)
			: new ActionPhysicsSphere3D(this.physicsWorld, radius, mass, position);
		this.physicsWorld.addObject(sphere);
		return sphere;
	}

	/**
	 * Create a capsule with physics - Single Color System
	 * 
	 * IMPORTANT: height must be > 2 × radius or physics library will throw error!
	 * 
	 * @param {number} radius - Capsule radius (default: 2)
	 * @param {number} height - Total height including caps - MUST be > 2×radius (default: 10)
	 * @param {number} mass - Physics mass (default: 1)
	 * @param {Vector3} position - World position (default: 0,15,0)
	 * @param {string|null} color - Hex color like "#FF0000" or null for default red
	 * @returns {ActionPhysicsCapsule3D} The created capsule
	 */
	createCapsule(radius = 2, height = 10, mass = 1, position = new Vector3(0, 15, 0), color = null) {
		// Only pass color if it's not null, let constructor use its default (#E94B3C)
		// This prevents null from overriding the constructor's default color
		const capsule = color !== null 
			? new ActionPhysicsCapsule3D(this.physicsWorld, radius, height, mass, position, color)
			: new ActionPhysicsCapsule3D(this.physicsWorld, radius, height, mass, position);
		this.physicsWorld.addObject(capsule);
		return capsule;
	}

	/**
	 * Create a cone with physics - Single Color System
	 * 
	 * @param {number} radius - Cone base radius (default: 2)
	 * @param {number} height - Cone height (default: 10)
	 * @param {number} mass - Physics mass (default: 1)
	 * @param {Vector3} position - World position (default: 0,15,0)
	 * @param {string|null} color - Hex color like "#FF0000" or null for default orange
	 * @returns {ActionPhysicsCone3D} The created cone
	 */
	createCone(radius = 2, height = 10, mass = 1, position = new Vector3(0, 15, 0), color = null) {
		// Only pass color if it's not null, let constructor use its default (#FFA500)
		// This prevents null from overriding the constructor's default color
		const cone = color !== null 
			? new ActionPhysicsCone3D(this.physicsWorld, radius, height, mass, position, color)
			: new ActionPhysicsCone3D(this.physicsWorld, radius, height, mass, position);
		this.physicsWorld.addObject(cone);
		return cone;
	}

	// Create a ground plane (actually just a flat box)
	createGround(size = 100, position = new Vector3(0, -0.5, 0)) {
		// Simply use our box creation method with a flat box shape
		// Using 0 mass to make it static (won't move)
		return this.createBox(
			size, // width - very wide
			1, // height - just 1 unit tall
			size, // depth - very deep
			0, // mass - 0 means static object
			position // position - slightly below zero by default
		);
	}
	
	/******* PROCEDURAL SAILBOAT CREATION USING GEOMETRYBUILDER *******/
	/**
	 * Creates a procedural sailboat using the smart GeometryBuilder triangle winding system
	 * 
	 * This method demonstrates the power of GeometryBuilder for creating complex 3D objects
	 * without worrying about triangle winding. The DEMO creates a sailboat with:
	 * - Hull (boat body) with proper boat-shaped geometry
	 * - Mast (vertical pole) for structural realism
	 * - Sail (triangular cloth) with double-sided rendering
	 * 
	 * KEY GEOMETRYBUILDER INSIGHT: Reference points must match actual geometry centers!
	 * When you set a reference point, make sure it's positioned where your geometry actually is.
	 * This allows GeometryBuilder to automatically calculate correct triangle winding.
	 * 
	 * @param {number} scale - Size multiplier for the entire sailboat
	 * @param {number} mass - Physics mass (affects how it falls and bounces)
	 * @param {Vector3} position - World position to spawn the sailboat
	 * @returns {ActionPhysicsMesh3D} - The sailboat physics object with mesh collision
	 */
	createSailboat(scale = 1, mass = 2, position = new Vector3(0, 15, 0)) {
		this.addMessage(`[DEMO] Creating procedural sailboat with GeometryBuilder (scale: ${scale.toFixed(2)})`);
		
		/******* GEOMETRYBUILDER INITIALIZATION *******/
		// The GeometryBuilder handles smart triangle winding automatically
		// No more manual clockwise/counterclockwise triangle headaches!
		const builder = new GeometryBuilder();
		
		/******* GEOMETRY DATA ARRAYS *******/
		// These arrays will hold our raw geometry data before conversion to physics objects
		const vertices = [];  // Flat array: [x1,y1,z1, x2,y2,z2, ...]
		const normals = [];   // Normals for lighting (filled automatically)
		const colors = [];    // RGB colors for each vertex [r,g,b, r,g,b, ...]
		const indices = [];   // Triangle indices pointing to vertices [i1,i2,i3, ...]
		
		/******* MATERIAL COLOR DEFINITIONS *******/
		// The DEMO uses realistic colors to make the sailboat visually appealing
		const hullColor = [0.6, 0.3, 0.1]; // Rich brown hull
		const sailColor = [0.9, 0.9, 0.9]; // Clean white sail
		const mastColor = [0.4, 0.2, 0.1]; // Dark brown mast
		
		/******* HULL CONSTRUCTION (BOAT BODY) *******/
		// The hull is the main body of the sailboat. The DEMO creates a boat-shaped hull
		// with a pointed front and back, wider middle, and proper 3D depth.
		
		// Calculate hull dimensions based on scale
		const hullLength = 6 * scale;  // Length from bow to stern
		const hullWidth = 2 * scale;   // Width at the widest point
		const hullHeight = 1 * scale;  // Height from bottom to deck
		
		// CRITICAL: Set reference point to the ACTUAL center of the hull geometry!
		// This allows GeometryBuilder to automatically determine correct winding
		builder.setReferencePoint({x: 0, y: hullHeight/2, z: 0}); // Real hull center
		
		// Create boat-shaped hull bottom
		// The DEMO creates a simple boat shape: pointed at front/back, wider in middle
		vertices.push(
			-hullLength/2, 0, 0,           // 0: Bow
			-hullLength/3, 0, -hullWidth/2, // 1: Front port side
			-hullLength/3, 0, hullWidth/2,  // 2: Front starboard side
			hullLength/3, 0, -hullWidth/2,  // 3: Rear port side
			hullLength/3, 0, hullWidth/2,   // 4: Rear starboard side
			hullLength/2, 0, 0             // 5: Stern
		);
		
		// Create deck level (top of hull) - same boat shape elevated to deck height
		// This creates the deck where crew would stand and sail equipment is mounted
		vertices.push(
			-hullLength/2, hullHeight, 0,           // 6: Deck bow
			-hullLength/3, hullHeight, -hullWidth/2, // 7: Deck front port
			-hullLength/3, hullHeight, hullWidth/2,  // 8: Deck front starboard
			hullLength/3, hullHeight, -hullWidth/2,  // 9: Deck rear port
			hullLength/3, hullHeight, hullWidth/2,   // 10: Deck rear starboar
			hullLength/2, hullHeight, 0             // 11: Deck stern
		);
		
		// Apply hull material properties to all hull vertices
		// The DEMO gives each vertex a normal (for lighting) and color (for appearance)
		for (let i = 0; i < 12; i++) {
			normals.push(0, 1, 0); // Temporary normals (will be calculated properly by renderer)
			colors.push(...hullColor); // Apply rich brown wood color to each vertex
		}
		
		// Create hull bottom triangles - GeometryBuilder handles winding automatically!
		// The DEMO shows how easy triangle creation becomes with GeometryBuilder
		builder.createTriangle(indices, vertices, 0, 1, 2); // Bow triangle
		builder.createTriangle(indices, vertices, 1, 3, 4); // Port side quad (left) - triangle 1
		builder.createTriangle(indices, vertices, 1, 4, 2); // Port side quad (left) - triangle 2
		builder.createTriangle(indices, vertices, 3, 5, 4); // Stern triangle (back point)
		
		// Create hull side walls - connecting bottom to deck level
		// GeometryBuilder.createQuad() automatically makes two triangles with correct winding!
		builder.createQuad(indices, vertices, 0, 6, 7, 1); // Bow port side (front left hull wall)
		builder.createQuad(indices, vertices, 0, 2, 8, 6); // Bow starboard side (front right)
		builder.createQuad(indices, vertices, 1, 7, 9, 3); // Port hull side (left side)
		builder.createQuad(indices, vertices, 2, 4, 10, 8); // Starboard hull side (right side)
		builder.createQuad(indices, vertices, 3, 9, 11, 5); // Stern port side (back left)
		builder.createQuad(indices, vertices, 4, 5, 11, 10); // Stern starboard side (back right)
		
		
		// Hull deck triangles (top) - add after hull sides
		builder.createTriangle(indices, vertices, 6, 8, 7); // deck front face
		builder.createTriangle(indices, vertices, 7, 10, 9); // deck middle quad part 1
		builder.createTriangle(indices, vertices, 7, 8, 10); // deck middle quad part 2
		builder.createTriangle(indices, vertices, 9, 10, 11); // deck back face
		
		/******* MAST CONSTRUCTION (VERTICAL SUPPORT) *******/
		// The mast is the tall vertical pole that supports the sail
		// The DEMO creates a simple rectangular mast for structural clarity
		
		// Calculate mast dimensions
		const mastHeight = 5 * scale;  // Tall enough to support a good-sized sail
		const mastRadius = 0.1 * scale; // Thin but visible thickness
		
		// Update reference point to the ACTUAL center of the mast
		// This ensures GeometryBuilder calculates correct winding for mast faces
		builder.setReferencePoint({x: 0, y: hullHeight + mastHeight/2, z: 0}); // Real mast center
		const mastBase = vertices.length / 3;
		
		// Simple mast (just a thin vertical cylinder, simplified as box)
		vertices.push(
			-mastRadius, hullHeight, -mastRadius,  // base
			mastRadius, hullHeight, -mastRadius,
			mastRadius, hullHeight, mastRadius,
			-mastRadius, hullHeight, mastRadius,
			-mastRadius, hullHeight + mastHeight, -mastRadius,  // top
			mastRadius, hullHeight + mastHeight, -mastRadius,
			mastRadius, hullHeight + mastHeight, mastRadius,
			-mastRadius, hullHeight + mastHeight, mastRadius
		);
		
		for (let i = 0; i < 8; i++) {
			normals.push(0, 1, 0);
			colors.push(...mastColor);
		}
		
		// Mast faces
		builder.createQuad(indices, vertices, mastBase, mastBase+1, mastBase+5, mastBase+4); // front
		builder.createQuad(indices, vertices, mastBase+1, mastBase+2, mastBase+6, mastBase+5); // right
		builder.createQuad(indices, vertices, mastBase+2, mastBase+3, mastBase+7, mastBase+6); // back
		builder.createQuad(indices, vertices, mastBase+3, mastBase, mastBase+4, mastBase+7); // left
		
		/******* SAIL CONSTRUCTION (TRIANGULAR CLOTH) *******/
		// The sail catches wind to propel the sailboat forward
		// The DEMO creates a classic triangular sail attached to the mast
		
		// Calculate sail dimensions for realistic proportions
		const sailWidth = 3 * scale;  // Width extending from mast outward
		const sailHeight = 4 * scale; // Height along the mast
		
		// Position reference point at the ACTUAL center of the triangular sail
		// This is critical for proper triangle winding on the sail surface
		const sailCenterY = hullHeight + mastHeight*0.5; // Middle height of sail area
		builder.setReferencePoint({x: sailWidth/2, y: sailCenterY, z: 0}); // Real sail center
		const sailBase = vertices.length / 3;
		
		// Create triangular sail geometry - classic sailboat sail shape
		// The DEMO positions the sail to catch wind effectively
		vertices.push(
			0, hullHeight + mastHeight*0.8, 0,         // Sail peak (top point attached high on mast)
			sailWidth, hullHeight + mastHeight*0.2, 0, // Sail clew (bottom outer corner)
			0, hullHeight + mastHeight*0.2, 0          // Sail tack (bottom corner at mast)
		);
		
		for (let i = 0; i < 3; i++) {
			normals.push(0, 0, 1);
			colors.push(...sailColor);
		}
		
		// Create double-sided sail triangle for realistic appearance
		// Double-sided = visible from both port and starboard sides
		// GeometryBuilder automatically creates both windings!
		builder.createTriangle(indices, vertices, sailBase, sailBase+1, sailBase+2, false, true);
		
		/******* PHYSICS INTEGRATION *******/
		// Convert our GeometryBuilder output to ActionEngine physics object
		// The DEMO uses GeometryBuilder's built-in physics integration!
		return builder.createPhysicsObject(this.physicsWorld, vertices, normals, colors, indices, mass, position);
	}
	
	/******* PROCEDURAL AIRPLANE CREATION USING GEOMETRYBUILDER *******/
	/**
	 * Creates a detailed procedural airplane using GeometryBuilder's smart triangle winding
	 * 
	 * This method showcases GeometryBuilder's power for complex multi-component objects.
	 * The DEMO constructs a realistic airplane with:
	 * - Fuselage (main body) with proper aerodynamic proportions
	 * - Main wings (port and starboard) for lift generation
	 * - Tail fin (vertical stabilizer) for directional stability
	 * - Horizontal stabilizer for pitch control
	 * - Propeller assembly for forward thrust
	 * - Landing gear for ground operations
	 * 
	 * GEOMETRYBUILDER BEST PRACTICE: Each component gets its own reference point!
	 * This ensures perfect triangle winding for every airplane part automatically.
	 * 
	 * @param {number} scale - Size multiplier for the entire aircraft
	 * @param {number} mass - Physics mass (affects flight dynamics in physics simulation)
	 * @param {Vector3} position - World position to spawn the airplane
	 * @returns {ActionPhysicsMesh3D} - Complete airplane with accurate mesh collision
	 */
	createAirplane(scale = 1, mass = 3, position = new Vector3(0, 15, 0)) {
		this.addMessage(`✈️ [DEMO] Creating detailed procedural airplane with GeometryBuilder (scale: ${scale.toFixed(2)})`);
		
		/******* GEOMETRYBUILDER INITIALIZATION *******/
		// Advanced multi-component geometry requires careful reference point management
		const builder = new GeometryBuilder();
		
		/******* GEOMETRY DATA ARRAYS *******/
		const vertices = [];  // All airplane vertices in one array
		const normals = [];   // Lighting normals for each vertex
		const colors = [];    // Material colors for each vertex
		const indices = [];   // Triangle indices for all airplane parts
		
		/******* AIRCRAFT MATERIAL DEFINITIONS *******/
		// The DEMO uses aviation-inspired colors for visual realism
		const fuselageColor = [0.9, 0.9, 0.9];  // Clean white fuselage (like commercial aircraft)
		const wingColor = [0.8, 0.1, 0.1];      // Bold red wings (for visibility)
		const tailColor = [0.1, 0.1, 0.8];      // Blue tail (contrasting accent)
		const propColor = [0.2, 0.2, 0.2];      // Dark gray propeller (metal)
		const gearColor = [0.1, 0.1, 0.1];      // Black landing gear (rubber/metal)
		
		/******* FUSELAGE CONSTRUCTION (MAIN AIRCRAFT BODY) *******/
		// The fuselage houses crew, passengers, and equipment
		// The DEMO creates a streamlined body for realistic appearance
		
		// Calculate fuselage dimensions with proper aircraft proportions
		const fuselageLength = 6 * scale;   // Length from nose to tail
		const fuselageHeight = 1.2 * scale; // Height for crew compartment
		const fuselageWidth = 1.0 * scale;  // Width for structural integrity
		
		// CRITICAL: Position reference point at the TRUE center of fuselage geometry
		builder.setReferencePoint({x: 0, y: 0, z: 0}); // Actual fuselage center
		
		// Create streamlined fuselage with tapered nose and tail
		// Front section (nose) - narrower for aerodynamics
		const noseWidth = fuselageWidth * 0.3;
		const noseHeight = fuselageHeight * 0.5;
		vertices.push(
			-fuselageLength/2, -noseHeight/2, -noseWidth/2,  // 0: Nose bottom left
			-fuselageLength/2, -noseHeight/2, noseWidth/2,   // 1: Nose bottom right
			-fuselageLength/2, noseHeight/2, noseWidth/2,    // 2: Nose top right
			-fuselageLength/2, noseHeight/2, -noseWidth/2    // 3: Nose top left
		);
		
		// Middle section (crew compartment) - full size for maximum volume
		vertices.push(
			-fuselageLength/6, -fuselageHeight/2, -fuselageWidth/2, // 4: Mid front bottom left
			-fuselageLength/6, -fuselageHeight/2, fuselageWidth/2,  // 5: Mid front bottom right
			-fuselageLength/6, fuselageHeight/2, fuselageWidth/2,   // 6: Mid front top right
			-fuselageLength/6, fuselageHeight/2, -fuselageWidth/2,  // 7: Mid front top left
			fuselageLength/6, -fuselageHeight/2, -fuselageWidth/2,  // 8: Mid rear bottom left
			fuselageLength/6, -fuselageHeight/2, fuselageWidth/2,   // 9: Mid rear bottom right
			fuselageLength/6, fuselageHeight/2, fuselageWidth/2,    // 10: Mid rear top right
			fuselageLength/6, fuselageHeight/2, -fuselageWidth/2    // 11: Mid rear top left
		);
		
		// Rear section (tail) - tapered for clean airflow
		const tailWidth = fuselageWidth * 0.4;
		const tailHeight = fuselageHeight * 0.6;
		vertices.push(
			fuselageLength/2, -tailHeight/2, -tailWidth/2,  // 12: Tail bottom left
			fuselageLength/2, -tailHeight/2, tailWidth/2,   // 13: Tail bottom right
			fuselageLength/2, tailHeight/2, tailWidth/2,    // 14: Tail top right
			fuselageLength/2, tailHeight/2, -tailWidth/2    // 15: Tail top left
		);
		
		// Apply fuselage material to all fuselage vertices
		for (let i = 0; i < 16; i++) {
			normals.push(0, 1, 0); // Temporary normals
			colors.push(...fuselageColor); // Clean white aircraft finish
		}
		
		// Create fuselage surface triangles - GeometryBuilder handles all winding!
		// Nose section
		builder.createQuad(indices, vertices, 0, 1, 2, 3); // Nose face
		builder.createQuad(indices, vertices, 0, 4, 5, 1); // Nose to mid bottom
		builder.createQuad(indices, vertices, 2, 6, 7, 3); // Nose to mid top
		builder.createQuad(indices, vertices, 0, 3, 7, 4); // Nose to mid left
		builder.createQuad(indices, vertices, 1, 5, 6, 2); // Nose to mid right
		
		// Middle section surfaces
		builder.createQuad(indices, vertices, 4, 8, 9, 5);   // Middle bottom
		builder.createQuad(indices, vertices, 6, 10, 11, 7); // Middle top
		builder.createQuad(indices, vertices, 4, 7, 11, 8);  // Middle left
		builder.createQuad(indices, vertices, 5, 9, 10, 6);  // Middle right
		
		// Tail section
		builder.createQuad(indices, vertices, 8, 12, 13, 9);  // Mid to tail bottom
		builder.createQuad(indices, vertices, 10, 14, 15, 11); // Mid to tail top
		builder.createQuad(indices, vertices, 8, 11, 15, 12); // Mid to tail left
		builder.createQuad(indices, vertices, 9, 13, 14, 10); // Mid to tail right
		builder.createQuad(indices, vertices, 12, 15, 14, 13); // Tail face
		
		/******* MAIN WING CONSTRUCTION (PRIMARY LIFT SURFACES) *******/
		// Wings generate lift and house fuel, control surfaces
		// The DEMO creates swept wings for modern aircraft appearance
		
		// Calculate wing dimensions for realistic lift-to-weight ratio
		const wingSpan = 8 * scale;       // Total wingspan (tip to tip)
		const wingChord = 2 * scale;      // Wing depth (front to back)
		const wingThickness = 0.3 * scale; // Wing thickness for fuel storage
		const wingSweep = 0.5 * scale;    // Wing sweep angle for speed
		
		// Wings attach to fuselage at center, so reference point stays centered
		// builder.setReferencePoint() not needed - using same as fuselage
		
		const wingBase = vertices.length / 3;
		
		// Create main wing geometry with realistic airfoil shape
		// Port wing
		vertices.push(
			-wingChord/2 + wingSweep/2, -wingThickness/2, -wingSpan/2, // Port leading edge bottom
			wingChord/2 + wingSweep/2, -wingThickness/2, -wingSpan/2,  // Port trailing edge bottom
			wingChord/2 + wingSweep/2, wingThickness/2, -wingSpan/2,   // Port trailing edge top
			-wingChord/2 + wingSweep/2, wingThickness/2, -wingSpan/2,  // Port leading edge top
			-wingChord/2, -wingThickness/2, 0,                       // Root leading edge bottom
			wingChord/2, -wingThickness/2, 0,                        // Root trailing edge bottom
			wingChord/2, wingThickness/2, 0,                         // Root trailing edge top
			-wingChord/2, wingThickness/2, 0                         // Root leading edge top
		);
		
		// Starboard wing
		vertices.push(
			-wingChord/2, -wingThickness/2, 0,                       // Root leading edge bottom
			wingChord/2, -wingThickness/2, 0,                        // Root trailing edge bottom
			wingChord/2, wingThickness/2, 0,                         // Root trailing edge top
			-wingChord/2, wingThickness/2, 0,                        // Root leading edge top
			-wingChord/2 + wingSweep/2, -wingThickness/2, wingSpan/2, // Starboard leading edge bottom
			wingChord/2 + wingSweep/2, -wingThickness/2, wingSpan/2,  // Starboard trailing edge bottom
			wingChord/2 + wingSweep/2, wingThickness/2, wingSpan/2,   // Starboard trailing edge top
			-wingChord/2 + wingSweep/2, wingThickness/2, wingSpan/2   // Starboard leading edge top
		);
		
		// Apply wing material to all wing vertices
		for (let i = 0; i < 16; i++) {
			normals.push(0, 1, 0);
			colors.push(...wingColor); // Bold red for high visibility
		}
		
		// Create wing surface triangles
		// Port wing surfaces
		builder.createQuad(indices, vertices, wingBase+0, wingBase+1, wingBase+2, wingBase+3); // Port wing tip
		builder.createQuad(indices, vertices, wingBase+4, wingBase+5, wingBase+6, wingBase+7); // Wing root
		builder.createQuad(indices, vertices, wingBase+0, wingBase+4, wingBase+5, wingBase+1); // Port bottom
		builder.createQuad(indices, vertices, wingBase+2, wingBase+6, wingBase+7, wingBase+3); // Port top
		builder.createQuad(indices, vertices, wingBase+0, wingBase+3, wingBase+7, wingBase+4); // Port leading edge
		builder.createQuad(indices, vertices, wingBase+1, wingBase+5, wingBase+6, wingBase+2); // Port trailing edge
		
		// Starboard wing surfaces
		builder.createQuad(indices, vertices, wingBase+8, wingBase+9, wingBase+10, wingBase+11);   // Wing root
		builder.createQuad(indices, vertices, wingBase+12, wingBase+13, wingBase+14, wingBase+15); // Starboard wing tip  
		builder.createQuad(indices, vertices, wingBase+8, wingBase+12, wingBase+13, wingBase+9);   // Starboard bottom
		builder.createQuad(indices, vertices, wingBase+10, wingBase+14, wingBase+15, wingBase+11); // Starboard top
		builder.createQuad(indices, vertices, wingBase+8, wingBase+11, wingBase+15, wingBase+12); // Starboard leading edge
		builder.createQuad(indices, vertices, wingBase+9, wingBase+13, wingBase+14, wingBase+10); // Starboard trailing edge
		
		/******* VERTICAL TAIL FIN (DIRECTIONAL STABILITY) *******/
		// Tail fin prevents airplane from spinning and provides directional control
		
		// Calculate tail dimensions for proper stability
		const tailFinHeight = 3 * scale;
		const tailChord = 1.5 * scale;
		const tailSweep = 0.3 * scale;
		
		// Position reference point at tail fin center
		builder.setReferencePoint({x: fuselageLength/3, y: tailFinHeight/2, z: 0}); // Tail fin center
		
		const tailBase = vertices.length / 3;
		
		// Create vertical tail fin geometry
		vertices.push(
			fuselageLength/3 - tailChord/2, 0, 0,                    // Root leading edge
			fuselageLength/3 + tailChord/2, 0, 0,                    // Root trailing edge
			fuselageLength/3 + tailChord/2 - tailSweep, tailFinHeight, 0, // Tip trailing edge
			fuselageLength/3 - tailChord/2 + tailSweep, tailFinHeight, 0  // Tip leading edge
		);
		
		// Apply tail material
		for (let i = 0; i < 4; i++) {
			normals.push(0, 0, 1);
			colors.push(...tailColor); // Blue tail for contrast
		}
		
		// Create double-sided tail fin (visible from both sides)
		builder.createQuad(indices, vertices, tailBase, tailBase+1, tailBase+2, tailBase+3, false, true);
		
		/******* PROPELLER ASSEMBLY (THRUST GENERATION) *******/
		// Propeller converts engine power into forward thrust
		
		// Calculate propeller dimensions
		const propDiameter = 2.5 * scale;
		const propThickness = 0.1 * scale;
		const propPosition = -fuselageLength/2 - 0.2*scale;
		
		// Position reference point at propeller center
		builder.setReferencePoint({x: propPosition, y: 0, z: 0}); // Propeller center
		
		const propBase = vertices.length / 3;
		
		// Create two-blade propeller (cross pattern)
		// Horizontal blade
		vertices.push(
			propPosition, -propThickness/2, -propDiameter/2, // Horizontal blade bottom left
			propPosition, -propThickness/2, propDiameter/2,  // Horizontal blade bottom right
			propPosition, propThickness/2, propDiameter/2,   // Horizontal blade top right
			propPosition, propThickness/2, -propDiameter/2   // Horizontal blade top left
		);
		
		// Vertical blade
		vertices.push(
			propPosition, -propDiameter/2, -propThickness/2, // Vertical blade bottom left
			propPosition, -propDiameter/2, propThickness/2,  // Vertical blade bottom right
			propPosition, propDiameter/2, propThickness/2,   // Vertical blade top right
			propPosition, propDiameter/2, -propThickness/2   // Vertical blade top left
		);
		
		// Apply propeller material
		for (let i = 0; i < 8; i++) {
			normals.push(-1, 0, 0);
			colors.push(...propColor); // Dark metallic finish
		}
		
		// Create propeller blade surfaces (double-sided for realistic appearance)
		builder.createQuad(indices, vertices, propBase, propBase+1, propBase+2, propBase+3, false, true);   // Horizontal blade - visible from both sides
		builder.createQuad(indices, vertices, propBase+4, propBase+5, propBase+6, propBase+7, false, true); // Vertical blade - visible from both sides
		
		/******* PHYSICS INTEGRATION *******/
		// Convert complete airplane geometry to ActionEngine physics object
		// The DEMO uses GeometryBuilder's built-in physics integration!
		return builder.createPhysicsObject(this.physicsWorld, vertices, normals, colors, indices, mass, position);
	}
	
	/**
	 * Create a random physics object at the given position
	 * 
	 * Spawns random shapes with random colors. Demonstrates the new single-color system
	 * and proper handling of geometry constraints.
	 * 
	 * @param {Vector3} position - World position to spawn the object
	 * @returns {ActionPhysicsObject3D} The created physics object
	 */
	createRandomObject(position) {
		// Enhanced random object creation with all available shapes!
		const objectType = Math.floor(Math.random() * 6); // 0-5 for seven types
		
		// Generate random hex colors for shapes that support them
		// Using hex format (#RRGGBB) required by the renderer
		const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
		
		switch (objectType) {
			case 0: // Sphere (now with color support!)
				const sphereRadius = Math.random() * 3 + 1;
				const sphereMass = Math.random() * 5 + 1;
				this.addMessage(`Spawning colorful sphere!`);
				return this.createSphere(sphereRadius, sphereMass, position, randomColor);
				
			case 1: // Box
				const boxWidth = Math.random() * 4 + 2;
				const boxHeight = Math.random() * 4 + 2;
				const boxDepth = Math.random() * 4 + 2;
				const boxMass = Math.random() * 5 + 1;
				this.addMessage(`Spawning colorful box!`);
				return this.createBox(boxWidth, boxHeight, boxDepth, boxMass, position, randomColor);
				
			case 2: // Capsule (now with single color system!)
				const capsuleRadius = Math.random() * 2 + 1; // 1 to 3
				// CRITICAL: Ensure height > 2*radius to avoid physics constraint violation
				// Formula: height = (2*radius) + extra_height ensures validity
				// Previous bug: random height could be < 2*radius causing crash
				const capsuleHeight = capsuleRadius * 2 + Math.random() * 6 + 2; // Always > 2*radius
				const capsuleMass = Math.random() * 3 + 2;
				this.addMessage(`Spawning colorful capsule!`);
				return this.createCapsule(capsuleRadius, capsuleHeight, capsuleMass, position, randomColor);
				
			case 3: // Cone (now with single color!)
				const coneRadius = Math.random() * 2 + 1; // 1 to 3
				const coneHeight = Math.random() * 8 + 4; // 4 to 12
				const coneMass = Math.random() * 3 + 1; // 1 to 4
				this.addMessage(`Spawning colorful cone!`);
				return this.createCone(coneRadius, coneHeight, coneMass, position, randomColor);
				
			case 4: // Sailboat (GeometryBuilder)
				const sailboatScale = Math.random() * 0.5 + 0.8; // 0.8 to 1.3 scale
				const sailboatMass = Math.random() * 3 + 2; // 2-5 mass
				this.addMessage("Spawning procedural sailboat!");
				return this.createSailboat(sailboatScale, sailboatMass, position);
				
			case 5: // Detailed Airplane (GeometryBuilder)
				const airplaneScale = Math.random() * 0.5 + 0.7; // 0.7 to 1.2 scale
				const airplaneMass = Math.random() * 4 + 2; // 2-6 mass
				this.addMessage("Spawning detailed procedural airplane!");
				return this.createAirplane(airplaneScale, airplaneMass, position);
		}
	}

	/**
	 * Setup canvas-based text input handling
	 */
	setupTextInput() {
		// Add keydown listener for text input when it's visible
		window.addEventListener('keydown', (e) => {
			if (!this.textInputVisible) return;
			
			if (e.key === 'Enter') {
				if (this.textInputValue.trim()) {
					this.addMessage(`[Input] ${this.textInputValue.trim()}`);
					this.textInputValue = '';
					this.textInputCursor = 0;
				}
			} else if (e.key === 'Backspace') {
				if (this.textInputCursor > 0) {
					this.textInputValue = this.textInputValue.slice(0, this.textInputCursor - 1) + 
					                     this.textInputValue.slice(this.textInputCursor);
					this.textInputCursor--;
				}
			} else if (e.key === 'ArrowLeft') {
				this.textInputCursor = Math.max(0, this.textInputCursor - 1);
			} else if (e.key === 'ArrowRight') {
				this.textInputCursor = Math.min(this.textInputValue.length, this.textInputCursor + 1);
			} else if (e.key.length === 1) {
				// Regular character input
				this.textInputValue = this.textInputValue.slice(0, this.textInputCursor) + 
				                     e.key + 
				                     this.textInputValue.slice(this.textInputCursor);
				this.textInputCursor++;
			}
		});
	}

	/**
	 * Spawn a character in the 3D world
	 */
	spawnCharacter() {
		// Create new character if one doesn't exist
		if (!this.player) {
			this.addMessage("Spawning 3D character");
			
			// Initialize first/3rd person character controller
			this.player = new ActionCharacter3D(this.camera, this, new Vector3(0, 40, 0));
			this.physicsWorld.objects.add(this.player.characterModel);

			// Position the character in a good starting location
			if (this.player.characterModel && this.player.characterModel.body) {
				this.player.characterModel.body.position.set(0, 5, 0);
			}

			// Connect camera to player
			this.camera.isDetached = false;

			// Play spawn sound with completion callback
			this.audio.play("spawnSound", {
				volume: 0.8,
				onEnd: () => this.addMessage("Character spawned successfully!")
			});
		}
	}

	/**
	 * action_update() - Hook called by the App class each frame
	 */
	action_update() {
		// Calculate delta time
		const currentTime = performance.now();
		const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25); // Cap at 250ms
		this.lastTime = currentTime;

		// Call our update method with the calculated delta time
		this.update(deltaTime);
	}
	/**
	 * action_fixed_update(fixedDeltaTime) - Hook called by the App class at fixed intervals
	 * 
	 * This method is called at a fixed timestep (typically 1/60 second) regardless of frame rate.
	 * Physics simulations and consistent-timing logic should be placed here for best results.
	 * 
	 * @param {number} fixedDeltaTime - The fixed time step duration in seconds (typically 1/60)
	 */
	action_fixed_update(fixedDeltaTime) {
		// Physics update at fixed timestep
		if (!this.showDebug && this.physicsWorld) {
			// Update physics system
			this.physicsWorld.fixed_update(fixedDeltaTime);
			
			// Update player character physics if it exists
			if (this.player && typeof this.player.fixed_update === 'function') {
				this.player.fixed_update(fixedDeltaTime);
			}
		}
	}

	/**
	 * action_draw() - Hook called by the App class each frame after update
	 */
	action_draw() {
		// Call our draw method
		this.draw();
	}
	/*-----------------
	 * THE THREE-LAYER INPUT SYSTEM:
	 * -----------------
	 * Action Engine uses a sophisticated three-layer input system that mimics how a typical
	 * game's interface is (ideally) structured:
	 *
	 * DEBUG LAYER (Top) -> GUI LAYER (Middle) -> GAME LAYER (Bottom)
	 *
	 * When input events occur, they cascade through these layers in order. If an upper
	 * layer handles the event (like clicking a debug button), lower layers won't receive it.
	 * This prevents background elements from catching input meant for UI or debug controls.
	 *
	 * Each registered element maps to a specific rendering layer, defaulting to:
	 *
	 * - GUI elements (guiCanvas): Menus, HUD, interface components
	 *
	 * The guiCanvas is the default layer target when no explicit layer parameter is passed to registerElement()
	 *
	 * Elements targeting non-default layers require explicit layer specification in registerElement():
	 *
	 * - Debug elements (debugCanvas): Debugging tools, development overlays  [layer='debug']
	 * - Game elements (gameCanvas): In-game objects, playfield interactions  [layer='game']
	 *
	 * The DEMO shows this by having elements on all three layers:
	 * - A debug toggle button on the debug layer
	 * - Menu buttons on the GUI layer
	 * - Clickable game elements on the game layer
	 *
	 * When registering elements, developers can specify which layer they belong to:
	 * registerElement('buttonId', element, 'gui')  // Default layer
	 * registerElement('gameObject', element, 'game')
	 * registerElement('debugButton', element, 'debug')
	 *
	 * Pointer coordinates are automatically translated between layers, so developers
	 * don't need to handle different coordinate spaces or canvas scaling. The input
	 * system provides consistent coordinates across all layers.
	 */

	/**
	 * initializeInteractiveElements()
	 */
	initializeInteractiveElements() {
		/******* BUTTON TEMPLATE SETUP *******/
		// Create a shared template for consistent button styling
		// The developer could have different templates for different button types
		const buttonTemplate = {
			width: 120, // Standard button width - you can customize these!
			height: 40, // Standard button height
			color: "#00f0f0", // Default button color
			hovered: false // Tracks mouse hover state for visual feedback
		};

		/******* CENTERED BUTTON CREATION *******/
		// Main button demonstrates screen-centered positioning
		// Uses Game.WIDTH/HEIGHT for reliable positioning regardless of screen size
		this.button1 = {
			...buttonTemplate, // Use our template as base
			x: (Game.WIDTH - buttonTemplate.width) / 2, // Center horizontally
			y: (Game.HEIGHT - buttonTemplate.height) / 2, // Center vertically
			text: "Click Me 1" // Button label
		};

		/******* FIXED POSITION BUTTONS *******/
		// Secondary buttons showing absolute positioning
		this.button2 = {
			...buttonTemplate,
			x: 340, // Fixed x position
			y: 180, // Fixed y position
			text: "Click Me 2"
		};

		this.button3 = {
			...buttonTemplate,
			x: 340,
			y: 80,
			text: "Click Me 3"
		};

		/******* INACTIVE BUTTON CREATION *******/
		// Create a special button to demonstrate the active/inactive element system
		// This button starts in a disabled state and can be toggled by Button 1
		// Uses different colors to provide clear visual feedback of its current state
		this.inactiveButton = {
			...buttonTemplate, // Share standard button properties
			x: 340, // Fixed x position
			y: 480, // Positioned below other buttons
			text: "Inactive", // Label indicates its purpose
			isActive: false, // Start in disabled state
			color: "#666666" // Grayed out when inactive
		};

		/******* 3D CHARACTER SPAWN BUTTON *******/
		// Create a button to spawn the 3D character
		// This is a key feature of the updated demo
		this.spawnButton = {
			...buttonTemplate,
			width: 200, // Wider than standard buttons
			x: (Game.WIDTH - 200) / 2, // Center horizontally
			y: Game.HEIGHT - 80, // Position near bottom of screen
			text: "Spawn Character", // Clear action label
			color: "#00f0f0" // Matching our color scheme
		};

		/******* INPUT SYSTEM REGISTRATION *******/
		// Register buttons with input system for interaction tracking
		// The bounds function lets the input system know where each button is
		// In the background, action engine has a clearly defined cascading input system
		// Events flow from debugCanvas -> guiCanvas -> gameCanvas, in that order

		// Register main game button
		this.input.registerElement("button1", {
			bounds: () => ({
				// Bounds provided as function for dynamic updates
				x: this.button1.x, // Current x position
				y: this.button1.y, // Current y position
				width: this.button1.width, // Button width
				height: this.button1.height // Button height
			})
		});

		// Register secondary buttons same way
		this.input.registerElement("button2", {
			bounds: () => ({
				x: this.button2.x,
				y: this.button2.y,
				width: this.button2.width,
				height: this.button2.height
			})
		});

		this.input.registerElement("button3", {
			bounds: () => ({
				x: this.button3.x,
				y: this.button3.y,
				width: this.button3.width,
				height: this.button3.height
			})
		});

		// Add inactive button to input tracking system
		// Even when inactive, the element's bounds are still tracked
		this.input.registerElement("inactiveButton", {
			bounds: () => ({
				x: this.inactiveButton.x,
				y: this.inactiveButton.y,
				width: this.inactiveButton.width,
				height: this.inactiveButton.height
			})
		});

		// Register the spawn button
		this.input.registerElement("spawnButton", {
			bounds: () => ({
				x: this.spawnButton.x,
				y: this.spawnButton.y,
				width: this.spawnButton.width,
				height: this.spawnButton.height
			})
		});

		/******* DEBUG LAYER BUTTON *******/
		// Create a button specifically for the debug layer
		// Shows how to work with different canvas layers
		this.debugButton = {
			x: Game.WIDTH - 130, // Position from right edge
			y: Game.HEIGHT - 50, // Position from bottom
			width: 120,
			height: 40,
			text: "Hide GUI", // Toggle button text
			color: "#ff4444", // Different color for visibility
			hovered: false,
			guiHidden: false // Track GUI visibility state
		};

		/******* GAME LAYER ELEMENT *******/
		// Create an interactive element in the game layer
		this.gameElement = {
			x: 600,
			y: 100,
			width: 100,
			height: 100,
			text: "Stop Sounds", // Careful with text rendering in 3D context!
			color: "#44ff44",
			hovered: false
		};

		/******* REGISTER LAYER-SPECIFIC ELEMENTS *******/
		// Register elements to specific layers for proper interaction handling

		// Debug layer button registration
		this.input.registerElement(
			"debugButton",
			{
				bounds: () => ({
					x: this.debugButton.x,
					y: this.debugButton.y,
					width: this.debugButton.width,
					height: this.debugButton.height
				})
			},
			"debug"
		); // Specify debug layer

		// Game layer element registration
		this.input.registerElement(
			"gameElement",
			{
				bounds: () => ({
					x: this.gameElement.x,
					y: this.gameElement.y,
					width: this.gameElement.width,
					height: this.gameElement.height
				})
			},
			"game"
		); // Specify game layer
	}

	/*
	 * update()
	 * The beating heart of the DEMO! This method handles all the logic updates
	 * including input handling, physics, and game state changes.
	 */
	update(deltaTime) {
		// Handle all common input interactions first
		this.handleCommonInput();

		// Route inputs based on debug overlay state (smart input routing)
		if (this.showDebug) {
			// When debug is visible, update 2D game
			this.update2DGame(deltaTime);
		} else {
			// When debug is not visible, update 3D world
			this.update3DWorld(deltaTime);
		}

		// Always update button states regardless of debug state
		this.updateButtonStates();
		
		// Update text input cursor blink
		if (this.textInputVisible) {
			this.textInputBlinkTime += deltaTime;
		}
	}

	/**
	 * Handle 3D world updates and 3D character input
	 */

	update3DWorld(deltaTime) {
		// Physics is now handled in fixed_update

		// If we have a player character, update it
		if (this.player) {
			// Let the character controller handle inputs for movement
			this.player.applyInput(this.input, deltaTime);
			this.player.update(deltaTime);
		} else {
			// Otherwise, control the free camera directly
			if (this.camera.isDetached) {
				this.camera.handleDetachedInput(this.input, deltaTime);
			}
		}

		// Check for Action3 to spawn random objects
		if (this.input.isKeyJustPressed("Action3")) {
			this.addMessage("Spawning random physics object");
			// Random position in the scene
			const randomX = Math.random() * 40 - 20; // -20 to 20
			const randomZ = Math.random() * 40 - 20; // -20 to 20
			const dropHeight = Math.random() * 10 + 20; // 20 to 30

			const randomPos = new Vector3(randomX, dropHeight, randomZ);
			this.createRandomObject(randomPos);
		}

		// Action2 to reset physics objects
		if (this.input.isKeyJustPressed("Action2")) {
			this.addMessage("Resetting physics world");
			this.physicsWorld.reset();

			// Re-add player if it exists
			if (this.player) {
				this.physicsWorld.objects.add(this.player.characterModel);

				// Reposition player after reset
				if (this.player.characterModel && this.player.characterModel.body) {
					this.player.characterModel.body.position.set(0, 5, 0);
				}
			}

			this.setupDemoObjects();
		}

		// Action1 is handled by the character controller internally when jumping
	}

	/**
	 * Update the 2D game that runs on the debug layer
	 */

	update2DGame(deltaTime) {
		/******* CONTINUOUS INPUT DETECTION *******/
		// When debug overlay is visible, we control the 2D game
		// These controls are similar to the original demo

		// DirectionalInput for ship movement
		if (this.input.isKeyPressed("DirUp")) {
			this.addMessage("DirUp IS PRESSED - Ship thrusting forward");
			const thrustVector = Vector2.create(this.shipDirection.x, this.shipDirection.y);
			thrustVector.scale(this.thrust);
			this.shipVelocity.add(thrustVector); // Add ship forward thrust
		}

		if (this.input.isKeyPressed("DirDown")) {
			this.addMessage("DirDown IS PRESSED - Ship reversing");
			const thrustVector = Vector2.create(this.shipDirection.x, this.shipDirection.y);
			thrustVector.scale(-this.thrust * 0.5); // Half power in reverse
			this.shipVelocity.add(thrustVector); // Add ship reverse thrust
		}

		if (this.input.isKeyPressed("DirLeft")) {
			this.addMessage("DirLeft IS PRESSED - Ship turning left");
			this.shipRotation -= this.rotationSpeed;
			this.shipDirection.rotate(-this.rotationSpeed); // Rotate ship left
		}

		if (this.input.isKeyPressed("DirRight")) {
			this.addMessage("DirRight IS PRESSED - Ship turning right");
			this.shipRotation += this.rotationSpeed;
			this.shipDirection.rotate(this.rotationSpeed); // Rotate ship right
		}

		// ActionEngine's audio system includes automatic stacking prevention, so sounds won't overlap
		// Individual sound volumes and callbacks can be set per sound for precise control
		if (this.input.isKeyJustPressed("DirUp")) {
			this.addMessage("DirUp JUST pressed");
			// Play at reduced volume with completion callback
			this.audio.play("TrumpetCall", {
				volume: 0.7,
				onEnd: (info) => this.addMessage(`${info.soundName} finished playing`)
			});
		}

		if (this.input.isKeyJustPressed("DirDown")) {
			this.addMessage("DirDown JUST pressed");
			// Demonstrate repeat functionality
			this.audio.play("PianoHit", {
				repeat: 2,
				volume: 0.8
			});
		}

		if (this.input.isKeyJustPressed("DirLeft")) {
			this.addMessage("DirLeft JUST pressed");
			// Complex sound with individual volume control
			this.audio.play("MidiSynthMix", { volume: 0.6 });
		}

		if (this.input.isKeyJustPressed("DirRight")) {
			this.addMessage("DirRight JUST pressed");
			// Background music with infinite repeat
			this.audio.play("SimpleSong", {
				repeat: -1,
				volume: 0.3,
				onEnd: (info) => this.addMessage("Background music loop started")
			});
		}

		// Action buttons demonstrate various audio features
		if (this.input.isKeyJustPressed("Action1")) {
			this.addMessage("Button 1 JUST pressed");
			// Standard jump sound with callback
			this.audio.play("jump", {
				onEnd: () => this.addMessage("Jump sound completed")
			});
		}

		if (this.input.isKeyJustPressed("Action2")) {
			this.addMessage("Button 2 JUST pressed");
			// Power-up sound with repeat
			this.audio.play("sound2", {
				repeat: 3,
				volume: 0.8
			});
		}

		if (this.input.isKeyJustPressed("Action3")) {
			this.addMessage("Button 3 JUST pressed");
			// Collision sound at specific volume
			this.audio.play("sound3", { volume: 0.9 });
		}

		// Continuous press with volume control demonstration
		if (this.input.isKeyPressed("Action4")) {
			this.addMessage("Button 4 IS PRESSED");
			// ActionEngine prevents stacking automatically - only one instance plays
			this.audio.play("sound4", { volume: 0.5 });
		}

		// Apply ship physics
		this.shipPosition.add(this.shipVelocity);
		this.shipVelocity.scale(this.friction);

		// Wrap ship around screen
		if (this.shipPosition.x < 0) this.shipPosition.x = Game.WIDTH;
		if (this.shipPosition.x > Game.WIDTH) this.shipPosition.x = 0;
		if (this.shipPosition.y < 0) this.shipPosition.y = Game.HEIGHT;
		if (this.shipPosition.y > Game.HEIGHT) this.shipPosition.y = 0;

		// Update ball position
		this.ballPosition.add(this.ballVelocity);
		this.ballRotation += this.ballSpinSpeed;

		// Ball screen wrapping
		if (this.ballPosition.x < -this.ballRadius) this.ballPosition.x = Game.WIDTH + this.ballRadius;
		if (this.ballPosition.x > Game.WIDTH + this.ballRadius) this.ballPosition.x = -this.ballRadius;
		if (this.ballPosition.y < -this.ballRadius) this.ballPosition.y = Game.HEIGHT + this.ballRadius;
		if (this.ballPosition.y > Game.HEIGHT + this.ballRadius) this.ballPosition.y = -this.ballRadius;

		// Ship-ball collision detection
		const dx = this.shipPosition.x - this.ballPosition.x;
		const dy = this.shipPosition.y - this.ballPosition.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance < this.ballRadius + 20) {
			// 20 is approximate ship radius
			// Calculate collision angle
			const collisionAngle = Math.atan2(dy, dx);

			// Ball rebounds off ship
			const speed = Math.sqrt(
				this.ballVelocity.x * this.ballVelocity.x + this.ballVelocity.y * this.ballVelocity.y
			);
			this.ballVelocity.x = -Math.cos(collisionAngle) * speed;
			this.ballVelocity.y = -Math.sin(collisionAngle) * speed;

			// Add ship's velocity to ball
			this.ballVelocity.add(this.shipVelocity);

			// Play bounce sound with collision feedback
			this.audio.play("sound3", {
				volume: 0.7,
				onEnd: () => this.addMessage("Ball collision sound completed")
			});
		}
	}

	/**
	 * Handle input that applies regardless of debug/game state
	 */
	handleCommonInput() {
		/******* THE SPECIAL DEBUG KEY *******/
		// The engine-level ActionDebugToggle key toggles the debugCanvas visibility
		// In our updated demo, this also switches between 2D and 3D gameplay
		if (this.input.isKeyJustPressed("ActionDebugToggle")) {
			this.showDebug = !this.showDebug;
			this.addMessage(this.showDebug ? "Debug mode ON - 2D game active" : "Debug mode OFF - 3D world active");
			if (!this.showDebug) {
				this.debugCtx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
			}
			
			// Show/hide canvas text input with debug overlay
			this.textInputVisible = this.showDebug;
			if (this.showDebug) {
				this.addMessage('Text input available at bottom - type and press Enter');
				this.textInputValue = '';
				this.textInputCursor = 0;
			}
		}

		/******* POINTER CHECKING (Legacy & New Methods) *******/
		// Get precise pointer coordinates in game space
		const pointerPos = this.input.getPointerPosition();
		if (pointerPos.x !== this.lastPointerX || pointerPos.y !== this.lastPointerY) {
			this.addMessage(`Pointer at: ${Math.round(pointerPos.x)}, ${Math.round(pointerPos.y)}`);
			this.lastPointerX = pointerPos.x;
			this.lastPointerY = pointerPos.y;
		}

		// --- LEGACY POINTER METHODS (Left click only) ---
		// Check if the pointer is down (clicked/touched) - LEGACY METHOD
		if (this.input.isPointerJustDown()) {
			this.addMessage("Left button JUST clicked (legacy method)");
		}

		// --- NEW MOUSE BUTTON METHODS ---
		// Check specific mouse buttons (just pressed this frame)
		if (this.input.isLeftMouseButtonJustPressed()) {
			this.addMessage("LEFT mouse button JUST pressed");
		}
		if (this.input.isRightMouseButtonJustPressed()) {
			this.addMessage("RIGHT mouse button JUST pressed");
		}
		if (this.input.isMiddleMouseButtonJustPressed()) {
			this.addMessage("MIDDLE mouse button JUST pressed");
		}

		// Check if specific mouse buttons are held down
		if (this.input.isLeftMouseButtonDown()) {
			// Only log occasionally to avoid spam
			if (this.frameCount % 30 === 0) {
				this.addMessage("LEFT mouse button is held down");
			}
		}

		if (this.input.isRightMouseButtonDown()) {
			// Only log occasionally to avoid spam
			if (this.frameCount % 30 === 0) {
				this.addMessage("RIGHT mouse button is held down");
			}
		}

		// Generic button check (useful for configurable controls)
		// button: 0=left, 1=middle, 2=right
		if (this.input.isMouseButtonJustPressed(2)) {
			this.addMessage("Generic right button check (button 2) JUST pressed");
		}

		/******* UI CONTROLS *******/
		// Track UI Controls
		if (this.input.isUIButtonJustPressed("soundToggle")) {
			this.addMessage("Sound button toggled");
		}
		if (this.input.isUIButtonJustPressed("fullscreenToggle")) {
			this.addMessage("Fullscreen button toggled");
		}
		if (this.input.isUIButtonJustPressed("controlsToggle")) {
			this.addMessage("Controls button toggled");
		}
		if (this.input.isUIButtonJustPressed("pauseButton")) {
			this.addMessage("Pause button toggled");
		}
	}

	/**
	 * Update button hover states and handle button interactions
	 */

	updateButtonStates() {
		// Track button hover states for visual feedback
		this.button1.hovered = this.input.isElementHovered("button1");
		this.button2.hovered = this.input.isElementHovered("button2");
		this.button3.hovered = this.input.isElementHovered("button3");
		this.inactiveButton.hovered = this.input.isElementHovered("inactiveButton");
		this.spawnButton.hovered = this.input.isElementHovered("spawnButton");
		this.debugButton.hovered = this.input.isElementHovered("debugButton", "debug");

		// Log edge-triggered hover events for demonstration
		if (this.input.isElementJustHovered("button1")) {
			this.addMessage("Button 1 JUST hovered");
		}

		// Handle button 1 press - toggles inactive button
		if (this.input.isElementJustPressed("button1")) {
			const newActiveState = !this.input.isElementActive("inactiveButton");
			this.input.setElementActive("inactiveButton", "gui", newActiveState);
			this.inactiveButton.color = newActiveState ? "#00f0f0" : "#666666";
			this.addMessage(`Inactive button ${newActiveState ? "enabled" : "disabled"}`);
			this.totalClicks++;
		}

		// Handle other button presses with audio control examples
		if (this.input.isElementJustPressed("button2")) {
			this.addMessage("Button 2 was just pressed!");
			// Demonstrate individual sound volume control
			this.audio.setSoundVolume("sound5", 0.7); // Set this sound to 70% volume
			this.audio.play("sound5");
			this.totalClicks++;
		}

		// Example of counting clicks vs continuous presses
		if (this.input.isElementJustPressed("button3")) {
			this.totalClicks++;
		}

		// Continuous press example with repeat demonstration
		if (this.input.isElementPressed("button3")) {
			this.addMessage("Button 3 is being held down");
			// Automatic stacking prevention means this won't create overlapping sounds
			this.audio.play("sound6", { volume: 0.6 });
		}

		// Inactive button status tracking
		if (this.input.isElementPressed("inactiveButton")) {
			if (this.input.isElementActive("inactiveButton")) {
				this.addMessage("Clicking an active button!");
			} else {
				this.addMessage("Button is inactive - click Button 1 to activate it!");
			}
		}

		// Handle inactive button click when active
		if (this.input.isElementJustPressed("inactiveButton") && this.input.isElementActive("inactiveButton")) {
			// Victory sound with celebration repeat
			this.audio.play("victory", {
				repeat: 2,
				volume: 0.9,
				onEnd: (info) => this.addMessage(`Victory fanfare completed after ${info.totalRepeats} plays!`)
			});
			this.totalClicks++;
		}

		// Handle game element press (stops all sounds)
		if (this.input.isElementJustPressed("gameElement", "game")) {
			this.audio.stopAllSounds();
			this.addMessage("gameCanvas element pressed! All sounds stopped.");
			this.totalClicks++;
		}

		// Handle debug button to toggle GUI visibility
		if (this.input.isElementJustPressed("debugButton", "debug")) {
			this.debugButton.guiHidden = !this.debugButton.guiHidden;
			this.debugButton.text = this.debugButton.guiHidden ? "Show GUI" : "Hide GUI";
			this.guiCanvas.style.display = this.debugButton.guiHidden ? "none" : "block";
			this.addMessage("Debug button toggled GUI visibility");
		}

		// Handle spawn button to create 3D character
		if (this.input.isElementJustPressed("spawnButton")) {
			this.spawnCharacter();
			// The spawn sound is played in spawnCharacter() with callback support
			this.totalClicks++;
		}
	}
	
	/*-----------------
	 * AUDIO INTEGRATION:
	 * -----------------
	 * Action Engine includes a powerful and flexible audio system for adding sound effects and music to your game.
	 *
	 * Sound in games is a critical part of the overall presentation, and it's often
	 * overlooked or pushed onto the back-burner due to a plethora of difficulties.
	 * The Action Engine audio system solves these common challenges with multiple synthesis methods:
	 *
	 * SYNTHESIS OPTIONS:
	 * - Basic Waveforms: Create simple tones using sine, triangle, and square waves
	 * - FM Synthesis: Generate rich, dynamic sounds through frequency modulation
	 * - Complex Synthesis: Layer multiple oscillators for full, harmonic sounds
	 * - Noise Generation: Create white, pink, or brown noise for effects
	 * - Frequency Sweeps: Create dramatic pitch slides and transitions
	 *
	 * MIDI CAPABILITIES:
	 * - Full 128-instrument library built-in
	 * - High quality sampled instruments from pianos to drums
	 * - Multi-channel playback support
	 * - No external sound files needed
	 *
	 * AUDIO CONTROL:
	 * - Real-time parameter control
	 * - Individual sound volume control (setSoundVolume)
	 * - Master volume control (setVolume)
	 * - Automatic sound stacking prevention
	 * - Sound completion callbacks (onEnd)
	 * - Flexible repeat and looping (repeat: number or -1 for infinite)
	 * - Stereo panning
	 * - Volume envelopes (ADSR)
	 * - Effects processing (reverb, echo, filters)
	 * - Complete playback control (play(), stopSound(), stopAllSounds())
	 *
	 * SEQUENCING:
	 * - SonicPi-style scripting for complex arrangements
	 * - Tempo and timing control
	 * - Multiple concurrent tracks
	 * - Effect chains and processing
	 *
	 * The DEMO maps various sounds to inputs to showcase these capabilities:
	 * - One-shot sound effects for edge-triggered actions
	 * - Different synthesis types for varied sound design
	 * - MIDI instrument playback
	 * - Complex musical arrangements
	 *
	 * Let's dive in and make some noise! 🎵
	 * -----------------
	 */

	/*-----------------
	 * createGameSounds()
	 * -----------------
	 */

	createGameSounds() {
		/*-----------------
		 * THE SOUND CREATION PLAYGROUND!
		 * -----------------
		 * This method demonstrates the various ways to create and manage sounds in the engine.
		 * We'll explore different synthesis methods and show how to build both simple effects
		 * and complex musical arrangements.
		 *
		 * The examples progress from simple to complex:
		 * 1. Basic waveform synthesis
		 * 2. FM synthesis for dynamic sounds
		 * 3. Multi-oscillator layered sounds
		 * 4. Noise and sweep effects
		 * 5. MIDI instrument playback
		 * 6. Full musical sequences
		 *
		 * Each sound type has its own use case:
		 * - Basic synthesis: UI sounds, simple effects
		 * - FM synthesis: Sci-fi sounds, complex tones
		 * - Multi-oscillator: Rich sound effects, musical notes
		 * - Noise/Sweeps: Environmental effects, transitions
		 * - MIDI: High quality musical elements
		 * - Sequences: Background music, complex events
		 *
		 * !!! OPTIMIZATION NOTE !!!
		 * Layer your sound complexity based on game needs:
		 * - Simple synthesis is very lightweight
		 * - MIDI instruments take more memory
		 * - Complex sequences need more processing
		 * Consider using simpler sounds for frequent events
		 * and save complex sounds for important moments
		 * -----------------
		 */

		/******* DIFFERENT SOUND TYPE CREATION *******/
		// Each of these methods demonstrates a different type of sound synthesis
		// available in the Action Engine audio system

		// FM (Frequency Modulation) synthesis creates rich, dynamic sounds
		// Great for sci-fi effects or complex tones
		this.audio.createFMSound("fmSound", {
			carrierFreq: 440, // Base frequency
			modulatorFreq: 100, // Modulating frequency
			modulationIndex: 100, // How intense the modulation is
			type: "sine", // Carrier wave type
			duration: 0.5,
			envelope: {
				attack: 0.1,
				decay: 0.2,
				sustain: 0.6,
				release: 0.2
			}
		});

		// Complex sounds combine multiple oscillators for rich harmonics
		// Perfect for creating full, layered sounds
		this.audio.createComplexSound("complexSound", {
			frequencies: [440, 880, 1320], // Stack of frequencies
			types: ["sine", "triangle", "square"], // Different wave types
			mix: [0.5, 0.3, 0.2], // Volume mix of each oscillator
			duration: 0.8,
			envelope: {
				attack: 0.1,
				decay: 0.2,
				sustain: 0.5,
				release: 0.3
			}
		});

		// Noise generation for effects like wind, water, explosions
		this.audio.createNoiseSound("noiseSound", {
			noiseType: "white", // white, pink, or brown noise
			duration: 0.5,
			envelope: {
				attack: 0.05,
				decay: 0.1,
				sustain: 0.7,
				release: 0.2
			},
			filterOptions: {
				frequency: 1000, // Filter cutoff frequency
				Q: 1, // Filter resonance
				type: "lowpass" // Filter type
			}
		});

		// Frequency sweeps for dramatic effects
		this.audio.createSweepSound("sweepSound", {
			startFreq: 200, // Starting frequency
			endFreq: 800, // Ending frequency
			type: "triangle", // Wave type
			duration: 0.6,
			envelope: {
				attack: 0.1,
				decay: 0.2,
				sustain: 0.4,
				release: 0.2
			}
		});

		/******* SIMPLE SOUND EFFECTS *******/
		// Let's start with a classic platformer jump!
		// Frequency sweep from low to high = nice 'jump' feeling
		this.audio.createSweepSound("jump", {
			startFreq: 220, // Start at A3
			endFreq: 880, // Sweep up to A5
			type: "triangle", // Triangle wave sounds nice and smooth
			duration: 0.25, // Quick and snappy
			envelope: {
				// Shape the sound's volume over time
				attack: 0.05, // Quick start
				decay: 0.1, // Fast falloff
				sustain: 0.8, // Hold most of the volume
				release: 0.1 // Quick end
			}
		});

		/******* DRAMATIC POWER-UP EFFECT *******/
		// Stack multiple oscillators for a rich, dramatic sound
		this.audio.createComplexSound("sound2", {
			frequencies: [440, 587, 880, 1174], // Stack of harmonious frequencies
			types: ["triangle", "sine", "triangle", "sine"], // Mix different waves
			mix: [0.4, 0.3, 0.2, 0.1], // Fade each higher frequency
			duration: 0.4,
			envelope: {
				attack: 0.01, // Almost instant attack
				decay: 0.2,
				sustain: 0.6,
				release: 0.19
			}
		});

		/******* RETRO GAME SOUNDS *******/
		// Create an SNES-style acceleration sound
		// Multiple oscillators create that classic 16-bit feel
		this.audio.createComplexSound("sound3", {
			frequencies: [220, 330, 440], // Power of three
			types: ["triangle", "square", "triangle"], // Mix of waves
			mix: [0.5, 0.2, 0.1], // Emphasize base frequency
			duration: 0.35,
			envelope: {
				attack: 0.08,
				decay: 0.15,
				sustain: 0.6,
				release: 0.12
			}
		});

		/******* FM SYNTHESIS MAGIC *******/
		// Use frequency modulation for otherworldly sounds
		// Great for sci-fi effects or mystery reveals
		this.audio.createFMSound("sound4", {
			carrierFreq: 185, // Base frequency
			modulatorFreq: 92.5, // Modulating frequency
			modulationIndex: 100, // How 'wild' the modulation gets
			type: "sine",
			duration: 0.6,
			envelope: {
				attack: 0.15, // Slow build
				decay: 0.25,
				sustain: 0.6,
				release: 0.2
			}
		});

		/******* TRANSFORMATION EFFECT *******/
		// Create an ethereal sound perfect for power-ups or transformations
		this.audio.createComplexSound("sound5", {
			frequencies: [220, 330, 440, 660], // Harmonious stack
			types: ["sine", "sine", "triangle", "sine"],
			mix: [0.4, 0.3, 0.2, 0.1], // Fade higher frequencies
			duration: 0.7,
			envelope: {
				attack: 0.2, // Slow, majestic build
				decay: 0.3,
				sustain: 0.4,
				release: 0.2
			}
		});

		/******* CRYSTAL SHIMMER *******/
		// High, bright frequencies create a sparkling effect
		this.audio.createComplexSound("sound6", {
			frequencies: [294, 370, 440], // High, bright frequencies
			types: ["sine", "triangle", "sine"],
			mix: [0.45, 0.35, 0.2],
			duration: 0.5,
			envelope: {
				attack: 0.1,
				decay: 0.2,
				sustain: 0.5,
				release: 0.2
			}
		});

		/******* VICTORY FANFARE *******/
		// A triumphant sound using multiple harmonious frequencies
		this.audio.createComplexSound("victory", {
			frequencies: [330, 440, 550, 660, 880],
			types: ["triangle", "sine", "triangle", "sine", "triangle"],
			mix: [0.3, 0.25, 0.2, 0.15, 0.1],
			duration: 0.7,
			envelope: {
				attack: 0.1,
				decay: 0.25,
				sustain: 0.5,
				release: 0.3
			}
		});

		/******* MIDI INSTRUMENT SHOWCASE *******/
		// Now let's play with some high-quality MIDI instruments!

		// Complex synth and pad mix
		this.audio.createSound(
			"MidiSynthMix",
			{
				script: `
			   use_bpm 120
			   sample :pad, note: 60, amp: 0.3, duration: 4
			   sample :soft_synth, note: 72, amp: 0.3
			   sleep 1
			   sample :soft_synth, note: 76, amp: 0.25
			   sleep 1
		   `,
				samples: {
					pad: {
						soundType: "midi",
						instrument: "pad_3_polysynth", // Rich, atmospheric pad
						amp: 0.3
					},
					soft_synth: {
						type: "sin", // Mix with synthetic sound
						frequency: 440,
						decay: 1.5,
						amp: 0.3
					}
				}
			},
			"sonicpi"
		);

		// Clean piano hit
		this.audio.createSound(
			"PianoHit",
			{
				script: `
			   use_bpm 120
			   sample :piano, note: 60, amp: 0.5
		   `,
				samples: {
					piano: {
						soundType: "midi",
						instrument: "acoustic_grand_piano", // Beautiful grand piano
						amp: 0.5
					}
				}
			},
			"sonicpi"
		);

		// Majestic trumpet call
		this.audio.createSound(
			"TrumpetCall",
			{
				script: `
			   use_bpm 120
			   sample :trumpet, note: 67, amp: 0.4
			   sleep 0.2
			   sample :trumpet, note: 72, amp: 0.5
		   `,
				samples: {
					trumpet: {
						soundType: "midi",
						instrument: "trumpet", // Bright, bold trumpet
						amp: 0.4
					}
				}
			},
			"sonicpi"
		);

		/******* FULL SONG DEMO *******/
		// Bringing it all together in a complete musical arrangement!
		this.audio.createSound(
			"SimpleSong",
			{
				script: `
			   use_bpm 80
			   
			   define :melody do
				   sample :piano, note: 67, amp: 0.4
				   sleep 2
				   sample :piano, note: 72, amp: 0.3
				   sleep 2
				   sample :bells, note: 84, amp: 0.2
				   sleep 2
				   sample :bells, note: 79, amp: 0.2
				   sleep 2
			   end
			   
			   8.times do
				   sample :bass, note: 48, amp: 0.4
				   sample :strings, note: 60, amp: 0.3, duration: 8
				   melody
			   end
		   `,
				samples: {
					piano: {
						soundType: "midi",
						instrument: "acoustic_grand_piano", // Main melody
						amp: 0.4
					},
					bells: {
						soundType: "midi",
						instrument: "tubular_bells", // Sparkly accents
						amp: 0.2
					},
					bass: {
						soundType: "midi",
						instrument: "acoustic_bass", // Strong bass line
						amp: 0.4
					},
					strings: {
						soundType: "midi",
						instrument: "string_ensemble_1", // Lush backing
						amp: 0.3
					}
				}
			},
			"sonicpi"
		);

		/******* CHARACTER SPAWN SOUND *******/
		// Create a sound for the spawn button click
		this.audio.createSweepSound("spawnSound", {
			startFreq: 300,
			endFreq: 600,
			type: "triangle",
			duration: 0.3,
			envelope: {
				attack: 0.05,
				decay: 0.1,
				sustain: 0.5,
				release: 0.15
			}
		});

		/*-----------------
		 * BONUS SOUND DESIGN GUIDE:
		 * -----------------
		 * Creating good game audio is both art and science. Here are some proven approaches
		 * for different common game sound needs:
		 *
		 * UI SOUNDS:
		 * - Keep them short (0.1s - 0.3s)
		 * - Use simple waveforms (sine or triangle)
		 * - Quick attack, minimal decay
		 * Example for a "select" sound:
		 */
		this.audio.createSweepSound("selectBlip", {
			startFreq: 440, // A4 note
			endFreq: 880, // Up to A5
			type: "sine", // Clean sine wave
			duration: 0.15, // Very short
			envelope: {
				attack: 0.01, // Almost immediate
				decay: 0.14, // Most of duration
				sustain: 0, // No sustain needed
				release: 0 // No release needed
			}
		});

		/*
		 * IMPACT SOUNDS:
		 * - Start with noise for the "hit"
		 * - Add a tonal element for character
		 * - Quick attack, medium decay
		 */
		this.audio.createComplexSound("impact", {
			frequencies: [100, 200, 300], // Low frequencies for impact
			types: ["square", "sine", "sine"], // Square wave adds "punch"
			mix: [0.6, 0.3, 0.1], // Emphasize lower frequencies
			duration: 0.4,
			envelope: {
				attack: 0.01, // Immediate hit
				decay: 0.2, // Quick falloff
				sustain: 0.2, // Some body
				release: 0.19 // Smooth end
			}
		});

		/*
		 * AMBIENT SOUNDS:
		 * - Use noise with heavy filtering
		 * - Longer durations
		 * - Smooth transitions
		 */
		this.audio.createNoiseSound("wind", {
			noiseType: "pink", // Pink noise sounds more natural
			duration: 2.0,
			envelope: {
				attack: 0.5, // Slow fade in
				decay: 0.5,
				sustain: 0.7, // Maintain presence
				release: 1.0 // Slow fade out
			},
			filterOptions: {
				frequency: 800, // Remove harsh high frequencies
				Q: 0.5, // Gentle resonance
				type: "lowpass"
			}
		});

		/*
		 * MUSICAL ELEMENTS:
		 * - Use FM synthesis for rich tones
		 * - Pay attention to musical intervals
		 * - Longer attack/release for smoothness
		 */
		this.audio.createFMSound("synthPad", {
			carrierFreq: 440, // Base note A4
			modulatorFreq: 220, // Modulate at half frequency
			modulationIndex: 50, // Moderate modulation
			type: "sine",
			duration: 1.0,
			envelope: {
				attack: 0.2, // Smooth fade in
				decay: 0.3,
				sustain: 0.6,
				release: 0.5
			}
		});

		/*
		 * EFFECT CHAINS:
		 * Action Engine supports chaining multiple effects. Some useful combinations:
		 *
		 * Spacious Atmosphere:
		 */
		const spaciousSound = {
			script: `
			use_bpm 60
			with_fx :reverb, room: 0.8 do
				with_fx :echo, phase: 0.5, decay: 2 do
					sample :pad_3_polysynth, note: 50, amp: 0.3
				end
			end
		`,
			samples: {
				pad: {
					soundType: "midi",
					instrument: "pad_3_polysynth",
					amp: 0.3
				}
			}
		};

		/*
		 * Power Up Effect:
		 */
		const powerUp = {
			script: `
			use_bpm 120
			with_fx :echo, phase: 0.125 do
				with_fx :wobble, phase: 0.5 do
					sample :synth_strings_1, note: 60
					sleep 0.25
					sample :synth_strings_1, note: 67
				end
			end
		`
		};

		/*
		 * COMMON PITFALLS TO AVOID:
		 * 1. Too much frequency overlap - space out your frequencies
		 * 2. Harsh attacks - use at least 0.01s attack time
		 * 3. Abrupt endings - always use some release time
		 * 4. Overusing effects - subtlety often works better
		 * 5. Too much low frequency content - can muddy the mix
		 */
	}

	/**
	 * drawButton(button)
	 *
	 * Renders a button with hover effects and centered text on the GUI layer
	 * @param {Object} button - The button object to render
	 *
	 * Before we got here, we stored some information on the "hover" state of our buttons class-wide.
	 * The DEMO will use the information it stores from the input state to draw the buttons in a different style when "hovered".
	 */

	drawButton(button) {
		// Use guiCtx instead of ctx since buttons are UI elements
		this.guiCtx.save();

		// Draw button background with "hover" effect
		this.guiCtx.fillStyle = button.hovered ? "#00b0b0" : button.color;
		this.guiCtx.strokeStyle = "#ffffff";
		this.guiCtx.lineWidth = 2;

		this.guiCtx.beginPath();
		this.guiCtx.roundRect(button.x, button.y, button.width, button.height, 8);
		this.guiCtx.fill();
		this.guiCtx.stroke();

		// Draw centered button text
		this.guiCtx.fillStyle = "#ffffff";
		this.guiCtx.font = "20px Orbitron";
		this.guiCtx.textAlign = "center";
		this.guiCtx.textBaseline = "middle";
		this.guiCtx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);

		this.guiCtx.restore();
	}

	/**
	 * draw()
	 * Master drawing method that handles all rendering layers
	 */
	draw() {
		/*
		 * Action Engine supports both 2D and 3D rendering.
		 * The demo shows the potential of the three-layer system by separating drawing across these layers.
		 * Each layer serves a specific purpose, and the three-layer system allows for harmony.
		 */

		/******* GAME LAYER RENDERING *******/
		/*
		 * GAME LAYER (this.gameCanvas):
		 * - This is now always 3D rendered
		 * - Handles the 3D world, character, and physics objects
		 */
		this.draw3DScene();

		/******* GUI LAYER RENDERING *******/
		/*
		 *  THE GUI LAYER (this.guiCtx):
		 * - Always 2D for crisp UI rendering
		 * - Intended use: Buttons, menus, HUD elements
		 * - Stays pixel-perfect regardless of game context
		 */
		this.drawGUILayer();

		/******* DEBUG LAYER RENDERING *******/
		/*
		 * THE DEBUG LAYER (this.debugCtx):
		 * - Development tools and debug info
		 * - Toggle with F9
		 * - Also hosts our 2D mini-game when visible!
		 * - Always renders on top
		 */
		if (this.showDebug) {
			this.drawDebugLayer();
		}
	}
	
	/**
	 * draw3DScene()
	 *
	 * Handles rendering the 3D world with all physics objects and characters
	 * Uses ActionEngine's 3D rendering system for clean, simplified 3D rendering
	 */
	draw3DScene() {
		// Clear the canvas
		if (this.gl) {
			this.gl.clearColor(0.529, 0.808, 0.922, 1.0); // Sky blue background
			this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
		}

		// Render the scene using ActionEngine's renderer
		this.renderer3D.render({
			renderableObjects: Array.from(this.physicsWorld.objects),
			camera: this.camera
		});
	}

	/**
	 * drawGUILayer()
	 *
	 * Renders all UI elements on the GUI layer
	 *
	 */
	drawGUILayer() {
		// Clear the GUI canvas
		this.guiCtx.clearRect(0, 0, this.guiCanvas.width, this.guiCanvas.height);

		/******* RENDER ALL BUTTONS *******/
		// Draw all interactive buttons including spawn character button
		[this.button1, this.button2, this.button3, this.inactiveButton, this.spawnButton].forEach((button) => {
			this.drawButton(button);
		});

		// Draw stats display
		this.drawStatsDisplay();

		// Draw 3D world instructions when debug overlay is not visible
		if (!this.showDebug) {
			this.drawInstructions();
		}
	}

	/**
	 * Draw gameplay instructions
	 */
	drawInstructions() {
		this.guiCtx.font = "16px Arial";
		this.guiCtx.fillStyle = "white";
		this.guiCtx.textAlign = "left";
		this.guiCtx.textBaseline = "top";

		this.guiCtx.fillText("3D World Demo with ActionEngine", 10, 10);

		if (this.player) {
			this.guiCtx.fillText("Action1: Jump (when character is on ground)", 10, 40);
			this.guiCtx.fillText("DirUp/Down/Left/Right: Move character", 10, 60);
			this.guiCtx.fillText("F9: Toggle debug overlay (switches to 2D mini-game)", 10, 80);
		} else {
			this.guiCtx.fillText("Use Arrow Keys to move the free camera", 10, 40);
			this.guiCtx.fillText("Click the 'Spawn Character' button to create a playable character", 10, 60);
			this.guiCtx.fillText("F9: Toggle debug overlay (switches to 2D mini-game)", 10, 80);
		}

		this.guiCtx.fillText("Action2: Reset all physics objects", 10, 100);
		this.guiCtx.fillText("Action3: Spawn random colorful physics objects (spheres, boxes, capsules!)", 10, 120);
		this.guiCtx.fillText(`Objects in world: ${this.physicsWorld.objects.size}`, 10, 140);

		// Display character debug info if available
		if (this.player && this.player.debugInfo) {
			const debugInfo = this.player.debugInfo;
			this.guiCtx.fillText(`Character state: ${debugInfo.state.current}`, 10, 170);
			this.guiCtx.fillText(
				`Position: (${debugInfo.physics.position.x.toFixed(2)}, ${debugInfo.physics.position.y.toFixed(2)}, ${debugInfo.physics.position.z.toFixed(2)})`,
				10,
				190
			);
			this.guiCtx.fillText(
				`Velocity: (${debugInfo.physics.velocity.x.toFixed(2)}, ${debugInfo.physics.velocity.y.toFixed(2)}, ${debugInfo.physics.velocity.z.toFixed(2)})`,
				10,
				210
			);
		}
	}

	/**
	 * drawDebugLayer()
	 *
	 * Renders the debug overlay and 2D game when the debug mode is active
	 * The debugCanvas hosts both debugging tools and our playable 2D mini-game
	 */
	drawDebugLayer() {
		// Clear the debug canvas
		this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);

		// Draw debug background
		this.debugCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
		this.debugCtx.fillRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);

		// Draw the 2D game on the debug layer when debug is active
		this.draw2DGame();

		// Draw debug button
		this.drawDebugButton();

		// Draw message log
		this.drawDebugMessages();
		
		// Draw text input if visible
		if (this.textInputVisible) {
			this.drawTextInput();
		}
	}

	/**
	 * draw2DGame()
	 *
	 * Renders the 2D space game on the debug layer when debug is toggled on
	 * This is the original 2D game from the demo, now running on the debug layer
	 */
	draw2DGame() {
		// Use the debug context for rendering
		const ctx = this.debugCtx;

		// Add a space-like background (semi-transparent to show debug layer)
		ctx.fillStyle = "rgba(0, 0, 51, 0.5)";
		ctx.fillRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);

		// Draw ship
		ctx.save();
		ctx.translate(this.shipPosition.x, this.shipPosition.y);
		ctx.rotate(this.shipRotation);

		// Draw triangular ship
		ctx.beginPath();
		ctx.moveTo(0, -20); // nose
		ctx.lineTo(-15, 20); // left wing
		ctx.lineTo(15, 20); // right wing
		ctx.closePath();

		ctx.strokeStyle = "#00ff00";
		ctx.lineWidth = 2;
		ctx.stroke();

		// Draw thrust if moving forward
		if (this.input.isKeyPressed("DirUp") && this.showDebug) {
			ctx.beginPath();
			ctx.moveTo(-8, 20);
			ctx.lineTo(0, 30);
			ctx.lineTo(8, 20);
			ctx.strokeStyle = "#ff0000";
			ctx.stroke();
		}

		ctx.restore();

		// Draw soccer ball
		ctx.save();
		ctx.translate(this.ballPosition.x, this.ballPosition.y);
		ctx.rotate(this.ballRotation);

		// Create pseudo-3D effect with gradient
		const gradient = ctx.createRadialGradient(-5, -5, 1, -5, -5, this.ballRadius * 2);
		gradient.addColorStop(0, "#ffffff");
		gradient.addColorStop(1, "#cccccc");

		// Draw main ball circle
		ctx.beginPath();
		ctx.arc(0, 0, this.ballRadius, 0, Math.PI * 2);
		ctx.fillStyle = gradient;
		ctx.fill();

		// Draw pentagon pattern
		const segments = 5;
		const angleStep = (Math.PI * 2) / segments;
		for (let i = 0; i < segments; i++) {
			const angle = i * angleStep;

			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(Math.cos(angle) * this.ballRadius, Math.sin(angle) * this.ballRadius);
			ctx.lineTo(Math.cos(angle + angleStep) * this.ballRadius, Math.sin(angle + angleStep) * this.ballRadius);
			ctx.closePath();
			ctx.fillStyle = i % 2 === 0 ? "#000000" : "#ffffff";
			ctx.globalAlpha = 0.3;
			ctx.fill();
		}

		// Draw highlight
		ctx.beginPath();
		ctx.arc(-5, -5, this.ballRadius / 3, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
		ctx.fill();

		ctx.restore();

		// Add 2D game info
		ctx.fillStyle = "#00ff00";
		ctx.font = "14px monospace";
		ctx.fillText("Debug Mode Active - 2D Mini-Game Running", this.padding, this.padding + 50);
		ctx.fillText("Use Arrow Keys to control the ship", this.padding, this.padding + 70);
		ctx.fillText("Try to hit the ball with your ship!", this.padding, this.padding + 90);
		ctx.fillText("Type in the text box below to add messages!", this.padding, this.padding + 110);
	}

	/**
	 * drawDebugButton()
	 *
	 * Renders the debug layer toggle button
	 */
	drawDebugButton() {
		this.debugCtx.save();
		this.debugCtx.fillStyle = this.debugButton.color;
		if (this.input.isElementHovered("debugButton", "debug")) {
			this.debugCtx.fillStyle = "#ff6666";
		}
		this.debugCtx.fillRect(this.debugButton.x, this.debugButton.y, this.debugButton.width, this.debugButton.height);
		this.debugCtx.fillStyle = "#ffffff";
		this.debugCtx.font = "16px Orbitron";
		this.debugCtx.textAlign = "center";
		this.debugCtx.fillText(
			this.debugButton.text,
			this.debugButton.x + this.debugButton.width / 2,
			this.debugButton.y + this.debugButton.height / 2
		);
		this.debugCtx.restore();
	}

	/**
	 * drawDebugMessages()
	 *
	 * Renders the debug message log on the debug layer
	 */
	drawDebugMessages() {
		this.debugCtx.font = "14px monospace";
		this.debugCtx.fillStyle = "#00ff00";

		this.messages.forEach((msg, i) => {
			this.debugCtx.fillText(msg, this.padding, this.debugCanvas.height - (this.padding + i * this.lineHeight));
		});

		// Draw debug header
		this.debugCtx.fillText(`Debug Mode (F9 to toggle)`, this.padding, this.padding + 20);
	}

	/**
	 * drawTextInput()
	 *
	 * Renders the canvas-based text input field at the bottom of debug overlay
	 */
	drawTextInput() {
		const ctx = this.debugCtx;
		
		// Input box dimensions and position (respecting 800x600)
		const inputHeight = 30;
		const inputY = Game.HEIGHT - inputHeight - 10;
		const inputX = 10;
		const inputWidth = Game.WIDTH - 20;
		
		// Draw input box background
		ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
		ctx.fillRect(inputX, inputY, inputWidth, inputHeight);
		
		// Draw input box border
		ctx.strokeStyle = "#00ff00";
		ctx.lineWidth = 2;
		ctx.strokeRect(inputX, inputY, inputWidth, inputHeight);
		
		// Draw the text content
		ctx.fillStyle = "#00ff00";
		ctx.font = "14px monospace";
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		
		// Draw placeholder or actual text
		const displayText = this.textInputValue || "Type a message and press Enter...";
		const textColor = this.textInputValue ? "#00ff00" : "#006600";
		ctx.fillStyle = textColor;
		ctx.fillText(displayText, inputX + 8, inputY + inputHeight / 2);
		
		// Draw cursor if there's text and it should blink
		if (this.textInputValue && Math.floor(this.textInputBlinkTime * 2) % 2 === 0) {
			const textBeforeCursor = this.textInputValue.substring(0, this.textInputCursor);
			const cursorX = inputX + 8 + ctx.measureText(textBeforeCursor).width;
			
			ctx.fillStyle = "#00ff00";
			ctx.fillRect(cursorX, inputY + 6, 2, inputHeight - 12);
		}
	}

	/**
	 * drawStatsDisplay()
	 *
	 * Renders a stats display on the GUI layer showing click count and buttons
	 */
	drawStatsDisplay() {
		this.guiCtx.save();
		this.guiCtx.font = "20px Orbitron";

		// Calculate stats box dimensions
		const statsText = `Total Clicks: ${this.totalClicks}`;
		const buttonText = `Buttons: ${this.totalButtons}`;
		const textWidth = Math.max(this.guiCtx.measureText(statsText).width, this.guiCtx.measureText(buttonText).width);

		const padding = 15;
		const boxHeight = 70;
		const boxWidth = textWidth + padding * 2;
		const boxX = this.guiCanvas.width - boxWidth - 20;
		const boxY = 20;

		// Create a semi-transparent box
		this.guiCtx.fillStyle = "rgba(10, 10, 42, 0.85)";
		this.guiCtx.beginPath();
		this.guiCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
		this.guiCtx.fill();

		// Add a subtle border
		this.guiCtx.strokeStyle = "rgba(0, 240, 240, 0.3)";
		this.guiCtx.lineWidth = 2;
		this.guiCtx.stroke();

		// Draw stats text
		this.guiCtx.fillStyle = "#00f0f0";
		this.guiCtx.textAlign = "left";
		this.guiCtx.fillText(statsText, boxX + padding, boxY + 30);
		this.guiCtx.fillText(buttonText, boxX + padding, boxY + 55);

		this.guiCtx.restore();
	}
}