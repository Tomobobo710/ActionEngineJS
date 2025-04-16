// game/display/gl/shaders/particleshader.js
class ParticleShader {
    getParticleVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} float aSize;
        ${isWebGL2 ? "in" : "attribute"} vec4 aColor;
    
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
    
        ${isWebGL2 ? "out" : "varying"} vec4 vColor;
    
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
            gl_PointSize = aSize;
            vColor = aColor;
        }`;
    }

    getParticleFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        ${isWebGL2 ? "in" : "varying"} vec4 vColor;
        ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
        uniform int uParticleType;
        void main() {
            vec2 coord = gl_PointCoord * 2.0 - 1.0;
            if (uParticleType == 1 || uParticleType == 2) {  // Rain types
                coord.y *= 12.0; // Longer streaks
                float r = dot(coord, coord);
                float streak = smoothstep(1.0, 0.0, r);
                float trail = smoothstep(1.0, 0.0, coord.y);
                float droplet = streak * trail;
                ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(0.8, 0.85, 1.0, 1.0); // Blueish tint, more transparent
            } else {
                float r = dot(coord, coord);
                if (r > 1.0) discard;
                ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vColor;
            }
        }`;
    }
}