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
	}

	render(terrain, camera, character, showDebugPanel, weatherSystem, renderablePhysicsObjects) {
		// Clear buffers
		this.clearBuffers();

		// Collect visible triangles
		const { nearTriangles, farTriangles } = this.collectTriangles(terrain, camera, renderablePhysicsObjects);

		// Add character triangles if present
		if (character) {
			this.processCharacterTriangles(character, camera, nearTriangles);
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
			this.renderDebugOverlays(character, camera);
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

	collectTriangles(terrain, camera, physicsObjects) {
		const nearTriangles = [];
		const farTriangles = [];

		const processTriangle = (triangle) => {
			/**
			 * Transforms triangle vertices into view space and calculates view Z distances.
			 * View space means positions relative to the camera, where:
			 * - viewSpace: The vertex position relative to camera position
			 * - viewZ: The distance along camera's forward vector (positive = in front of camera)
			 *
			 * @param {Vector3[]} triangle.vertices - Array of 3 vertices in world space
			 * @param {Matrix4} camera.getViewMatrix() - Camera's view matrix containing position and orientation
			 * @returns {Object[]} Array of transformed vertices containing:
			 *   @returns {Vector3} .pos - The vertex position in view space
			 *   @returns {number} .viewZ - Distance along camera's forward vector
			 */
			const viewPositions = triangle.vertices.map((vertex) => {
				const viewSpace = vertex.sub(camera.getViewMatrix().position);
				return {
					pos: viewSpace,
					viewZ: viewSpace.dot(camera.getViewMatrix().forward)
				};
			});

			// If ALL vertices are behind, skip it
			if (viewPositions.every((vp) => vp.viewZ <= 0)) return;
			// If ALL vertices are too far, skip it
			if (viewPositions.every((vp) => vp.viewZ > this.depthConfig.far)) return;
			// Back-face culling using viewspace positions
			if (triangle.normal.dot(viewPositions[0].pos) >= 0) return;
			// Skip if projection fails
			const projectedVerts = triangle.vertices.map((v) => this.project(v, camera));
			if (projectedVerts.some((v) => v === null)) return;

			const lightDir = new Vector3(0.5, 1, 0.5).normalize();
			const lighting = Math.max(0.3, Math.min(1.0, triangle.normal.dot(lightDir)));

			const processedTriangle = {
				points: projectedVerts,
				color: triangle.color,
				lighting: triangle.vertices[0].y === 0 ? 1.0 : lighting,
				depth: (projectedVerts[0].z + projectedVerts[1].z + projectedVerts[2].z) / 3,
				isWater: triangle.isWater || false
			};

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

	project(point, camera) {
		const view = camera.getViewMatrix();
		const relativePos = point.sub(view.position);
		const viewZ = relativePos.dot(view.forward);

		Matrix4.lookAt(
			this.viewMatrix,
			view.position.toArray(),
			[view.position.x + view.forward.x, view.position.y + view.forward.y, view.position.z + view.forward.z],
			view.up.toArray()
		);

		Matrix4.perspective(this.projMatrix, camera.fov, this.width / this.height, 0.1, 10000.0);

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
		const minX = Math.max(0, Math.floor(Math.min(points[0].x, points[1].x, points[2].x)));
		const maxX = Math.min(this.width - 1, Math.ceil(Math.max(points[0].x, points[1].x, points[2].x)));
		const minY = Math.max(0, Math.floor(Math.min(points[0].y, points[1].y, points[2].y)));
		const maxY = Math.min(this.height - 1, Math.ceil(Math.max(points[0].y, points[1].y, points[2].y)));

		// Pre-calculate color values
		const r = parseInt(triangle.color.substr(1, 2), 16);
		const g = parseInt(triangle.color.substr(3, 2), 16);
		const b = parseInt(triangle.color.substr(5, 2), 16);
		let lighting = triangle.lighting;

		// Block-based rasterization for better cache usage
		const BLOCK_SIZE = 8;
		for (let blockY = minY; blockY <= maxY; blockY += BLOCK_SIZE) {
			for (let blockX = minX; blockX <= maxX; blockX += BLOCK_SIZE) {
				const endX = Math.min(blockX + BLOCK_SIZE, maxX + 1);
				const endY = Math.min(blockY + BLOCK_SIZE, maxY + 1);

				for (let y = blockY; y < endY; y++) {
					const rowOffset = y * this.width;
					for (let x = blockX; x < endX; x++) {
						if (!TriangleUtils.pointInTriangle({ x, y }, points[0], points[1], points[2])) continue;

						let currentLighting = lighting;
						const index = rowOffset + x;
						let shouldDraw = true;

						if (triangle.isWater || useDepthTest) {
							const z = TriangleUtils.interpolateZ(x, y, points[0], points[1], points[2]);

							if (triangle.isWater) {
								const time = performance.now() / 1000;
								currentLighting *= Math.sin(time + z / 50) * 0.1 + 0.9;
							}

							if (useDepthTest) {
								shouldDraw = z < this.zBuffer[index];
								if (shouldDraw) {
									this.zBuffer[index] = z;
								}
							}
						}

						if (shouldDraw) {
							const pixelIndex = index * 4;
							this.imageData.data[pixelIndex] = r * currentLighting;
							this.imageData.data[pixelIndex + 1] = g * currentLighting;
							this.imageData.data[pixelIndex + 2] = b * currentLighting;
							this.imageData.data[pixelIndex + 3] = 255;
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

	processCharacterTriangles(character, camera, nearTriangles) {
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

			// Project to screen space
			const projectedPoints = new Array(3);
			let invalidProjection = false;
			for (let i = 0; i < 3; i++) {
				projectedPoints[i] = this.project(transformedVerts[i], camera);
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

	renderDebugOverlays(character, camera) {
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

			const projectedCenter = this.project(new Vector3(center.x, center.y, center.z), camera);
			const projectedEnd = this.project(new Vector3(normalEnd.x, normalEnd.y, normalEnd.z), camera);

			if (projectedCenter && projectedEnd) {
				ctx.strokeStyle = "#0000FF";
				ctx.beginPath();
				ctx.moveTo(projectedCenter.x, projectedCenter.y);
				ctx.lineTo(projectedEnd.x, projectedEnd.y);
				ctx.stroke();
			}
		}

		this.renderDirectionIndicator(character, camera);
	}

	renderDirectionIndicator(character, camera) {
		const center = character.position;
		const directionEnd = new Vector3(
			center.x + character.facingDirection.x * character.size * 2,
			center.y,
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
}