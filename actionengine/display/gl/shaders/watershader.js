class WaterShader {
    /**
     * Helper functions for GPU-side matrix construction
     * Matches Matrix4.fromQuat() from matrix4.js to ensure correct orientation
     * @returns {string} - GLSL helper functions
     */
    getMatrixConstructionHelpers() {
        return `
     // Convert quaternion to 3x3 rotation matrix
     // Uses the same formula as Matrix4.fromQuat() in the JS math library
     mat3 quaternionToMatrix(vec4 q) {
         float x = q.x, y = q.y, z = q.z, w = q.w;
         float x2 = x + x, y2 = y + y, z2 = z + z;
         float xx = x * x2, xy = x * y2, xz = x * z2;
         float yy = y * y2, yz = y * z2, zz = z * z2;
         float wx = w * x2, wy = w * y2, wz = w * z2;
         
         return mat3(
             1.0 - (yy + zz), xy + wz,       xz - wy,
             xy - wz,       1.0 - (xx + zz), yz + wx,
             xz + wy,       yz - wx,       1.0 - (xx + yy)
         );
     }
     
     // Build full 4x4 model matrix from position, quaternion rotation, scale
     mat4 buildModelMatrix(vec3 position, vec4 rotation, float scale) {
         mat3 rotMatrix = quaternionToMatrix(rotation);
         mat3 scaledRotMatrix = rotMatrix * mat3(scale);
         
         return mat4(
             vec4(scaledRotMatrix[0], 0.0),
             vec4(scaledRotMatrix[1], 0.0),
             vec4(scaledRotMatrix[2], 0.0),
             vec4(position, 1.0)
         );
     }`;
    }

    getWaterVertexShader() {
        return `#version 300 es
         in vec3 aPosition;
         in vec3 aNormal;
         in vec2 aTexCoord;
          
          uniform mat4 uProjectionMatrix;
          uniform mat4 uViewMatrix;
          uniform vec3 uModelPos;
          uniform vec4 uModelRotation;
          uniform float uModelScale;
          uniform float uTime;
          
          out vec3 vPosition;
          out vec3 vNormal;
          out vec2 vTexCoord;
          out float vFragDepth;  // For logarithmic depth
         
         ${this.getMatrixConstructionHelpers()}
         
         void main() {
             vec3 pos = aPosition;
             
             float wave = sin(pos.x * 2.0 + uTime) * 2.0 + 
                         sin(pos.z * 1.5 + uTime * 0.8) * 1.8;
             pos.y += wave;
             
             vec3 normal = aNormal;
             normal.xz += cos(pos.xz * 2.0 + uTime) * 0.2;
             normal = normalize(normal);
             
             mat4 modelMatrix = buildModelMatrix(uModelPos, uModelRotation, uModelScale);
             vPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
             vNormal = normal;
             vTexCoord = aTexCoord;
             
             vec4 clipPos = uProjectionMatrix * uViewMatrix * vec4(vPosition, 1.0);
             gl_Position = clipPos;
             
             // Store depth for logarithmic depth buffer
             vFragDepth = 1.0 + clipPos.w;
         }`;
    }

    getWaterFragmentShader() {
        return `#version 300 es
        precision highp float;
         
        in vec3 vPosition;
        in vec3 vNormal;
        in vec2 vTexCoord;
        in float vFragDepth;  // For logarithmic depth
         
         uniform vec3 uCameraPos;
         uniform vec3 uLightDir;
         uniform float uTime;
         uniform float uFarPlane;  // For logarithmic depth
         
         out vec4 fragColor;
         
         void main() {
             vec3 viewDir = normalize(uCameraPos - vPosition);
             
             vec3 waterColor = vec3(0.0, 0.4, 0.6);
             
             float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
             
             vec3 reflectDir = reflect(-uLightDir, vNormal);
             float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
             
             vec3 finalColor = waterColor + fresnel * 0.5 + spec;
             
             float alpha = mix(0.6, 0.9, fresnel);
             
             fragColor = vec4(finalColor, alpha);
             
             // Logarithmic depth buffer encoding (match other shaders)
             float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
             gl_FragDepth = logDepth;
         }`;
    }
}
