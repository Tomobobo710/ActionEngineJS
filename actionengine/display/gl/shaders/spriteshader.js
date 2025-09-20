// actionengine/display/gl/shaders/spriteshader.js

class SpriteShader {
    constructor() {
        // No variants needed for sprites - keep it simple
    }

    /**
     * Get sprite vertex shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Vertex shader source code
     */
    getVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} vec2 aTexCoord;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform vec3 uSpritePosition;  // World position of the sprite
        uniform vec2 uSpriteSize;      // Width and height of the sprite
        uniform vec3 uCameraPosition;
        uniform vec3 uCameraRight;
        uniform vec3 uCameraUp;
        uniform bool uIsBillboard;     // Whether to use billboard mode
        uniform vec3 uSpriteForward;   // Sprite forward direction (for non-billboard)
        uniform vec3 uSpriteUp;        // Sprite up direction (for non-billboard)
        
        ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
        
        void main() {
            vec3 worldPos;

            if (uIsBillboard) {
                // Calculate billboard position in world space
                // aPosition.xy contains the quad vertices (-0.5 to 0.5)
                worldPos = uSpritePosition
                         + uCameraRight * aPosition.x * uSpriteSize.x
                         + uCameraUp * aPosition.y * uSpriteSize.y;
            } else {
                // Non-billboard mode: Use sprite's own orientation
                // Create a basis using sprite's forward and up vectors
                vec3 forward = normalize(uSpriteForward);
                vec3 up = normalize(uSpriteUp);

                // Calculate right vector (perpendicular to forward and up)
                vec3 right = normalize(cross(forward, up));

                // Recalculate up to ensure orthogonality (in case forward/up weren't perfectly perpendicular)
                vec3 correctedUp = normalize(cross(right, forward));

                // Calculate world position using sprite's local coordinate system
                worldPos = uSpritePosition
                         + right * aPosition.x * uSpriteSize.x
                         + correctedUp * aPosition.y * uSpriteSize.y;
            }

            // Transform to screen space
            vec4 viewPos = uViewMatrix * vec4(worldPos, 1.0);
            gl_Position = uProjectionMatrix * viewPos;

            // Pass through texture coordinates
            vTexCoord = aTexCoord;
        }`;
    }

    /**
     * Get billboard fragment shader
     * @param {boolean} isWebGL2 - Whether WebGL2 is being used
     * @returns {string} - Fragment shader source code
     */
    getFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        
        ${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
        
        uniform sampler2D uTexture;
        uniform vec3 uColor;       // Color tint
        uniform float uAlpha;      // Alpha value
        
        ${isWebGL2 ? "out vec4 fragColor;" : ""}
        
        void main() {
            vec4 texColor = texture${isWebGL2 ? "" : "2D"}(uTexture, vTexCoord);
            
            // Apply color tint and alpha
            vec4 finalColor = vec4(texColor.rgb * uColor, texColor.a * uAlpha);
            
            // Discard transparent pixels
            if (finalColor.a < 0.01) {
                discard;
            }
            
            ${isWebGL2 ? "fragColor = finalColor;" : "gl_FragColor = finalColor;"}
        }`;
    }
}