/**
 * Memory Palace 3D - Method of Loci Environment (WebGL Version)
 *
 * A spatial memory system where users can:
 * - Fly through a large 3D space
 * - Place textured blocks
 * - Attach long-form notes to blocks
 * - Save/load their memory palace
 */

// WebGL Utilities for common operations
class WebGLUtils {
    static createBuffer(gl, data) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        return buffer;
    }

    static createIndexBuffer(gl, indices) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        return buffer;
    }

    static compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    static createShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Failed to link shader program:", gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }
}

// WebGL geometry builder for creating 3D shapes
class WebGLGeometryBuilder {
    constructor(gl) {
        this.gl = gl;
        this.vertices = [];
        this.normals = [];
        this.colors = [];
        this.indices = [];
    }

    // Static helper methods for basic primitive creation
    static createTriangle(indices, positions, a, b, c, forceFlip = false, doubleSided = false) {
        // Get vertex positions
        const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
        const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
        const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];

        // Calculate face normal using cross product
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;

        // Calculate centroid
        const centroidX = (ax + bx + cx) / 3;
        const centroidY = (ay + by + cy) / 3;
        const centroidZ = (az + bz + cz) / 3;

        // Determine if normal points away from origin (0,0,0)
        const dotProduct = nx * centroidX + ny * centroidY + nz * centroidZ;

        // STEP 1: First determine winding based on origin calculations
        let v1, v2, v3;
        if (dotProduct === 0 || dotProduct > 0) {
            v1 = a; v2 = b; v3 = c;
        } else {
            v1 = a; v2 = c; v3 = b;
        }

        // STEP 2: AFTER origin-based calculation, apply forceFlip if requested
        if (forceFlip) {
            // Swap v2 and v3 to flip the triangle
            const temp = v2; v2 = v3; v3 = temp;
        }

        // Add the triangle with final winding
        indices.push(v1, v2, v3);

        // If double-sided, add a second triangle with opposite winding
        if (doubleSided) {
            indices.push(v1, v3, v2);
        }
    }

    // Quad helper method
    static createQuad(indices, positions, a, b, c, d, forceFlip = false, doubleSided = false) {
        this.createTriangle(indices, positions, a, b, c, forceFlip, doubleSided);
        this.createTriangle(indices, positions, a, c, d, forceFlip, doubleSided);
    }

    // Instance methods for building geometry
    addBox(x, y, z, width, height, depth, color) {
        const baseIndex = this.vertices.length / 3;

        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const halfDepth = depth / 2;

        // Calculate actual min/max coordinates for centering
        const minX = x - halfWidth;
        const maxX = x + halfWidth;
        const minY = y - halfHeight;
        const maxY = y + halfHeight;
        const minZ = z - halfDepth;
        const maxZ = z + halfDepth;

        // Eight corners of box (vertices stay the same)
        const vertices = [
            // Bottom face
            minX, minY, minZ,
            maxX, minY, minZ,
            maxX, minY, maxZ,
            minX, minY, maxZ,

            // Top face
            minX, maxY, minZ,
            maxX, maxY, minZ,
            maxX, maxY, maxZ,
            minX, maxY, maxZ
        ];

        // Add vertices
        for (const vertex of vertices) {
            this.vertices.push(vertex);
        }

        // Add normals
        // Bottom face normals
        for (let i = 0; i < 4; i++) {
            this.normals.push(0, -1, 0);
        }
        // Top face normals
        for (let i = 0; i < 4; i++) {
            this.normals.push(0, 1, 0);
        }

        // Add colors
        for (let i = 0; i < 8; i++) {
            this.colors.push(...color);
        }

        // Add indices for all six faces with consistent winding and make all faces double-sided
        // Bottom face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 3, true, true);
        // Top face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex + 4, baseIndex + 5, baseIndex + 6, baseIndex + 7, false, true);
        // Front face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 1, baseIndex + 5, baseIndex + 4, false, true);
        // Back face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex + 2, baseIndex + 3, baseIndex + 7, baseIndex + 6, false, true);
        // Left face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 3, baseIndex + 7, baseIndex + 4, false, true);
        // Right face
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex + 1, baseIndex + 2, baseIndex + 6, baseIndex + 5, false, true);
    }

    addFloor(x, y, z, width, depth, color) {
        const baseIndex = this.vertices.length / 3;

        // Add vertices for the floor
        this.vertices.push(
            x, y, z, // Bottom-left
            x + width, y, z, // Bottom-right
            x + width, y, z + depth, // Top-right
            x, y, z + depth // Top-left
        );

        // Add normals (all pointing up)
        for (let i = 0; i < 4; i++) {
            this.normals.push(0, 1, 0);
        }

        // Add colors
        for (let i = 0; i < 4; i++) {
            this.colors.push(...color);
        }

        // Add indices for the quad
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 3, true);
    }

    addWall(x1, y1, z1, x2, y2, z2, height, color) {
        const baseIndex = this.vertices.length / 3;

        // Calculate wall direction and normal
        const dirX = x2 - x1;
        const dirZ = z2 - z1;
        const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
        const normalX = dirZ / length;
        const normalZ = -dirX / length;

        // Add vertices
        this.vertices.push(
            x1, y1, z1, // Bottom-left
            x2, y2, z2, // Bottom-right
            x2, y2 + height, z2, // Top-right
            x1, y1 + height, z1 // Top-left
        );

        // Add normals and colors
        for (let i = 0; i < 4; i++) {
            this.normals.push(normalX, 0, normalZ);
            this.colors.push(...color);
        }

        // Add indices (double-sided)
        WebGLGeometryBuilder.createQuad(this.indices, this.vertices, baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 3, false, true);
    }

    // Method to build and return mesh data
    build() {
        return {
            vertices: this.vertices,
            normals: this.normals,
            colors: this.colors,
            indices: this.indices,
            vertexBuffer: WebGLUtils.createBuffer(this.gl, this.vertices),
            normalBuffer: WebGLUtils.createBuffer(this.gl, this.normals),
            colorBuffer: WebGLUtils.createBuffer(this.gl, this.colors),
            indexBuffer: WebGLUtils.createIndexBuffer(this.gl, this.indices),
            indexCount: this.indices.length
        };
    }

    // Method to clear all data
    clear() {
        this.vertices = [];
        this.normals = [];
        this.colors = [];
        this.indices = [];
    }
}

// Renderer class to handle WebGL rendering
class Renderer {
    constructor(gl) {
        this.gl = gl;
        this.shaderPrograms = {};
    }

    initGL() {
        const gl = this.gl;

        // Configure WebGL
        gl.clearColor(0.6, 0.8, 1.0, 1.0); // Sky blue
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
    }

    addShaderProgram(name, vsSource, fsSource) {
        this.shaderPrograms[name] = WebGLUtils.createShaderProgram(this.gl, vsSource, fsSource);
        return this.shaderPrograms[name];
    }

    getShaderProgram(name) {
        return this.shaderPrograms[name];
    }

