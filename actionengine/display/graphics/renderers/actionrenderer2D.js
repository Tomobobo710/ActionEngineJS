// actionengine/display/graphics/renderers/renderer2D.js
class ActionRenderer2D {
	constructor(canvas) {
		this.ctx = canvas.getContext("2d");
		this.viewMatrix = Matrix4.create();
		this.projMatrix = Matrix4.create();
		this.transformedVerts = new Array(8); // Pre-allocate for character vertices
		for (let i = 0; i < 8; i++) {
			this.transformedVerts[i] = new Vector3(0, 0, 0);
		}

		this.nearZoneBuffer = new HighPrecisionZBuffer(Game.WIDTH, Game.HEIGHT);
		this.zBuffer = new SoftwareZBuffer(Game.WIDTH, Game.HEIGHT);
		this.imageData = this.ctx.createImageData(Game.WIDTH, Game.HEIGHT);

		// Depth zone configuration
		this.depthZones = {
			near: {
				max: 500
				// Higher precision
			},
			mid: {
				min: 500,
				max: 1000
				// Current 8-bit buffer stays here
			},
			far: {
				min: 1000,
				max: 10000,
				buckets: 16, // Number of depth buckets for far zone
				triangles: [] // Array of bucket arrays for far triangles
			}
		};

		// Initialize far zone buckets
		this.initializeFarZoneBuckets();
	}

	collectTriangles(terrain, camera, physicsObjects = []) {
		const nearTriangles = [];
		const midTriangles = [];

		// Reset far zone buckets
		for (let i = 0; i < this.depthZones.far.buckets; i++) {
			this.depthZones.far.triangles[i] = [];
		}

		const processTriangle = (triangle, isPhysicsObject = false) => {
			const cameraPos = camera.getViewMatrix().position;
			const viewVector = cameraPos.sub(triangle.vertices[0]);
			if (triangle.normal.dot(viewVector) <= 0) {
				return;
			}

			// Project vertices
			const projectedVerts = triangle.vertices.map((vertex) => this.project(vertex, camera));

			// Check if any projection failed
			if (projectedVerts.some((v) => v === null)) return;

			// Calculate lighting
			const lightDir = new Vector3(0.5, 1, 0.5).normalize();
			const lighting = Math.max(0.3, Math.min(1.0, triangle.normal.dot(lightDir)));

			const triangle2d = {
				points: projectedVerts,
				color: triangle.color,
				lighting: triangle.vertices[0].y === 0 ? 1.0 : lighting,
				depth: (projectedVerts[0].z + projectedVerts[1].z + projectedVerts[2].z) / 3,
				isWater: triangle.isWater || false
			};

			// Sort into appropriate zone
			const zone = this.getTriangleZone(triangle2d.depth);
			if (zone === "near") {
				nearTriangles.push(triangle2d);
			} else if (zone === "mid") {
				midTriangles.push(triangle2d);
			} else {
				const bucketIndex = this.getFarZoneBucketIndex(triangle2d.depth);
				this.depthZones.far.triangles[bucketIndex].push(triangle2d);
			}
		};

		// Process terrain triangles
		for (const triangle of terrain.triangles) {
			processTriangle(triangle, false);
		}

		// Process physics object triangles
		for (const physicsObject of physicsObjects) {
			for (const triangle of physicsObject.triangles) {
				processTriangle(triangle, true);
			}
		}

		return {
			nearTriangles,
			midTriangles,
			farTriangles: this.depthZones.far.triangles
		};
	}

	initializeFarZoneBuckets() {
		this.depthZones.far.triangles = new Array(this.depthZones.far.buckets);
		for (let i = 0; i < this.depthZones.far.buckets; i++) {
			this.depthZones.far.triangles[i] = [];
		}
	}

	// Helper to determine which zone a triangle belongs to
	getTriangleZone(avgDepth) {
		if (avgDepth <= this.depthZones.near.max) {
			return "near";
		} else if (avgDepth <= this.depthZones.mid.max) {
			return "mid";
		} else {
			return "far";
		}
	}

	// Helper to get far zone bucket index
	getFarZoneBucketIndex(depth) {
		const { min, max, buckets } = this.depthZones.far;
		const normalizedDepth = (depth - min) / (max - min);
		return Math.min(buckets - 1, Math.floor(normalizedDepth * buckets));
	}

