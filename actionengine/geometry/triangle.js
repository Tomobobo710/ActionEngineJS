//actionengine/geometry/triangle.js
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

        // KHR_materials_* extension blocks (volume/sheen/clearcoat/anisotropy/iridescence) are
        // LAZY — see the prototype accessors below the class. They used to be five object literals
        // allocated here, per triangle, always. That was 5 of the ~15 heap objects every triangle
        // costs (10,240 objects on a single seg32 sphere) to hold values that are almost always the
        // untouched defaults, and that no shader reads — only the GLB exporter/loader,
        // modelcodegenerator and textureset.js do, all of them null-guarded.
        //
        // Reading one now returns a shared frozen default (correct values, zero allocation);
        // ASSIGNING one — which is what glbloader does for a model that actually carries the
        // extension — installs a real own-property on that triangle. So behaviour is unchanged and
        // per-triangle overrides still work; only the untouched-default case stops allocating.
        //
        // `dispersion` is a plain number, so it stays a normal field.
        this.dispersion = 0.0;         // Abbe number, typically 20-100

        // Material texture map references (from GLTF)
         this.material = null; // Full material object with texture indices:
         // - textureIndex: base color texture
         // - normalMapIndex: normal map texture
         // - metallicRoughnessMapIndex: packed metallic/roughness texture
         // - emissiveMapIndex: emissive texture
         // - ior: index of refraction

         // Skeletal animation data: per-vertex joint indices and weights
         // jointData: array of 3 elements, each with [4 joint indices]
         // weightData: array of 3 elements, each with [4 blend weights]
         // Used for vertex skinning - deforming geometry based on bone transforms
         this.jointData = null; // [[j0,j1,j2,j3], [j0,j1,j2,j3], [j0,j1,j2,j3]]
         this.weightData = null;       // [[w0,w1,w2,w3], [w0,w1,w2,w3], [w0,w1,w2,w3]]
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

// ---------------------------------------------------------------------------------------------
// Lazy KHR_materials_* extension blocks.
//
// One shared, DEEPLY FROZEN default per extension, handed out on read. Frozen because callers do
// `{...triangle.volume}` (textureset.js) and read the nested arrays (glbexporter.js) — without the
// freeze, one caller mutating a default in place would silently change it for every triangle in
// the engine. Frozen makes that a loud failure in strict mode instead of a haunting.
//
// Writing installs a plain own-property on that triangle, shadowing the accessor, so
// `triangle.volume = {...}` (glbloader.js:823) behaves exactly as before.
// ---------------------------------------------------------------------------------------------
Triangle.DEFAULT_VOLUME = Object.freeze({
    thicknessFactor: 0.0,
    attenuationDistance: 1.0,
    attenuationColor: Object.freeze([1, 1, 1])
});
Triangle.DEFAULT_SHEEN = Object.freeze({
    colorFactor: Object.freeze([0, 0, 0]),
    roughnessFactor: 0.0
});
Triangle.DEFAULT_CLEARCOAT = Object.freeze({ factor: 0.0, roughnessFactor: 0.0 });
Triangle.DEFAULT_ANISOTROPY = Object.freeze({ strength: 0.0, rotation: 0.0 });
Triangle.DEFAULT_IRIDESCENCE = Object.freeze({ factor: 0.0, ior: 1.3, thickness: 0.0 });

for (const [prop, dflt] of [
    ["volume", Triangle.DEFAULT_VOLUME],
    ["sheen", Triangle.DEFAULT_SHEEN],
    ["clearcoat", Triangle.DEFAULT_CLEARCOAT],
    ["anisotropy", Triangle.DEFAULT_ANISOTROPY],
    ["iridescence", Triangle.DEFAULT_IRIDESCENCE]
]) {
    Object.defineProperty(Triangle.prototype, prop, {
        configurable: true,
        // Prototype accessors are not own-properties, so an untouched triangle no longer lists
        // these under Object.keys()/spread the way the old eager fields did. Verified unobservable:
        // nothing spreads or serializes a whole Triangle (only `{...triangle.volume}` on the
        // sub-object, which still works). Once written, the own-property IS enumerable, matching
        // the old shape exactly for any triangle that actually carries an extension.
        enumerable: true,
        get() {
            return dflt;
        },
        set(value) {
            // Shadow the accessor with a real own data property on this instance.
            Object.defineProperty(this, prop, {
                value,
                writable: true,
                enumerable: true,
                configurable: true
            });
        }
    });
}
