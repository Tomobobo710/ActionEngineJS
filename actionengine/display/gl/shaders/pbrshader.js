// game/display/gl/shaders/pbrshader.js
class PBRShader {
    getTerrainVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    // Attributes - data coming in per vertex
    ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
    ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
    ${isWebGL2 ? "in" : "attribute"} vec3 aColor;
    ${isWebGL2 ? "in" : "attribute"} vec2 aTexCoord;
    ${isWebGL2 ? "in" : "attribute"} float aTextureIndex;
    ${isWebGL2 ? "in" : "attribute"} float aUseTexture;
    
    // Uniforms - shared data for all vertices
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    uniform vec3 uLightDir;
    uniform vec3 uCameraPos;
    
    // Outputs to fragment shader
    ${isWebGL2 ? "out" : "varying"} vec3 vNormal;        // Surface normal
    ${isWebGL2 ? "out" : "varying"} vec3 vWorldPos;      // Position in world space

    ${isWebGL2 ? "out" : "varying"} vec3 vColor;
    ${isWebGL2 ? "out" : "varying"} vec3 vViewDir;       // Direction to camera
    ${isWebGL2 ? "flat out" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "flat out" : "varying"} float vUseTexture;
    
    void main() {
        // Calculate world position
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        
        // Transform normal to world space
        vNormal = mat3(uModelMatrix) * aNormal;
        
        // Calculate view direction
        vViewDir = normalize(uCameraPos - worldPos.xyz);
        

        
        // Pass color and texture info to fragment shader
        vColor = aColor;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
        
        // Final position
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }`;
    }

    getTerrainFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
precision highp float;
${isWebGL2 ? "precision mediump sampler2DArray;\n" : ""}

// Inputs from vertex shader
${isWebGL2 ? "in" : "varying"} vec3 vNormal;
${isWebGL2 ? "in" : "varying"} vec3 vWorldPos;

${isWebGL2 ? "in" : "varying"} vec3 vColor;
${isWebGL2 ? "in" : "varying"} vec3 vViewDir;
${isWebGL2 ? "flat in" : "varying"} float vTextureIndex;
${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
${isWebGL2 ? "flat in" : "varying"} float vUseTexture;

// Material properties
uniform float uRoughness;
uniform float uMetallic;
uniform float uBaseReflectivity;

// Light properties
uniform vec3 uLightPos;
uniform vec3 uLightDir;
uniform vec3 uCameraPos;

uniform float uLightIntensity;

// Texture sampler
uniform sampler2DArray uPBRTextureArray;



${isWebGL2 ? "out vec4 fragColor;" : ""}

// PBR functions stay the same
float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / (3.14159 * denom * denom);
}

float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = GeometrySchlickGGX(NdotV, roughness);
    float ggx2 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}



void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    // Positional light calculation
    vec3 lightToFrag = vWorldPos - uLightPos;  // Vector from light to fragment
    float distanceToLight = length(lightToFrag);  // Actual distance to light
    float distanceAttenuation = 1.0 / (1.0 + 0.0001 * distanceToLight * distanceToLight);

    // Directional component - use light's intended direction
    vec3 L = normalize(uLightDir);  // Light direction
    vec3 H = normalize(V + L);  // Halfway vector



    // Determine albedo - either from texture or vertex color
    vec3 albedo;
    if (vUseTexture > 0.5) {
        // Sample from texture array using texture index
        vec4 texColor = texture(uPBRTextureArray, vec3(vTexCoord, vTextureIndex));
        albedo = texColor.rgb;
    } else {
        albedo = vColor;
    }

    // Base reflectivity
    vec3 baseF0 = vec3(uBaseReflectivity);
    baseF0 = mix(baseF0, albedo, uMetallic);

    // Cook-Torrance BRDF
    float NDF = DistributionGGX(N, H, uRoughness);
    float G = GeometrySmith(N, V, L, uRoughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), baseF0);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.001;
    vec3 specular = numerator / denominator;

    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - uMetallic;

    float NdotL = max(dot(N, L), 0.0);

    // Combine everything
    vec3 color = (kD * albedo / 3.14159 + specular) * NdotL * uLightIntensity;
    
    // Apply distance attenuation
    color *= distanceAttenuation;

    // Add ambient light
    vec3 ambient = vec3(0.03) * albedo;
    color += ambient;

    // HDR tonemapping
    color = color / (color + vec3(1.0));

    // Gamma correction
    color = pow(color, vec3(1.0/2.2));

    ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(color, 1.0);
}`;
    }

    // Add these methods to PBRShader class
    getCharacterVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
    ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
    ${isWebGL2 ? "in" : "attribute"} vec3 aColor;
    ${isWebGL2 ? "in" : "attribute"} vec2 aTexCoord;
    ${isWebGL2 ? "in" : "attribute"} float aTextureIndex;
    ${isWebGL2 ? "in" : "attribute"} float aUseTexture;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform vec3 uCameraPos;
    
    ${isWebGL2 ? "out" : "varying"} vec3 vNormal;
    ${isWebGL2 ? "out" : "varying"} vec3 vWorldPos;
    ${isWebGL2 ? "out" : "varying"} vec3 vViewDir;
    ${isWebGL2 ? "out" : "varying"} vec3 vColor;
    ${isWebGL2 ? "flat out" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "flat out" : "varying"} float vUseTexture;
    
    void main() {
        // Calculate world position
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        
        // Transform normal to world space
        vNormal = mat3(uModelMatrix) * aNormal;
        
        // Calculate view direction
        vViewDir = normalize(uCameraPos - worldPos.xyz);
        
        // Pass color and texture info to fragment shader
        vColor = aColor;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
        
        // Final position
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }`;
    }

    getCharacterFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    precision mediump float;
    ${isWebGL2 ? "precision mediump sampler2DArray;\n" : ""}
    
    ${isWebGL2 ? "in" : "varying"} vec3 vNormal;
    ${isWebGL2 ? "in" : "varying"} vec3 vWorldPos;
    ${isWebGL2 ? "in" : "varying"} vec3 vViewDir;
    ${isWebGL2 ? "in" : "varying"} vec3 vColor;
    ${isWebGL2 ? "flat in" : "varying"} float vTextureIndex;
    ${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
    ${isWebGL2 ? "flat in" : "varying"} float vUseTexture;
    ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
    
    // Material properties
    uniform float uRoughness;
    uniform float uMetallic;
    
    // Light properties
    uniform vec3 uLightDir;
    
    // Texture sampler
    uniform sampler2DArray uPBRTextureArray;
    
    void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightDir);
        vec3 V = normalize(vViewDir);
        vec3 H = normalize(V + L);
        
        // Determine albedo - either from texture or vertex color
        vec3 albedo;
        if (vUseTexture > 0.5) {
            // Sample from texture array using texture index
            vec4 texColor = texture(uPBRTextureArray, vec3(vTexCoord, vTextureIndex));
            albedo = texColor.rgb;
        } else {
            albedo = vColor;
        }
        
        // Basic lighting calculation
        float diffuse = max(dot(N, L), 0.0);
        float specular = pow(max(dot(N, H), 0.0), 32.0) * 0.3;
        
        // Final color
        vec3 color = albedo * (0.2 + 0.7 * diffuse) + specular * (0.5 + 0.5 * uMetallic);
        
        // Simple tonemapping
        color = color / (color + vec3(1.0));
        
        // Gamma correction
        color = pow(color, vec3(1.0/2.2));
        
        ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(color, 1.0);
    }`;
    }

    getLineVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
    }`;
    }

    getLineFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
    precision mediump float;
    ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
    
    void main() {
        ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(1.0, 0.0, 0.0, 1.0);
    }`;
    }
}

// Register the shader
//console.log("[PBRShader] Registering PBR shader..");
ShaderRegistry.register("pbr", PBRShader);