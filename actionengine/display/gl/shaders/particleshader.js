// game/display/gl/shaders/particleshader.js
class ParticleShader {
    getParticleVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
        in float aSize;
        in vec4 aColor;
     
         uniform mat4 uProjectionMatrix;
         uniform mat4 uViewMatrix;
     
         out vec4 vColor;
         out float vFragDepth;  // For logarithmic depth
    
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
            gl_PointSize = aSize;
            vColor = aColor;
            
            // Store depth for logarithmic depth buffer
            vFragDepth = 1.0 + gl_Position.w;
        }`;
    }

    getParticleFragmentShader() {
        return `#version 300 es
        precision mediump float;
        in vec4 vColor;
        in float vFragDepth;  // For logarithmic depth
        out vec4 fragColor;
         uniform int uParticleType;
         uniform float uFarPlane;  // For logarithmic depth
         void main() {
             vec2 coord = gl_PointCoord * 2.0 - 1.0;
             if (uParticleType == 1 || uParticleType == 2) {  // Rain types
                 coord.y *= 12.0; // Longer streaks
                 float r = dot(coord, coord);
                 float streak = smoothstep(1.0, 0.0, r);
                 float trail = smoothstep(1.0, 0.0, coord.y);
                 float droplet = streak * trail;
                 fragColor = vec4(0.8, 0.85, 1.0, 1.0); // Blueish tint, more transparent
             } else {
                 float r = dot(coord, coord);
                 if (r > 1.0) discard;
                 fragColor = vColor;
             }
             
             // Logarithmic depth buffer encoding
             float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
             gl_FragDepth = logDepth;
         }`;
    }
}
