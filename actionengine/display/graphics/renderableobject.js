// actionengine/display/graphics/renderableobject.js
import { Matrix4 } from '../../math/matrix4.js';

export class RenderableObject {
    constructor() {
        // Add visual update tracking
        this._visualDirty = true;
        this._lastPosition = null;
        this._lastRotation = null;
        
        // Frustum culling properties
        this.excludeFromFrustumCulling = false; // Objects can opt out if needed
    }
    
    markVisualDirty() {
        this._visualDirty = true;
    }
    
    isVisualDirty() {
        return this._visualDirty;
    }
    getModelMatrix() {
        const matrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        const rotationMatrix = window.Matrix4 ? window.Matrix4.create() : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

        // Apply initial vertical offset
        if (window.Matrix4) {
            window.Matrix4.translate(matrix, matrix, [0, this.height / 8, 0]);
        } else {
            matrix[13] = this.height / 8; // Manual Y translation
        }

        // Apply position
        if (window.Matrix4) {
            window.Matrix4.translate(matrix, matrix, this.position.toArray());
        } else {
            matrix[12] = this.position.x || 0;
            matrix[13] += (this.position.y || 0);
            matrix[14] = this.position.z || 0;
        }

        // Apply full rotation from physics body if it exists
        if (this.body) {
            if (window.Matrix4) {
                window.Matrix4.fromQuat(rotationMatrix, this.body.rotation);
                window.Matrix4.multiply(matrix, matrix, rotationMatrix);
            }
        } else {
            // Fall back to simple Y rotation if no physics body
            if (window.Matrix4) {
                window.Matrix4.rotateY(matrix, matrix, this.rotation);
            }
        }

        // Apply scale
        if (window.Matrix4) {
            window.Matrix4.scale(matrix, matrix, [this.scale, this.scale, this.scale]);
        } else {
            // Manual scaling fallback
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    matrix[i * 4 + j] *= (this.scale || 1);
                }
            }
        }

        return matrix;
    }
}

// Make RenderableObject available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.RenderableObject = RenderableObject;
}
