//actionengine/rendering/renderers/actionrenderer2D/cpuvertexskinning.js
/**
 * CPU Vertex Skinning Module
 *
 * Handles the computation of skinned vertices for 2D rendering.
 * Takes animated bone matrices and applies them to model vertices using weight data.
 */
class CPUVertexSkinning {
	/**
	 * Compute CPU-skinned triangles for a character with animation
	 *
	 * @param {ActionCharacter} character - The character object with animated skeleton
	 * @returns {Triangle[]} Array of transformed, skinned triangles
	 */
	static getSkinned2DTriangles(character) {
		if (!character || !character.characterModel) {
			return [];
		}

		/**
		 * Apply bone skinning to a single vertex
		 * Combines transformations from all bones that influence this vertex
		 */
		function transformVertexWithSkin(vertex, vertexIndex, triangle, skin) {
			if (!triangle.jointData || !triangle.weightData) {
				return vertex;
			}

			const finalPosition = new Vector3(0, 0, 0);
			const joints = triangle.jointData[vertexIndex];
			const weights = triangle.weightData[vertexIndex];
			let totalWeight = 0;

			// Apply influence from each bone
			for (let i = 0; i < 4; i++) {
				const weight = weights[i];
				if (weight > 0) {
					totalWeight += weight;
					const jointMatrix = skin.jointMatrices[joints[i]];
					if (jointMatrix) {
						const transformed = Vector3.transformMat4(vertex, jointMatrix);
						finalPosition.x += transformed.x * weight;
						finalPosition.y += transformed.y * weight;
						finalPosition.z += transformed.z * weight;
					}
				}
			}

			// Normalize by total weight if not close to 1.0
			if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.001) {
				finalPosition.x /= totalWeight;
				finalPosition.y /= totalWeight;
				finalPosition.z /= totalWeight;
			}

			return finalPosition;
		}

		/**
		 * Apply model-space transform to a vertex
		 */
		function applyTransform(vertex, transform) {
			return Vector3.transformMat4(vertex, transform);
		}

		// Get bone matrices from character's current animation state
		const skin = character.characterModel.skins[0];
		// Update joint matrices from current skeleton state
		skin.update(character.characterModel.nodes);

		// Build model transform with character's visual offset
		const modelTransform = Matrix4.create();
		Matrix4.translate(modelTransform, modelTransform, [0, character.characterVisualYOffset, 0]);

		const transformedTriangles = [];

		// Process each triangle in the model
		for (const triangle of character.characterModel.getAllTrianglesLocal()) {
			// Step 1: Apply bone skinning to each vertex
			const skinnedVertices = [];
			for (let i = 0; i < triangle.vertices.length; i++) {
				skinnedVertices.push(transformVertexWithSkin(triangle.vertices[i], i, triangle, skin));
			}

			// Step 2: Apply model transform to skinned vertices
			const transformedVerts = [];
			for (let i = 0; i < skinnedVertices.length; i++) {
				transformedVerts.push(applyTransform(skinnedVertices[i], modelTransform));
			}

			// Step 3: Create final transformed triangle
			transformedTriangles.push(
				new Triangle(transformedVerts[0], transformedVerts[1], transformedVerts[2], triangle.color)
			);
		}

		return transformedTriangles;
	}
}
