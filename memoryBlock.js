// Memory Block class for 3D WebGL rendering
import { WebGLGeometryBuilder } from './webglGeometryBuilder.js';
import { WebGLUtils } from './webglUtils.js';

class MemoryBlock {
	constructor(gl, position, type = "cube", blockSize = 5, title = "") { // Add gl, blockSize, and title parameters
		this.gl = gl; // Store gl context
		this.id = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		this.position = position ?
			(window.Vector3 && position.clone ? position.clone() : { x: position.x, y: position.y, z: position.z }) :
			(window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 });
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
		      this.model = window.ActionModel3D ? new window.ActionModel3D(geometry) : null;
	       if (this.model && window.Vector3 && this.model.position.copy) {
	           this.model.position.copy(this.position); // Set model's position
	       } else if (this.model) {
	           this.model.position.x = this.position.x;
	           this.model.position.y = this.position.y;
	           this.model.position.z = this.position.z;
	       }
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
			data.position ?
				(window.Vector3 ? new window.Vector3(data.position.x, data.position.y, data.position.z) : { x: data.position.x, y: data.position.y, z: data.position.z }) :
				(window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 }),
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
		const modelMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
		Matrix4.translate(modelMatrix, modelMatrix, [
			this.model.position.x, // Use model's position
			this.model.position.y,
			this.model.position.z
		]);

		// Draw the block mesh
		renderer.drawMesh(this.model.geometry, "basic", modelMatrix, viewMatrix, projectionMatrix);
	}
}

export { MemoryBlock };