	transformVertex(vertex, modelMatrix) {
		const v = [vertex.x, vertex.y, vertex.z, 1];
		const result = [0, 0, 0, 0];

		// Manual matrix multiplication
		for (let i = 0; i < 4; i++) {
			result[i] =
				v[0] * modelMatrix[i] +
				v[1] * modelMatrix[i + 4] +
				v[2] * modelMatrix[i + 8] +
				v[3] * modelMatrix[i + 12];
		}

		return new Vector3(result[0] / result[3], result[1] / result[3], result[2] / result[3]);
	}

	transformNormal(normal, modelMatrix) {
		// Calculate inverse transpose of 3x3 portion of model matrix
		const a = modelMatrix[0],
			b = modelMatrix[1],
			c = modelMatrix[2],
			d = modelMatrix[4],
			e = modelMatrix[5],
			f = modelMatrix[6],
			g = modelMatrix[8],
			h = modelMatrix[9],
			i = modelMatrix[10];

		const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
		const invdet = 1.0 / det;

		const invTranspose = [
			(e * i - f * h) * invdet,
			(c * h - b * i) * invdet,
			(b * f - c * e) * invdet,
			(f * g - d * i) * invdet,
			(a * i - c * g) * invdet,
			(c * d - a * f) * invdet,
			(d * h - e * g) * invdet,
			(b * g - a * h) * invdet,
			(a * e - b * d) * invdet
		];

		// Transform normal with inverse transpose matrix
		const x = normal.x * invTranspose[0] + normal.y * invTranspose[1] + normal.z * invTranspose[2];
		const y = normal.x * invTranspose[3] + normal.y * invTranspose[4] + normal.z * invTranspose[5];
		const z = normal.x * invTranspose[6] + normal.y * invTranspose[7] + normal.z * invTranspose[8];

		return new Vector3(x, y, z).normalize();
	}

	project(point, camera) {
		const view = camera.getViewMatrix();
		const relativePos = point.sub(view.position);
		const viewZ = relativePos.dot(view.forward);

		if (viewZ <= -500) return null;

		Matrix4.lookAt(
			this.viewMatrix,
			view.position.toArray(),
			[view.position.x + view.forward.x, view.position.y + view.forward.y, view.position.z + view.forward.z],
			view.up.toArray()
		);

		Matrix4.perspective(this.projMatrix, camera.fov, Game.WIDTH / Game.HEIGHT, 0.1, 10000.0);

		const worldPoint = [point.x, point.y, point.z, 1];
		const clipSpace = Matrix4.transformVector(worldPoint, this.viewMatrix, this.projMatrix);

		const w = Math.max(0.1, clipSpace[3]);
		const screenX = ((clipSpace[0] / w) * 0.5 + 0.5) * Game.WIDTH;
		const screenY = ((-clipSpace[1] / w) * 0.5 + 0.5) * Game.HEIGHT;

		return {
			x: screenX,
			y: screenY,
			z: viewZ
		};
	}

