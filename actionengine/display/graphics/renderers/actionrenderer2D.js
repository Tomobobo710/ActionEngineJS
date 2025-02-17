class ActionRenderer2D {
	constructor(canvas) {
		this.ctx = canvas.getContext("2d");
		this.width = Game.WIDTH;
		this.height = Game.HEIGHT;

		this.viewMatrix = Matrix4.create();
		this.projMatrix = Matrix4.create();

		this.imageData = this.ctx.createImageData(this.width, this.height);
		this.zBuffer = new Float32Array(this.width * this.height);

		// Configuration for depth handling
		this.depthConfig = {
			far: 10000.0,
			transitionDistance: 250.0 // Where we switch to painter's algorithm
		};

		// Create procedural textures
		this.grassTexture = new ProceduralTexture(256, 256);
		this.grassTexture.generateGrass();

		this.checkerTexture = new ProceduralTexture(256, 256);
		this.checkerTexture.generateCheckerboard();
	}

	render(terrain, camera, character, showDebugPanel, weatherSystem, renderablePhysicsObjects) {
		// Get view matrix ONCE at the start
		const view = camera.getViewMatrix();
		// Calculate view and projection matrices ONCE
		Matrix4.lookAt(
			this.viewMatrix,
			view.position.toArray(),
			[view.position.x + view.forward.x, view.position.y + view.forward.y, view.position.z + view.forward.z],
			view.up.toArray()
		);
		Matrix4.perspective(this.projMatrix, camera.fov, this.width / this.height, 0.1, 10000.0);

		// Clear buffers
		this.clearBuffers();

		// Pass view to collectTriangles
		const { nearTriangles, farTriangles } = this.collectTriangles(terrain, camera, renderablePhysicsObjects, view);

		// Add character triangles if present
		if (character) {
			this.processCharacterTriangles(character, camera, nearTriangles, view);
		}

		// Render far triangles first (back to front) WITHOUT depth testing
		farTriangles.sort((a, b) => b.depth - a.depth);
		for (const triangle of farTriangles) {
			this.rasterizeTriangleNoDepth(triangle);
		}

		// Render near triangles WITH depth testing
		nearTriangles.sort((a, b) => b.depth - a.depth);
		for (const triangle of nearTriangles) {
			this.rasterizeTriangle(triangle);
		}

		// Put final image to canvas
		this.ctx.putImageData(this.imageData, 0, 0);

		// Debug overlays if needed
		if (showDebugPanel) {
			this.renderDebugOverlays(character, camera, view); // Pass view here too
		}
	}

	clearBuffers() {
		const data = this.imageData.data;
		for (let i = 0; i < data.length; i += 4) {
			data[i] = 135; // sky r
			data[i + 1] = 206; // sky g
			data[i + 2] = 235; // sky b
			data[i + 3] = 255; // alpha
		}
		this.zBuffer.fill(Infinity);
	}

	collectTriangles(terrain, camera, physicsObjects, view) {
		const nearTriangles = [];
		const farTriangles = [];

		const processTriangle = (triangle) => {
			// Calculate viewZ values once
			const viewZs = triangle.vertices.map((vertex) => {
				const viewSpace = vertex.sub(view.position);
				return viewSpace.dot(view.forward);
			});

			// If ALL vertices are behind, skip it
			if (viewZs.every((z) => z <= 0)) return;
			// If ALL vertices are too far, skip it
			if (viewZs.every((z) => z > this.depthConfig.far)) return;
			// Back-face culling using viewspace positions
			if (triangle.normal.dot(triangle.vertices[0].sub(view.position)) >= 0) return;

			// Project using our cached viewZ values
			const projectedVerts = triangle.vertices.map((v, i) => this.project(v, camera, view, viewZs[i]));
			if (projectedVerts.some((v) => v === null)) return;

			const lightDir = new Vector3(0.5, 1, 0.5).normalize();
			const lighting = Math.max(0.3, Math.min(1.0, triangle.normal.dot(lightDir)));

			const processedTriangle = {
				points: projectedVerts,
				color: triangle.color,
				lighting: triangle.vertices[0].y === 0 ? 1.0 : lighting,
				depth: (projectedVerts[0].z + projectedVerts[1].z + projectedVerts[2].z) / 3,
				isWater: triangle.isWater || false,
				uvs: triangle.uvs,
				texture: triangle.texture
			};

			// Assign different textures based on distance
			if (processedTriangle.depth <= this.depthConfig.transitionDistance) {
				nearTriangles.push(processedTriangle);
			} else {
				farTriangles.push(processedTriangle);
			}
		};

		// Process terrain triangles
		for (const triangle of terrain.triangles) {
			processTriangle(triangle);
		}

		// Process physics object triangles
		for (const physicsObject of physicsObjects) {
			for (const triangle of physicsObject.triangles) {
				processTriangle(triangle);
			}
		}

		return { nearTriangles, farTriangles };
	}

	project(point, camera, view, cachedViewZ) {
		const viewZ = cachedViewZ ?? point.sub(view.position).dot(view.forward);

		const worldPoint = [point.x, point.y, point.z, 1];
		const clipSpace = Matrix4.transformVector(worldPoint, this.viewMatrix, this.projMatrix);

		const w = Math.max(0.1, clipSpace[3]);
		const screenX = ((clipSpace[0] / w) * 0.5 + 0.5) * this.width;
		const screenY = ((-clipSpace[1] / w) * 0.5 + 0.5) * this.height;

		return {
			x: screenX,
			y: screenY,
			z: viewZ
		};
	}

	rasterizeTriangleBase(triangle, useDepthTest = true) {
		const points = triangle.points;
		// Cache array access and bound calculations
		const p0 = points[0],
			p1 = points[1],
			p2 = points[2];
		const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
		const maxX = Math.min(this.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
		const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
		const maxY = Math.min(this.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

		// Pre-calculate color values once
		const color = triangle.color;
		const r = parseInt(color.substr(1, 2), 16);
		const g = parseInt(color.substr(3, 2), 16);
		const b = parseInt(color.substr(5, 2), 16);
		const baseLighting = triangle.lighting;

		// Cache texture-related values
		const hasTexture = triangle.texture && triangle.uvs;
		const imageData = this.imageData.data;
		let oneOverW, uvOverW;

		if (hasTexture) {
			oneOverW = [1 / Math.max(0.1, p0.z), 1 / Math.max(0.1, p1.z), 1 / Math.max(0.1, p2.z)];
			const uvs = triangle.uvs;
			uvOverW = [
				{ u: uvs[0].u * oneOverW[0], v: uvs[0].v * oneOverW[0] },
				{ u: uvs[1].u * oneOverW[1], v: uvs[1].v * oneOverW[1] },
				{ u: uvs[2].u * oneOverW[2], v: uvs[2].v * oneOverW[2] }
			];
		}

		// Cache texture dimensions if available
		const textureWidth = hasTexture ? triangle.texture.width : 0;
		const textureHeight = hasTexture ? triangle.texture.height : 0;

		const BLOCK_SIZE = 8;
		const isWater = triangle.isWater;
		const zBuffer = this.zBuffer;

		// Pre-calculate block boundaries
		const numBlocksX = Math.ceil((maxX - minX + 1) / BLOCK_SIZE);
		const numBlocksY = Math.ceil((maxY - minY + 1) / BLOCK_SIZE);

		for (let blockYIndex = 0; blockYIndex < numBlocksY; blockYIndex++) {
			const blockY = minY + blockYIndex * BLOCK_SIZE;
			const endY = Math.min(blockY + BLOCK_SIZE, maxY + 1);

			for (let blockXIndex = 0; blockXIndex < numBlocksX; blockXIndex++) {
				const blockX = minX + blockXIndex * BLOCK_SIZE;
				const endX = Math.min(blockX + BLOCK_SIZE, maxX + 1);

				for (let y = blockY; y < endY; y++) {
					const rowOffset = y * this.width;

					for (let x = blockX; x < endX; x++) {
						if (!TriangleUtils.pointInTriangle({ x, y }, p0, p1, p2)) continue;

						const index = rowOffset + x;
						let currentLighting = baseLighting;

						// Z-buffer and water effects
						if (isWater || useDepthTest) {
							const z = TriangleUtils.interpolateZ(x, y, p0, p1, p2);

							if (isWater) {
								currentLighting *= Math.sin(performance.now() / 1000 + z / 50) * 0.1 + 0.9;
							}

							if (useDepthTest && z >= zBuffer[index]) continue;
							if (useDepthTest) zBuffer[index] = z;
						}

						const pixelIndex = index * 4;

						if (hasTexture) {
							const bary = TriangleUtils.getBarycentricCoords(x, y, p0, p1, p2);
							const interpolatedOneOverW =
								bary.w1 * oneOverW[0] + bary.w2 * oneOverW[1] + bary.w3 * oneOverW[2];

							const interpolatedUOverW =
								bary.w1 * uvOverW[0].u + bary.w2 * uvOverW[1].u + bary.w3 * uvOverW[2].u;

							const interpolatedVOverW =
								bary.w1 * uvOverW[0].v + bary.w2 * uvOverW[1].v + bary.w3 * uvOverW[2].v;

							const u = interpolatedUOverW / interpolatedOneOverW;
							const v = interpolatedVOverW / interpolatedOneOverW;

							const texel = triangle.texture.getPixel(
								Math.floor(u * textureWidth),
								Math.floor(v * textureHeight)
							);

							imageData[pixelIndex] = texel.r * currentLighting;
							imageData[pixelIndex + 1] = texel.g * currentLighting;
							imageData[pixelIndex + 2] = texel.b * currentLighting;
							imageData[pixelIndex + 3] = 255;
						} else {
							imageData[pixelIndex] = r * currentLighting;
							imageData[pixelIndex + 1] = g * currentLighting;
							imageData[pixelIndex + 2] = b * currentLighting;
							imageData[pixelIndex + 3] = 255;
						}
					}
				}
			}
		}
	}

	rasterizeTriangle(triangle) {
		this.rasterizeTriangleBase(triangle, true);
	}

	rasterizeTriangleNoDepth(triangle) {
		this.rasterizeTriangleBase(triangle, false);
	}

	processCharacterTriangles(character, camera, nearTriangles, view) {
		const modelMatrix = character.getModelMatrix();
		const characterModel = character.getCharacterModelTriangles();
		const lightDir = new Vector3(0.5, 1.0, 0.5).normalize();

		for (const triangle of characterModel) {
			const worldNormal = Matrix4.transformNormal(triangle.normal, modelMatrix);

			// Transform vertices to world space
			const transformedVerts = new Array(3);
			for (let i = 0; i < 3; i++) {
				transformedVerts[i] = Matrix4.transformVertex(triangle.vertices[i], modelMatrix);
			}

			// Project to screen space using our cached view
			const projectedPoints = new Array(3);
			let invalidProjection = false;
			for (let i = 0; i < 3; i++) {
				projectedPoints[i] = this.project(transformedVerts[i], camera, view);
				if (projectedPoints[i] === null) {
					invalidProjection = true;
					break;
				}
			}
			if (invalidProjection) continue;

			// Calculate average Z depth
			const viewZ = (projectedPoints[0].z + projectedPoints[1].z + projectedPoints[2].z) / 3;
			if (viewZ <= 0) continue;

			if (TriangleUtils.isFrontFacing(projectedPoints[0], projectedPoints[1], projectedPoints[2])) {
				const lighting = Math.max(0.3, Math.min(1.0, worldNormal.dot(lightDir)));
				nearTriangles.push({
					points: projectedPoints,
					color: triangle.color,
					lighting: lighting,
					depth: viewZ
				});
			}
		}
	}

	renderDebugOverlays(character, camera, view) {
		const ctx = this.ctx;
		const currentTriangle = character.getCurrentTriangle();
		if (currentTriangle) {
			const center = {
				x: (currentTriangle.vertices[0].x + currentTriangle.vertices[1].x + currentTriangle.vertices[2].x) / 3,
				y: (currentTriangle.vertices[0].y + currentTriangle.vertices[1].y + currentTriangle.vertices[2].y) / 3,
				z: (currentTriangle.vertices[0].z + currentTriangle.vertices[1].z + currentTriangle.vertices[2].z) / 3
			};
			const normalEnd = {
				x: center.x + currentTriangle.normal.x * 10,
				y: center.y + currentTriangle.normal.y * 10,
				z: center.z + currentTriangle.normal.z * 10
			};
			const projectedCenter = this.project(new Vector3(center.x, center.y, center.z), camera, view);
			const projectedEnd = this.project(new Vector3(normalEnd.x, normalEnd.y, normalEnd.z), camera, view);
			if (projectedCenter && projectedEnd) {
				ctx.strokeStyle = "#0000FF";
				ctx.beginPath();
				ctx.moveTo(projectedCenter.x, projectedCenter.y);
				ctx.lineTo(projectedEnd.x, projectedEnd.y);
				ctx.stroke();
			}
		}
		this.renderDirectionIndicator(character, camera, view);
	}

	renderDirectionIndicator(character, camera, view) {
		const center = character.position;
		const directionEnd = new Vector3(
			center.x + character.facingDirection.x * character.size * 2,
			center.y,
			center.z + character.facingDirection.z * character.size * 2
		);

		const projectedCenter = this.project(center, camera, view);
		const projectedEnd = this.project(directionEnd, camera, view);

		if (projectedCenter && projectedEnd) {
			this.ctx.strokeStyle = "#0000FF";
			this.ctx.beginPath();
			this.ctx.moveTo(projectedCenter.x, projectedCenter.y);
			this.ctx.lineTo(projectedEnd.x, projectedEnd.y);
			this.ctx.stroke();
		}
	}
}

class TriangleUtils {
	static interpolateZ(x, y, p1, p2, p3) {
		const denominator = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);
		if (Math.abs(denominator) < 0.0001) {
			return (p1.z + p2.z + p3.z) / 3;
		}
		const w1 = ((p2.y - p3.y) * (x - p3.x) + (p3.x - p2.x) * (y - p3.y)) / denominator;
		const w2 = ((p3.y - p1.y) * (x - p3.x) + (p1.x - p3.x) * (y - p3.y)) / denominator;
		const w3 = 1 - w1 - w2;
		return w1 * p1.z + w2 * p2.z + w3 * p3.z;
	}

	static pointInTriangle(p, v1, v2, v3) {
		const d1 = (p.x - v2.x) * (v1.y - v2.y) - (v1.x - v2.x) * (p.y - v2.y);
		const d2 = (p.x - v3.x) * (v2.y - v3.y) - (v2.x - v3.x) * (p.y - v3.y);
		const d3 = (p.x - v1.x) * (v3.y - v1.y) - (v3.x - v1.x) * (p.y - v1.y);
		const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
		const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
		return !(hasNeg && hasPos);
	}

	static isFrontFacing(p1, p2, p3) {
		return (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y) < 0;
	}

	static getBarycentricCoords(x, y, p1, p2, p3) {
		const denominator = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);
		const w1 = ((p2.y - p3.y) * (x - p3.x) + (p3.x - p2.x) * (y - p3.y)) / denominator;
		const w2 = ((p3.y - p1.y) * (x - p3.x) + (p1.x - p3.x) * (y - p3.y)) / denominator;
		const w3 = 1 - w1 - w2;
		return { w1, w2, w3 };
	}
}

