// actionengine/display/graphics/renderers/actionrenderer2D/actionrenderer2D.js
class ActionRenderer2D {
	constructor(canvas) {
		this.ctx = canvas.getContext("2d");
		this.width = Game.WIDTH;
		this.height = Game.HEIGHT;

		this.viewMatrix = Matrix4.create();
		this.projMatrix = Matrix4.create();

		this.imageData = this.ctx.createImageData(this.width, this.height);
		this.zBuffer = new Float32Array(this.width * this.height);

		// Pre-fill imageData with sky color for faster clearing
		this.skyColor = new Uint8ClampedArray(this.width * this.height * 4);
		for (let i = 0; i < this.skyColor.length; i += 4) {
			this.skyColor[i] = 135; // r
			this.skyColor[i + 1] = 206; // g
			this.skyColor[i + 2] = 235; // b
			this.skyColor[i + 3] = 255; // a
		}

		// Configuration for depth handling
		this.depthConfig = {
			far: 10000.0,
			transitionDistance: 250.0 // Where we switch to painter's algorithm
		};

		// Cache for parsed colors (hex string -> {r, g, b})
		this.colorCache = new Map();

		// Light direction (constant for all frames)
		this.lightDir = new Vector3(0.5, 1, 0.5).normalize();

		// Reusable temporary arrays for matrix transformation
		this.projectionTemp = [0, 0, 0, 1];
		this.transformResult = [0, 0, 0, 0];

		// Object pool for processed triangles to avoid allocation churn
		this.processedTrianglePool = [];
		this.processedTriangleIndex = 0;

		// Reusable vectors for triangle vertex transformation (3 verts + 1 normal per triangle)
		this.transformedVertices = [new Vector3(), new Vector3(), new Vector3()];
		this.transformedNormal = new Vector3();

		// Temporary Vector3 for view-space calculations
		this.tempVector = new Vector3();

		// Reusable object for barycentric coordinates
		this.baryCoords = { w1: 0, w2: 0, w3: 0 };

		// Object pool for viewZs arrays (3 floats per triangle)
		this.viewZsPool = [];
		this.viewZsIndex = 0;

		// Object pool for projectedVerts arrays (3 points per triangle)
		this.projectedVertsPool = [];
		this.projectedVertsIndex = 0;

		// Cache for animated character triangles
		// Maps character objects to their computed skinned triangles
		this.skinnedTriangleCache = new Map();
	}

	/**
	 * Parse hex color string and cache result
	 * @param {string} color - Hex color like "#FF0000"
	 * @returns {{r, g, b}} RGB values 0-255
	 */
	parseColor(color) {
		if (this.colorCache.has(color)) {
			return this.colorCache.get(color);
		}
		const rgb = {
			r: parseInt(color.substr(1, 2), 16),
			g: parseInt(color.substr(3, 2), 16),
			b: parseInt(color.substr(5, 2), 16)
		};
		this.colorCache.set(color, rgb);
		return rgb;
	}

	/**
	 * Get or create a pooled processed triangle object
	 * Reuse objects to minimize allocation churn
	 */
	getProcessedTriangle() {
		if (this.processedTriangleIndex < this.processedTrianglePool.length) {
			return this.processedTrianglePool[this.processedTriangleIndex++];
		}
		const tri = { points: [], color: "", lighting: 1.0, depth: 0, isWater: false, uvs: null, texture: null };
		this.processedTrianglePool.push(tri);
		this.processedTriangleIndex++;
		return tri;
	}

	/**
	 * Reset pool index for next frame
	 */
	resetTrianglePool() {
		this.processedTriangleIndex = 0;
	}

	/**
	 * Get or create a pooled viewZs array
	 */
	getViewZs() {
		if (this.viewZsIndex < this.viewZsPool.length) {
			return this.viewZsPool[this.viewZsIndex++];
		}
		const arr = [0, 0, 0];
		this.viewZsPool.push(arr);
		this.viewZsIndex++;
		return arr;
	}

	/**
	 * Get or create a pooled projectedVerts array
	 */
	getProjectedVerts() {
		if (this.projectedVertsIndex < this.projectedVertsPool.length) {
			return this.projectedVertsPool[this.projectedVertsIndex++];
		}
		const arr = [
			{ x: 0, y: 0, z: 0 },
			{ x: 0, y: 0, z: 0 },
			{ x: 0, y: 0, z: 0 }
		];
		this.projectedVertsPool.push(arr);
		this.projectedVertsIndex++;
		return arr;
	}

