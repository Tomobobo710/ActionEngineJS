/**
 * Memory Palace 3D - Method of Loci Environment (WebGL Version)
 *
 * A spatial memory system where users can:
 * - Fly through a large 3D space
 * - Place textured blocks
 * - Attach long-form notes to blocks
 * - Save/load their memory palace
 */
import { MemoryPalaceAPI } from './api.js';

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

    addCone(x, y, z, radius, height, segments, color) {
        const baseIndex = this.vertices.length / 3;
        const halfHeight = height / 2;

        // Add apex vertex
        this.vertices.push(x, y + halfHeight, z);
        this.normals.push(0, 1, 0); // Pointing up
        this.colors.push(...color);

        // Add base vertices and normals
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const vx = x + radius * Math.cos(angle);
            const vz = z + radius * Math.sin(angle);
            this.vertices.push(vx, y - halfHeight, vz);
            this.normals.push(0, -1, 0); // Pointing down for base
            this.colors.push(...color);
        }

        // Add indices for cone sides
        for (let i = 0; i < segments; i++) {
            const p1 = baseIndex; // Apex
            const p2 = baseIndex + 1 + i;
            const p3 = baseIndex + 1 + ((i + 1) % segments);
            WebGLGeometryBuilder.createTriangle(this.indices, this.vertices, p1, p2, p3, false, true);
        }

        // Add indices for base
        for (let i = 0; i < segments - 2; i++) {
            const p1 = baseIndex + 1;
            const p2 = baseIndex + 1 + i + 1;
            const p3 = baseIndex + 1 + i + 2;
            WebGLGeometryBuilder.createTriangle(this.indices, this.vertices, p1, p3, p2, false, true); // Flipped for correct winding
        }
    }

    addSphere(x, y, z, radius, segments, rings, color) {
        const baseIndex = this.vertices.length / 3;

        for (let i = 0; i <= rings; i++) {
            const latAngle = (i * Math.PI) / rings;
            const sinLat = Math.sin(latAngle);
            const cosLat = Math.cos(latAngle);

            for (let j = 0; j <= segments; j++) {
                const lonAngle = (j * 2 * Math.PI) / segments;
                const sinLon = Math.sin(lonAngle);
                const cosLon = Math.cos(lonAngle);

                const vx = x + radius * cosLon * sinLat;
                const vy = y + radius * cosLat;
                const vz = z + radius * sinLon * sinLat;

                this.vertices.push(vx, vy, vz);
                const normal = new Vector3(vx - x, vy - y, vz - z).normalize();
                this.normals.push(normal.x, normal.y, normal.z);
                this.colors.push(...color);

                if (i < rings && j < segments) {
                    const p1 = baseIndex + i * (segments + 1) + j;
                    const p2 = baseIndex + i * (segments + 1) + j + 1;
                    const p3 = baseIndex + (i + 1) * (segments + 1) + j;
                    const p4 = baseIndex + (i + 1) * (segments + 1) + j + 1;

                    WebGLGeometryBuilder.createQuad(this.indices, this.vertices, p1, p2, p4, p3, false, true);
                }
            }
        }
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
	constructor(gl, position, type = "cube", blockSize = 5, title = "") { // Add gl, blockSize, and title parameters
		this.gl = gl; // Store gl context
		this.id = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		this.position = position.clone();
		this.type = type;
		this.text = "";
        this.title = title; // Store title
        this.blockSize = blockSize; // Store blockSize

		// Create the 3D visual representation
		this.model = null;
		this.createVisual();
	}

	createVisual() {
		// Create 3D geometry for WebGL rendering based on block type
		const builder = new WebGLGeometryBuilder(this.gl); // Use stored gl context
	       let color = [0.545, 0.451, 0.333]; // Default brownish color

	       switch (this.type) {
	           case "cube":
	               builder.addBox(0, 0, 0, this.blockSize, this.blockSize, this.blockSize, color);
	               break;
	           case "cone":
	               builder.addCone(0, 0, 0, this.blockSize / 2, this.blockSize, 32, color); // Radius half of blockSize
	               break;
	           case "sphere":
	               builder.addSphere(0, 0, 0, this.blockSize / 2, 32, 16, color); // Radius half of blockSize
	               break;
	           default:
	               console.warn(`Unknown block type: ${this.type}. Defaulting to cube.`);
	               builder.addBox(0, 0, 0, this.blockSize, this.blockSize, this.blockSize, color);
	               break;
	       }
		const geometry = builder.build();
	       this.model = new ActionModel3D(geometry);
	       this.model.position.copy(this.position); // Set model's position
	       this.model.setColor(color[0], color[1], color[2]); // Set model's color
	}

	setText(text) {
		this.text = text;
	}

    setTitle(title) {
        this.title = title;
    }

	getText() {
		return this.text;
	}

    getTitle() {
        return this.title;
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
            title: this.title, // Add title to JSON
            blockSize: this.blockSize // Add blockSize to JSON
		};
	}

	static fromJSON(gl, data) { // Add gl parameter
		const block = new MemoryBlock(
            gl, // Pass gl to constructor
			new Vector3(data.position.x, data.position.y, data.position.z),
			data.type,
            data.blockSize, // Pass blockSize from JSON
            data.title // Pass title from JSON
		);
		block.id = data.id;
		block.text = data.text;
        block.title = data.title; // Ensure title is set on the block object
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
		this.titleContent = ""; // New: for block title
		this.scrollOffset = 0;

		// Editor dimensions
		this.width = 600;
		this.height = 400;
		this.x = (800 - this.width) / 2;
		this.y = (600 - this.height) / 2;
		this.padding = 20;

        // Title input dimensions
        this.titleInputX = this.x + this.padding;
        this.titleInputY = this.y + 60;
        this.titleInputWidth = this.width - this.padding * 2;
        this.titleInputHeight = 30;

		// Text area dimensions
		this.textAreaX = this.x + this.padding;
		this.textAreaY = this.y + 100; // Adjusted Y for title input
		this.textAreaWidth = this.width - this.padding * 2;
		this.textAreaHeight = this.height - 180; // Adjusted height

		// Button dimensions
		this.buttonWidth = 120;
		this.buttonHeight = 40;
		this.buttonY = this.y + this.height - 60;

		// Cursor state
		this.cursorPosition = 0;
		this.cursorBlinkTime = 0;
		this.cursorVisible = true;

        // Title cursor state
        this.titleCursorPosition = 0;
        this.titleCursorBlinkTime = 0;
        this.titleCursorVisible = true;
        this.isTitleFocused = false;

		// Register UI elements
		this.registerElements();
	}

	registerElements() {
        // Title input area
        this.game.input.registerElement("editorTitleInput", {
            bounds: () => ({
                x: this.titleInputX,
                y: this.titleInputY,
                width: this.titleInputWidth,
                height: this.titleInputHeight
            })
        }, "gui");

		// Save button
		this.game.input.registerElement("editorSave", {
			bounds: () => ({
				x: this.x + this.padding,
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Delete Note button
		this.game.input.registerElement("editorDeleteNote", { // Changed ID
			bounds: () => ({
				x: this.x + this.padding + this.buttonWidth + 20,
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Delete Block button
		this.game.input.registerElement("editorDeleteBlock", {
			bounds: () => ({
				x: this.x + this.padding + (this.buttonWidth + 20) * 2, // Position next to delete note
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
		if (!block) {
			console.error('❌ Cannot open text editor: block is undefined');
			return;
		}

		this.isOpen = true;
		this.currentBlock = block;
		this.textContent = block.getText() || "";
        this.titleContent = block.getTitle() || ""; // Populate title
		this.cursorPosition = this.textContent.length;
        this.titleCursorPosition = this.titleContent.length;
		this.scrollOffset = 0;
        this.isTitleFocused = false; // Start with text area focused

		// Capture keyboard input
		this.game.capturingTextInput = true;
		this.game.toggleCursorLock(false); // Unlock cursor when editor opens
	}

	close() {
		this.isOpen = false;
		this.currentBlock = null;
		this.game.capturingTextInput = false;
		this.game.toggleCursorLock(true); // Re-lock cursor when editor closes
        if (this.textarea) {
            document.body.removeChild(this.textarea);
            this.textarea = null;
        }
        if (this.titleInput) {
            document.body.removeChild(this.titleInput);
            this.titleInput = null;
        }
	}

	save() {
		if (this.currentBlock) {
		    this.currentBlock.setText(this.textContent);
            this.currentBlock.setTitle(this.titleContent); // Save title
		    this.game.saveToStorage();
		    this.game.addMessage("Note saved!");
		}
		this.close();
	}

	deleteNote() {
		if (this.currentBlock) {
			this.currentBlock.setText("");
			this.game.saveToStorage(); // Use game.saveToStorage
			this.game.addMessage("Note deleted!");
		}
		this.close();
	}

    deleteBlock() {
        if (this.currentBlock) {
            this.game.deleteBlock(this.currentBlock.id); // Call game method to delete block
            this.game.addMessage("Block deleted!");
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

	   if (this.game.input.isElementJustPressed("editorDeleteNote", "gui")) {
	       this.deleteNote();
	       return;
	   }

	   if (this.game.input.isElementJustPressed("editorDeleteBlock", "gui")) {
	       this.deleteBlock();
	       return;
	   }

	   if (this.game.input.isElementJustPressed("editorClose", "gui")) {
	       this.close();
	       return;
	   }

        // Handle focus switching between title and text area
        if (this.game.input.isElementJustPressed("editorTitleInput", "gui")) {
            this.isTitleFocused = true;
            if (this.textarea) this.textarea.blur(); // Unfocus text area
        } else if (this.game.input.isElementJustPressed("editorTextArea", "gui")) {
            this.isTitleFocused = false;
            if (this.titleInput) this.titleInput.blur(); // Unfocus title input
        }

	   // Handle title input when editor is open
	   if (this.isOpen && !this.titleInput) {
	       this.titleInput = document.createElement('input');
	       this.titleInput.type = 'text';
	       this.titleInput.style.position = 'absolute';
	       this.titleInput.style.left = '-9999px';
	       this.titleInput.style.top = '-9999px';
	       this.titleInput.style.width = '1px';
	       this.titleInput.style.height = '1px';
	       this.titleInput.style.opacity = '0';
	       this.titleInput.style.pointerEvents = 'none';
	       this.titleInput.style.zIndex = '-1';
	       document.body.appendChild(this.titleInput);

	       this.titleInput.addEventListener('input', (e) => {
	           this.titleContent = e.target.value;
	           this.titleCursorPosition = e.target.selectionStart;
	       });
	   }

	   // Handle text input when editor is open
	   if (this.isOpen && !this.textarea) { // Only create textarea once
	       this.textarea = document.createElement('textarea');
	       this.textarea.style.position = 'absolute';
	       this.textarea.style.left = '-9999px';
	       this.textarea.style.top = '-9999px';
	       this.textarea.style.width = '1px';
	       this.textarea.style.height = '1px';
	       this.textarea.style.opacity = '0';
	       this.textarea.style.pointerEvents = 'none';
	       this.textarea.style.zIndex = '-1';
	       document.body.appendChild(this.textarea);

	       this.textarea.addEventListener('input', (e) => {
	           this.textContent = e.target.value;
	           this.cursorPosition = e.target.selectionStart;
	       });

	       this.textarea.addEventListener('keydown', (e) => {
	           if (e.key === 'Enter' && !e.shiftKey) { // Regular Enter for new line
	               e.preventDefault();
	               this.textContent = this.textContent.slice(0, this.cursorPosition) +
	                                '\n' + this.textContent.slice(this.cursorPosition);
	               this.cursorPosition++;
	           } else if (e.key === 'Enter' && e.shiftKey) { // Shift+Enter to save/close
	               e.preventDefault();
	               this.save();
	           } else if (e.key === 'Backspace') {
	               // Handled by default textarea behavior
	           }
	       });
	   }

	   if (this.isOpen && this.titleInput && this.isTitleFocused) {
	       this.titleInput.focus();
	       this.titleInput.value = this.titleContent;
	       this.titleInput.setSelectionRange(this.titleCursorPosition, this.titleCursorPosition);
	   } else if (this.isOpen && this.textarea && !this.isTitleFocused) {
	       // Focus the hidden textarea
	       this.textarea.focus();
	       this.textarea.value = this.textContent;
	       this.textarea.setSelectionRange(this.cursorPosition, this.cursorPosition);
	   }
	}

	update(deltaTime) {
		if (!this.isOpen) return;

		// Cursor blink animation for text area
		this.cursorBlinkTime += deltaTime;
		if (this.cursorBlinkTime > 0.5) {
			this.cursorVisible = !this.cursorVisible;
			this.cursorBlinkTime = 0;
		}

		// Cursor blink animation for title input
		this.titleCursorBlinkTime += deltaTime;
		if (this.titleCursorBlinkTime > 0.5) {
			this.titleCursorVisible = !this.titleCursorVisible;
			this.titleCursorBlinkTime = 0;
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
		ctx.fillText(`Block Notes: ${this.currentBlock ? this.currentBlock.getTitle() : ''}`, this.x + this.padding, this.y + 25);

        // Title input label
        ctx.fillStyle = "#e0e0e0";
        ctx.font = "14px Arial";
        ctx.fillText("Title:", this.titleInputX, this.titleInputY - 15);

        // Title input background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(this.titleInputX, this.titleInputY, this.titleInputWidth, this.titleInputHeight);

        // Title input border
        ctx.strokeStyle = this.isTitleFocused ? "#00ffff" : "#4a4a6e"; // Highlight if focused
        ctx.lineWidth = 1;
        ctx.strokeRect(this.titleInputX, this.titleInputY, this.titleInputWidth, this.titleInputHeight);

        // Draw title content
        ctx.fillStyle = "#e0e0e0";
        ctx.font = "16px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.titleContent, this.titleInputX + 5, this.titleInputY + this.titleInputHeight / 2);

        // Draw title cursor
        if (this.isTitleFocused && this.titleCursorVisible) {
            const cursorX = this.titleInputX + 5 + ctx.measureText(this.titleContent.slice(0, this.titleCursorPosition)).width;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(cursorX, this.titleInputY + 5, 2, this.titleInputHeight - 10);
        }

		// Text area background
		ctx.fillStyle = "#1a1a2e";
		ctx.fillRect(this.textAreaX, this.textAreaY, this.textAreaWidth, this.textAreaHeight);

		// Text area border
		ctx.strokeStyle = !this.isTitleFocused ? "#00ffff" : "#4a4a6e"; // Highlight if focused
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
		if (!this.isTitleFocused && this.cursorVisible) {
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

		this.drawButton(ctx, "Clear Note", this.x + this.padding + this.buttonWidth + 20, this.buttonY, // Changed text and ID
			this.game.input.isElementHovered("editorDeleteNote", "gui"));

		this.drawButton(ctx, "Delete Block", this.x + this.padding + (this.buttonWidth + 20) * 2, this.buttonY, // New button
			this.game.input.isElementHovered("editorDeleteBlock", "gui"));

		this.drawButton(ctx, "Close", this.x + this.width - this.padding - this.buttonWidth, this.buttonY,
			this.game.input.isElementHovered("editorClose", "gui"));

		// Instructions
		ctx.fillStyle = "#888888";
		ctx.font = "12px Arial";
		ctx.textAlign = "center";
		ctx.fillText("Type to add text • Action1: New Line • Action2: Backspace • Click Title/Text to Focus",
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

    constructor(canvases, input, audio, backendAvailable) { // Add backendAvailable parameter
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
        this.useBackend = true; // Still use backend if available
        this.backendAvailable = backendAvailable; // Set from parameter

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

        // Scene object management
        this.sceneObjects = new Set(); // Track 3D objects in the scene
        
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

    toggleCursorLock(forceLock = undefined) {
        if (forceLock === true) {
            if (!this.cursorLocked) {
                this.canvas.requestPointerLock();
                console.log('🔒 Requesting pointer lock (forced)...');
            }
        } else if (forceLock === false) {
            if (this.cursorLocked) {
                document.exitPointerLock();
                console.log('🔓 Exiting pointer lock (forced)...');
            }
        } else {
            // Toggle behavior
            if (!this.cursorLocked) {
                this.canvas.requestPointerLock();
                console.log('🔒 Requesting pointer lock...');
            } else {
                document.exitPointerLock();
                console.log('🔓 Exiting pointer lock...');
            }
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

        // Shape selection system
        this.showShapeSelector = false;
        this.shapeSelectorPosition = { x: 350, y: 200 };
        this.availableShapes = ["cube", "cone", "sphere"];
        this.shapeNames = {
            cube: "Cube",
            cone: "Cone",
            sphere: "Sphere"
        };

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

        // Don't handle game input if editor is open or cursor is not locked
        if (this.textEditor.isOpen || !this.cursorLocked) {
            // If editor is open, ensure raycast is cleared
            if (this.textEditor.isOpen) {
                this.persistentHighlightPosition = null;
                this.hoveredFace = null;
                this.hoveredBlock = null;
            }
            return;
        }

        // Update player
        this.player.update(this.input, deltaTime);

        // Raycast for block interaction
        this.raycastBlocks();

        // Shape selection (Z key)
        if (this.input.isKeyJustPressed('ActionShapeSelect') && this.cursorLocked) {
            this.showShapeSelector = !this.showShapeSelector;
            if (this.showShapeSelector) {
                this.addMessage("🔧 Shape selector opened");
            } else {
                this.addMessage("🔧 Shape selector closed");
            }
        }

        // Shape selection with number keys
        if (this.showShapeSelector && this.cursorLocked) {
            for (let i = 0; i < this.availableShapes.length; i++) {
                if (this.input.isKeyJustPressed(String(i + 1))) {
                    this.selectedBlockType = this.availableShapes[i];
                    this.showShapeSelector = false;
                    this.addMessage(`✅ Selected: ${this.shapeNames[this.selectedBlockType]}`);
                }
            }
        }

        // Block placement (left click) - modified to show shape selector if no target
        if (this.input.isLeftMouseButtonJustPressed()) { // cursorLocked check moved to outer if
            if (this.persistentHighlightPosition && !this.showShapeSelector) {
                this.placeBlock();
            } else if (!this.showShapeSelector) {
                this.showShapeSelector = true;
                this.addMessage("🔧 Select shape first (1-3)");
            }
        }

        // Block editor (right click)
        if (this.input.isRightMouseButtonJustPressed()) { // cursorLocked check moved to outer if
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

        // Delete block (for testing) - press Delete key
        if (this.input.isKeyJustPressed('Delete') && this.cursorLocked && this.hoveredBlock && !this.hoveredBlock.isFloor) {
            this.deleteBlock(this.hoveredBlock.id);
        }
    }

    deleteBlock(blockId) {
        const blockToDelete = this.blocks.get(blockId);
        if (blockToDelete) {
            if (blockToDelete.model) {
                this.removeObject(blockToDelete.model); // Remove from 3D scene
            }
            this.blocks.delete(blockId); // Remove from map
            this.saveToStorage(); // Save changes
            this.addMessage(`🗑️ Block ${blockId} deleted.`);
            this.hoveredBlock = null; // Clear hovered block if it was deleted
            this.persistentHighlightPosition = null; // Clear highlight
        }
    }

    draw() {
        // Clear the canvas
        this.renderer.clear();

        // Get view matrix from player camera
        const viewMatrix = this.player.getViewMatrix();

        // Draw level
        this.level.draw(this.renderer, viewMatrix, this.projectionMatrix);

        // Draw all scene objects
        this.sceneObjects.forEach((model) => {
            if (model && model.geometry) {
                try {
                    // Assuming model has a draw method or can be drawn directly by renderer
                    // For now, we'll draw it using the basic shader
                    const modelMatrix = Matrix4.create();
                    Matrix4.translate(modelMatrix, modelMatrix, [
                        model.position.x,
                        model.position.y,
                        model.position.z
                    ]);
                    this.renderer.drawMesh(model.geometry, "basic", modelMatrix, viewMatrix, this.projectionMatrix);
                } catch (error) {
                    console.error('❌ Error drawing scene object:', model, error);
                }
            } else {
                console.warn('⚠️ Scene object missing model or geometry:', model);
            }
        });

        // Draw persistent highlight - always visible if we have a stored position
        if (this.persistentHighlightPosition) {  // CHANGED: Use persistent position instead of hoveredBlock
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
        // Enhanced raycast: shoot ray from camera, find first hit with room geometry
        if (!this.cursorLocked) {
            this.persistentHighlightPosition = null;
            this.hoveredFace = null;
            this.hoveredBlock = null; // Ensure hoveredBlock is cleared
            return;
        }

        const ray = this.getRayFromCamera();
        let closestDistance = Infinity;
        let closestHit = null;
        let closestFace = null;
        let closestBlock = null;

        // 1. Raycast against room geometry
        const roomHitResult = this.castRayIntoRoom(ray);
        if (roomHitResult) {
            closestDistance = roomHitResult.distance;
            closestHit = roomHitResult.position;
            closestFace = roomHitResult.face;
        }

        // 2. Raycast against placed blocks
        for (let [id, block] of this.blocks) {
            const blockHitResult = this.rayBoxIntersection(ray, block);
            if (blockHitResult && blockHitResult.distance < closestDistance) {
                closestDistance = blockHitResult.distance;
                closestHit = blockHitResult.hitPoint;
                closestFace = blockHitResult.face;
                closestBlock = block;
            }
        }

        if (closestHit) {
            this.persistentHighlightPosition = closestHit;
            this.hoveredFace = closestFace;
            this.hoveredBlock = closestBlock; // Set hoveredBlock if a block was hit
        } else {
            this.persistentHighlightPosition = null;
            this.hoveredFace = null;
            this.hoveredBlock = null;
        }
    }

    getRayFromCamera() {
        // Get camera forward direction - match the camera target calculation
        const lookDistance = 50;

        // Calculate forward direction based on camera rotation
        // Fix Z coordinate system - when moving +Z, raycast should hit +Z, not -Z
        const forward = new Vector3(
            Math.sin(this.player.rotation.y) * Math.cos(this.player.rotation.x) * lookDistance,
            -Math.sin(this.player.rotation.x) * lookDistance,  // NEGATIVE Y for down pitch
            -Math.cos(this.player.rotation.y) * Math.cos(this.player.rotation.x) * lookDistance  // FLIP Z for correct coordinate system
        );

        const normalized = forward.normalize();

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

        // Determine the final position based on the hovered face and whether it's a block or the room
        if (this.hoveredBlock) {
            // Hit an existing block
            switch (this.hoveredFace) {
                case "top": newPos.y = this.hoveredBlock.position.y + offset; break; // Place above
                case "bottom": newPos.y = this.hoveredBlock.position.y - offset; break; // Place below
                case "north": newPos.z = this.hoveredBlock.position.z - offset; break; // Place in front
                case "south": newPos.z = this.hoveredBlock.position.z + offset; break; // Place behind
                case "east": newPos.x = this.hoveredBlock.position.x + offset; break; // Place right
                case "west": newPos.x = this.hoveredBlock.position.x - offset; break; // Place left
            }
        } else {
            // Hit room geometry (floor, wall, ceiling)
            switch (this.hoveredFace) {
                case "floor": newPos.y = offset / 2; break; // Place on floor (center at half block size)
                case "ceiling": newPos.y = 125 - offset / 2; break; // Place hanging from ceiling
                case "north": newPos.z = -this.level.halfRoomSize - offset / 2; break; // Place on north wall
                case "south": newPos.z = this.level.halfRoomSize + offset / 2; break; // Place on south wall
                case "east": newPos.x = this.level.halfRoomSize + offset / 2; break; // Place on east wall
                case "west": newPos.x = -this.level.halfRoomSize - offset / 2; break; // Place on west wall
            }
        }

        // Round to grid for X and Z, but keep Y precise
        newPos.x = Math.round(newPos.x);
        // newPos.y = Math.round(newPos.y); // Keep Y precise, do not round
        newPos.z = Math.round(newPos.z);

        // Check if position is already occupied
        for (let [id, block] of this.blocks) {
            if (block.position.distanceTo(newPos) < this.blockSize * 0.5) {
                this.addMessage("❌ Position already occupied!");
                return;
            }
        }

        // Create new block
        const block = new MemoryBlock(this.gl, newPos.clone(), this.selectedBlockType, this.blockSize, ""); // Pass this.gl and an empty title
        this.blocks.set(block.id, block);

        // Ensure block is visible in 3D scene
        if (block.model) {
            block.model.setColor(0.0, 1.0, 0.0); // Bright green for high visibility
            block.model.position.set(newPos.x, newPos.y, newPos.z);
            this.addObject(block.model); // ADDED: Add block model to scene objects
        } else {
            console.error('❌ Block model not created!');
            // Try manual geometry creation
            
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

        // Create new block, passing this.gl and this.blockSize
        const block = new MemoryBlock(this.gl, newPos, this.selectedBlockType, this.blockSize, ""); // Pass an empty title
        this.blocks.set(block.id, block);

        // Ensure block is visible in 3D scene
        if (block.model) {
            block.model.setColor(0.0, 1.0, 0.0); // Bright green for high visibility
            block.model.position.set(newPos.x, newPos.y, newPos.z);
            this.addObject(block.model);
        } else {
            console.error('❌ Block model not created for camera position placement!');
        }

        this.audio.play("placeBlock");
        this.addMessage(`✅ Block placed at (${Math.round(newPos.x)}, ${Math.round(newPos.y)}, ${Math.round(newPos.z)})`);

        this.saveToStorage();
    }

    openBlockEditor() {
        if (!this.hoveredBlock || this.hoveredBlock.isFloor) {
            this.addMessage("❌ Point at a block to edit notes!");
            return;
        }

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

        // Save to backend if available
        if (this.backendAvailable && this.useBackend) {
            try {
                await MemoryPalaceAPI.bulkSaveBlocks(data.blocks);
                await MemoryPalaceAPI.saveCameraState(data.camera.position, data.camera.rotation);
                this.addMessage("💾 Saved to server");
            } catch (error) {
                console.error('❌ Failed to save to backend:', error);
                this.addMessage("⚠️ Server save failed");
            }
        } else {
            this.addMessage("⚠️ Backend not available or not in use. Data not saved.");
            console.warn('⚠️ Backend not available or not in use. Data not saved.');
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
            } catch (error) {
                console.error('❌ Failed to load from backend:', error);
                this.addMessage("⚠️ Server load failed or no data found.");
                console.warn('⚠️ Server load failed or no data found.');
            }
        } else {
            this.addMessage("⚠️ Backend not available or not in use. No data loaded.");
            console.warn('⚠️ Backend not available or not in use. No data loaded.');
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
                // Ensure blockSize and title are passed when creating block from JSON
                const block = MemoryBlock.fromJSON(this.gl, blockData);
                
                // Re-create 3D model for imported block
                const builder = new WebGLGeometryBuilder(this.gl);
                builder.addBox(
                    0, 0, 0,
                    block.blockSize, block.blockSize, block.blockSize,
                    [0.0, 1.0, 0.0] // Bright green for high visibility
                );
                const geometry = builder.build();
                const model = new ActionModel3D(geometry);
                model.position.copy(block.position);
                model.setColor(0.0, 1.0, 0.0); // Bright green for high visibility

                block.model = model;
                this.addObject(model); // Add to scene objects
                this.blocks.set(block.id, block);
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
    }

    addMessage(msg) {
        this.messages.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }
    }

    drawUI() {
        this.guiCtx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);

        // Draw crosshair only if cursor is locked AND editor is not open
        if (this.cursorLocked && !this.textEditor.isOpen) {
            if (this.persistentHighlightPosition) {
                // Green crosshair when ready to place
                this.guiCtx.strokeStyle = "#00ff00";
                this.guiCtx.lineWidth = 3;
                this.guiCtx.shadowColor = "#00ff00";
                this.guiCtx.shadowBlur = 5;
            } else {
                // Yellow crosshair when locked but no target
                this.guiCtx.strokeStyle = "#ffff00";
                this.guiCtx.lineWidth = 2;
            }

            this.guiCtx.beginPath();
            this.guiCtx.moveTo(395, 300);
            this.guiCtx.lineTo(405, 300);
            this.guiCtx.moveTo(400, 295);
            this.guiCtx.lineTo(400, 305);
            this.guiCtx.stroke();

            // Reset shadow
            this.guiCtx.shadowBlur = 0;
        } else if (!this.cursorLocked && !this.textEditor.isOpen) {
            // White crosshair when unlocked and editor not open
            this.guiCtx.strokeStyle = "#ffffff";
            this.guiCtx.lineWidth = 2;
            this.guiCtx.shadowBlur = 0;
            this.guiCtx.beginPath();
            this.guiCtx.moveTo(395, 300);
            this.guiCtx.lineTo(405, 300);
            this.guiCtx.moveTo(400, 295);
            this.guiCtx.lineTo(400, 305);
            this.guiCtx.stroke();
        }

        // Always draw HUD (position, controls, etc.)
        this.drawHUD();

        // Draw shape selector if open
        if (this.showShapeSelector && this.cursorLocked) {
            this.drawShapeSelector();
        }

        // Draw text editor if open
        if (this.textEditor.isOpen) { // Only draw if open
            this.textEditor.draw(this.guiCtx);
        }

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

        ctx.fillStyle = "#00ff00";
        ctx.fillText(`Shape: ${this.shapeNames[this.selectedBlockType]}`, x, y);
        y += lineHeight;

        if (this.hoveredBlock) {
            ctx.fillStyle = "#ffff00";
            ctx.fillText(`Target: Block (${this.hoveredFace})`, x, y);

            if (!this.hoveredBlock.isFloor && this.hoveredBlock.text) {
                y += lineHeight;
                ctx.fillStyle = "#00ff00";
                ctx.fillText(`Has notes: ${this.hoveredBlock.text.length} chars`, x, y);
            }
            if (!this.hoveredBlock.isFloor && this.hoveredBlock.title) {
                y += lineHeight;
                ctx.fillStyle = "#00ffff";
                ctx.fillText(`Title: ${this.hoveredBlock.title}`, x, y);
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
        ctx.fillText("Delete Key: Delete Hovered Block", 500, y); y += 20; // New control
        ctx.fillText("B: Place Block (Camera)", 500, y); y += 20;
        ctx.fillText("Action2: Manual Save", 500, y); y += 20;
        ctx.fillText("F9: Toggle Debug", 500, y);
        y += 20; // Add space for new control
        ctx.fillText("Z: Select Shape", 500, y); // New control
    }

    drawClickToStart() {
        const ctx = this.guiCtx;

        // Semi-transparent overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

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

    drawShapeSelector() {
        const ctx = this.guiCtx;
        const selectorWidth = 400;
        const selectorHeight = 200;
        const x = this.shapeSelectorPosition.x;
        const y = this.shapeSelectorPosition.y;

        // Semi-transparent backdrop
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(x - 20, y - 20, selectorWidth + 40, selectorHeight + 40);

        // Selector window background
        ctx.fillStyle = "#2a2a3e";
        ctx.fillRect(x, y, selectorWidth, selectorHeight);

        // Border
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, selectorWidth, selectorHeight);

        // Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Select Block Shape", x + selectorWidth / 2, y + 30);

        // Shape options
        ctx.font = "16px Arial";
        ctx.textAlign = "left";

        for (let i = 0; i < this.availableShapes.length; i++) {
            const shapeKey = this.availableShapes[i];
            const shapeName = this.shapeNames[shapeKey];
            const optionY = y + 60 + (i * 35);
            const isSelected = this.selectedBlockType === shapeKey;

            // Highlight selected shape
            if (isSelected) {
                ctx.fillStyle = "#00ffff";
                ctx.fillRect(x + 20, optionY - 5, selectorWidth - 40, 30);
            }

            // Shape name
            ctx.fillStyle = isSelected ? "#000000" : "#ffffff";
            ctx.fillText(`${i + 1}. ${shapeName}`, x + 30, optionY + 15);

            // Shape preview (simple icons)
            ctx.fillStyle = "#888888";
            switch (shapeKey) {
                case "cube":
                    ctx.fillRect(x + selectorWidth - 60, optionY, 20, 20);
                    break;
                case "cone":
                    ctx.beginPath();
                    ctx.moveTo(x + selectorWidth - 50, optionY + 20);
                    ctx.lineTo(x + selectorWidth - 60, optionY);
                    ctx.lineTo(x + selectorWidth - 40, optionY);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case "sphere":
                    ctx.beginPath();
                    ctx.arc(x + selectorWidth - 50, optionY + 10, 10, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
        }

        // Instructions
        ctx.fillStyle = "#aaaaaa";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Press 1-3 to select shape, Z to close", x + selectorWidth / 2, y + selectorHeight - 20);
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

    addObject(model) {
        if (model && model.geometry) {
            this.sceneObjects.add(model);
            // console.log('✅ Added object to scene:', model);
        }
    }

    removeObject(model) {
        if (model) {
            this.sceneObjects.delete(model);
            // console.log('✅ Removed object from scene:', model);
        }
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
            } else if (input.isKeyPressed("Action4")) { // Q - Down
                this.velocity.y = -this.moveSpeed;
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
}

export { Game };