class ProceduralTexture {
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.data = new Uint8ClampedArray(width * height * 4);
		this.widthMask = width - 1; // For power-of-2 textures, faster modulo
		this.heightMask = height - 1;
	}
	getPixel(x, y) {
		// Fast modulo for power-of-2 textures using bitwise AND
		const tx = x & this.widthMask;
		const ty = y & this.heightMask;
		const i = (ty * this.width + tx) * 4;
		return {
			r: this.data[i],
			g: this.data[i + 1],
			b: this.data[i + 2]
		};
	}
	generateCheckerboard() {
		const size = 4; // Make checkers a bit bigger
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				const isEven = ((x >> 2) + (y >> 2)) & 1; // Simpler calculation using bitwise
				const i = (y * this.width + x) * 4;
				if (isEven) {
					this.data[i] = 0; // Blue square
					this.data[i + 1] = 0;
					this.data[i + 2] = 255;
				} else {
					this.data[i] = 255; // Purple square
					this.data[i + 1] = 0;
					this.data[i + 2] = 255;
				}
				this.data[i + 3] = 255;
			}
		}
	}
	generateGrass() {
		const baseColor = { r: 34, g: 139, b: 34 };
		// Pre-calculate a noise table for faster lookup
		const noiseTable = new Uint8Array(256);
		for (let i = 0; i < 256; i++) {
			noiseTable[i] = Math.floor(Math.random() * 30);
		}
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				const variation = noiseTable[(x * 7 + y * 13) & 255];
				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r + variation);
				this.data[i + 1] = Math.min(255, baseColor.g + variation);
				this.data[i + 2] = Math.min(255, baseColor.b + variation);
				this.data[i + 3] = 255;
			}
		}
	}
	generateWater() {
		const baseColor = { r: 0, g: 100, b: 255 }; // Keeping your bright blue base
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				// Just gentle noise for natural water look
				const noise = Math.random() * 15 - 7;

				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r + noise);
				this.data[i + 1] = Math.min(255, baseColor.g + noise);
				this.data[i + 2] = Math.min(255, baseColor.b + noise);
				this.data[i + 3] = 255;
			}
		}
	}
	generateDeepWater() {
		const baseColor = { r: 0, g: 21, b: 37 }; // Dark blue base
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				// Just subtle random variation
				const variation = Math.random() * 15 - 7;

				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r + variation);
				this.data[i + 1] = Math.min(255, baseColor.g + variation);
				this.data[i + 2] = Math.min(255, baseColor.b + variation);
				this.data[i + 3] = 255;
			}
		}
	}
	generateSand() {
		const baseColor = { r: 210, g: 185, b: 139 }; // Sandy beige
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				// Create grainy noise pattern
				const noise = Math.random() * 20 - 10;

				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r + noise);
				this.data[i + 1] = Math.min(255, baseColor.g + noise);
				this.data[i + 2] = Math.min(255, baseColor.b + noise);
				this.data[i + 3] = 255;
			}
		}
	}

	generateRock() {
		const baseColor = { r: 115, g: 109, b: 105 }; // Gray
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				// Just natural noise variation
				const noise = Math.random() * 35 - 17;

				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r + noise);
				this.data[i + 1] = Math.min(255, baseColor.g + noise);
				this.data[i + 2] = Math.min(255, baseColor.b + noise);
				this.data[i + 3] = 255;
			}
		}
	}
	generateHighlandGrass() {
		const baseColor = { r: 45, g: 89, b: 41 }; // Darker green
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				// Simple noise variation for natural look
				const noise = Math.random() * 35 - 17;

				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r + noise);
				this.data[i + 1] = Math.min(255, baseColor.g + noise);
				this.data[i + 2] = Math.min(255, baseColor.b + noise);
				this.data[i + 3] = 255;
			}
		}
	}

	generateTreeline() {
		const baseColor = { r: 116, g: 71, b: 0 }; // Brown base
		const grayColor = { r: 115, g: 109, b: 105 }; // Gray instead of green

		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				// Smooth blend between brown and gray
				const blendFactor = Math.random();
				const noise = Math.random() * 20 - 10;

				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r * blendFactor + grayColor.r * (1 - blendFactor) + noise);
				this.data[i + 1] = Math.min(255, baseColor.g * blendFactor + grayColor.g * (1 - blendFactor) + noise);
				this.data[i + 2] = Math.min(255, baseColor.b * blendFactor + grayColor.b * (1 - blendFactor) + noise);
				this.data[i + 3] = 255;
			}
		}
	}
	generateDunes() {
		const baseColor = { r: 230, g: 185, b: 115 }; // More orange/reddish sand color
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				// Natural noise variation
				const noise = Math.random() * 25 - 12;

				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r + noise);
				this.data[i + 1] = Math.min(255, baseColor.g + noise);
				this.data[i + 2] = Math.min(255, baseColor.b + noise);
				this.data[i + 3] = 255;
			}
		}
	}
	generateSnow() {
		const baseColor = { r: 232, g: 232, b: 232 }; // Very light gray/white
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				// Just subtle noise variation
				const noise = Math.random() * 12 - 6;

				const i = (y * this.width + x) * 4;
				this.data[i] = Math.min(255, baseColor.r + noise);
				this.data[i + 1] = Math.min(255, baseColor.g + noise);
				this.data[i + 2] = Math.min(255, baseColor.b + noise);
				this.data[i + 3] = 255;
			}
		}
	}
}