	render(terrain, camera, character, showDebugPanel, weatherSystem, renderablePhysicsObjects) {
		// Clear image data and fill with sky color
		this.imageData = this.ctx.createImageData(Game.WIDTH, Game.HEIGHT);
		const data = this.imageData.data;
		for (let i = 0; i < data.length; i += 4) {
			data[i] = 135; // sky r
			data[i + 1] = 206; // sky g
			data[i + 2] = 235; // sky b
			data[i + 3] = 255; // alpha
		}

		// Clear both z-buffers
		this.zBuffer.clear();
		this.nearZoneBuffer.clear();

		// Project terrain vertices first - we don't need to store these anymore
		// since we'll project them as needed in collectTriangles

		// Collect and sort triangles into zones
		const { nearTriangles, midTriangles, farTriangles } = this.collectTriangles(
			terrain,
			camera,
			renderablePhysicsObjects
		);

		// Handle character if present
		if (character) {
			this.drawCharacter(character, camera, nearTriangles);
		}

		// Render far zone first (painter's algorithm with buckets)
		for (let bucketIndex = farTriangles.length - 1; bucketIndex >= 0; bucketIndex--) {
			const bucket = farTriangles[bucketIndex];
			bucket.sort((a, b) => b.depth - a.depth);

			for (const triangle of bucket) {
				this.renderTriangleWithoutDepth(triangle);
			}
		}

		// Render mid zone (8-bit depth buffer)
		for (const triangle of midTriangles) {
			this.rasterizeTriangle(triangle, triangle.color, triangle.lighting);
		}

		// Render near zone with high precision
		for (const triangle of nearTriangles) {
			this.rasterizeTriangleHighPrecision(triangle);
		}

		// Draw weather particles last (on top)
		if (weatherSystem && weatherSystem.particleEmitter) {
			const particles = weatherSystem.particleEmitter.getParticles();

			this.ctx.save();

			// Sort particles back to front
			particles.sort((a, b) => b.position.z - a.position.z);

			particles.forEach((particle) => {
				const projected = this.project(
					new Vector3(particle.position.x, particle.position.y, particle.position.z),
					camera
				);

				if (!projected) return;

				this.ctx.fillStyle = `rgba(180, 190, 255, ${particle.alpha})`;
				this.ctx.fillRect(
					projected.x - particle.size / 2,
					projected.y - particle.size / 2,
					particle.size,
					particle.size
				);
			});
			this.ctx.restore();
		}

		// Put the final image to canvas
		this.ctx.putImageData(this.imageData, 0, 0);

		// Draw debug overlays
		this.drawDebugLines(character, camera, showDebugPanel);
	}

	drawDebugLines(character, camera, showDebugPanel) {
		if (showDebugPanel) {
			const currentTriangle = character.getCurrentTriangle();
			if (currentTriangle) {
				// Calculate triangle center
				const center = {
					x:
						(currentTriangle.vertices[0].x +
							currentTriangle.vertices[1].x +
							currentTriangle.vertices[2].x) /
						3,
					y:
						(currentTriangle.vertices[0].y +
							currentTriangle.vertices[1].y +
							currentTriangle.vertices[2].y) /
						3,
					z:
						(currentTriangle.vertices[0].z +
							currentTriangle.vertices[1].z +
							currentTriangle.vertices[2].z) /
						3
				};

				const normalEnd = {
					x: center.x + currentTriangle.normal.x * 10,
					y: center.y + currentTriangle.normal.y * 10,
					z: center.z + currentTriangle.normal.z * 10
				};

				const projectedCenter = this.project(new Vector3(center.x, center.y, center.z), camera);
				const projectedEnd = this.project(new Vector3(normalEnd.x, normalEnd.y, normalEnd.z), camera);

				if (projectedCenter && projectedEnd) {
					this.ctx.strokeStyle = "#0000FF";
					this.ctx.beginPath();
					this.ctx.moveTo(projectedCenter.x, projectedCenter.y);
					this.ctx.lineTo(projectedEnd.x, projectedEnd.y);
					this.ctx.stroke();
				}
			}
			this.drawDirectionIndicator(character, camera);
		}
	}

	interpolateZ(x, y, p1, p2, p3) {
		// Calculate barycentric coordinates
		const denominator = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);

		if (Math.abs(denominator) < 0.0001) {
			// Degenerate triangle, return average z
			return (p1.z + p2.z + p3.z) / 3;
		}

		const w1 = ((p2.y - p3.y) * (x - p3.x) + (p3.x - p2.x) * (y - p3.y)) / denominator;
		const w2 = ((p3.y - p1.y) * (x - p3.x) + (p1.x - p3.x) * (y - p3.y)) / denominator;
		const w3 = 1 - w1 - w2;

