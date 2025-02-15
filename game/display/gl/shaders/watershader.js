class WaterShader {
    getWaterVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
        ${isWebGL2 ? "in" : "attribute"} vec2 aTexCoord;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        uniform float uTime;
        
        ${isWebGL2 ? "out" : "varying"} vec3 vPosition;
        ${isWebGL2 ? "out" : "varying"} vec3 vNormal;
        ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
        
        void main() {
            vec3 pos = aPosition;
            
            // Simplified wave calculation
            float wave = sin(pos.x * 2.0 + uTime) * 0.5 + 
                        sin(pos.z * 1.5 + uTime * 0.8) * 0.4;
            pos.y += wave;
            
            // Simple normal calculation
            vec3 normal = aNormal;
            normal.xz += cos(pos.xz * 2.0 + uTime) * 0.2;
            normal = normalize(normal);
            
            vPosition = (uModelMatrix * vec4(pos, 1.0)).xyz;
            vNormal = normal;
            vTexCoord = aTexCoord;
            
            gl_Position = uProjectionMatrix * uViewMatrix * vec4(vPosition, 1.0);
        }`;
    }

    getWaterFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision highp float;
        
        ${isWebGL2 ? "in" : "varying"} vec3 vPosition;
        ${isWebGL2 ? "in" : "varying"} vec3 vNormal;
        ${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
        
        uniform vec3 uCameraPos;
        uniform vec3 uLightDir;
        uniform float uTime;
        
        ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
        
        void main() {
            vec3 viewDir = normalize(uCameraPos - vPosition);
            
            // Basic water color
            vec3 waterColor = vec3(0.0, 0.4, 0.6);
            
            // Simple fresnel
            float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
            
            // Specular highlight
            vec3 reflectDir = reflect(-uLightDir, vNormal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
            
            // Final color
            vec3 finalColor = waterColor + fresnel * 0.5 + spec;
            
            // Transparency based on view angle
            float alpha = mix(0.6, 0.9, fresnel);
            
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(finalColor, alpha);
        }`;
    }
}
 class WaterVolumetricShader {
    constructor() {
        this.numSteps = 64; // Ray marching steps
        this.maxDistance = 50.0; // Maximum ray marching distance
    }

    getWaterVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
        ${isWebGL2 ? "in" : "attribute"} vec2 aTexCoord;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        uniform float uTime;
        
        ${isWebGL2 ? "out" : "varying"} vec3 vPosition;
        ${isWebGL2 ? "out" : "varying"} vec3 vNormal;
        ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
        ${isWebGL2 ? "out" : "varying"} vec4 vClipSpace;
        ${isWebGL2 ? "out" : "varying"} vec3 vWorldPos;
        
        void main() {
            vec3 pos = aPosition;
            
            // Wave calculations (same as before)
            vec3 wave1Dir = normalize(vec3(1.0, 0.0, 0.2));
            vec3 wave2Dir = normalize(vec3(0.8, 0.0, 0.3));
            vec3 wave3Dir = normalize(vec3(0.3, 0.0, 1.0));
            
            float wave1 = 1.0 * sin(1.0 * dot(wave1Dir.xz, pos.xz) - 1.0 * uTime);
            float wave2 = 0.6 * sin(2.0 * dot(wave2Dir.xz, pos.xz) - 0.5 * uTime);
            float wave3 = 0.4 * sin(3.0 * dot(wave3Dir.xz, pos.xz) - 1.5 * uTime);
            
            pos.y += wave1 + wave2 + wave3;
            
            vec3 normal = aNormal;
            normal.y = 1.0;
            normal = normalize(normal);
            
            vPosition = (uModelMatrix * vec4(pos, 1.0)).xyz;
            vNormal = normal;
            vTexCoord = aTexCoord;
            vWorldPos = pos;
            
            vec4 clipSpace = uProjectionMatrix * uViewMatrix * vec4(vPosition, 1.0);
            vClipSpace = clipSpace;
            gl_Position = clipSpace;
        }`;
    }

    getWaterFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision highp float;
        
        ${isWebGL2 ? "in" : "varying"} vec3 vPosition;
        ${isWebGL2 ? "in" : "varying"} vec3 vNormal;
        ${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
        ${isWebGL2 ? "in" : "varying"} vec4 vClipSpace;
        ${isWebGL2 ? "in" : "varying"} vec3 vWorldPos;
        
        uniform vec3 uCameraPos;
        uniform vec3 uLightDir;
        uniform float uTime;
        uniform sampler2D uDepthMap;
        uniform vec2 uScreenSize;
        
        const int NUM_STEPS = 64;
        const float MAX_DIST = 50.0;
        const float DENSITY = 0.1;
        const float SCATTER_STRENGTH = 0.5;
        const vec3 WATER_COLOR = vec3(0.0, 0.3, 0.5);
        const vec3 SCATTER_COLOR = vec3(0.2, 0.5, 0.7);
        
        ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
        
        float random(vec2 co) {
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }
        
        vec3 calculateVolumetrics(vec3 startPos, vec3 rayDir, float rayLength) {
            float stepSize = rayLength / float(NUM_STEPS);
            vec3 step = rayDir * stepSize;
            vec3 currentPos = startPos;
            
            vec3 scattering = vec3(0.0);
            float transmittance = 1.0;
            
            for(int i = 0; i < NUM_STEPS; i++) {
                // Add some noise to the position for more realistic scattering
                vec3 noisyPos = currentPos + 0.1 * vec3(
                    random(currentPos.xy + uTime),
                    random(currentPos.yz + uTime),
                    random(currentPos.xz + uTime)
                );
                
                // Calculate density at current position
                float height = noisyPos.y;
                float density = exp(-height * DENSITY);
                
                // Calculate light scattering
                float lightDensity = exp(-height * DENSITY);
                vec3 lightContrib = SCATTER_COLOR * lightDensity * SCATTER_STRENGTH;
                
                // Accumulate scattering and update transmittance
                scattering += lightContrib * transmittance * stepSize;
                transmittance *= exp(-density * stepSize);
                
                currentPos += step;
                
                // Early exit if transmittance is very low
                if(transmittance < 0.01) break;
            }
            
            return scattering;
        }
        
        void main() {
            vec3 viewDir = normalize(uCameraPos - vPosition);
            vec3 reflectDir = reflect(-uLightDir, vNormal);
            
            // Surface shading
            float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
            float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.0);
            
            vec3 deepColor = vec3(0.0, 0.1, 0.2);
            vec3 shallowColor = vec3(0.0, 0.5, 0.8);
            vec3 waterColor = mix(deepColor, shallowColor, fresnel);
            
            // Calculate volumetric effects
            float rayLength = length(uCameraPos - vPosition);
            rayLength = min(rayLength, MAX_DIST);
            vec3 volumetrics = calculateVolumetrics(vPosition, -viewDir, rayLength);
            
            // Combine surface color with volumetrics
            vec3 finalColor = waterColor + vec3(specular);
            finalColor = mix(finalColor, volumetrics, 0.5);
            
            // Apply depth-based fog
            float fogFactor = 1.0 - exp(-rayLength * 0.02);
            finalColor = mix(finalColor, WATER_COLOR, fogFactor);
            
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(finalColor, 0.9);
        }`;
    }
}
