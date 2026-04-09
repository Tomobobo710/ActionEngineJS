// actionengine/math/physics/actionboxshape2d.js
/**
 * ActionBoxShape2D — Oriented bounding box collider.
 * Defined by half-extents (halfWidth, halfHeight).
 * The OBB orientation comes from the owning body's angle.
 */
class ActionBoxShape2D extends ActionShape2D {
    /**
     * @param {number} halfWidth
     * @param {number} halfHeight
     */
    constructor(halfWidth, halfHeight) {
        super(ActionShapeType2D.BOX);
        this.halfWidth = halfWidth;
        this.halfHeight = halfHeight;
    }

    /**
     * Return the four local-space corner vertices (no rotation applied).
     * @returns {Vector2[]}
     */
    getLocalVertices() {
        const hw = this.halfWidth;
        const hh = this.halfHeight;
        return [
            new Vector2(-hw, -hh),
            new Vector2( hw, -hh),
            new Vector2( hw,  hh),
            new Vector2(-hw,  hh)
        ];
    }

    /**
     * Return world-space vertices given body position and angle.
     * @param {Vector2} position
     * @param {number} angle
     * @returns {Vector2[]}
     */
    getWorldVertices(position, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const hw = this.halfWidth;
        const hh = this.halfHeight;

        // Pre-compute the four rotated corners
        return [
            new Vector2(position.x + (-hw * cos - (-hh) * sin), position.y + (-hw * sin + (-hh) * cos)),
            new Vector2(position.x + ( hw * cos - (-hh) * sin), position.y + ( hw * sin + (-hh) * cos)),
            new Vector2(position.x + ( hw * cos -   hh  * sin), position.y + ( hw * sin +   hh  * cos)),
            new Vector2(position.x + (-hw * cos -   hh  * sin), position.y + (-hw * sin +   hh  * cos))
        ];
    }

    /**
     * Return the two unique edge normals in world space (the OBB axes).
     * @param {number} angle
     * @returns {Vector2[]}
     */
    getAxes(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            new Vector2(cos, sin),   // local X axis
            new Vector2(-sin, cos)   // local Y axis
        ];
    }

    computeAABB(position, angle) {
        const verts = this.getWorldVertices(position, angle);
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < 4; i++) {
            const v = verts[i];
            if (v.x < minX) minX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.x > maxX) maxX = v.x;
            if (v.y > maxY) maxY = v.y;
        }
        return new ActionAABB2D(minX, minY, maxX, maxY);
    }

    computeInertia(mass) {
        // I = (1/12) m (w² + h²)  for a solid rectangle
        const w = this.halfWidth * 2;
        const h = this.halfHeight * 2;
        return (mass / 12) * (w * w + h * h);
    }

    computeArea() {
        return 4 * this.halfWidth * this.halfHeight;
    }
}