    setupShader(programName, modelMatrix, viewMatrix, projectionMatrix, lightDirection = [0.5, 1.0, 0.5]) {
        const gl = this.gl;
        const program = this.shaderPrograms[programName];

        gl.useProgram(program);

        // Set uniforms
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uModelMatrix"), false, modelMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uViewMatrix"), false, viewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "uProjectionMatrix"), false, projectionMatrix);
        gl.uniform3fv(gl.getUniformLocation(program, "uLightDirection"), lightDirection);
    }

    drawMesh(mesh, programName, modelMatrix, viewMatrix, projectionMatrix, lightDirection = [0.5, 1.0, 0.5]) {
        const gl = this.gl;
        const program = this.shaderPrograms[programName];

        // Setup shader and uniforms
        this.setupShader(programName, modelMatrix, viewMatrix, projectionMatrix, lightDirection);

        // Bind vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
        const vertexPositionLocation = gl.getAttribLocation(program, "aVertexPosition");
        gl.vertexAttribPointer(vertexPositionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vertexPositionLocation);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
        const vertexNormalLocation = gl.getAttribLocation(program, "aVertexNormal");
        gl.vertexAttribPointer(vertexNormalLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vertexNormalLocation);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
        const vertexColorLocation = gl.getAttribLocation(program, "aVertexColor");
        gl.vertexAttribPointer(vertexColorLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vertexColorLocation);

        // Draw the mesh
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    clear(r = 0.6, g = 0.8, b = 1.0, a = 1.0) {
        const gl = this.gl;
        gl.clearColor(r, g, b, a);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
}

// Memory Block class for 3D WebGL rendering
class MemoryBlock {
	constructor(gl, position, type = "cube", blockSize = 5) { // Add gl and blockSize parameters
		this.gl = gl; // Store gl context
		this.id = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		this.position = position.clone();
		this.type = type;
		this.text = "";
        this.blockSize = blockSize; // Store blockSize

		// Create the 3D visual representation
		this.model = null;
		this.createVisual();
	}

	createVisual() {
		// Create 3D geometry for WebGL rendering
		const builder = new WebGLGeometryBuilder(this.gl); // Use stored gl context
		builder.addBox(
			0, 0, 0, // Position relative to block's own position
			this.blockSize, this.blockSize, this.blockSize, // Use this.blockSize
			[0.545, 0.451, 0.333] // brownish color like wood
		);
		const geometry = builder.build();
        this.model = new ActionModel3D(geometry);
        this.model.position.copy(this.position); // Set model's position
        this.model.setColor(0.545, 0.451, 0.333); // Set model's color
	}

	setText(text) {
		this.text = text;
	}

	getText() {
		return this.text;
	}

	toJSON() {
		return {
			id: this.id,
			position: {
				x: this.position.x,
				y: this.position.y,
				z: this.position.z
			},
			type: this.type,
			text: this.text,
            blockSize: this.blockSize // Add blockSize to JSON
		};
	}

	static fromJSON(gl, data) { // Add gl parameter
		const block = new MemoryBlock(
            gl, // Pass gl to constructor
			new Vector3(data.position.x, data.position.y, data.position.z),
			data.type,
            data.blockSize // Pass blockSize from JSON
		);
		block.id = data.id;
		block.text = data.text;
		return block;
	}

	draw(renderer, viewMatrix, projectionMatrix) {
		if (!this.model || !this.model.geometry) return; // Use this.model

		// Create model matrix for block position
		const modelMatrix = Matrix4.create();
		Matrix4.translate(modelMatrix, modelMatrix, [
			this.model.position.x, // Use model's position
			this.model.position.y,
			this.model.position.z
		]);

		// Draw the block mesh
		renderer.drawMesh(this.model.geometry, "basic", modelMatrix, viewMatrix, projectionMatrix);
	}
}

// Text Editor for notes (2D overlay)
class TextEditor {
	constructor(game) {
		this.game = game;
		this.isOpen = false;
		this.currentBlock = null;
		this.textContent = "";
		this.scrollOffset = 0;

		// Editor dimensions
		this.width = 600;
		this.height = 400;
		this.x = (800 - this.width) / 2;
		this.y = (600 - this.height) / 2;
		this.padding = 20;

		// Text area dimensions
		this.textAreaX = this.x + this.padding;
		this.textAreaY = this.y + 60;
		this.textAreaWidth = this.width - this.padding * 2;
		this.textAreaHeight = this.height - 140;

		// Button dimensions
		this.buttonWidth = 120;
		this.buttonHeight = 40;
		this.buttonY = this.y + this.height - 60;

		// Cursor state
		this.cursorPosition = 0;
		this.cursorBlinkTime = 0;
		this.cursorVisible = true;

		// Register UI elements
		this.registerElements();
	}

	registerElements() {
		// Save button
		this.game.input.registerElement("editorSave", {
			bounds: () => ({
				x: this.x + this.padding,
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Delete button
		this.game.input.registerElement("editorDelete", {
			bounds: () => ({
				x: this.x + this.padding + this.buttonWidth + 20,
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Close button
		this.game.input.registerElement("editorClose", {
			bounds: () => ({
				x: this.x + this.width - this.padding - this.buttonWidth,
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Text area (for click to focus)
		this.game.input.registerElement("editorTextArea", {
			bounds: () => ({
				x: this.textAreaX,
				y: this.textAreaY,
				width: this.textAreaWidth,
				height: this.textAreaHeight
			})
		}, "gui");
	}

	open(block) {
		this.isOpen = true;
		this.currentBlock = block;
		this.textContent = block.getText();
		this.cursorPosition = this.textContent.length;
		this.scrollOffset = 0;

		// Capture keyboard input
		this.game.capturingTextInput = true;
	}

	close() {
		this.isOpen = false;
		this.currentBlock = null;
		this.game.capturingTextInput = false;
	}

	save() {
		if (this.currentBlock) {
		    this.currentBlock.setText(this.textContent);
		    this.game.saveToStorage();
		    this.game.addMessage("Note saved!");
		}
		this.close();
	}

	delete() {
		if (this.currentBlock) {
			this.currentBlock.setText("");
			this.game.saveToLocalStorage();
			this.game.addMessage("Note deleted!");
		}
		this.close();
	}

	handleInput() {
		if (!this.isOpen) return;

		// Handle button clicks
		if (this.game.input.isElementJustPressed("editorSave", "gui")) {
			this.save();
			return;
		}

		if (this.game.input.isElementJustPressed("editorDelete", "gui")) {
			this.delete();
			return;
		}

		if (this.game.input.isElementJustPressed("editorClose", "gui")) {
			this.close();
			return;
		}

		// Handle text input (we'll use a simple system)
		// Note: In a real implementation, you'd want proper keyboard event handling
		// For this demo, we'll simulate with action keys

		// Backspace simulation with Action2
		if (this.game.input.isKeyJustPressed("Action2") && this.cursorPosition > 0) {
			this.textContent =
				this.textContent.slice(0, this.cursorPosition - 1) +
				this.textContent.slice(this.cursorPosition);
			this.cursorPosition--;
		}

		// Add newline with Action1
		if (this.game.input.isKeyJustPressed("Action1")) {
			this.textContent =
				this.textContent.slice(0, this.cursorPosition) +
				"\n" +
				this.textContent.slice(this.cursorPosition);
			this.cursorPosition++;
		}
	}

	update(deltaTime) {
		if (!this.isOpen) return;

		// Cursor blink animation
		this.cursorBlinkTime += deltaTime;
		if (this.cursorBlinkTime > 0.5) {
			this.cursorVisible = !this.cursorVisible;
			this.cursorBlinkTime = 0;
		}
	}

	draw(ctx) {
		if (!this.isOpen) return;

		// Semi-transparent backdrop
		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.fillRect(0, 0, 800, 600);

		// Editor window background
		ctx.fillStyle = "#2a2a3e";
		ctx.fillRect(this.x, this.y, this.width, this.height);

		// Border
		ctx.strokeStyle = "#4a4a6e";
		ctx.lineWidth = 2;
		ctx.strokeRect(this.x, this.y, this.width, this.height);

		// Title bar
		ctx.fillStyle = "#1a1a2e";
		ctx.fillRect(this.x, this.y, this.width, 50);

		ctx.fillStyle = "#ffffff";
		ctx.font = "20px Arial";
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillText("Block Notes", this.x + this.padding, this.y + 25);

		// Text area background
		ctx.fillStyle = "#1a1a2e";
		ctx.fillRect(this.textAreaX, this.textAreaY, this.textAreaWidth, this.textAreaHeight);

		// Text area border
		ctx.strokeStyle = "#4a4a6e";
		ctx.lineWidth = 1;
		ctx.strokeRect(this.textAreaX, this.textAreaY, this.textAreaWidth, this.textAreaHeight);

		// Draw text content
		ctx.save();
		ctx.beginPath();
		ctx.rect(this.textAreaX, this.textAreaY, this.textAreaWidth, this.textAreaHeight);
		ctx.clip();

		ctx.fillStyle = "#e0e0e0";
		ctx.font = "16px monospace";
		ctx.textAlign = "left";
		ctx.textBaseline = "top";

		const lines = this.textContent.split('\n');
		const lineHeight = 22;
		let y = this.textAreaY + 10 - this.scrollOffset;

		lines.forEach((line, index) => {
			ctx.fillText(line || " ", this.textAreaX + 10, y);
			y += lineHeight;
		});

		// Draw cursor
		if (this.cursorVisible) {
			const cursorLine = this.textContent.slice(0, this.cursorPosition).split('\n').length - 1;
			const cursorY = this.textAreaY + 10 + (cursorLine * lineHeight) - this.scrollOffset;
			const lastLineText = this.textContent.slice(0, this.cursorPosition).split('\n').pop();
			const cursorX = this.textAreaX + 10 + ctx.measureText(lastLineText).width;

			ctx.fillStyle = "#ffffff";
			ctx.fillRect(cursorX, cursorY, 2, 18);
		}

		ctx.restore();

		// Draw buttons
		this.drawButton(ctx, "Save", this.x + this.padding, this.buttonY,
			this.game.input.isElementHovered("editorSave", "gui"));

		this.drawButton(ctx, "Delete", this.x + this.padding + this.buttonWidth + 20, this.buttonY,
			this.game.input.isElementHovered("editorDelete", "gui"));

		this.drawButton(ctx, "Close", this.x + this.width - this.padding - this.buttonWidth, this.buttonY,
			this.game.input.isElementHovered("editorClose", "gui"));

		// Instructions
		ctx.fillStyle = "#888888";
		ctx.font = "12px Arial";
		ctx.textAlign = "center";
		ctx.fillText("Type to add text • Action1: New Line • Action2: Backspace",
			this.x + this.width / 2, this.y + this.height - 20);
	}

	drawButton(ctx, text, x, y, hovered) {
		ctx.fillStyle = hovered ? "#4a6fa5" : "#3a5f95";
		ctx.fillRect(x, y, this.buttonWidth, this.buttonHeight);

		ctx.strokeStyle = "#5a7fb5";
		ctx.lineWidth = 2;
		ctx.strokeRect(x, y, this.buttonWidth, this.buttonHeight);

		ctx.fillStyle = "#ffffff";
		ctx.font = "16px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(text, x + this.buttonWidth / 2, y + this.buttonHeight / 2);
	}
}

// Main Game class using WebGL
class Game {
    static WIDTH = 800;
    static HEIGHT = 600;

    constructor(canvases, input, audio) {
        // Store Action Engine references
        this.input = input;
        this.audio = audio;

        // Canvas setup
        this.canvas = canvases.gameCanvas;
        this.gl = this.canvas.getContext("webgl");
        this.guiCtx = canvases.guiCtx;
        this.debugCtx = canvases.debugCtx;

        if (!this.gl) {
            console.error("WebGL not supported");
            return;
        }

        // Create renderer
        this.renderer = new Renderer(this.gl);
        this.renderer.initGL();

        // Game state
        this.state = {
            gameOver: false,
            score: 0,
            health: 100,
            ammo: 30,
            showDebug: false,
            paused: false
        };

        // Initialize game systems
        this.initWebGL();
        this.createSounds();
        this.buildLevel();
        this.setupPlayer();

        // Initialize messages array before creating blocks
        this.messages = [];
        this.maxMessages = 10;

        // Backend integration
        this.useBackend = true;
        this.backendAvailable = window.BACKEND_AVAILABLE || false;

        this.createBlocks();

        // Start game loop
        this.lastTime = performance.now();

        // Add cursor lock support
        this.cursorLocked = false;
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;

        // Set up pointer lock event listeners
        document.addEventListener("keydown", (e) => {
            if (e.code === "KeyC") {
                this.toggleCursorLock();
            }
        });

        document.addEventListener("pointerlockchange", () => {
            this.handlePointerLockChange();
        });

        // Also try clicking on canvas to lock
        document.addEventListener("click", (e) => {
            if (e.target === this.canvas && !this.cursorLocked) {
                this.toggleCursorLock();
            }
        });

        document.addEventListener("mousemove", (e) => {
            if (this.cursorLocked) {
                this.mouseDeltaX = e.movementX || 0;
                this.mouseDeltaY = e.movementY || 0;
            } else {
                this.mouseDeltaX = 0;
                this.mouseDeltaY = 0;
            }
        });

        // Text editor
        this.textEditor = new TextEditor(this);
        this.capturingTextInput = false;

        // Auto-save system
        this.autoSaveInterval = 30000; // 30 seconds
        this.lastAutoSave = Date.now();
        this.autoSaveIntervalId = null;

        this.loop();
    }

    initWebGL() {
        // Create shader programs
        this.renderer.addShaderProgram("basic", this.basicVertexShader(), this.basicFragmentShader());

        // Set up projection matrix
        this.projectionMatrix = Matrix4.create();
        Matrix4.perspective(
            this.projectionMatrix,
            (60 * Math.PI) / 180, // 60 degrees FOV
            this.canvas.width / this.canvas.height,
            0.1,
            1000.0
        );
    }

    toggleCursorLock() {
        if (!this.cursorLocked) {
            this.canvas.requestPointerLock();
            console.log('🔒 Requesting pointer lock...');
        } else {
            document.exitPointerLock();
            console.log('🔓 Exiting pointer lock...');
        }
    }

    // Enhanced mouse lock handling
    handlePointerLockChange() {
        const isLocked = document.pointerLockElement === this.canvas;
        this.cursorLocked = isLocked;

        if (isLocked) {
            console.log('✅ Pointer lock acquired');
            this.addMessage("🔒 Mouse locked - ready to place blocks!");
        } else {
            console.log('❌ Pointer lock lost');
            this.addMessage("🔓 Mouse unlocked - click canvas to continue");
        }
    }

    basicVertexShader() {
        return `
            attribute vec4 aVertexPosition;
            attribute vec3 aVertexNormal;
            attribute vec3 aVertexColor;

            uniform mat4 uModelMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;

            varying vec3 vNormal;
            varying vec3 vColor;

            void main() {
                gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aVertexPosition;
                vNormal = mat3(uModelMatrix) * aVertexNormal;
                vColor = aVertexColor;
            }
        `;
    }

    basicFragmentShader() {
        return `
            precision mediump float;

            varying vec3 vNormal;
            varying vec3 vColor;

            uniform vec3 uLightDirection;

            void main() {
                vec3 normal = normalize(vNormal);
                float light = max(dot(normal, normalize(uLightDirection)), 0.0);
                vec3 ambient = vColor * 0.3;
                vec3 diffuse = vColor * light * 0.7;
                gl_FragColor = vec4(ambient + diffuse, 1.0);
            }
        `;
    }

    createSounds() {
        // Block placement sound
        this.audio.createSweepSound("placeBlock", {
            startFreq: 400,
            endFreq: 600,
            type: "sine",
            duration: 0.1,
            envelope: {
                attack: 0.01,
                decay: 0.05,
                sustain: 0.5,
                release: 0.04
            }
        });

        // UI click sound
        this.audio.createSweepSound("uiClick", {
            startFreq: 800,
            endFreq: 1000,
            type: "sine",
            duration: 0.08,
            envelope: {
                attack: 0.01,
                decay: 0.03,
                sustain: 0.3,
                release: 0.04
            }
        });

        // Save sound
        this.audio.createComplexSound("save", {
            frequencies: [440, 550, 660],
            types: ["sine", "sine", "sine"],
            mix: [0.4, 0.3, 0.3],
            duration: 0.3,
            envelope: {
                attack: 0.05,
                decay: 0.1,
                sustain: 0.5,
                release: 0.15
            }
        });
    }

    buildLevel() {
        // Create level geometry
        this.level = new Level(this.gl, this.renderer);
    }

    setupPlayer() {
        this.player = new Player(this, this.level);

        // Initialize at starting position
        this.player.position = new Vector3(5, 1.8, 5);
        this.player.velocity = new Vector3(0, 0, 0);
    }

    createBlocks() {
        this.blocks = new Map();
        this.selectedBlockType = "cube";
        this.placementRange = 50;
        this.blockSize = 5;

        // Raycasting for block placement/selection
        this.hoveredBlock = null;
        this.hoveredFace = null;
        this.persistentHighlightPosition = null; // NEW: Stores last targeted position persistently

        // Load saved data
        this.loadFromStorage();
    }

    update() {
        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
        this.lastTime = currentTime;
        this.deltaTime = deltaTime;

        // Handle text editor input first (captures input when open)
        this.textEditor.handleInput();
        this.textEditor.update(deltaTime);

        // Don't handle game input if editor is open
        if (this.textEditor.isOpen) return;

        // Update player
        this.player.update(this.input, deltaTime);

        // Raycast for block interaction
        this.raycastBlocks();

        // Block placement (left click)
        if (this.input.isLeftMouseButtonJustPressed() && this.cursorLocked) {
            this.placeBlock();
        }

        // Block editor (right click)
        if (this.input.isRightMouseButtonJustPressed() && this.cursorLocked) {
            this.openBlockEditor();
        }

        // Manual save with Action2
        if (this.input.isKeyJustPressed("Action2")) {
            this.saveToStorage();
            this.addMessage("Progress saved!");
        }

        // Toggle debug with F9
        if (this.input.isKeyJustPressed("ActionDebugToggle")) {
            this.state.showDebug = !this.state.showDebug;
        }

        // Handle export/import keyboard shortcuts
        if (this.input.isKeyPressed('Control') && this.input.isKeyJustPressed('e')) {
            this.exportData();
        }
        if (this.input.isKeyPressed('Control') && this.input.isKeyJustPressed('i')) {
            this.importData();
        }

        // Alternative block placement (for testing) - press B key
        if (this.input.isKeyJustPressed('b') && this.cursorLocked) {
            this.placeBlockAtCameraPosition();
        }
    }

    draw() {
        // Clear the canvas
        this.renderer.clear();

        // Get view matrix from player camera
        const viewMatrix = this.player.getViewMatrix();

        // Draw level
        this.level.draw(this.renderer, viewMatrix, this.projectionMatrix);

        // Draw all blocks
        this.blocks.forEach((block, id) => {
            if (block && block.model) {
                try {
                    block.draw(this.renderer, viewMatrix, this.projectionMatrix);
                    console.log(`Game.draw: Block ${id} model position: (${block.model.position.x.toFixed(1)}, ${block.model.position.y.toFixed(1)}, ${block.model.position.z.toFixed(1)})`);
                } catch (error) {
                    console.error('❌ Error drawing block:', id, error);
                }
            } else {
                console.warn('⚠️ Block missing model:', id, !!block, !!block?.model);
            }
        });

        // Debug: Show block count and positions
        if (this.blocks.size > 0) {
            console.log('🎲 Drawing blocks:', this.blocks.size);
            this.blocks.forEach((block, id) => {
                console.log(`  Block ${id}: pos(${block.position.x.toFixed(1)}, ${block.position.y.toFixed(1)}, ${block.position.z.toFixed(1)})`);
            });
        }

        // Draw persistent highlight - always visible if we have a stored position
        // if (this.persistentHighlightPosition) {  // CHANGED: Use persistent position instead of hoveredBlock
        //     this.drawHoveredBlockHighlight(this.renderer, viewMatrix, this.projectionMatrix);
        // }

        // Draw 2D UI elements
        this.drawUI();

        // Draw debug info if enabled
        if (this.state.showDebug) {
            this.drawDebugInfo();
        }
    }

    raycastBlocks() {
        // Enhanced raycast: shoot ray from camera, find first hit with room geometry
        if (!this.cursorLocked) {
            this.persistentHighlightPosition = null;
            this.hoveredFace = null;
            return;
        }

        const ray = this.getRayFromCamera();
        const hitResult = this.castRayIntoRoom(ray);

        if (hitResult) {
            this.persistentHighlightPosition = hitResult.position;
            this.hoveredFace = hitResult.face;

            // Debug logging to help troubleshoot
            console.log('🎯 Raycast hit:', {
                position: hitResult.position,
                face: hitResult.face,
                distance: hitResult.distance
            });
        } else {
            this.persistentHighlightPosition = null;
            this.hoveredFace = null;
        }
    }

    getRayFromCamera() {
        // Get camera forward direction - match the camera target calculation
        const lookDistance = 50;

        // Debug: Log current rotation values
        console.log(`Player rotation - pitch(x): ${this.player.rotation.x.toFixed(3)}, yaw(y): ${this.player.rotation.y.toFixed(3)}`);

        // Calculate forward direction based on camera rotation
        // Fix Z coordinate system - when moving +Z, raycast should hit +Z, not -Z
        const forward = new Vector3(
            Math.sin(this.player.rotation.y) * Math.cos(this.player.rotation.x) * lookDistance,
            -Math.sin(this.player.rotation.x) * lookDistance,  // NEGATIVE Y for down pitch
            -Math.cos(this.player.rotation.y) * Math.cos(this.player.rotation.x) * lookDistance  // FLIP Z for correct coordinate system
        );

        console.log(`Calculated forward vector: (${forward.x.toFixed(2)}, ${forward.y.toFixed(2)}, ${forward.z.toFixed(2)})`);

        const normalized = forward.normalize();
        console.log(`Normalized direction: (${normalized.x.toFixed(2)}, ${normalized.y.toFixed(2)}, ${normalized.z.toFixed(2)})`);

        return {
            origin: this.player.position.clone(),
            direction: normalized
        };
    }

    rayBoxIntersection(ray, block) {
        const size = this.blockSize;

        const min = new Vector3(
            block.position.x - size / 2,
            block.position.y - size / 2,
            block.position.z - size / 2
        );

        const max = new Vector3(
            block.position.x + size / 2,
            block.position.y + size / 2,
            block.position.z + size / 2
        );

        let tmin = (min.x - ray.origin.x) / ray.direction.x;
        let tmax = (max.x - ray.origin.x) / ray.direction.x;

        if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

        let tymin = (min.y - ray.origin.y) / ray.direction.y;
        let tymax = (max.y - ray.origin.y) / ray.direction.y;

        if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

        if ((tmin > tymax) || (tymin > tmax)) return null;

        if (tymin > tmin) tmin = tymin;
        if (tymax < tmax) tmax = tymax;

        let tzmin = (min.z - ray.origin.z) / ray.direction.z;
        let tzmax = (max.z - ray.origin.z) / ray.direction.z;

        if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

        if ((tmin > tzmax) || (tzmin > tmax)) return null;

        if (tzmin > tmin) tmin = tzmin;
        if (tzmax < tmax) tmax = tzmax;

        if (tmin < 0) return null;

        // Calculate the exact hit point
        const hitPoint = new Vector3(
            ray.origin.x + ray.direction.x * tmin,
            ray.origin.y + ray.direction.y * tmin,
            ray.origin.z + ray.direction.z * tmin
        );

        // Determine which face was hit
        const epsilon = 0.01;
        let face = "top";

        if (Math.abs(hitPoint.x - min.x) < epsilon) face = "west";
        else if (Math.abs(hitPoint.x - max.x) < epsilon) face = "east";
        else if (Math.abs(hitPoint.y - min.y) < epsilon) face = "bottom";
        else if (Math.abs(hitPoint.y - max.y) < epsilon) face = "top";
        else if (Math.abs(hitPoint.z - min.z) < epsilon) face = "north";
        else if (Math.abs(hitPoint.z - max.z) < epsilon) face = "south";

        return { distance: tmin, face, hitPoint };
    }

    // Enhanced raycast against room geometry (walls, floor, ceiling)
    castRayIntoRoom(ray) {
        const roomSize = 125; // half room size
        const maxDistance = 100; // Maximum raycast distance
        let closestDistance = Infinity;
        let closestHit = null;
        let closestFace = "";

        // Test floor (Y = 0) - increased bounds
        const floorHit = this.rayPlaneIntersection(ray, { y: 0 }, "floor");
        if (floorHit && floorHit.distance < closestDistance && floorHit.distance <= maxDistance &&
            Math.abs(floorHit.position.x) <= roomSize + 10 && Math.abs(floorHit.position.z) <= roomSize + 10) {
            closestDistance = floorHit.distance;
            closestHit = floorHit;
            closestFace = "floor";
        }

        // Test ceiling (Y = 125) - increased bounds
        const ceilingHit = this.rayPlaneIntersection(ray, { y: 125 }, "ceiling");
        if (ceilingHit && ceilingHit.distance < closestDistance && ceilingHit.distance <= maxDistance &&
            Math.abs(ceilingHit.position.x) <= roomSize + 10 && Math.abs(ceilingHit.position.z) <= roomSize + 10) {
            closestDistance = ceilingHit.distance;
            closestHit = ceilingHit;
            closestFace = "ceiling";
        }

        // Test north wall (Z = -125) - increased bounds
        const northHit = this.rayPlaneIntersection(ray, { z: -roomSize }, "north");
        if (northHit && northHit.distance < closestDistance && northHit.distance <= maxDistance &&
            Math.abs(northHit.position.x) <= roomSize + 10 && northHit.position.y >= -5 && northHit.position.y <= 130) {
            closestDistance = northHit.distance;
            closestHit = northHit;
            closestFace = "north";
        }

        // Test south wall (Z = 125) - increased bounds
        const southHit = this.rayPlaneIntersection(ray, { z: roomSize }, "south");
        if (southHit && southHit.distance < closestDistance && southHit.distance <= maxDistance &&
            Math.abs(southHit.position.x) <= roomSize + 10 && southHit.position.y >= -5 && southHit.position.y <= 130) {
            closestDistance = southHit.distance;
            closestHit = southHit;
            closestFace = "south";
        }

        // Test east wall (X = 125) - increased bounds
        const eastHit = this.rayPlaneIntersection(ray, { x: roomSize }, "east");
        if (eastHit && eastHit.distance < closestDistance && eastHit.distance <= maxDistance &&
            Math.abs(eastHit.position.z) <= roomSize + 10 && eastHit.position.y >= -5 && eastHit.position.y <= 130) {
            closestDistance = eastHit.distance;
            closestHit = eastHit;
            closestFace = "east";
        }

        // Test west wall (X = -125) - increased bounds
        const westHit = this.rayPlaneIntersection(ray, { x: -roomSize }, "west");
        if (westHit && westHit.distance < closestDistance && westHit.distance <= maxDistance &&
            Math.abs(westHit.position.z) <= roomSize + 10 && westHit.position.y >= -5 && westHit.position.y <= 130) {
            closestDistance = westHit.distance;
            closestHit = westHit;
            closestFace = "west";
        }

        return closestHit ? { position: closestHit.position, face: closestFace, distance: closestHit.distance } : null;
    }

    // Ray-plane intersection helper
    rayPlaneIntersection(ray, plane, faceName) {
        // Plane defined by a point on the plane and normal vector
        let normal, point;

        if (plane.y !== undefined) {
            // Horizontal plane (floor/ceiling)
            normal = new Vector3(0, plane.y > 0 ? 1 : -1, 0);
            point = new Vector3(0, plane.y, 0);
        } else if (plane.x !== undefined) {
            // Vertical plane (east/west walls)
            normal = new Vector3(plane.x > 0 ? 1 : -1, 0, 0);
            point = new Vector3(plane.x, 0, 0);
        } else if (plane.z !== undefined) {
            // Vertical plane (north/south walls)
            normal = new Vector3(0, 0, plane.z > 0 ? 1 : -1);
            point = new Vector3(0, 0, plane.z);
        }

        // Ray-plane intersection formula
        const denom = ray.direction.dot(normal);

        // If ray is parallel to plane, no intersection
        if (Math.abs(denom) < 0.0001) {
            return null;
        }

        const t = Vector3.subtract(point, ray.origin).dot(normal) / denom;

        // If intersection is behind ray origin, ignore
        if (t < 0) {
            return null;
        }

        // Calculate hit position
        const hitPosition = new Vector3(
            ray.origin.x + ray.direction.x * t,
            ray.origin.y + ray.direction.y * t,
            ray.origin.z + ray.direction.z * t
        );

        return {
            position: hitPosition,
            distance: t,
            face: faceName
        };
    }

placeBlock() {
    // Debug: Check if we have the required data
    console.log('🎯 Place block attempt:', {
        cursorLocked: this.cursorLocked,
        hasPersistentPosition: !!this.persistentHighlightPosition,
        position: this.persistentHighlightPosition
    });

    if (!this.cursorLocked) {
        this.addMessage("🔒 Click canvas to lock mouse first!");
        return;
    }

    if (!this.persistentHighlightPosition) {
        this.addMessage("🎯 Point at a surface (wall/floor/ceiling)");
        return;
    }

    // Calculate placement position based on face and hit point
    const offset = this.blockSize;
    let newPos = this.persistentHighlightPosition.clone();
    console.log('placeBlock: initial newPos from highlight:', newPos.toArray());

    // Adjust position based on which face was hit
    switch (this.hoveredFace) {
        case "top": newPos.y += offset / 2; break;
        case "bottom": newPos.y += offset / 2; break; // Adjust up by half block size to sit on the floor
        case "north": newPos.z -= offset / 2; break;
        case "south": newPos.z += offset / 2; break;
        case "east": newPos.x += offset / 2; break;
        case "west": newPos.x -= offset / 2; break;
    }
    console.log('placeBlock: newPos after face adjustment:', newPos.toArray());

    // Round to grid
    newPos.x = Math.round(newPos.x);
    newPos.y = Math.round(newPos.y);
    newPos.z = Math.round(newPos.z);
    console.log('placeBlock: newPos after rounding:', newPos.toArray());

    // Check if position is already occupied
    for (let [id, block] of this.blocks) {
        if (block.position.distanceTo(newPos) < this.blockSize * 0.5) {
            this.addMessage("❌ Position already occupied!");
            return;
        }
    }

    // Create new block
    const block = new MemoryBlock(this.gl, newPos.clone(), this.selectedBlockType, this.blockSize); // Pass this.gl
    this.blocks.set(block.id, block);

    // Ensure block is visible in 3D scene
    if (block.model) {
        block.model.setColor(0.0, 1.0, 0.0); // Bright green for high visibility
        block.model.position.set(newPos.x, newPos.y, newPos.z);
        console.log('🎁 New block model created:', {
            id: block.id,
            position: newPos,
            model: !!block.model,
            color: 'bright green'
        });
    } else {
        console.error('❌ Block model not created!');
        // Try manual geometry creation
        console.log('🔄 Creating block with manual geometry...');
        
        // Create simple cube geometry manually
        const size = 0.5;
        const vertices = new Float32Array([
            // Front face
            -size, -size,  size,  size, -size,  size,  size,  size,  size, -size,  size,  size,
            // Back face
            -size, -size, -size, -size,  size, -size,  size,  size, -size,  size, -size, -size,
            // Top face
            -size,  size, -size, -size,  size,  size,  size,  size,  size,  size,  size, -size,
            // Bottom face
            -size, -size, -size,  size, -size, -size,  size, -size,  size, -size, -size,  size,
            // Right face
             size, -size, -size,  size,  size, -size,  size,  size,  size,  size, -size,  size,
            // Left face
            -size, -size, -size, -size, -size,  size, -size,  size,  size, -size,  size, -size
        ]);

        const indices = new Uint16Array([
            0,  1,  2,    0,  2,  3,    // front
            4,  5,  6,    4,  6,  7,    // back
            8,  9,  10,   8,  10, 11,   // top
            12, 13, 14,   12, 14, 15,   // bottom
            16, 17, 18,   16, 18, 19,   // right
            20, 21, 22,   20, 22, 23    // left
        ]);

        const geometry = {
            vertices: vertices,
            indices: indices,
            vertexCount: vertices.length / 3,
            indexCount: indices.length
        };

        const model = new ActionModel3D(geometry);
        model.position.set(newPos.x, newPos.y, newPos.z);
        model.setColor(1.0, 0.0, 0.0); // Red as fallback
        block.model = model;
        block.position = newPos.clone(); // Ensure position is set
        this.addObject(model);
        console.log('✅ Manual block creation successful');
    }

    this.audio.play("placeBlock");
    this.addMessage(`✅ Block placed at (${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)})`);

    this.saveToStorage();
}

    // Alternative block placement method (fallback) - press B key
    placeBlockAtCameraPosition() {
        // Place block 5 units in front of camera
        const distance = 5;
        const cameraPos = this.player.position;
        const newPos = new Vector3(
            cameraPos.x + Math.sin(this.player.rotation.y) * distance,
            cameraPos.y,
            cameraPos.z - Math.cos(this.player.rotation.y) * distance
        );

        // Round to grid
        newPos.x = Math.round(newPos.x);
        newPos.y = Math.round(newPos.y);
        newPos.z = Math.round(newPos.z);

        // Check if position is already occupied
        for (let [id, block] of this.blocks) {
            if (block.position.distanceTo(newPos) < this.blockSize * 0.5) {
                this.addMessage("❌ Position already occupied!");
                return;
            }
        }

        // Create new block
        const block = new MemoryBlock(newPos, this.selectedBlockType);
        this.blocks.set(block.id, block);

        this.audio.play("placeBlock");
        this.addMessage(`✅ Block placed at (${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)})`);

        this.saveToStorage();
    }

    openBlockEditor() {
        if (!this.hoveredBlock || this.hoveredBlock.isFloor) return;

        this.textEditor.open(this.hoveredBlock);
        this.audio.play("uiClick");
    }

    drawHoveredBlockHighlight(renderer, viewMatrix, projectionMatrix) {
        if (!this.persistentHighlightPosition) return;

        // Create model matrix for highlight position at exact hit location
        const modelMatrix = Matrix4.create();
        Matrix4.translate(modelMatrix, modelMatrix, [
            this.persistentHighlightPosition.x,
            this.persistentHighlightPosition.y,
            this.persistentHighlightPosition.z
        ]);

        // Scale up slightly for highlight effect
        Matrix4.scale(modelMatrix, modelMatrix, [1.1, 1.1, 1.1]);

        // Create highlight geometry (wireframe cube)
        const builder = new WebGLGeometryBuilder(this.gl);
        builder.addBox(-2.5, -2.5, -2.5, 5, 5, 5, [1.0, 1.0, 0.0]); // Yellow highlight
        const highlightMesh = builder.build();

        // Draw with wireframe effect (we'll use the basic shader but with emissive color)
        renderer.drawMesh(highlightMesh, "basic", modelMatrix, viewMatrix, projectionMatrix, [1.0, 1.0, 1.0]);
    }

    async saveToStorage() {
        const data = {
            blocks: Array.from(this.blocks.values()).map(block => block.toJSON()),
            camera: {
                position: {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    z: this.player.position.z
                },
                rotation: {
                    x: this.player.rotation.x,
                    y: this.player.rotation.y
                }
            },
            timestamp: Date.now()
        };

        // Save to localStorage
        try {
            localStorage.setItem('memoryPalace', JSON.stringify(data));
            console.log('💾 Saved to localStorage');
        } catch (error) {
            console.error('❌ Failed to save to localStorage:', error);
        }

        // Save to backend if available
        if (this.backendAvailable && this.useBackend) {
            try {
                await MemoryPalaceAPI.bulkSaveBlocks(data.blocks);
                await MemoryPalaceAPI.saveCameraState(data.camera.position, data.camera.rotation);
                this.addMessage("💾 Saved to server");
                console.log('💾 Saved to backend');
            } catch (error) {
                console.error('❌ Failed to save to backend:', error);
                this.addMessage("⚠️ Server save failed");
            }
        } else {
            this.addMessage("💾 Saved locally");
        }
    }

    async loadFromStorage() {
        let data = null;

        // Try loading from backend first
        if (this.backendAvailable && this.useBackend) {
            try {
                const response = await MemoryPalaceAPI.getAllBlocks();
                const cameraState = await MemoryPalaceAPI.getCameraState();

                data = {
                    blocks: response.blocks,
                    camera: cameraState
                };

                this.addMessage("📥 Loaded from server");
                console.log('📥 Loaded from backend');
            } catch (error) {
                console.error('❌ Failed to load from backend:', error);
                this.addMessage("⚠️ Server load failed, trying local");
            }
        }

        // Fallback to localStorage
        if (!data) {
            try {
                const saved = localStorage.getItem('memoryPalace');
                if (saved) {
                    data = JSON.parse(saved);
                    this.addMessage("📥 Loaded from local storage");
                    console.log('📥 Loaded from localStorage');
                }
            } catch (error) {
                console.error('❌ Failed to load from localStorage:', error);
            }
        }

        if (!data) {
            console.log('ℹ️ No saved data found');
            return;
        }

        // Clear existing blocks
        this.blocks.forEach(block => {
            if (block.model) {
                this.removeObject(block.model);
            }
        });
        this.blocks.clear();

        // Load blocks
        if (data.blocks && Array.isArray(data.blocks)) {
            data.blocks.forEach(blockData => {
                const block = MemoryBlock.fromJSON(this.gl, blockData); // Pass this.gl

                // Adjust block position to sit on the floor if it was saved at y=0
                if (block.position.y === 0) {
                    block.position.y += block.blockSize / 2;
                }

                // Create 3D model
                const builder = new WebGLGeometryBuilder(this.gl); // Use this.gl
                builder.addBox(
                    0, 0, 0, // Position relative to block's own position
                    block.blockSize, block.blockSize, block.blockSize, // Use block's blockSize
                    [0.0, 1.0, 0.0] // Bright green for high visibility
                );
                const geometry = builder.build();
                const model = new ActionModel3D(geometry);
                model.position.copy(block.position);
                model.setColor(0.0, 1.0, 0.0); // Bright green for high visibility

                block.model = model;
                this.addObject(model);
                this.blocks.set(block.id, block);

                console.log('🎁 Loaded existing block:', {
                    id: block.id,
                    position: block.position,
                    model: !!model
                });
            });

            // Update block ID counter
            const maxId = Math.max(
                0,
                ...Array.from(this.blocks.keys())
                    .map(id => parseInt(id.replace('block_', '')) || 0)
            );
            this.blockIdCounter = maxId + 1;

            console.log(`✅ Loaded ${this.blocks.size} blocks`);
        }

        // Load camera position
        if (data.camera) {
            if (data.camera.position) {
                this.player.position.set(
                    data.camera.position.x,
                    data.camera.position.y,
                    data.camera.position.z
                );
            }
            if (data.camera.rotation) {
                this.player.rotation.set(
                    data.camera.rotation.x,
                    data.camera.rotation.y,
                    0
                );
            }
            console.log('✅ Camera position restored');
        }

        // Initialize auto-save system after game is fully loaded
        this.autoSaveInterval = 30000; // 30 seconds
        this.lastAutoSave = Date.now();
        this.autoSaveIntervalId = null;
        this.startAutoSave();
    }

    addMessage(msg) {
        this.messages.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }
    }

    drawUI() {
        this.guiCtx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);

        // Draw enhanced crosshair
        if (this.cursorLocked && this.persistentHighlightPosition) {
            // Green crosshair when ready to place
            this.guiCtx.strokeStyle = "#00ff00";
            this.guiCtx.lineWidth = 3;
            this.guiCtx.shadowColor = "#00ff00";
            this.guiCtx.shadowBlur = 5;
        } else if (this.cursorLocked) {
            // Yellow crosshair when locked but no target
            this.guiCtx.strokeStyle = "#ffff00";
            this.guiCtx.lineWidth = 2;
        } else {
            // White crosshair when unlocked
            this.guiCtx.strokeStyle = "#ffffff";
            this.guiCtx.lineWidth = 2;
            this.guiCtx.shadowBlur = 0;
        }

        this.guiCtx.beginPath();
        this.guiCtx.moveTo(395, 300);
        this.guiCtx.lineTo(405, 300);
        this.guiCtx.moveTo(400, 295);
        this.guiCtx.lineTo(400, 305);
        this.guiCtx.stroke();

        // Reset shadow
        this.guiCtx.shadowBlur = 0;

        // Always draw HUD (position, controls, etc.)
        this.drawHUD();

        // Draw text editor if open
        this.textEditor.draw(this.guiCtx);

        // Draw click-to-start screen if game not started
        if (!this.cursorLocked && !this.textEditor.isOpen) {
            this.drawClickToStart();
        }
    }

    drawHUD() {
        const ctx = this.guiCtx;

        // HUD background panel
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(10, 10, 300, 120);

        ctx.strokeStyle = "#4a4a6e";
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, 300, 120);

        // HUD text
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        const x = 20;
        let y = 20;
        const lineHeight = 22;

        ctx.fillText(`Position: (${Math.round(this.player.position.x)}, ${Math.round(this.player.position.y)}, ${Math.round(this.player.position.z)})`, x, y);
        y += lineHeight;

        ctx.fillText(`Blocks: ${this.blocks.size}`, x, y);
        y += lineHeight;

        if (this.hoveredBlock) {
            ctx.fillStyle = "#ffff00";
            ctx.fillText(`Target: Block (${this.hoveredFace})`, x, y);

            if (!this.hoveredBlock.isFloor && this.hoveredBlock.text) {
                y += lineHeight;
                ctx.fillStyle = "#00ff00";
                ctx.fillText(`Has notes: ${this.hoveredBlock.text.length} chars`, x, y);
            }
        }

        // Display raycast hit coordinates if available
        if (this.persistentHighlightPosition) {
            y += lineHeight;
            ctx.fillStyle = "#00ffff";
            ctx.fillText(`🎯 Ready: (${Math.round(this.persistentHighlightPosition.x)}, ${Math.round(this.persistentHighlightPosition.y)}, ${Math.round(this.persistentHighlightPosition.z)})`, x, y);

            if (this.hoveredFace) {
                y += lineHeight;
                ctx.fillStyle = "#ffff00";
                ctx.fillText(`📍 Face: ${this.hoveredFace} - Click to place!`, x, y);
            }
        } else {
            // Show that raycast is running but no hits found
            y += lineHeight;
            ctx.fillStyle = "#ff00ff";
            ctx.fillText(`❌ Point at wall/floor/ceiling`, x, y);
        }

        // Show cursor lock status
        y += lineHeight;
        ctx.fillStyle = this.cursorLocked ? "#00ff00" : "#ff0000";
        ctx.fillText(`🔒 Mouse: ${this.cursorLocked ? 'Locked' : 'Unlocked (click canvas)'}`, x, y);

        // Controls reminder (bottom right)
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(490, 450, 300, 140);

        ctx.strokeStyle = "#4a4a6e";
        ctx.lineWidth = 2;
        ctx.strokeRect(490, 450, 300, 140);

        ctx.fillStyle = "#aaaaaa";
        ctx.font = "14px Arial";
        ctx.textAlign = "left";

        y = 460;
        ctx.fillText("WASD: Move", 500, y); y += 20;
        ctx.fillText("Mouse: Look", 500, y); y += 20;
        ctx.fillText("Double-Space: Toggle Flying", 500, y); y += 20;
        ctx.fillText("E/Q: Up/Down (when flying)", 500, y); y += 20;
        ctx.fillText("C: Toggle Mouse Lock", 500, y); y += 20;
        ctx.fillText("Left Click: Place Block", 500, y); y += 20;
        ctx.fillText("Right Click: Edit Notes", 500, y); y += 20;
        ctx.fillText("B: Place Block (Camera)", 500, y); y += 20;
        ctx.fillText("Action2: Manual Save", 500, y); y += 20;
        ctx.fillText("F9: Toggle Debug", 500, y);
    }

    drawClickToStart() {
        const ctx = this.guiCtx;

        // Semi-transparent overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, 800, 600);

        // Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Memory Palace 3D", 400, 200);

        // Subtitle
        ctx.font = "24px Arial";
        ctx.fillStyle = "#aaaaaa";
        ctx.fillText("Method of Loci Environment", 400, 250);

        // Instructions
        ctx.font = "20px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Click to lock mouse and begin", 400, 350);

        // Feature list
        ctx.font = "16px Arial";
        ctx.fillStyle = "#888888";
        ctx.textAlign = "left";

        const features = [
            "• Navigate a large 3D space",
            "• Place blocks to create structures",
            "• Attach detailed notes to any block",
            "• Auto-save to browser storage",
            "• Build your personal memory palace"
        ];

        let y = 420;
        features.forEach(feature => {
            ctx.fillText(feature, 250, y);
            y += 25;
        });
    }

    drawDebugInfo() {
        this.debugCtx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);

        this.debugCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.debugCtx.fillRect(0, 0, 200, 120);

        this.debugCtx.fillStyle = "#fff";
        this.debugCtx.font = "12px monospace";
        this.debugCtx.textAlign = "left";

        const pos = this.player.position;
        const rot = this.player.rotation;

        this.debugCtx.fillText(`FPS: ${Math.round(1 / this.deltaTime || 60)}`, 10, 20);
        this.debugCtx.fillText(`Position: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`, 10, 40);
        this.debugCtx.fillText(
            `Rotation: ${((rot.x * 180) / Math.PI).toFixed(1)}°, ${((rot.y * 180) / Math.PI).toFixed(1)}°`,
            10,
            60
        );
        this.debugCtx.fillText(
            `Blocks: ${this.blocks.size}`,
            10,
            80
        );

        // Display raycast hit coordinates in debug panel too
        if (this.persistentHighlightPosition) {
            this.debugCtx.fillText(
                `Raycast Hit: ${this.persistentHighlightPosition.x.toFixed(2)}, ${this.persistentHighlightPosition.y.toFixed(2)}, ${this.persistentHighlightPosition.z.toFixed(2)}`,
                10,
                100
            );
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Level class for 3D WebGL rendering
class Level {
    constructor(gl, renderer) {
        this.gl = gl;
        this.renderer = renderer;
        this.collisionBoxes = [];
        this.halfRoomSize = 125; // Room half-size for consistent geometry

        // Create level geometry
        this.createGeometry();
    }

    createGeometry() {
        // Create geometry builder
        const builder = new WebGLGeometryBuilder(this.gl);

        // Create floor and ceiling - perfectly aligned with walls
        builder.addFloor(-this.halfRoomSize, 0, -this.halfRoomSize, 250, 250, [0.8, 0.8, 0.8]);
        builder.addFloor(-this.halfRoomSize, 125, -this.halfRoomSize, 250, 250, [0.6, 0.6, 0.8]); // Ceiling at height 125

        // Create walls - proper room dimensions without overlap

        // North wall (along X axis at Z = -halfRoomSize)
        builder.addWall(-this.halfRoomSize, 0, -this.halfRoomSize, this.halfRoomSize, 0, -this.halfRoomSize, 125, [0.6, 0.6, 0.8]);
        // South wall (along X axis at Z = halfRoomSize)
        builder.addWall(-this.halfRoomSize, 0, this.halfRoomSize, this.halfRoomSize, 0, this.halfRoomSize, 125, [0.6, 0.6, 0.8]);
        // East wall (along Z axis at X = halfRoomSize)
        builder.addWall(this.halfRoomSize, 0, -this.halfRoomSize, this.halfRoomSize, 0, this.halfRoomSize, 125, [0.6, 0.6, 0.8]);
        // West wall (along Z axis at X = -halfRoomSize)
        builder.addWall(-this.halfRoomSize, 0, -this.halfRoomSize, -this.halfRoomSize, 0, this.halfRoomSize, 125, [0.6, 0.6, 0.8]);

        // Generate collision boxes for the level
        this.generateCollisionGeometry();

        // Build the mesh
        this.mesh = builder.build();
    }

    generateCollisionGeometry() {
        this.collisionBoxes = [];

        // Add floor and ceiling - perfectly aligned with walls
        this.collisionBoxes.push({
            min: new Vector3(-this.halfRoomSize, -0.1, -this.halfRoomSize),
            max: new Vector3(this.halfRoomSize, 0, this.halfRoomSize),
            type: "floor"
        });
        this.collisionBoxes.push({
            min: new Vector3(-this.halfRoomSize, 125, -this.halfRoomSize),
            max: new Vector3(this.halfRoomSize, 125.1, this.halfRoomSize),
            type: "floor"
        });

        // Add walls (with proper thickness) - match visual wall positions
        const wallThickness = 3; // Slightly thicker for better collision

        // North wall collision (Z = -halfRoomSize)
        this.collisionBoxes.push({
            min: new Vector3(-this.halfRoomSize, 0, -this.halfRoomSize - wallThickness),
            max: new Vector3(this.halfRoomSize, 125, -this.halfRoomSize),
            type: "wall"
        });
        // South wall collision (Z = halfRoomSize)
        this.collisionBoxes.push({
            min: new Vector3(-this.halfRoomSize, 0, this.halfRoomSize),
            max: new Vector3(this.halfRoomSize, 125, this.halfRoomSize + wallThickness),
            type: "wall"
        });
        // East wall collision (X = halfRoomSize)
        this.collisionBoxes.push({
            min: new Vector3(this.halfRoomSize, 0, -this.halfRoomSize),
            max: new Vector3(this.halfRoomSize + wallThickness, 125, this.halfRoomSize),
            type: "wall"
        });
        // West wall collision (X = -halfRoomSize)
        this.collisionBoxes.push({
            min: new Vector3(-this.halfRoomSize - wallThickness, 0, -this.halfRoomSize),
            max: new Vector3(-this.halfRoomSize, 125, this.halfRoomSize),
            type: "wall"
        });
    }

    draw(renderer, viewMatrix, projectionMatrix) {
        // Create model matrix (identity for level)
        const modelMatrix = Matrix4.create();

        // Draw the mesh with the renderer
        renderer.drawMesh(this.mesh, "basic", modelMatrix, viewMatrix, projectionMatrix);
    }
}

// Player class for 3D WebGL movement
class Player {
    constructor(game, level) {
        this.game = game;
        this.level = level;

        // Player physics properties
        this.position = new Vector3(5, 1.8, 5); // Eye height of 1.8 units
        this.velocity = new Vector3(0, 0, 0);
        this.rotation = new Vector3(0, 0, 0); // x = pitch, y = yaw
        this.moveSpeed = 15.0; // 3x faster movement
        this.jumpForce = 8.0;
        this.gravity = 20.0;
        this.friction = 8.0;

        // Collision properties
        this.radius = 0.5; // Player radius
        this.standingHeight = 1.8;
        this.crouchHeight = 1.2;
        this.height = this.standingHeight;
        this.isCrouching = false;
        this.crouchAmount = 0;
        this.crouchSpeed = 3.0;
        this.grounded = false;
        this.stepHeight = 0.5;

        // Camera properties
        this.viewMatrix = Matrix4.create();
        this.lookSensitivity = 0.002;
        this.maxPitch = Math.PI / 2 - 0.1;

        // Movement state
        this.isSprinting = false;
        this.sprintSpeed = 10.0;
        this.sprintStaminaMax = 100;
        this.sprintStamina = this.sprintStaminaMax;
        this.staminaRecoveryRate = 30;
        this.staminaDepletionRate = 25;

        // Flying state
        this.isFlying = false;
        this.flyingVelocity = new Vector3(0, 0, 0);
        this.lastSpaceTapTime = 0;
        this.doubleTapWindow = 0.3; // seconds

        // Footstep sound timer
        this.footstepTimer = 0;
        this.footstepInterval = 0.4;
    }

    update(input, deltaTime) {
        // Update look direction
        this.updateRotation(input, deltaTime);

        // Simple crouching logic
        const targetCrouch = input.isKeyPressed("Action9") ? 0.6 : 0;

        if (targetCrouch > this.crouchAmount) {
            this.crouchAmount = Math.min(targetCrouch, this.crouchAmount + 3.0 * deltaTime);
        } else if (targetCrouch < this.crouchAmount) {
            this.crouchAmount = Math.max(targetCrouch, this.crouchAmount - 3.0 * deltaTime);
        }

        // Update actual player height for collisions
        this.height = this.standingHeight - this.crouchAmount;
        this.isCrouching = this.crouchAmount > 0.1;

        // Can't sprint while crouching
        this.isSprinting = !this.isCrouching && input.isKeyPressed("Action2") && this.sprintStamina > 0;

        // Handle sprint stamina
        if (this.isSprinting) {
            this.sprintStamina = Math.max(0, this.sprintStamina - this.staminaDepletionRate * deltaTime);
        } else {
            this.sprintStamina = Math.min(this.sprintStaminaMax, this.sprintStamina + this.staminaRecoveryRate * deltaTime);
        }

        // Handle flying toggle (double-tap space)
        if (input.isKeyJustPressed("Action1")) { // Space mapped to Action1
            const currentTime = performance.now() / 1000;
            if (currentTime - this.lastSpaceTapTime < this.doubleTapWindow) {
                this.isFlying = !this.isFlying;
                this.flyingVelocity = new Vector3(0, 0, 0);
                console.log('Flying toggled:', this.isFlying ? 'ON' : 'OFF');
            }
            this.lastSpaceTapTime = currentTime;
        }

        // Calculate movement direction from keyboard input
        const moveDir = this.calculateMoveDirection(input);

        // Apply movement to velocity with proper speed modifier
        let currentSpeed = this.moveSpeed;
        if (this.isCrouching) {
            currentSpeed = this.crouchSpeed;
        } else if (this.isSprinting) {
            currentSpeed = this.sprintSpeed;
        }

        this.velocity.x = moveDir.x * currentSpeed;
        this.velocity.z = moveDir.z * currentSpeed;

        // Flying vertical movement (only when flying is enabled)
        if (this.isFlying) {
            if (input.isKeyPressed("Action3")) { // E - Up
                this.velocity.y = this.moveSpeed;
                console.log('Flying UP - E pressed');
            } else if (input.isKeyPressed("Action4")) { // Q - Down
                this.velocity.y = -this.moveSpeed;
                console.log('Flying DOWN - Q pressed');
            } else if (!input.isKeyPressed("Action3") && !input.isKeyPressed("Action4")) {
                // No vertical input - maintain current Y velocity but slow it down
                this.velocity.y *= 0.9;
            }
        } else {
            // Normal gravity and jumping when not flying
            if (!this.grounded) {
                this.velocity.y -= this.gravity * deltaTime;
            } else if (input.isKeyJustPressed("Action1") && !this.isCrouching) {
                this.velocity.y = this.jumpForce;
                this.grounded = false;
            }
        }

        // Update position with collision detection
        this.updatePosition(deltaTime);

        // Update footstep sounds
        const footstepInterval = this.isSprinting ? this.footstepInterval / 2 : this.isCrouching ? this.footstepInterval * 1.5 : this.footstepInterval;
        this.updateFootsteps(deltaTime, moveDir, footstepInterval);
    }

    updateRotation(input, deltaTime) {
        if (this.game.cursorLocked) {
            // Use movement data from pointer lock
            const sensitivity = this.lookSensitivity;

            // Mouse look - natural FPS camera controls
            this.rotation.y += this.game.mouseDeltaX * sensitivity; // Left/right rotation (yaw)
            this.rotation.x += this.game.mouseDeltaY * sensitivity; // Up/down rotation (pitch) - positive when mouse moves down

            // NEW: Normalize Y rotation to prevent extreme values that break raycast
            this.rotation.y = ((this.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (this.rotation.y > Math.PI) this.rotation.y -= Math.PI * 2;

            // Clamp pitch to prevent flipping
            this.rotation.x = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.rotation.x));

            // Reset delta values after using them
            this.game.mouseDeltaX = 0;
            this.game.mouseDeltaY = 0;
        }
    }

    calculateMoveDirection(input) {
        // Create a movement vector in local space
        let dx = 0;
        let dz = 0;

        // Determine desired movement direction in LOCAL space
        if (input.isKeyPressed("DirUp")) dz -= 1;
        if (input.isKeyPressed("DirDown")) dz += 1;
        if (input.isKeyPressed("DirLeft")) dx -= 1;
        if (input.isKeyPressed("DirRight")) dx += 1;

        // Normalize diagonal movement
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length > 0) {
            dx /= length;
            dz /= length;
        }

        // Convert local space movement to world space based on camera rotation
        const angle = this.rotation.y;
        const moveDir = new Vector3(
            -dz * Math.sin(angle) + dx * Math.cos(angle),
            0,
            dz * Math.cos(angle) + dx * Math.sin(angle)
        );

        return moveDir;
    }

    updatePosition(deltaTime) {
        // Temp position for collision checking
        const newPosition = new Vector3(
            this.position.x + this.velocity.x * deltaTime,
            this.position.y + this.velocity.y * deltaTime,
            this.position.z + this.velocity.z * deltaTime
        );

        // Check collision with level
        const collision = this.checkCollision(newPosition);

        // Apply collision response
        if (collision.x) {
            newPosition.x = this.position.x;
            this.velocity.x = 0;
        }

        if (collision.y) {
            if (this.velocity.y < 0) {
                // Hit ground
                newPosition.y = collision.floorY;
                this.velocity.y = 0;
                this.grounded = true;
            } else {
                // Hit ceiling
                newPosition.y = this.position.y;
                this.velocity.y = 0;
            }
        } else {
            this.grounded = false;
        }

        if (collision.z) {
            newPosition.z = this.position.z;
            this.velocity.z = 0;
        }

        // Update position
        this.position = newPosition;
    }

    checkCollision(position) {
        const result = {
            x: false,
            y: false,
            z: false,
            floorY: 0
        };

        const playerMin = new Vector3(
            position.x - this.radius,
            position.y - this.standingHeight,
            position.z - this.radius
        );

        const playerMax = new Vector3(
            position.x + this.radius,
            position.y - this.crouchAmount,
            position.z + this.radius
        );

        // Check against all level collision boxes
        for (const box of this.level.collisionBoxes) {
            if (
                playerMax.x > box.min.x &&
                playerMin.x < box.max.x &&
                playerMax.y > box.min.y &&
                playerMin.y < box.max.y &&
                playerMax.z > box.min.z &&
                playerMin.z < box.max.z
            ) {
                // Collision detected, determine the minimal penetration axis
                const penetrationX = Math.min(playerMax.x - box.min.x, box.max.x - playerMin.x);
                const penetrationY = Math.min(playerMax.y - box.min.y, box.max.y - playerMin.y);
                const penetrationZ = Math.min(playerMax.z - box.min.z, box.max.z - playerMin.z);

                // Resolve along minimal penetration axis
                if (penetrationX < penetrationY && penetrationX < penetrationZ) {
                    result.x = true;
                } else if (penetrationY < penetrationX && penetrationY < penetrationZ) {
                    result.y = true;

                    // Store floor height if colliding with top of box
                    if (playerMin.y < box.max.y && this.position.y >= box.max.y) {
                        result.floorY = box.max.y + this.standingHeight;
                    }
                } else {
                    result.z = true;
                }
            }
        }

        return result;
    }

    updateFootsteps(deltaTime, moveDir, interval) {
        // Only play footsteps when moving on the ground
        if (this.grounded && (moveDir.x !== 0 || moveDir.z !== 0)) {
            this.footstepTimer -= deltaTime;

            if (this.footstepTimer <= 0) {
                this.game.audio.play("footstep");
                this.footstepTimer = interval || this.footstepInterval;
            }
        }
    }

    getViewMatrix() {
        // Create view matrix
        Matrix4.identity(this.viewMatrix);

        // Apply rotations
        Matrix4.rotateX(this.viewMatrix, this.viewMatrix, this.rotation.x);
        Matrix4.rotateY(this.viewMatrix, this.viewMatrix, this.rotation.y);

        // Apply position including crouch offset
        Matrix4.translate(this.viewMatrix, this.viewMatrix, [
            -this.position.x,
            -(this.position.y - this.crouchAmount),
            -this.position.z
        ]);

        return this.viewMatrix;
    }

    // ========================================================================
    // EXPORT/IMPORT SYSTEM
    // ========================================================================

    exportData() {
        const data = {
            version: '1.0.0',
            exported: new Date().toISOString(),
            blocks: Array.from(this.blocks.values()).map(block => block.toJSON()),
            camera: {
                position: {
                    x: this.position.x,
                    y: this.position.y,
                    z: this.position.z
                },
                rotation: {
                    x: this.rotation.x,
                    y: this.rotation.y
                }
            }
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `memory-palace-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);

        this.addMessage("📤 Exported to file");
        console.log('📤 Data exported');
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importDataFromFile(file);
            }
        };
        input.click();
    }

    importDataFromFile(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate data
                if (!data.blocks || !Array.isArray(data.blocks)) {
                    throw new Error('Invalid data format');
                }

                // Clear existing blocks
                this.blocks.forEach(block => {
                    if (block.model) {
                        this.removeObject(block.model);
                    }
                });
                this.blocks.clear();

                // Import blocks
                data.blocks.forEach(blockData => {
                    const block = MemoryBlock.fromJSON(blockData);

                    const geometry = GeometryBuilder.createCube(1, 1, 1);
                    const model = new ActionModel3D(geometry);
                    model.position.copy(block.position);
                    model.setColor(0.3, 0.5, 0.9);

                    block.model = model;
                    this.addObject(model);
                    this.blocks.set(block.id, block);
                });

                // Import camera
                if (data.camera) {
                    if (data.camera.position) {
                        this.position.set(
                            data.camera.position.x,
                            data.camera.position.y,
                            data.camera.position.z
                        );
                    }
                    if (data.camera.rotation) {
                        this.rotation.set(
                            data.camera.rotation.x,
                            data.camera.rotation.y,
                            0
                        );
                    }
                }

                this.addMessage(`📥 Imported ${this.blocks.size} blocks`);
                console.log('📥 Data imported successfully');

                // Save after import
                this.saveToStorage();

            } catch (error) {
                console.error('❌ Import failed:', error);
                this.addMessage("❌ Import failed");
            }
        };

        reader.readAsText(file);
    }

    // ========================================================================
    // ENHANCED AUTO-SAVE SYSTEM
    // ========================================================================

    startAutoSave() {
        if (this.autoSaveIntervalId) {
            clearInterval(this.autoSaveIntervalId);
        }

        this.autoSaveIntervalId = setInterval(() => {
            this.saveToStorage();
        }, this.autoSaveInterval);

        console.log('💾 Auto-save started');
    }

    stopAutoSave() {
        if (this.autoSaveIntervalId) {
            clearInterval(this.autoSaveIntervalId);
            this.autoSaveIntervalId = null;
        }

        console.log('⏹️ Auto-save stopped');
    }
}