class TextureRegistry {
	constructor() {
		this.textures = new Map();
		this.textureList = []; // Array to maintain texture order
		this.generateTextures();
	}

	generateTextures() {
		// Create textures in a specific order for indexing
		const grass = new ProceduralTexture(256, 256);
		grass.generateGrass();
		this.addTexture("grass", grass);

		const water = new ProceduralTexture(256, 256);
		water.generateWater();
		this.addTexture("water", water);

		const deepWater = new ProceduralTexture(256, 256);
		deepWater.generateDeepWater();
		this.addTexture("deepwater", deepWater);

		const sand = new ProceduralTexture(256, 256);
		sand.generateSand();
		this.addTexture("sand", sand);

		const dunes = new ProceduralTexture(256, 256);
		dunes.generateDunes();
		this.addTexture("dunes", dunes);

		const rock = new ProceduralTexture(256, 256);
		rock.generateRock();
		this.addTexture("rock", rock);

		const highland = new ProceduralTexture(256, 256);
		highland.generateHighlandGrass();
		this.addTexture("highland", highland);

		const treeline = new ProceduralTexture(256, 256);
		treeline.generateTreeline();
		this.addTexture("treeline", treeline);

		const snow = new ProceduralTexture(256, 256);
		snow.generateSnow();
		this.addTexture("snow", snow);
	}

	addTexture(name, texture) {
		this.textures.set(name, texture);
		this.textureList.push(name);
	}

	get(type) {
		return this.textures.get(type);
	}

	getTextureIndex(textureName) {
		return this.textureList.indexOf(textureName);
	}

	getTextureByIndex(index) {
		return this.textures.get(this.textureList[index]);
	}

	getTextureCount() {
		return this.textureList.length;
	}
}
const textureRegistry = new TextureRegistry(); // global