		// Interpolate Z using barycentric coordinates
		return w1 * p1.z + w2 * p2.z + w3 * p3.z;
	}
	// Render far triangles without depth testing
	renderTriangleWithoutDepth(triangle) {
		let lightingValue = triangle.lighting; // Change to let

		if (triangle.isWater) {
			const time = performance.now() / 1000;
			const wave = Math.sin(time + triangle.depth / 50) * 0.1 + 0.9;
			lightingValue *= wave;
		}

		const r = parseInt(triangle.color.substr(1, 2), 16);
		const g = parseInt(triangle.color.substr(3, 2), 16);
		const b = parseInt(triangle.color.substr(5, 2), 16);

		const lit_r = Math.floor(r * lightingValue);
		const lit_g = Math.floor(g * lightingValue);
		const lit_b = Math.floor(b * lightingValue);

		this.fillTriangleInImageData(triangle.points[0], triangle.points[1], triangle.points[2], lit_r, lit_g, lit_b);
	}

	fillTriangleInImageData(p1, p2, p3, r, g, b) {
		const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x, p3.x)));
		const maxX = Math.min(Game.WIDTH - 1, Math.ceil(Math.max(p1.x, p2.x, p3.x)));
		const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y, p3.y)));
		const maxY = Math.min(Game.HEIGHT - 1, Math.ceil(Math.max(p1.y, p2.y, p3.y)));

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				if (this.pointInTriangle({ x, y }, p1, p2, p3)) {
					const index = (y * Game.WIDTH + x) * 4;
					this.imageData.data[index] = r;
					this.imageData.data[index + 1] = g;
					this.imageData.data[index + 2] = b;
					this.imageData.data[index + 3] = 255;
				}
			}
		}
	}

	pointInTriangle(p, v1, v2, v3) {
		function sign(p1, p2, p3) {
			return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
		}

		const d1 = sign(p, v1, v2);
		const d2 = sign(p, v2, v3);
		const d3 = sign(p, v3, v1);

		const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
		const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

		return !(hasNeg && hasPos);
	}

	isFrontFacing(p1, p2, p3) {
		// Calculate signed area - if positive, triangle is CCW from our view
		return (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y) < 0;
	}

	drawDirectionIndicator(character, camera) {
		const center = character.position;
		const directionEnd = new Vector3(
			center.x + character.facingDirection.x * character.size * 2,
			center.y, // Keep y level for visual clarity
			center.z + character.facingDirection.z * character.size * 2
		);

		const projectedCenter = this.project(center, camera);
		const projectedEnd = this.project(directionEnd, camera);

		if (projectedCenter && projectedEnd) {
			this.ctx.strokeStyle = "#0000FF";
			this.ctx.beginPath();
			this.ctx.moveTo(projectedCenter.x, projectedCenter.y);
			this.ctx.lineTo(projectedEnd.x, projectedEnd.y);
			this.ctx.stroke();
		}
	}

	drawCharacter(character, camera, visibleTriangles) {
		const modelMatrix = character.getModelMatrix();
		const characterModel = character.getCharacterModelTriangles();
		const lightDir = new Vector3(0.5, 1.0, 0.5).normalize();

		// Define mapping functions outside the loop
		const transformVertex = (vertex) => this.transformVertex(vertex, modelMatrix);
		const projectVertex = (vertex) => this.project(vertex, camera);

		for (const triangle of characterModel) {
			const worldNormal = this.transformNormal(triangle.normal, modelMatrix);
			const lighting = Math.max(0.3, Math.min(1.0, worldNormal.dot(lightDir)));

			const transformedVerts = triangle.vertices.map(transformVertex);
			const projectedPoints = transformedVerts.map(projectVertex);

			if (projectedPoints.some((p) => p === null)) continue;

			if (this.isFrontFacing(projectedPoints[0], projectedPoints[1], projectedPoints[2])) {
				const triangle2d = {
					points: projectedPoints,
					color: triangle.color,
					lighting: lighting,
					depth: (projectedPoints[0].z + projectedPoints[1].z + projectedPoints[2].z) / 3
				};
				visibleTriangles.push(triangle2d);
			}
		}
	}

	setPixel(x, y, r, g, b) {
		const index = (y * Game.WIDTH + x) * 4;
		this.imageData.data[index] = r;
		this.imageData.data[index + 1] = g;
		this.imageData.data[index + 2] = b;
		this.imageData.data[index + 3] = 255;
	}

	rasterizeTriangle(triangle, lighting) {
		const p1 = triangle.points[0];
		const p2 = triangle.points[1];
		const p3 = triangle.points[2];

		// Pre-calculate color once per triangle
		const r = parseInt(triangle.color.substr(1, 2), 16);
		const g = parseInt(triangle.color.substr(3, 2), 16);
		const b = parseInt(triangle.color.substr(5, 2), 16);

		// Use triangle's lighting value directly
		let lightingValue = triangle.lighting;

		if (triangle.isWater) {
			const time = performance.now() / 1000;
			const wave = Math.sin(time + triangle.depth / 50) * 0.1 + 0.9;
			lightingValue *= wave;
		}

		// Apply lighting to RGB values
		const lit_r = Math.floor(r * lightingValue);
		const lit_g = Math.floor(g * lightingValue);
		const lit_b = Math.floor(b * lightingValue);

		// Rest of rasterization logic...
		const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x, p3.x)));
		const maxX = Math.min(Game.WIDTH - 1, Math.ceil(Math.max(p1.x, p2.x, p3.x)));
		const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y, p3.y)));
		const maxY = Math.min(Game.HEIGHT - 1, Math.ceil(Math.max(p1.y, p2.y, p3.y)));

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				if (this.pointInTriangle({ x, y }, p1, p2, p3)) {
					const z = this.interpolateZ(x, y, p1, p2, p3);
					if (this.zBuffer.testAndSetDepth(x, y, z)) {
						this.setPixel(x, y, lit_r, lit_g, lit_b);
					}
				}
			}
		}
	}

	rasterizeTriangleHighPrecision(triangle) {
		const p1 = triangle.points[0];
		const p2 = triangle.points[1];
		const p3 = triangle.points[2];

		// Get color from triangle
		const r = parseInt(triangle.color.substr(1, 2), 16);
		const g = parseInt(triangle.color.substr(3, 2), 16);
		const b = parseInt(triangle.color.substr(5, 2), 16);

		let lightingValue = triangle.lighting;

		if (triangle.isWater) {
			const time = performance.now() / 1000;
			const wave = Math.sin(time + triangle.depth / 50) * 0.1 + 0.9;
			lightingValue *= wave;
		}

		const lit_r = Math.floor(r * lightingValue);
		const lit_g = Math.floor(g * lightingValue);
		const lit_b = Math.floor(b * lightingValue);

		const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x, p3.x)));
		const maxX = Math.min(Game.WIDTH - 1, Math.ceil(Math.max(p1.x, p2.x, p3.x)));
		const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y, p3.y)));
		const maxY = Math.min(Game.HEIGHT - 1, Math.ceil(Math.max(p1.y, p2.y, p3.y)));

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				if (this.pointInTriangle({ x, y }, p1, p2, p3)) {
					const z = this.interpolateZ(x, y, p1, p2, p3);
					if (this.nearZoneBuffer.testAndSetDepth(x, y, z)) {
						this.setPixel(x, y, lit_r, lit_g, lit_b);
					}
				}
			}
		}
	}
}

