// actionengine/display/graphics/texture/texturemanager.js
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
			this.processCharacterTriangles(character, camera, nearTriangles, farTriangles, view);
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

						// Calculate barycentric coords once
						const bary = TriangleUtils.getBarycentricCoords(x, y, p0, p1, p2);

						// Z-buffer and water effects
						if (isWater || useDepthTest) {
							// Use bary coords instead of recalculating
							const z = bary.w1 * p0.z + bary.w2 * p1.z + bary.w3 * p2.z;

							if (isWater) {
								currentLighting *= Math.sin(performance.now() / 1000 + z / 50) * 0.1 + 0.9;
							}
							if (useDepthTest && z >= zBuffer[index]) continue;
							if (useDepthTest) zBuffer[index] = z;
						}

						const pixelIndex = index * 4;

						if (hasTexture) {
   let u, v;
   if (useDepthTest) {
       // Full perspective-correct texture mapping for near triangles
       const interpolatedOneOverW = bary.w1 * oneOverW[0] + bary.w2 * oneOverW[1] + bary.w3 * oneOverW[2];
       const interpolatedUOverW = bary.w1 * uvOverW[0].u + bary.w2 * uvOverW[1].u + bary.w3 * uvOverW[2].u;
       const interpolatedVOverW = bary.w1 * uvOverW[0].v + bary.w2 * uvOverW[1].v + bary.w3 * uvOverW[2].v;
       u = interpolatedUOverW / interpolatedOneOverW;
       v = interpolatedVOverW / interpolatedOneOverW;
   } else {
       // Simpler linear interpolation for far triangles
       u = bary.w1 * triangle.uvs[0].u + bary.w2 * triangle.uvs[1].u + bary.w3 * triangle.uvs[2].u;
       v = bary.w1 * triangle.uvs[0].v + bary.w2 * triangle.uvs[1].v + bary.w3 * triangle.uvs[2].v;
   }
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

	processCharacterTriangles(character, camera, nearTriangles, farTriangles, view) {
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
				if (viewZ <= this.depthConfig.transitionDistance) {
					nearTriangles.push({
						points: projectedPoints,
						color: triangle.color,
						lighting: lighting,
						depth: viewZ
					});
				} else {
					farTriangles.push({
						points: projectedPoints,
						color: triangle.color,
						lighting: lighting,
						depth: viewZ
					});
				}
			}
		}
	}

	renderDebugOverlays(character, camera, view) {
		const ctx = this.ctx;
		// Add null check to prevent error when character is null
		if (!character || !character.getCurrentTriangle) {
			return; // Skip debug visualization if character is not valid
		}
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
		// Add null check to prevent error when character is null
		if (!character || !character.position || !character.facingDirection) {
			return; // Skip direction indicator if character is not valid
		}
		
		const center = character.position;
		const directionEnd = new Vector3(
			center.x + character.facingDirection.x * (character.size || 5) * 2, // Default size if undefined
			center.y,
			center.z + character.facingDirection.z * (character.size || 5) * 2
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