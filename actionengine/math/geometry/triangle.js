// actionengine/math/geometry/triangle.js
class Triangle {
    constructor(v1, v2, v3, color = null) {
        this.vertices = [v1, v2, v3];
        this.normal = this.calculateNormal();
        // If color isn't provided, calculate it based on average height
        this.color = color || this.calculateColor();
    }

    calculateNormal() {
        const edge1 = this.vertices[1].sub(this.vertices[0]);
        const edge2 = this.vertices[2].sub(this.vertices[0]);
        return edge1.cross(edge2).normalize();
    }

    calculateColor() {
        // Average height of vertices
        const avgHeight = (this.vertices[0].y + this.vertices[1].y + this.vertices[2].y) / 3;

        // Handle underwater case specially for OCEAN_DEEP
        if (avgHeight <= 0) return BIOME_TYPES.OCEAN_DEEP.base;
        if (avgHeight >= 400) return BIOME_TYPES.SNOW.base;

        // Convert to height percentage exactly like Terrain does
        const heightPercent = (avgHeight / 400) * 100;  // Using 400 since that's terrain's baseWorldHeight default

        // Use same biome lookup
        for (const biome of Object.values(BIOME_TYPES)) {
            if (heightPercent >= biome.heightRange[0] && heightPercent <= biome.heightRange[1]) {
                return biome.base;
            }
        }
        return BIOME_TYPES.OCEAN.base;
    }
    
    getVertexArray() {
        return this.vertices.flatMap(v => [v.x, v.y, v.z]);
    }

    getNormalArray() {
        return [
            ...this.normal.toArray(),
            ...this.normal.toArray(),
            ...this.normal.toArray()
        ];
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