class SoftwareZBuffer {
	constructor(width, height) {
		// Use Uint8Array for low precision (0-255 depth values)
		// Much more memory efficient than Float32Array
		this.buffer = new Uint8Array(width * height);
		this.width = width;
		this.height = height;
	}

	clear() {
		// Fill with "infinity" (255 in our case)
		this.buffer.fill(255);
	}

	// Convert world z coordinate to 0-255 range
	convertToBufferDepth(worldZ) {
		const near = -1;
		const far = 6000;
		const normalized = (worldZ - near) / (far - near);
		return Math.floor(normalized * 255);
	}

	testAndSetDepth(x, y, worldZ) {
		if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

		const index = Math.floor(y) * this.width + Math.floor(x);
		const bufferDepth = this.convertToBufferDepth(worldZ);

		// Lower values are closer (like GL)
		if (bufferDepth < this.buffer[index]) {
			this.buffer[index] = bufferDepth;
			return true;
		}
		return false;
	}
}

class HighPrecisionZBuffer {
	constructor(width, height) {
		// Using Float32Array for near-zone precision
		this.buffer = new Float32Array(width * height);
		this.width = width;
		this.height = height;
	}

	clear() {
		this.buffer.fill(Number.MAX_VALUE);
	}

	testAndSetDepth(x, y, worldZ) {
		// First check if point is behind camera
		if (worldZ < -1) return false; // Matching your current near plane culling

		if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

		const index = Math.floor(y) * this.width + Math.floor(x);

		if (worldZ < this.buffer[index]) {
			this.buffer[index] = worldZ;
			return true;
		}
		return false;
	}
}