	/**
	 * Reset pools for next frame
	 */
	resetPools() {
		this.viewZsIndex = 0;
		this.projectedVertsIndex = 0;
	}

	render(camera, renderablePhysicsObjects, showDebugPanel, character) {
		// Reset triangle pool for this frame
		this.resetTrianglePool();
		// Reset viewZs and projectedVerts pools
		this.resetPools();

		// Update visual representation of all renderable physics objects first
		if (renderablePhysicsObjects) {
			for (const object of renderablePhysicsObjects) {
				if (object && typeof object.updateVisual === "function") {
					object.updateVisual();
				}
			}
		}

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

		// Cache performance.now() once per frame for water effect
		const frameTime = performance.now();

		// Pass view to collectTriangles, include character for CPU skinning
		const { nearTriangles, farTriangles } = this.collectTriangles(camera, renderablePhysicsObjects, view, character);

		// Render far triangles first (back to front) WITHOUT depth testing
		farTriangles.sort((a, b) => b.depth - a.depth);
		for (const triangle of farTriangles) {
			this.rasterizeTriangleNoDepth(triangle, frameTime);
		}

		// Render near triangles WITH depth testing
		nearTriangles.sort((a, b) => b.depth - a.depth);
		for (const triangle of nearTriangles) {
			this.rasterizeTriangle(triangle, frameTime);
		}

		// Put final image to canvas
		this.ctx.putImageData(this.imageData, 0, 0);

		// Debug overlays if needed
		if (showDebugPanel) {
			this.renderDebugOverlays(character, camera, view); // Pass view here too
		}
	}

	clearBuffers() {
		// Copy pre-filled sky color to imageData (much faster than manual pixel loops)
		this.imageData.data.set(this.skyColor);

		// Clear z-buffer for depth testing
		this.zBuffer.fill(Infinity);
	}

	collectTriangles(camera, physicsObjects, view, character) {
		const nearTriangles = [];
		const farTriangles = [];

		const processTriangle = (triangle, worldTransform, parentObject) => {

			// Transform vertices from local-space to world-space if transform provided
			let vertices = triangle.vertices;
			let normal = triangle.normal;

			if (worldTransform) {
				// Reuse pre-allocated vectors to avoid allocation churn
				for (let i = 0; i < 3; i++) {
					worldTransform.transformPointInto(triangle.vertices[i], this.transformedVertices[i]);
				}
				vertices = this.transformedVertices;

				// Transform normal (rotation only, no translation)
				worldTransform.transformVectorInto(triangle.normal, this.transformedNormal);
				normal = this.transformedNormal;
			}

			// Calculate viewZ values once using pooled array
			const viewZs = this.getViewZs();
			for (let i = 0; i < 3; i++) {
				const vertex = vertices[i];
				// Reuse tempVector to avoid allocating new Vector3
				const viewSpace = this.tempVector.copy(vertex).subInPlace(view.position);
				viewZs[i] = viewSpace.dot(view.forward);
			}

			// If ALL vertices are behind, skip it
			if (viewZs.every((z) => z <= 0)) return;
			// If ALL vertices are too far, skip it
			if (viewZs.every((z) => z > this.depthConfig.far)) return;
			// Back-face culling using viewspace positions
			// Inline the dot product to avoid creating a temporary vector
			const v0 = vertices[0];
			const toCameraX = view.position.x - v0.x;
			const toCameraY = view.position.y - v0.y;
			const toCameraZ = view.position.z - v0.z;
			if (normal.x * toCameraX + normal.y * toCameraY + normal.z * toCameraZ <= 0) return;

			// Project using our cached viewZ values with pooled array
			const projectedVerts = this.getProjectedVerts();
			for (let i = 0; i < 3; i++) {
				const projected = this.project(vertices[i], camera, view, viewZs[i]);
				if (projected === null) return;
				projectedVerts[i] = projected;
			}

			// Use cached light direction
			const lighting = Math.max(0.3, Math.min(1.0, normal.dot(this.lightDir)));

			// Reuse pooled triangle object instead of creating new one
			const processedTriangle = this.getProcessedTriangle();
			processedTriangle.points = projectedVerts;
			processedTriangle.color = triangle.color;
			processedTriangle.lighting = vertices[0].y === 0 ? 1.0 : lighting;
			processedTriangle.depth = (projectedVerts[0].z + projectedVerts[1].z + projectedVerts[2].z) / 3;
			processedTriangle.isWater = triangle.isWater || false;
			processedTriangle.uvs = triangle.uvs;
			processedTriangle.texture = triangle.texture;
			processedTriangle.material = triangle.material;
			processedTriangle.parentObject = parentObject;

			// Assign different textures based on distance
			if (processedTriangle.depth <= this.depthConfig.transitionDistance) {
				nearTriangles.push(processedTriangle);
			} else {
				farTriangles.push(processedTriangle);
			}
		};

		// Process physics object triangles
		for (const physicsObject of physicsObjects) {
			// Skip character object - it's rendered separately with CPU vertex skinning
			if (physicsObject === character) continue;
			
			// Transform vertices on-the-fly during collection
			// No need to pre-allocate world-space triangle objects
			for (const triangle of physicsObject.triangles) {
				processTriangle(triangle, physicsObject.transform, physicsObject);
			}
		}

		// Process character with CPU skinning if present and animated
		if (character && character.characterModel) {
			// Get skinned triangles for this character
			const skinnedTriangles = CPUVertexSkinning.getSkinned2DTriangles(character);
			for (const triangle of skinnedTriangles) {
				processTriangle(triangle, character.transform, character);
			}
		}

		return { nearTriangles, farTriangles };
	}

