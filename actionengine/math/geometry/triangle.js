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

        // Vertex normals: array of 3 Vector3 objects (one per vertex)
        // Used for smooth shading - averages normals from adjacent triangles
        // If null, renderer falls back to face normal for all vertices (flat shading)
        this.vertexNormals = null;

        // Alpha transparency (0-1), used in materials
        this.alpha = 1.0;

        // Material properties
        this.metallic = 0.0; // 0-1, how metallic the surface is
        this.roughness = 1.0; // 0-1, how rough the surface is
        this.emissive = [0, 0, 0]; // RGB color of emissive glow, [0-1, 0-1, 0-1]
        this.ior = 1.5; // Index of refraction, affects Fresnel reflections

        // KHR_materials_transmission - transparency with refraction
        this.transmission = 0.0; // 0-1, factor controlling how much light passes through

        // KHR_materials_volume - absorption and thickness effects
        this.volume = {
            thicknessFactor: 0.0,      // 0-1, thickness of the volume
            attenuationDistance: 1.0,  // Infinity or distance in world units
            attenuationColor: [1, 1, 1] // RGB, color of absorbed light
        };

        // KHR_materials_sheen - fabric/cloth materials
        this.sheen = {
            colorFactor: [0, 0, 0],    // RGB, sheen color
            roughnessFactor: 0.0       // 0-1, sheen surface roughness
        };

        // KHR_materials_clearcoat - clear coat layer
        this.clearcoat = {
            factor: 0.0,               // 0-1, clearcoat coverage
            roughnessFactor: 0.0       // 0-1, clearcoat roughness
        };

        // KHR_materials_anisotropy - directional roughness
        this.anisotropy = {
            strength: 0.0,             // 0-1, anisotropy strength
            rotation: 0.0              // 0-1, normalized rotation angle
        };

        // KHR_materials_dispersion - wavelength-dependent refraction
        this.dispersion = 0.0;         // Abbe number, typically 20-100

        // KHR_materials_iridescence - thin-film interference
        this.iridescence = {
            factor: 0.0,               // 0-1, iridescence strength
            ior: 1.3,                  // Index of refraction for iridescent layer
            thickness: 0.0             // Layer thickness in micrometers
        };

        // Material texture map references (from GLTF)
        this.material = null; // Full material object with texture indices:
        // - textureIndex: base color texture
        // - normalMapIndex: normal map texture
        // - metallicRoughnessMapIndex: packed metallic/roughness texture
        // - emissiveMapIndex: emissive texture
        // - ior: index of refraction
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
