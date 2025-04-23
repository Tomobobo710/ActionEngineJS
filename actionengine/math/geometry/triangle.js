// actionengine/math/geometry/triangle.js
class Triangle {
    constructor(v1, v2, v3, color = "#FF00FF", texture = null, uvs = null) {
        this.vertices = [v1, v2, v3];
        this.normal = this.calculateNormal();
        this.color = color;  // Default to magenta
        this.texture = texture;
        this.uvs = uvs;
    }

    calculateNormal() {
        const edge1 = this.vertices[1].sub(this.vertices[0]);
        const edge2 = this.vertices[2].sub(this.vertices[0]);
        return edge1.cross(edge2).normalize();
    }

    getVertexArray() {
        return this.vertices.flatMap((v) => [v.x, v.y, v.z]);
    }

    getNormalArray() {
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