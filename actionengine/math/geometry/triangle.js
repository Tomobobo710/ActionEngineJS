// actionengine/math/geometry/triangle.js
class Triangle {
    constructor(v1, v2, v3, color = "#FF00FF", texture = null, uvs = null) {
        this.vertices = [v1, v2, v3];
        this.normal = this.calculateNormal();
        this.color = color; // Default to magenta

        // Texture structure: { imageData: Uint8Array, mimeType: string, name: string }
        // Can be null for non-textured triangles
        this.texture = texture;

        // UV coordinates: array of 3 objects with {u, v} or Vector2
        // Only present if triangle is textured
        this.uvs = uvs;

        // Tangent vectors: array of 3 Vector3 objects (one per vertex)
        // Needed for normal map calculations in tangent space
        this.tangents = null;

        // Alpha transparency (0-1), used in materials
        this.alpha = 1.0;

        // Material properties
        this.metallic = 0.0; // 0-1, how metallic the surface is
        this.roughness = 1.0; // 0-1, how rough the surface is
        this.emissive = [0, 0, 0]; // RGB color of emissive glow, [0-1, 0-1, 0-1]

        // Material texture map references (from GLTF)
        this.material = null; // Full material object with texture indices:
        // - textureIndex: base color texture
        // - normalMapIndex: normal map texture
        // - metallicRoughnessMapIndex: packed metallic/roughness texture
        // - emissiveMapIndex: emissive texture
    }

    calculateNormal() {
        const edge1 = this.vertices[1].sub(this.vertices[0]);
        const edge2 = this.vertices[2].sub(this.vertices[0]);

        // OPTIMIZATION: Use static crossInto to avoid allocating an intermediate vector
        const normal = new Vector3();
        Vector3.crossInto(normal, edge1, edge2);
        normal.normalizeInPlace();

        return normal;
    }

    getVertexArray() {
        return this.vertices.flatMap((v) => [v.x, v.y, v.z]);
    }

    getNormalArray() {
        // Return face normal for all vertices - shader will compute actual normals
        return [...this.normal.toArray(), ...this.normal.toArray(), ...this.normal.toArray()];
    }

    getColorArray() {
        // Convert hex color to RGB array
        const r = parseInt(this.color.substr(1, 2), 16) / 255;
        const g = parseInt(this.color.substr(3, 2), 16) / 255;
        const b = parseInt(this.color.substr(5, 2), 16) / 255;
        // Return color for all three vertices
        return [r, g, b, r, g, b, r, g, b];
    }
}