	project(point, camera, view, cachedViewZ) {
		const viewZ = cachedViewZ ?? this.tempVector.copy(point).subInPlace(view.position).dot(view.forward);

		// Reuse temporary array instead of allocating new one
		this.projectionTemp[0] = point.x;
		this.projectionTemp[1] = point.y;
		this.projectionTemp[2] = point.z;
		Matrix4.transformVectorInto(this.projectionTemp, this.viewMatrix, this.projMatrix, this.transformResult);

		const w = Math.max(0.1, this.transformResult[3]);
		const screenX = ((this.transformResult[0] / w) * 0.5 + 0.5) * this.width;
		const screenY = ((-this.transformResult[1] / w) * 0.5 + 0.5) * this.height;

		return {
			x: screenX,
			y: screenY,
			z: viewZ
		};
	}

	rasterizeTriangleBase(triangle, useDepthTest = true, frameTime) {
		const points = triangle.points;
		// Cache array access and bound calculations
		const p0 = points[0],
			p1 = points[1],
			p2 = points[2];
		const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
		const maxX = Math.min(this.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
		const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
		const maxY = Math.min(this.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

		// Pre-calculate color values once (use cache to avoid parsing every frame)
		const color = triangle.color;
		const rgb = this.parseColor(color);
		const r = rgb.r;
		const g = rgb.g;
		const b = rgb.b;
		const baseLighting = triangle.lighting;

		// Cache texture-related values
		// Check for either direct texture reference OR material-based texture from TextureSet
		const hasDirectTexture = triangle.texture && triangle.uvs;
		const hasMaterialTexture = triangle.material && triangle.material.useTexture && triangle.uvs && triangle.parentObject && triangle.parentObject._textureSet;
		const hasTexture = hasDirectTexture || hasMaterialTexture;
		const imageData = this.imageData.data;
		let oneOverW, uvOverW;

		if (hasTexture) {
			// Cache z values to avoid redundant Math.max calls
			const z0 = Math.max(0.1, p0.z);
			const z1 = Math.max(0.1, p1.z);
			const z2 = Math.max(0.1, p2.z);
			oneOverW = [1 / z0, 1 / z1, 1 / z2];
			const uvs = triangle.uvs;
			uvOverW = [
				{ u: uvs[0].u * oneOverW[0], v: uvs[0].v * oneOverW[0] },
				{ u: uvs[1].u * oneOverW[1], v: uvs[1].v * oneOverW[1] },
				{ u: uvs[2].u * oneOverW[2], v: uvs[2].v * oneOverW[2] }
			];
		}

		// Cache texture dimensions if available
		let textureWidth = 0;
		let textureHeight = 0;
		if (hasTexture) {
			if (triangle.texture) {
				textureWidth = triangle.texture.width;
				textureHeight = triangle.texture.height;
			} else if (triangle.material && triangle.material.useTexture && triangle.parentObject && triangle.parentObject._textureSet) {
				const textureSet = triangle.parentObject._textureSet;
				const textureIndex = triangle.material.textureIndex;
				if (textureSet.textures && textureSet.textures[textureIndex]) {
					textureWidth = textureSet.textures[textureIndex].width;
					textureHeight = textureSet.textures[textureIndex].height;
				}
			}
		}

		const isWater = triangle.isWater;
		const zBuffer = this.zBuffer;

		// Pre-calculate water effect factor once per frame (not per pixel)
		let waterEffect = 1.0;
		if (isWater) {
			const avgDepth = (p0.z + p1.z + p2.z) / 3;
			waterEffect = Math.sin(frameTime / 1000 + avgDepth / 50) * 0.1 + 0.9;
		}

		for (let y = minY; y <= maxY; y++) {
			const rowOffset = y * this.width;
			for (let x = minX; x <= maxX; x++) {
				if (!TriangleUtils.pointInTriangle({ x, y }, p0, p1, p2)) continue;

				const index = rowOffset + x;
				let currentLighting = baseLighting;

				// Calculate barycentric coords once (using pooled object)
				TriangleUtils.getBarycentricCoordsInto(x, y, p0, p1, p2, this.baryCoords);
				const bary = this.baryCoords;

				// Z-buffer and water effects
				if (isWater || useDepthTest) {
					// Use bary coords instead of recalculating
					const z = bary.w1 * p0.z + bary.w2 * p1.z + bary.w3 * p2.z;

					if (isWater) {
						currentLighting *= waterEffect;
					}
					if (useDepthTest && z >= zBuffer[index]) continue;
					if (useDepthTest) zBuffer[index] = z;
				}

				const pixelIndex = index * 4;

				if (hasTexture) {
					let u, v;
					if (useDepthTest) {
						// Full perspective-correct texture mapping for near triangles
						const interpolatedOneOverW =
							bary.w1 * oneOverW[0] + bary.w2 * oneOverW[1] + bary.w3 * oneOverW[2];
						const interpolatedUOverW =
							bary.w1 * uvOverW[0].u + bary.w2 * uvOverW[1].u + bary.w3 * uvOverW[2].u;
						const interpolatedVOverW =
							bary.w1 * uvOverW[0].v + bary.w2 * uvOverW[1].v + bary.w3 * uvOverW[2].v;
						u = interpolatedUOverW / interpolatedOneOverW;
						v = interpolatedVOverW / interpolatedOneOverW;
					} else {
						// Simpler linear interpolation for far triangles
						u = bary.w1 * triangle.uvs[0].u + bary.w2 * triangle.uvs[1].u + bary.w3 * triangle.uvs[2].u;
						v = bary.w1 * triangle.uvs[0].v + bary.w2 * triangle.uvs[1].v + bary.w3 * triangle.uvs[2].v;
					}
					
					// Get texture from either direct reference or parent object's TextureSet
					let textureToSample = triangle.texture;
					if (!textureToSample && triangle.material && triangle.material.useTexture && triangle.parentObject && triangle.parentObject._textureSet) {
						const textureSet = triangle.parentObject._textureSet;
						const textureIndex = triangle.material.textureIndex;
						if (textureSet.textures && textureSet.textures[textureIndex]) {
							textureToSample = textureSet.textures[textureIndex];
						}
					}
					
					if (textureToSample) {
						const texel = textureToSample.getPixel(
							Math.floor(u * textureWidth),
							Math.floor(v * textureHeight)
						);
						imageData[pixelIndex] = texel.r * currentLighting;
						imageData[pixelIndex + 1] = texel.g * currentLighting;
						imageData[pixelIndex + 2] = texel.b * currentLighting;
						imageData[pixelIndex + 3] = 255;
					} else {
						// Fallback to vertex color if no texture found
						imageData[pixelIndex] = r * currentLighting;
						imageData[pixelIndex + 1] = g * currentLighting;
						imageData[pixelIndex + 2] = b * currentLighting;
						imageData[pixelIndex + 3] = 255;
					}
				} else {
					imageData[pixelIndex] = r * currentLighting;
					imageData[pixelIndex + 1] = g * currentLighting;
					imageData[pixelIndex + 2] = b * currentLighting;
					imageData[pixelIndex + 3] = 255;
				}
			}
		}
	}

	rasterizeTriangle(triangle, frameTime) {
		this.rasterizeTriangleBase(triangle, true, frameTime);
	}

	rasterizeTriangleNoDepth(triangle, frameTime) {
		this.rasterizeTriangleBase(triangle, false, frameTime);
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
