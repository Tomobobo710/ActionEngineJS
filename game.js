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

        // Eight corners of box (vertices stay the same)
        const vertices = [
            // Bottom face
            x, y, z,
            x + width, y, z,
            x + width, y, z + depth,
            x, y, z + depth,

            // Top face
            x, y + height, z,
            x + width, y + height, z,
            x + width, y + height, z + depth,
            x, y + height, z + depth
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
	constructor(position, type = "cube") {
		this.id = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		this.position = position.clone();
		this.type = type;
		this.text = "";

		// Create the 3D visual representation
		this.mesh = null;
		this.createVisual();
	}

	createVisual() {
		// Create 3D geometry for WebGL rendering
		if (typeof document !== 'undefined') {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl');
			if (gl) {
				const builder = new WebGLGeometryBuilder(gl);
				builder.addBox(
					this.position.x - 2.5, // half of blockSize
					this.position.y - 2.5,
					this.position.z - 2.5,
					5, 5, 5, // blockSize
					[0.545, 0.451, 0.333] // brownish color like wood
				);
				this.mesh = builder.build();
			}
		}
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
			text: this.text
		};
	}

	static fromJSON(data) {
		const block = new MemoryBlock(
			new Vector3(data.position.x, data.position.y, data.position.z),
			data.type
		);
		block.id = data.id;
		block.text = data.text;
		return block;
	}

	draw(renderer, viewMatrix, projectionMatrix) {
		if (!this.mesh) return;

		// Create model matrix for block position
		const modelMatrix = Matrix4.create();
		Matrix4.translate(modelMatrix, modelMatrix, [
			this.position.x,
			this.position.y,
			this.position.z
		]);

		// Draw the block mesh
		renderer.drawMesh(this.mesh, "basic", modelMatrix, viewMatrix, projectionMatrix);
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
			this.game.saveToLocalStorage();
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
            this.cursorLocked = document.pointerLockElement === this.canvas;
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
        } else {
            document.exitPointerLock();
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

        // Load saved data
        this.loadFromLocalStorage();
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
            this.saveToLocalStorage();
            this.addMessage("Progress saved!");
        }

        // Toggle debug with F9
        if (this.input.isKeyJustPressed("ActionDebugToggle")) {
            this.state.showDebug = !this.state.showDebug;
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
        this.blocks.forEach(block => {
            block.draw(this.renderer, viewMatrix, this.projectionMatrix);
        });

        // Draw hovered block highlight
        if (this.hoveredBlock && !this.hoveredBlock.isFloor) {
            this.drawHoveredBlockHighlight(this.renderer, viewMatrix, this.projectionMatrix);
        }

        // Draw 2D UI elements
        this.drawUI();

        // Draw debug info if enabled
        if (this.state.showDebug) {
            this.drawDebugInfo();
        }
    }

    raycastBlocks() {
        const ray = this.getRayFromCamera();
        let closestBlock = null;
        let closestDistance = Infinity;
        let closestFace = null;

        this.blocks.forEach(block => {
            const result = this.rayBoxIntersection(ray, block);
            if (result && result.distance < closestDistance && result.distance < this.placementRange) {
                closestDistance = result.distance;
                closestBlock = block;
                closestFace = result.face;
            }
        });

        // Also check floor (match actual floor size and position)
        const floorResult = this.rayBoxIntersection(ray, {
            position: new Vector3(0, -0.5, 0),
            size: 250
        });

        if (floorResult && floorResult.distance < closestDistance && floorResult.distance < this.placementRange) {
            closestDistance = floorResult.distance;
            closestBlock = { isFloor: true, position: new Vector3(0, -0.5, 0) };
            closestFace = floorResult.face;
        }

        this.hoveredBlock = closestBlock;
        this.hoveredFace = closestFace;
    }

    getRayFromCamera() {
        // Get camera forward direction - match the camera target calculation
        const lookDistance = 50;
        const forward = new Vector3(
            Math.sin(this.player.rotation.y) * Math.cos(this.player.rotation.x) * lookDistance,
            Math.sin(this.player.rotation.x) * lookDistance,
            Math.cos(this.player.rotation.y) * Math.cos(this.player.rotation.x) * lookDistance
        ).normalize();

        return {
            origin: this.player.position.clone(),
            direction: forward
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

        // Determine which face was hit
        const hitPoint = new Vector3(
            ray.origin.x + ray.direction.x * tmin,
            ray.origin.y + ray.direction.y * tmin,
            ray.origin.z + ray.direction.z * tmin
        );

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

    placeBlock() {
        if (!this.hoveredBlock || !this.hoveredFace) return;

        // Calculate placement position based on face
        const offset = this.blockSize;
        let newPos = this.hoveredBlock.position.clone();

        switch (this.hoveredFace) {
            case "top": newPos.y += offset; break;
            case "bottom": newPos.y -= offset; break;
            case "north": newPos.z -= offset; break;
            case "south": newPos.z += offset; break;
            case "east": newPos.x += offset; break;
            case "west": newPos.x -= offset; break;
        }

        // Check if position is already occupied
        for (let [id, block] of this.blocks) {
            if (block.position.distanceTo(newPos) < this.blockSize * 0.5) {
                this.addMessage("Position already occupied!");
                return;
            }
        }

        // Create new block
        const block = new MemoryBlock(newPos, this.selectedBlockType);
        this.blocks.set(block.id, block);

        this.audio.play("placeBlock");
        this.addMessage(`Block placed at (${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)})`);

        this.saveToLocalStorage();
    }

    openBlockEditor() {
        if (!this.hoveredBlock || this.hoveredBlock.isFloor) return;

        this.textEditor.open(this.hoveredBlock);
        this.audio.play("uiClick");
    }

    drawHoveredBlockHighlight(renderer, viewMatrix, projectionMatrix) {
        if (!this.hoveredBlock || !this.hoveredBlock.position) return;

        // Create model matrix for highlight position
        const modelMatrix = Matrix4.create();
        Matrix4.translate(modelMatrix, modelMatrix, [
            this.hoveredBlock.position.x,
            this.hoveredBlock.position.y,
            this.hoveredBlock.position.z
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

    saveToLocalStorage() {
        const data = {
            blocks: Array.from(this.blocks.values()).map(block => block.toJSON()),
            player: {
                position: {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    z: this.player.position.z
                },
                rotation: {
                    x: this.player.rotation.x,
                    y: this.player.rotation.y
                }
            }
        };

        try {
            localStorage.setItem('memoryPalace', JSON.stringify(data));
            this.audio.play("save");
        } catch (e) {
            this.addMessage("Error saving: " + e.message);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('memoryPalace');
            if (!saved) {
                this.addMessage("No saved data found");
                return;
            }

            const data = JSON.parse(saved);

            // Load blocks
            this.blocks.clear();
            data.blocks.forEach(blockData => {
                const block = MemoryBlock.fromJSON(blockData);
                this.blocks.set(block.id, block);
            });

            // Load player position
            if (data.player) {
                this.player.position = new Vector3(
                    data.player.position.x,
                    data.player.position.y,
                    data.player.position.z
                );
                this.player.rotation.x = data.player.rotation.x || 0;
                this.player.rotation.y = data.player.rotation.y || 0;
            }

            this.addMessage(`Loaded ${this.blocks.size} blocks from storage`);
        } catch (e) {
            this.addMessage("Error loading: " + e.message);
        }
    }

    addMessage(msg) {
        this.messages.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }
    }

    drawUI() {
        this.guiCtx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);

        // Draw crosshair
        this.guiCtx.strokeStyle = this.hoveredBlock ? "#ffff00" : "#ffffff";
        this.guiCtx.lineWidth = 2;
        this.guiCtx.beginPath();
        this.guiCtx.moveTo(395, 300);
        this.guiCtx.lineTo(405, 300);
        this.guiCtx.moveTo(400, 295);
        this.guiCtx.lineTo(400, 305);
        this.guiCtx.stroke();

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

            // FIXED: Flipped the signs to correct the look direction
            this.rotation.y += this.game.mouseDeltaX * sensitivity; // Changed from -= to +=
            this.rotation.x += this.game.mouseDeltaY * sensitivity; // Changed from -= to +=

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
}

