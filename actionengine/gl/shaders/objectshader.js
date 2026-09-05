//actionengine/gl/shaders/objectshader.js

class ObjectShader {
    constructor() {
        // Normal mapping helper functions (shared across all shaders)
        this.normalMappingFunctions = `
            // Sample normal from normal map and convert from tangent to world space
            vec3 sampleNormalMap(sampler2DArray normalMap, int mapIndex, vec2 texCoord, vec3 normal, vec3 tangent, vec3 bitangent) {
                // Check if normal map index is valid
                if (mapIndex < 0) return normal;
                
                // Sample from normal map texture array
                vec4 sampledNormal = texture(normalMap, vec3(texCoord, float(mapIndex)));
                
                // Convert from [0,1] to [-1,1] range (assuming GL_RGB or GL_RGBA format)
                vec3 normalTangentSpace = normalize(sampledNormal.rgb * 2.0 - 1.0);
                
                // Construct TBN matrix (from tangent space to world space)
                vec3 N = normalize(normal);
                vec3 T = normalize(tangent);
                vec3 B = normalize(bitangent);
                mat3 TBN = mat3(T, B, N);
                
                // Transform normal from tangent space to world space
                vec3 normalWorldSpace = TBN * normalTangentSpace;
                return normalize(normalWorldSpace);
            }
        `;

        // Store references to different object shader variants
        this.variants = {
            default: {
                getVertexShader: this.getDefaultVertexShader,
                getFragmentShader: this.getDefaultFragmentShader
            },
            virtualboy: {
                getVertexShader: this.getVirtualBoyVertexShader,
                getFragmentShader: this.getVirtualBoyFragmentShader
            }
        };

        // Current active variant (default to 'default')
        this.currentVariant = "default";
    }

    /**
     * Set the current shader variant
     * @param {string} variantName - Name of the variant to use
     */
    setVariant(variantName) {
        if (this.variants[variantName]) {
            this.currentVariant = variantName;
            console.log(`[ObjectShader] Set shader variant to: ${variantName}`);
        } else {
            console.warn(`[ObjectShader] Unknown variant: ${variantName}, using default`);
            this.currentVariant = "default";
        }
    }

    /**
     * Get the current variant name
     * @returns {string} - Current variant name
     */
    getCurrentVariant() {
        return this.currentVariant;
    }

    /**
     * Get the current variant's vertex shader
     * @returns {string} - Vertex shader source code
     */
    getVertexShader() {
        return this.variants[this.currentVariant].getVertexShader.call(this);
    }

    /**
     * Get the current variant's fragment shader
     * @returns {string} - Fragment shader source code
     */
    getFragmentShader() {
        return this.variants[this.currentVariant].getFragmentShader.call(this);
    }

    //--------------------------------------------------------------------------
    // DEFAULT SHADER VARIANT
    //--------------------------------------------------------------------------

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
    mat4 buildModelMatrix(vec3 position, vec4 rotation, vec3 scale) {
        mat3 rotMatrix = quaternionToMatrix(rotation);
        
        // Apply non-uniform scale by multiplying columns of the rotation matrix
        rotMatrix[0] *= scale.x;
        rotMatrix[1] *= scale.y;
        rotMatrix[2] *= scale.z;
        
        return mat4(
            vec4(rotMatrix[0], 0.0),
            vec4(rotMatrix[1], 0.0),
            vec4(rotMatrix[2], 0.0),
            vec4(position, 1.0)
        );
    }`;
    }

    /**
     * Default object vertex shader
     * Features: normal mapping, texture arrays, shadow mapping, skeletal animation
     * @returns {string} - Vertex shader source code
     */
    getDefaultVertexShader() {
        return `#version 300 es
    // Attributes - data coming in per vertex
    in vec3 aPosition;
    in vec3 aNormal;
    in vec3 aTangent;
    in vec3 aColor;
    in float aAlpha;
    in vec2 aTexCoord;
    in float aTextureIndex;
    in float aUseTexture;
    in float aNormalMapIndex;
    in float aMetallicRoughnessMapIndex;
    in float aEmissiveMapIndex;
    
    // Skeletal animation attributes
    in ivec4 aBoneIndices;
    in vec4 aBoneWeights;
    
    // Uniforms - shared data for all vertices
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform vec3 uModelPos;
    uniform vec4 uModelRotation;
    uniform vec3 uModelScale;
    uniform mat4 uLightSpaceMatrix;  // Added for shadow mapping
    uniform float uShadowNormalOffset; // world-space normal-offset bias magnitude (texelWorld × normalSlackTexels)

    uniform vec3 uLightDir;
    uniform vec3 uCameraPos;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    
    // Bone matrices for skeletal animation (max 256 bones)
    layout(std140) uniform BoneMatrices {
        mat4 matrices[256];
    } boneData;
    
    // Outputs to fragment shader
    out vec3 vNormal;        // Surface normal
    out vec3 vTangent;       // Surface tangent
    out vec3 vBitangent;     // Surface bitangent
    out vec3 vWorldPos;      // Position in world space
    out vec4 vFragPosLightSpace;  // Added for shadow mapping
    out vec3 vFragPos;
    out vec3 vColor;
    out float vAlpha;
    out vec3 vViewDir;       // Direction to camera
    flat out float vTextureIndex;
    out vec2 vTexCoord;
    flat out float vUseTexture;
    out float vFragDepth;    // For logarithmic depth buffer
    out float vViewDepth;    // Linear view-space depth (forward distance) for CSM cascade selection
    flat out float vNormalMapIndex;
    flat out float vMetallicRoughnessMapIndex;
    flat out float vEmissiveMapIndex;
    
    ${this.getMatrixConstructionHelpers()}
    
    void main() {
        // Apply skeletal animation if bone weights are present
        vec3 skinnedPosition = aPosition;
        vec3 skinnedNormal = aNormal;
        
        float totalWeight = aBoneWeights.x + aBoneWeights.y + aBoneWeights.z + aBoneWeights.w;
        if (totalWeight > 0.001) {
            // Normalize weights in case they don't sum to 1.0
            vec4 normalizedWeights = aBoneWeights / totalWeight;
            
            skinnedPosition = vec3(0.0);
            skinnedNormal = vec3(0.0);
            
            // Apply up to 4 bone influences
            for (int i = 0; i < 4; i++) {
                mat4 boneMatrix = boneData.matrices[aBoneIndices[i]];
                skinnedPosition += (boneMatrix * vec4(aPosition, 1.0)).xyz * normalizedWeights[i];
                skinnedNormal += (boneMatrix * vec4(aNormal, 0.0)).xyz * normalizedWeights[i];
            }
        }
        
        // Calculate world position from GPU-constructed matrix
        mat4 modelMatrix = buildModelMatrix(uModelPos, uModelRotation, uModelScale);
        vec4 worldPos = modelMatrix * vec4(skinnedPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vFragPos = worldPos.xyz;
        // Transform normal to world space (use 3x3 rotation part for normal)
        vec3 worldNormal = normalize(quaternionToMatrix(uModelRotation) * skinnedNormal);
        vNormal = worldNormal;
        
        // Transform tangent to world space and calculate bitangent
        vTangent = quaternionToMatrix(uModelRotation) * aTangent;
        vBitangent = cross(normalize(vNormal), normalize(vTangent));
        
        // Calculate view direction
        vViewDir = normalize(uCameraPos - worldPos.xyz);
        
        // Position in light space for shadow mapping, with NORMAL-OFFSET bias: nudge the sampled
        // position along the surface normal (NOT toward the light) before projecting. This covers the
        // texel-footprint depth error that causes acne WITHOUT pushing the shadow along the light ray,
        // so it kills acne without the peter-panning that depth bias causes. The offset ramps up as the
        // surface approaches grazing (sin(angle), zero face-on) and back OFF to zero once the surface is
        // backfacing (n·l <= 0) — a backfacing fragment is already unlit by the diffuse term, so it needs
        // no shadow bias at all; without the explicit backface branch below, clamping n·l to >=0 collapses
        // face-on-away-from-light and true-grazing into the same "0" value, which made grazeV saturate to
        // its MAXIMUM across the entire backfacing hemisphere instead of ramping down to zero. That
        // constant max offset near silhouette edges (ramps, cones, cylinders) pushed the shadow-space
        // sample position across geometry boundaries, which read as crawl independent of any slack slider.
        vec3 nrmW = normalize(worldNormal);
        float ndlRawV = dot(nrmW, normalize(-uLightDir));
        float grazeV = ndlRawV > 0.0 ? sqrt(max(0.0, 1.0 - ndlRawV * ndlRawV)) : 0.0;
        vFragPosLightSpace = uLightSpaceMatrix * vec4(worldPos.xyz + nrmW * (uShadowNormalOffset * grazeV), 1.0);

        // Linear view-space depth (positive forward distance) for CSM cascade selection. View space
        // looks down -Z, so -(view·worldPos).z is the camera-forward distance the cascade splits use.
        vViewDepth = -(uViewMatrix * worldPos).z;

        // Pass color and texture info to fragment shader
        vColor = aColor;
        vAlpha = aAlpha;
        vTexCoord = aTexCoord;
        vTextureIndex = aTextureIndex;
        vUseTexture = aUseTexture;
        vNormalMapIndex = aNormalMapIndex;
        vMetallicRoughnessMapIndex = aMetallicRoughnessMapIndex;
        vEmissiveMapIndex = aEmissiveMapIndex;
        
        // Final position
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
        
        // Store depth for logarithmic depth buffer (after gl_Position is set)
        vFragDepth = 1.0 + gl_Position.w;
    }`;
    }

    /**
     * Default object fragment shader
     * Features: normal mapping, texture arrays, shadow mapping, point/directional lights
     * @returns {string} - Fragment shader source code
     */
    getDefaultFragmentShader() {
        return this._getDefaultFragmentShaderImpl();
    }

    /**
     * Default fragment shader implementation
     * @returns {string} - Fragment shader source code
     */
    _getDefaultFragmentShaderImpl() {
        // Directly include shadow calculation functions for WebGL2
        const shadowFunctions = `
            // ---- color pipeline (linear <-> sRGB, ACES filmic tonemap) ----
            vec3 sRGBToLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
            vec3 linearToSRGB(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
            vec3 acesTonemap(vec3 x) {
                const float a = 2.51; const float b = 0.03;
                const float c = 2.43; const float d = 0.59; const float e = 0.14;
                return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
            }

            // Hemisphere ambient: sky tint above, ground tint below, by surface normal.
            vec3 hemisphereAmbient(vec3 N) {
                float t = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
                return mix(uAmbientGroundColor, uAmbientSkyColor, t) * uAmbientIntensity;
            }

            // Point falloff: the original intensity-compatible curve (~1 at center, 0.5 at d=radius)
            // multiplied by a smooth window so it reaches EXACTLY 0 at the radius instead of trailing
            // off forever. Keeps existing light intensities working while giving a clean cutoff.
            // (Pure inverse-square is more physical but needs intensities ~radius², which would make
            // every point light go dark at these scales — not worth re-authoring every scene.)
            float pointFalloff(float dist, float radius) {
                float r2 = max(radius * radius, 1e-4);
                float d2 = dist * dist;
                float base = 1.0 / (1.0 + d2 / r2);
                float win = clamp(1.0 - (d2 * d2) / (r2 * r2), 0.0, 1.0); // 1 - (d/r)^4
                return base * win * win;
            }

            // Receiver-plane depth bias (Isidoro 2006): depth gradient per shadow-map UV from screen
            // derivatives, so each PCF tap knows the receiver's TRUE depth at its offset — removes
            // slope acne without a global depth bias.
            vec2 receiverPlaneDepthBias(vec3 projCoords) {
                vec3 dx = dFdx(projCoords);
                vec3 dy = dFdy(projCoords);
                vec2 biasUV = vec2(dy.y * dx.z - dx.y * dy.z,
                                   dx.x * dy.z - dy.x * dx.z);
                float det = dx.x * dy.y - dx.y * dy.x;
                // The 1e-8 floor on |det| only guards against literal divide-by-zero — it does nothing
                // for a det that's small-but-nonzero (common on ordinary flat surfaces at moderate view
                // angles, not just degenerate silhouettes), which still blows biasUV up by orders of
                // magnitude. That unbounded per-fragment, per-frame noise feeds straight into every PCF
                // tap's reference depth, independent of Flat/Slope/Normal Slack — none of those sliders
                // can touch it, which is why tuning the Bias tab alone can't kill this crawl. Clamp the
                // gradient itself to a sane number of texels of depth change per texel of UV offset;
                // beyond that it's numerical noise, not real surface slope.
                biasUV /= (sign(det) * max(abs(det), 1e-8));
                float maxSlope = 8.0; // texels of depth change per texel of UV — generous but bounded
                biasUV = clamp(biasUV, vec2(-maxSlope), vec2(maxSlope));
                return biasUV; // d(depth)/d(uv)
            }

            // Sample from shadow map with hardware-enabled filtering
            float shadowCalculation(vec4 fragPosLightSpace, sampler2D shadowMap) {
                // Perform perspective divide to get NDC coordinates
                vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
                
                // Transform to [0,1] range for texture lookup
                projCoords = projCoords * 0.5 + 0.5;
                
                // Check if position is outside the shadow map bounds
                if(projCoords.x < 0.0 || projCoords.x > 1.0 || 
                   projCoords.y < 0.0 || projCoords.y > 1.0 || 
                   projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0; // No shadow outside shadow map
                }
                
                // Explicitly sample shadow map with separate texture binding
                float closestDepth = texture(shadowMap, projCoords.xy).r;
                
                // Get current depth value
                float currentDepth = projCoords.z;
                
                // Apply shadow bias to reduce self-shadowing artifacts
                float bias = uShadowBias;
                
                // Check if fragment is in shadow
                float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
                
                return shadow;
            }
            
            // ===== PBR FUNCTIONS =====
            
            // PBR Constants
            const float PI = 3.14159265359;
            const float RECIPROCAL_PI = 1.0 / PI;
            
            // Fresnel-Schlick approximation for specular reflection
            vec3 fresnelSchlick(float cosTheta, vec3 baseF0) {
                return baseF0 + (1.0 - baseF0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
            }
            
            // GGX normal distribution function
            float distributionGGX(vec3 N, vec3 H, float roughness) {
                float a = roughness * roughness;
                float a2 = a * a;
                float NdotH = max(dot(N, H), 0.0);
                float NdotH2 = NdotH * NdotH;
                float nom = a2;
                float denom = (NdotH2 * (a2 - 1.0) + 1.0);
                denom = PI * denom * denom;
                return nom / denom;
            }
            
            // Schlick-GGX geometry function
            float geometrySchlickGGX(float NdotV, float roughness) {
                float r = (roughness + 1.0);
                float k = (r * r) / 8.0;
                float nom = NdotV;
                float denom = NdotV * (1.0 - k) + k;
                return nom / denom;
            }
            
            // Smith geometry function
            float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
                float NdotV = max(dot(N, V), 0.0);
                float NdotL = max(dot(N, L), 0.0);
                float ggx2 = geometrySchlickGGX(NdotV, roughness);
                float ggx1 = geometrySchlickGGX(NdotL, roughness);
                return ggx1 * ggx2;
            }
            
            // Cook-Torrance BRDF specular calculation
            vec3 specularBRDF(vec3 N, vec3 L, vec3 V, vec3 baseF0, float roughness) {
                vec3 H = normalize(V + L);
                
                float NdotV = max(dot(N, V), 0.0);
                float NdotL = max(dot(N, L), 0.0);
                
                // Calculate BRDF components
                vec3 F = fresnelSchlick(max(dot(H, V), 0.0), baseF0);
                float D = distributionGGX(N, H, roughness);
                float G = geometrySmith(N, V, L, roughness);
                
                // Calculate specular component
                vec3 numerator = D * G * F;
                float denominator = 4.0 * max(NdotV, 0.001) * max(NdotL, 0.001);
                vec3 specular = numerator / denominator;
                
                return specular;
            }
            
            // PCF shadow mapping for smoother shadows
            float shadowCalculationPCF(vec4 fragPosLightSpace, sampler2D shadowMap, vec3 normal, vec3 lightDir) {
                // Check if PCF is disabled - fall back to basic shadow calculation
                if (!uPCFEnabled) {
                    return shadowCalculation(fragPosLightSpace, shadowMap);
                }
                
                // Perform perspective divide to get NDC coordinates
                vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
                
                // Transform to [0,1] range for texture lookup
                projCoords = projCoords * 0.5 + 0.5;
                
                // Check if position is outside the shadow map bounds
                if(projCoords.x < 0.0 || projCoords.x > 1.0 || 
                   projCoords.y < 0.0 || projCoords.y > 1.0 || 
                   projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0; // No shadow outside shadow map
                }
                
                float currentDepth = projCoords.z;

                // Flat + slope depth bias (the panel knobs). Receiver-plane handles slope per-tap, so
                // these stay small — flat covers the flat case, slope is a manual trim on top.
                // Backfacing (rawNdotL <= 0) gets ZERO slope bias, not the clamp ceiling: the old
                // max(clamp(x,0,1), 0.05) floor made backfacing fragments indistinguishable from true
                // grazing ones, so slopeTan saturated to its max across the whole backfacing hemisphere
                // instead of ramping down — a constant near-maximum bias smeared across every silhouette
                // edge (ramps, cones, cylinders), independent of the Slope Slack slider value.
                float rawNdotL = dot(normalize(normal), normalize(lightDir));
                float NdotL = max(rawNdotL, 0.05);
                // uShadowSlopeClamp <= 0 means "no clamp", not "clamp to zero" — min(x, 0.0) would zero
                // the whole slope term silently (which is why Slope Slack looked dead at Clamp = 0).
                float rawSlopeTan = sqrt(1.0 - NdotL * NdotL) / NdotL;
                float slopeTan = rawNdotL > 0.0 ? (uShadowSlopeClamp > 0.0 ? min(rawSlopeTan, uShadowSlopeClamp) : rawSlopeTan) : 0.0;
                float bias = uShadowBias + slopeTan * uShadowSlopeScaleBias;

                vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));
                vec2 planeBias = receiverPlaneDepthBias(projCoords); // depth slope per UV (auto)

                // PCSS: search for blockers to size the penumbra. uShadowSoftness is the light size
                // (max filter radius in texels). Penumbra grows with blocker distance, so contact
                // stays crisp and far shadows go soft — physical contact-hardening, not a flat blur.
                float lightSizeTexels = mix(1.0, uShadowPcssMax, clamp(uShadowSoftness, 0.0, 1.0));
                float filterRadius = lightSizeTexels;
                if (uShadowSoftness > 0.001) {
                    float avgBlocker = 0.0;
                    float blockers = 0.0;
                    for (int sx = -2; sx <= 2; ++sx) {
                        for (int sy = -2; sy <= 2; ++sy) {
                            vec2 tap = vec2(sx, sy) * (lightSizeTexels / 2.0);
                            vec2 o = tap * texelSize;
                            float d = texture(shadowMap, projCoords.xy + o).r;
                            float ref = currentDepth + dot(o, planeBias) - bias;
                            if (d < ref) { avgBlocker += d; blockers += 1.0; }
                        }
                    }
                    if (blockers < 0.5) {
                        return 1.0; // nothing between us and the light → fully lit
                    }
                    avgBlocker /= blockers;
                    float penumbra = (currentDepth - avgBlocker) / max(avgBlocker, 1e-4);
                    filterRadius = clamp(penumbra * lightSizeTexels, 1.0, lightSizeTexels);
                }

                // PCF with the penumbra-sized radius, receiver-plane-corrected per tap.
                float shadow = 0.0;
                float totalSamples = 0.0;
                int pcfRadius = max(1, uPCFSize / 2);
                for (int x = -pcfRadius; x <= pcfRadius; ++x) {
                    for (int y = -pcfRadius; y <= pcfRadius; ++y) {
                        vec2 tap = vec2(x, y) * (filterRadius / float(pcfRadius));
                        vec2 offset = tap * texelSize;
                        float pcfDepth = texture(shadowMap, projCoords.xy + offset).r;
                        float ref = currentDepth + dot(offset, planeBias) - bias;
                        shadow += ref > pcfDepth ? 0.0 : 1.0;
                        totalSamples += 1.0;
                    }
                }
                shadow /= max(1.0, totalSamples);
                return shadow;
            }

            // ===== Cascaded Shadow Map sampling =====
            // Project a world position into cascade 'layer' light space, applying that cascade's own
            // normal-offset bias (strongest on grazing surfaces). Returns [0,1] shadow-map coordinates.
            // normalOffset is passed EXPLICITLY (not read from uCascadeNormalOffset[layer]) so shadowCSM
            // can cross-fade it across a cascade seam: near the split both the near and far cascade are
            // projected with the SAME blended offset, so the normal-offset push doesn't step from one
            // cascade's value to the next mid-blend (that step was a large part of the visible seam line).
            vec3 cascadeProj(int layer, float normalOffset, vec3 worldPos, vec3 normal, vec3 lightDir) {
                // lightDir here is ALREADY "direction toward the light" (callers pass L = normalize(-uLightDir)) —
                // do NOT negate again. The extra negation flipped the sign of every n·l test in this function,
                // so it treated light-facing surfaces as backfacing and vice versa: the normal-offset ramp
                // (meant to be zero on the front face, strongest at grazing) was instead being applied with
                // the wrong sign across all CSM-rendered geometry, independent of any Bias slider value.
                vec3 nrmW = normalize(normal);
                float ndlRaw = dot(nrmW, normalize(lightDir));
                float graze = ndlRaw > 0.0 ? sqrt(max(0.0, 1.0 - ndlRaw * ndlRaw)) : 0.0;
                vec4 ls = uCascadeMatrices[layer] * vec4(worldPos + nrmW * (normalOffset * graze), 1.0);
                vec3 pc = ls.xyz / ls.w;
                return pc * 0.5 + 0.5;
            }

            // PCSS + PCF against one layer of the cascade depth array. Same filtering as the single-map
            // shadowCalculationPCF, but samples uShadowMapArray at 'layer' and takes the cascade's own
            // flat/slope bias (each cascade auto-derived its own from its own slice).
            float sampleCascadeLayer(int layer, vec3 projCoords, vec3 normal, vec3 lightDir, float flatBias, float slopeBase) {
                if (projCoords.x < 0.0 || projCoords.x > 1.0 ||
                    projCoords.y < 0.0 || projCoords.y > 1.0 ||
                    projCoords.z < 0.0 || projCoords.z > 1.0) {
                    return 1.0; // outside this cascade — caller falls back / leaves lit
                }
                float currentDepth = projCoords.z;
                float rawNdotL = dot(normalize(normal), normalize(lightDir));
                float NdotL = max(rawNdotL, 0.05);
                // uShadowSlopeClamp <= 0 means "no clamp" (see shadowCalculationPCF for why).
                float rawSlopeTan = sqrt(1.0 - NdotL * NdotL) / NdotL;
                float slopeTan = rawNdotL > 0.0 ? (uShadowSlopeClamp > 0.0 ? min(rawSlopeTan, uShadowSlopeClamp) : rawSlopeTan) : 0.0;
                float bias = flatBias + slopeTan * slopeBase;

                vec2 texelSize = 1.0 / vec2(textureSize(uShadowMapArray, 0).xy);
                vec2 planeBias = receiverPlaneDepthBias(projCoords);

                if (!uPCFEnabled) {
                    float d = texture(uShadowMapArray, vec3(projCoords.xy, float(layer))).r;
                    return currentDepth - bias > d ? 0.0 : 1.0;
                }

                // PCSS blocker search → penumbra estimate (contact-hardening), identical to the single map.
                float lightSizeTexels = mix(1.0, uShadowPcssMax, clamp(uShadowSoftness, 0.0, 1.0));
                float filterRadius = lightSizeTexels;
                if (uShadowSoftness > 0.001) {
                    float avgBlocker = 0.0;
                    float blockers = 0.0;
                    for (int sx = -2; sx <= 2; ++sx) {
                        for (int sy = -2; sy <= 2; ++sy) {
                            vec2 o = vec2(sx, sy) * (lightSizeTexels / 2.0) * texelSize;
                            float d = texture(uShadowMapArray, vec3(projCoords.xy + o, float(layer))).r;
                            float ref = currentDepth + dot(o, planeBias) - bias;
                            if (d < ref) { avgBlocker += d; blockers += 1.0; }
                        }
                    }
                    if (blockers < 0.5) {
                        return 1.0;
                    }
                    avgBlocker /= blockers;
                    float penumbra = (currentDepth - avgBlocker) / max(avgBlocker, 1e-4);
                    filterRadius = clamp(penumbra * lightSizeTexels, 1.0, lightSizeTexels);
                }

                float shadow = 0.0;
                float totalSamples = 0.0;
                int pcfRadius = max(1, uPCFSize / 2);
                for (int x = -pcfRadius; x <= pcfRadius; ++x) {
                    for (int y = -pcfRadius; y <= pcfRadius; ++y) {
                        vec2 offset = vec2(x, y) * (filterRadius / float(pcfRadius)) * texelSize;
                        float pcfDepth = texture(uShadowMapArray, vec3(projCoords.xy + offset, float(layer))).r;
                        float ref = currentDepth + dot(offset, planeBias) - bias;
                        shadow += ref > pcfDepth ? 0.0 : 1.0;
                        totalSamples += 1.0;
                    }
                }
                return shadow / max(1.0, totalSamples);
            }

            // Top-level CSM shadow: pick the cascade by view depth, sample it, and dissolve across the
            // boundary into the next cascade so the resolution step doesn't show as a hard seam.
            float shadowCSM(vec3 worldPos, vec3 normal, vec3 lightDir, float viewDepth) {
                // First cascade whose far split still contains this fragment (last one is the catch-all).
                int layer = uCascadeCount - 1;
                for (int i = 0; i < MAX_CASCADES; i++) {
                    if (i >= uCascadeCount) break;
                    if (viewDepth < uCascadeSplits[i]) { layer = i; break; }
                }

                // How close are we to THIS cascade's far split, measured in the blend band? blendT=1 at
                // (or before) the band's near edge — pure cascade loLayer; blendT=0 at the split — a
                // 50/50 mix with the next cascade. The band is TWO-SIDED about the split: fragments just
                // past the split (already in the next cascade, selected above) still see blendT>0 here
                // because their distance to the previous split is within half a band, so they blend back
                // toward the cascade they just left. Without that there was a hard step at the split.
                float blendT = 1.0;
                bool inBand = false;
                int loLayer = layer;      // the nearer of the two cascades being blended
                if (uCascadeBlendTexels > 0.0 && uShadowMapSize > 0.0) {
                    // Which split are we nearer — this cascade's far edge, or the one behind us? Blend
                    // across whichever is closer, so a fragment just past a split blends back toward the
                    // cascade it just left (two-sided band).
                    if (layer > 0 && (uCascadeSplits[layer] - viewDepth) > (viewDepth - uCascadeSplits[layer - 1])) {
                        loLayer = layer - 1;
                    }
                    if (loLayer < uCascadeCount - 1) {
                        float prevSplit = loLayer > 0 ? uCascadeSplits[loLayer - 1] : 0.0;
                        float range = max(uCascadeSplits[loLayer] - prevSplit, 1e-4);
                        float halfBand = 0.5 * (uCascadeBlendTexels / uShadowMapSize) * range;
                        // signed distance from the split: >0 on the near side (cascade loLayer), <0 past it
                        float d = uCascadeSplits[loLayer] - viewDepth;
                        blendT = clamp(0.5 + 0.5 * (d / max(halfBand, 1e-4)), 0.0, 1.0);
                        inBand = blendT < 1.0;
                    }
                }

                if (!inBand) {
                    vec3 pc = cascadeProj(layer, uCascadeNormalOffset[layer], worldPos, normal, lightDir);
                    return sampleCascadeLayer(layer, pc, normal, lightDir,
                                              uCascadeBias[layer], uCascadeSlopeBias[layer]);
                }

                // In the band: sample BOTH neighbouring cascades with the SAME blended bias / slope /
                // normal-offset, so the only thing that differs between the two samples is the cascade
                // matrix + resolution. The parameter pop that used to ride the mix is gone; each side
                // converges to the same contact point at the split, and mix() just fades resolution.
                int hi = loLayer + 1;
                float nOff  = mix(uCascadeNormalOffset[hi], uCascadeNormalOffset[loLayer], blendT);
                float fBias = mix(uCascadeBias[hi],         uCascadeBias[loLayer],         blendT);
                float sBias = mix(uCascadeSlopeBias[hi],    uCascadeSlopeBias[loLayer],    blendT);

                vec3 pcLo = cascadeProj(loLayer, nOff, worldPos, normal, lightDir);
                float sLo = sampleCascadeLayer(loLayer, pcLo, normal, lightDir, fBias, sBias);

                vec3 pcHi = cascadeProj(hi, nOff, worldPos, normal, lightDir);
                float sHi = sampleCascadeLayer(hi, pcHi, normal, lightDir, fBias, sBias);

                return mix(sHi, sLo, blendT);
            }`;

        return `#version 300 es
    precision highp float;
    precision mediump sampler2DArray;
    
    in vec3 vColor;
    in float vAlpha;
    in vec2 vTexCoord;
    in float vLighting;
    flat in float vTextureIndex;
    flat in float vUseTexture;
    in vec4 vFragPosLightSpace;
    in vec3 vNormal;
    in vec3 vTangent;
    in vec3 vBitangent;
    in vec3 vFragPos;
    in vec3 vWorldPos;  // Position in world space
    in vec3 vViewDir;   // Direction to camera
    in float vFragDepth;  // For logarithmic depth
    in float vViewDepth;  // Linear view-space depth (forward distance) — used for CSM cascade select
    flat in float vNormalMapIndex;
    flat in float vMetallicRoughnessMapIndex;
    flat in float vEmissiveMapIndex;
    
    // Texture array for albedo textures
    uniform sampler2DArray uTextureArray;
    
    // Shadow map with explicit separate binding
    // Always use sampler2D for shadow maps
    uniform sampler2D uShadowMap;
    uniform highp samplerCubeShadow uPointShadowMap;

    // ===== Cascaded Shadow Maps =====
    // MAX_CASCADES is the compile-time ceiling; it MUST match lightingConstants.AUTO_SHADOW.CSM.MAX.
    // When uCSMEnabled, the single uShadowMap path is bypassed and the fragment selects one of
    // uCascadeCount layers of uShadowMapArray by its view depth, transforming itself into that
    // cascade's light space (so each cascade carries its own matrix + geometry-derived biases).
    #define MAX_CASCADES 4
    uniform bool uCSMEnabled;
    uniform int uCascadeCount;
    uniform sampler2DArray uShadowMapArray;     // depth array, one layer per cascade
    uniform mat4 uCascadeMatrices[MAX_CASCADES];
    uniform float uCascadeSplits[MAX_CASCADES]; // far view-depth covered by each cascade
    uniform float uCascadeBias[MAX_CASCADES];   // per-cascade flat bias (geometry-derived)
    uniform float uCascadeSlopeBias[MAX_CASCADES]; // per-cascade slope bias base
    uniform float uCascadeNormalOffset[MAX_CASCADES]; // per-cascade world normal-offset magnitude
    uniform float uCascadeBlendTexels;          // dissolve-band width across a cascade boundary
    
    // Light counts
    uniform int uDirectionalLightCount;
    uniform int uPointLightCount;
    uniform int uSpotLightCount;
    
    // Light data textures - each light has multiple pixels for all properties
    uniform sampler2D uDirectionalLightData;
    uniform vec2 uDirectionalLightTextureSize;
    uniform sampler2D uPointLightData;
    uniform vec2 uPointLightTextureSize;
    
    // Directional light uniforms
    uniform bool uDirectionalLightEnabled;
    uniform vec3 uLightDir;
    uniform float uLightIntensity;
    uniform vec3 uLightColor;
    
    // Legacy point light uniforms (for backward compatibility)
    uniform vec3 uPointLightPos; 
    uniform float uPointLightIntensity;
    uniform float uLightRadius; 
    uniform vec3 uPointLightColor;
    
    // Legacy second point light uniforms
    uniform vec3 uPointLightPos1;
    uniform float uPointLightIntensity1;
    uniform float uPointLightRadius1;
    uniform vec3 uPointLightColor1;
    uniform highp samplerCubeShadow uPointShadowMap1;
    uniform bool uPointShadowsEnabled1;
    
    // Additional point light shadow maps
    uniform highp samplerCubeShadow uPointShadowMap2;
    uniform bool uPointShadowsEnabled2;
    uniform highp samplerCubeShadow uPointShadowMap3;
    uniform bool uPointShadowsEnabled3;
    
    uniform bool uShadowsEnabled;
    uniform bool uPointShadowsEnabled; // Enable point light shadows
    //uniform int uPointLightCount; // Number of point lights
    uniform float uShadowBias; // Directional shadow bias (geometry-derived: flat slack texels × texel/far)
    uniform float uShadowSlopeScaleBias; // Directional SLOPE bias base (slope slack texels × texel/far); multiplied by tan(angle)
    uniform float uShadowSlopeClamp; // Clamp on tan(angle) so grazing surfaces don't blow the slope bias up
    uniform float uShadowPcssMax; // PCSS max penumbra width in texels at full softness
    uniform float uPointShadowBias; // Point-light (cube) shadow bias — separate from directional so they don't stomp each other
    uniform float uShadowMapSize; // Shadow map size for texture calculations
    uniform float uShadowSoftness; // Controls shadow edge softness (0-1)
    uniform int uPCFSize; // Controls PCF kernel size (1, 3, 5, 7, 9)
    uniform bool uPCFEnabled; // Controls whether PCF filtering is enabled
    uniform float uFarPlane; // Far plane for logarithmic depth buffer
    uniform float uPointShadowFarPlane; // Far plane for point light 0 shadow depth comparison (= its radius)
    uniform float uPointShadowFarPlane1; // per-light: must match the far the cube map was rendered with
    uniform float uPointShadowFarPlane2;
    uniform float uPointShadowFarPlane3;
    uniform bool uDirectionalLightAttenuation; // Enable attenuation for directional lights
    uniform float uNormalMapStrength; // Normal map intensity
    
    // PBR Material properties
    uniform float uRoughness;
    uniform float uMetallic;
    uniform float uIOR;
    uniform float uTransmission;
    uniform sampler2D uMaterialPropertiesTexture;
    
    // Lighting intensity controls
    uniform float uAmbientIntensity;
    uniform vec3 uAmbientSkyColor;    // hemisphere ambient tint from above
    uniform vec3 uAmbientGroundColor; // hemisphere ambient tint from below
    uniform float uExposure;          // pre-tonemap exposure multiplier
    uniform bool uTonemapEnabled;     // ACES filmic tonemap on output
    uniform float uShadowDarkness;

    // Structures to hold light data
    struct DirectionalLight {
        vec3 position;
        vec3 direction;
        vec3 color;
        float intensity;
        bool shadowsEnabled;
    };
    
    struct PointLight {
        vec3 position;
        vec3 color;
        float intensity;
        float radius;
        bool shadowsEnabled;
    };
    
    // Functions to extract light data from textures
    DirectionalLight getDirectionalLight(int index) {
        // Each light takes 3 pixels horizontally
        int basePixel = index * 3;
        
        // Calculate UV coordinates for each pixel
        // First pixel: position + enabled
        float u1 = (float(basePixel) + 0.5) / uDirectionalLightTextureSize.x;
        // Second pixel: direction + shadowEnabled
        float u2 = (float(basePixel + 1) + 0.5) / uDirectionalLightTextureSize.x;
        // Third pixel: color + intensity
        float u3 = (float(basePixel + 2) + 0.5) / uDirectionalLightTextureSize.x;
        
        // Use centered V coordinate (there's only one row)
        float v = 0.5 / uDirectionalLightTextureSize.y;
        
        // Sample pixels from texture
        vec4 posData = texture(uDirectionalLightData, vec2(u1, v));
        vec4 dirData = texture(uDirectionalLightData, vec2(u2, v));
        vec4 colorData = texture(uDirectionalLightData, vec2(u3, v));
        
        // Create and populate the light structure
        DirectionalLight light;
        light.position = posData.xyz;
        light.direction = dirData.xyz;
        light.color = colorData.rgb;
        light.intensity = colorData.a;
        light.shadowsEnabled = dirData.a > 0.5;
        
        return light;
    }
    
    PointLight getPointLight(int index) {
        // Each light takes 3 pixels horizontally
        int basePixel = index * 3;
        
        // Calculate UV coordinates for each pixel
        // First pixel: position + enabled
        float u1 = (float(basePixel) + 0.5) / uPointLightTextureSize.x;
        // Second pixel: color + intensity
        float u2 = (float(basePixel + 1) + 0.5) / uPointLightTextureSize.x;
        // Third pixel: radius + shadowEnabled + padding
        float u3 = (float(basePixel + 2) + 0.5) / uPointLightTextureSize.x;
        
        // Use centered V coordinate (there's only one row)
        float v = 0.5 / uPointLightTextureSize.y;
        
        // Sample pixels from texture
        vec4 posData = texture(uPointLightData, vec2(u1, v));
        vec4 colorData = texture(uPointLightData, vec2(u2, v));
        vec4 radiusData = texture(uPointLightData, vec2(u3, v));
        
        // Create and populate the light structure
        PointLight light;
        light.position = posData.xyz;
        light.color = colorData.rgb;
        light.intensity = colorData.a;
        light.radius = radiusData.r;
        light.shadowsEnabled = radiusData.g > 0.5;
        
        return light;
    }
    
    out vec4 fragColor;
    
    // Shadow mapping functions
    ${shadowFunctions}
    
    // Normal mapping functions
    ${this.normalMappingFunctions}
    
    // Point light shadow functions
    // Calculate shadow for omnidirectional point light with cubemap shadow
    float pointShadowCalculation(vec3 fragPos, vec3 lightPos, highp samplerCubeShadow shadowMap, float farPlane) {
        // Calculate fragment-to-light vector
        vec3 fragToLight = fragPos - lightPos;
        
        // Get current distance from fragment to light
        float currentDepth = length(fragToLight);
        
        // Normalize to [0,1] range using far plane
        currentDepth = currentDepth / farPlane;

        // Apply bias (point-light bias, separate uniform from the directional one)
        float bias = uPointShadowBias;

        // Hardware depth comparison (texture params set COMPARE_MODE + COMPARE_FUNC)
        // Returns 1.0 if passes comparison, 0.0 if fails
        float shadow = texture(shadowMap, vec4(fragToLight, currentDepth - bias));

        return shadow;
    }
    
    // PCF shadow calculation for omnidirectional point light
    float pointShadowCalculationPCF(vec3 fragPos, vec3 lightPos, highp samplerCubeShadow shadowMap, float farPlane) {
        // Check if PCF is disabled - fall back to basic shadow calculation
        if (!uPCFEnabled) {
            return pointShadowCalculation(fragPos, lightPos, shadowMap, farPlane);
        }
        
        // Calculate fragment-to-light vector (will be used as cubemap direction)
        vec3 fragToLight = fragPos - lightPos;
        
        // Get current distance from fragment to light
        float currentDepth = length(fragToLight);
        
        // Normalize to [0,1] range using far plane
        currentDepth = currentDepth / farPlane;
        
        // Apply bias from uniform (point-light bias, decoupled from directional + softness)
        float bias = uPointShadowBias;

        // Softness factor for PCF sampling spread (0 = hard, 1 = soft)
        float softnessFactor = clamp(uShadowSoftness, 0.0, 1.0);
        
        // Set up PCF sampling
        float shadow = 0.0;
        int samples = 0;
        float diskRadius = 0.01 * softnessFactor; // Radius of sampling cone based on softness (0-1)
        
        // Generate a tangent space TBN matrix for sampling in a cone
        vec3 absFragToLight = abs(fragToLight);
        vec3 tangent, bitangent;
        
        // Find least used axis to avoid precision issues
        if (absFragToLight.x <= absFragToLight.y && absFragToLight.x <= absFragToLight.z) {
            tangent = vec3(0.0, fragToLight.z, -fragToLight.y);
        } else if (absFragToLight.y <= absFragToLight.x && absFragToLight.y <= absFragToLight.z) {
            tangent = vec3(fragToLight.z, 0.0, -fragToLight.x);
        } else {
            tangent = vec3(fragToLight.y, -fragToLight.x, 0.0);
        }
        
        tangent = normalize(tangent);
        bitangent = normalize(cross(fragToLight, tangent));
        
        // Determine sample count based on PCF size
        int pcfRadius = uPCFSize / 2;
        int maxSamples = (pcfRadius * 2 + 1) * (pcfRadius * 2 + 1);
        
        for (int i = 0; i < maxSamples; i++) {
            // Skip if we exceed the requested PCF size
            int x = (i % 9) - 4;
            int y = (i / 9) - 4;
            
            if (abs(x) <= pcfRadius && abs(y) <= pcfRadius) {
                // Generate offset direction based on x, y grid position
                float angle = float(x) * (3.14159265359 / float(pcfRadius + 1)); // Convert x to angle
                float distance = float(y) + 0.1; // Add small offset to avoid zero
                
                // Calculate offset direction in tangent space
                vec3 offset = tangent * (cos(angle) * distance * diskRadius) + 
                              bitangent * (sin(angle) * distance * diskRadius);
                
                // Sample from the cubemap with offset and hardware comparison
                 vec3 sampleDir = normalize(fragToLight + offset);
                 shadow += texture(shadowMap, vec4(sampleDir, currentDepth - bias));
                samples++;
            }
        }
        
        // Average all samples
        shadow /= float(max(samples, 1));
        
        return shadow;
    }
    
    void main() {
        // Base color calculation
        vec4 baseColor;
        if (vUseTexture > 0.5) {  // Check if this fragment uses texture
            baseColor = texture(uTextureArray, vec3(vTexCoord, vTextureIndex));
            baseColor.a *= vAlpha;  // Apply triangle alpha to textured fragments
            baseColor.rgb *= vColor;  // per-vertex tint (e.g. baked AO); no-op when vColor is white
        } else {
            baseColor = vec4(vColor, vAlpha);
        }
        // Linear workflow: decode authored sRGB albedo to linear before any lighting math.
        baseColor.rgb = sRGBToLinear(baseColor.rgb);
        
        // Sample normal map if available
        vec3 surfaceNormal = normalize(vNormal);
        int normalMapIdx = int(vNormalMapIndex);
        if (normalMapIdx >= 0) {
            vec3 sampledNormal = sampleNormalMap(uTextureArray, normalMapIdx, vTexCoord, vNormal, vTangent, vBitangent);
            // Blend between surface normal and sampled normal based on strength
            surfaceNormal = normalize(mix(surfaceNormal, sampledNormal, uNormalMapStrength));
        }
        
        // Sample emissive map if available
        vec3 emissiveColor = vec3(0.0);
        int emissiveMapIdx = int(vEmissiveMapIndex);
        if (emissiveMapIdx >= 0) {
            emissiveColor = sRGBToLinear(texture(uTextureArray, vec3(vTexCoord, emissiveMapIdx)).rgb);
        }
        
        // Compute PBR lighting
        vec3 N = surfaceNormal;
        vec3 V = normalize(vViewDir);
        vec3 L = normalize(-uLightDir);
        
        // Get material properties
        float roughness = uRoughness;
        float metallic = uMetallic;
        float ior = uIOR;
        float transmission = uTransmission;
        float volumeThickness = 0.0;
        float attenuationDistance = 1.0;
        vec3 volumeColor = vec3(1.0);
        
        if (vUseTexture > 0.5) {
            // Sample per-texture material properties
            // Texture is tripled width to store 12 channels (3 RGBA samples per texture)
            float textureSize = float(textureSize(uMaterialPropertiesTexture, 0).x);
            float textureSampleIndex = vTextureIndex * 3.0; // Each texture occupies 3 slots
            float textureCoord = (textureSampleIndex + 0.5) / textureSize;
            float sampleOffset = 1.0 / textureSize;
            
            // First sample: roughness, metallic, ior, transmission
            vec4 materialProps = texture(uMaterialPropertiesTexture, vec2(textureCoord, 0.5));
            roughness = materialProps.r;
            metallic = materialProps.g;
            ior = materialProps.b;
            transmission = materialProps.a;
            
            // Second sample: volumeThickness, volumeAttenuationDistance, volumeColor.r, volumeColor.g
            vec4 volumeProps = texture(uMaterialPropertiesTexture, vec2(textureCoord + sampleOffset, 0.5));
            volumeThickness = volumeProps.r;
            attenuationDistance = volumeProps.g;
            volumeColor.r = volumeProps.b;
            volumeColor.g = volumeProps.a;
            
            // Third sample: volumeColor.b
            vec4 volumeProps2 = texture(uMaterialPropertiesTexture, vec2(textureCoord + sampleOffset * 2.0, 0.5));
            volumeColor.b = volumeProps2.r;
        }
        
        // Calculate F0 from IOR: F0 = ((n - 1) / (n + 1))^2
        float f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
        vec3 baseF0 = mix(vec3(f0), baseColor.rgb, metallic);
        
        // Calculate specular BRDF
        vec3 specular = specularBRDF(N, L, V, baseF0, roughness);
        
        // Diffuse component with metallic
        vec3 kD = (vec3(1.0) - specular) * (1.0 - metallic);
        
        // Calculate shadow factor. CSM picks a cascade by view depth and samples the depth array;
        // otherwise the single fitted map drives it (vFragPosLightSpace was built in the vertex shader).
        float shadow = 1.0;
        if (uShadowsEnabled) {
            float shadowFactor = uCSMEnabled
                ? shadowCSM(vWorldPos, N, L, vViewDepth)
                : shadowCalculationPCF(vFragPosLightSpace, uShadowMap, N, L);
            shadow = 1.0 - (1.0 - shadowFactor) * uShadowDarkness;
        }
        
        // Hemisphere ambient — sky/ground indirect fill. Kept SEPARATE from the shadow term below
        // (shadow occludes the sun, not the sky), so shadowed areas don't go dead-flat.
        vec3 ambient = hemisphereAmbient(N);

        // Direct sun diffuse
        vec3 lightColor = length(uLightColor) > 0.0 ? uLightColor : vec3(0.3);
        float diffuse = max(dot(N, L), 0.0);
        vec3 diffuseLighting = lightColor * diffuse * max(uLightIntensity, 1.0);
        
        // Calculate point light contributions
        vec3 pointLightColors = vec3(0.0);
        
        // Process all point lights from the data texture with PBR
        for (int i = 0; i < uPointLightCount; i++) {
            if (i >= 100) break;
            
            PointLight light = getPointLight(i);
            
            // Direction from fragment to point light
            vec3 pointL = normalize(light.position - vWorldPos);
            float pointNdotL = max(dot(N, pointL), 0.0);
            
            // Distance attenuation
            float pointDistance = length(vWorldPos - light.position);
            float pointAttenuation = pointFalloff(pointDistance, light.radius);
            
            // PBR specular for point light
            vec3 pointSpecular = specularBRDF(N, pointL, V, baseF0, roughness);
            vec3 pointKD = (vec3(1.0) - pointSpecular) * (1.0 - metallic);
            
            // Shadow for point light
            float pointShadow = 1.0;
            if (light.shadowsEnabled) {
                int lightIdx = i % 4;
                switch(lightIdx) {
                    case 0:
                        if (uPointShadowsEnabled) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap, uPointShadowFarPlane);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 1:
                        if (uPointShadowsEnabled1) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap1, uPointShadowFarPlane1);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 2:
                        if (uPointShadowsEnabled2) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap2, uPointShadowFarPlane2);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                    case 3:
                        if (uPointShadowsEnabled3) {
                            float pointShadowFactor = pointShadowCalculationPCF(vFragPos, light.position, uPointShadowMap3, uPointShadowFarPlane3);
                            pointShadow = 1.0 - (1.0 - pointShadowFactor) * 0.8;
                        }
                        break;
                }
            }
            
            // PBR point light contribution
            pointLightColors += (pointKD * baseColor.rgb * RECIPROCAL_PI + pointSpecular) * pointNdotL * 
                    light.intensity * pointAttenuation * pointShadow * light.color;
        }
        
        
        // Direct sun (diffuse + specular), occluded by the shadow term ONLY.
        vec3 directLit = uDirectionalLightEnabled ? (diffuseLighting * baseColor.rgb + specular) * shadow : vec3(0.0);
        // Ambient/indirect fill — NOT shadowed (this is the decouple/bug-fix).
        vec3 ambientLit = ambient * baseColor.rgb;
        vec3 color = directLit + ambientLit;

        // Add point lights (each already occluded by its own shadow + attenuation)
        if (uPointLightCount > 0) {
            color += pointLightColors;
        }
        
        // Add emissive
        color += emissiveColor;
        
        // Apply volume absorption effect
        // Volume absorbs light based on thickness and attenuation properties
        if (volumeThickness > 0.0) {
            // Calculate absorption factor: stronger with higher thickness, weaker with higher attenuation distance
            float absorptionFactor = (volumeThickness * volumeThickness) / (1.0 + attenuationDistance);
            
            // Apply volumetric absorption: tint color by volume color and reduce brightness
            color = mix(color, color * volumeColor, absorptionFactor * 0.5);
            
            // Reduce overall brightness based on absorption (darker with more thickness)
            color *= (1.0 - absorptionFactor * 0.3);
        }
        
        // Apply transmission: reduce alpha based on transmission factor
        // transmission = 0.0: fully opaque (alpha = 1.0)
        // transmission = 1.0: fully transparent (alpha reduced significantly)
        float finalAlpha = baseColor.a * (1.0 - transmission);

        // Apply transmission effect: reduce specular highlights for transparent materials
        if (transmission > 0.0) {
            // For transparent materials, reduce specular contribution
            color *= (1.0 - transmission * 0.3);
        }

        // Linear HDR -> display: exposure, optional ACES filmic tonemap, then sRGB encode.
        color *= uExposure;
        if (uTonemapEnabled) {
            color = acesTonemap(color);
        }
        color = linearToSRGB(color);

        fragColor = vec4(color, finalAlpha);
        
        // Logarithmic depth buffer encoding
        // Increases precision for distant fragments
        // Formula: log2(depth) / log2(farPlane + 1.0)
        float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
        gl_FragDepth = logDepth;
    }`;
    }

    //--------------------------------------------------------------------------
    // VIRTUALBOY SHADER VARIANT
    //--------------------------------------------------------------------------

    /**
     * VirtualBoy vertex shader
     * @returns {string} - Vertex shader source code
     */
    getVirtualBoyVertexShader() {
        return `#version 300 es
        in vec3 aPosition;
        in vec3 aNormal;
        in vec3 aColor;
        in float aAlpha;
        
        // Skeletal animation attributes
        in ivec4 aBoneIndices;
        in vec4 aBoneWeights;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform vec3 uModelPos;
        uniform vec4 uModelRotation;
        uniform vec3 uModelScale;
        uniform vec3 uLightDir;
        
        // Bone matrices for skeletal animation (max 256 bones)
        layout(std140) uniform BoneMatrices {
            mat4 matrices[256];
        } boneData;
        
        flat out float vLighting;
        out vec3 vBarycentricCoord;
        out float vAlpha;
        out float vFragDepth;  // For logarithmic depth buffer
        
        ${this.getMatrixConstructionHelpers()}
        
        void main() {
            // Apply skeletal animation if bone weights are present
            vec3 skinnedPosition = aPosition;
            vec3 skinnedNormal = aNormal;
            
            float totalWeight = aBoneWeights.x + aBoneWeights.y + aBoneWeights.z + aBoneWeights.w;
            if (totalWeight > 0.001) {
                // Normalize weights in case they don't sum to 1.0
                vec4 normalizedWeights = aBoneWeights / totalWeight;
                
                skinnedPosition = vec3(0.0);
                skinnedNormal = vec3(0.0);
                
                // Apply up to 4 bone influences
                for (int i = 0; i < 4; i++) {
                    mat4 boneMatrix = boneData.matrices[aBoneIndices[i]];
                    skinnedPosition += (boneMatrix * vec4(aPosition, 1.0)).xyz * normalizedWeights[i];
                    skinnedNormal += (boneMatrix * vec4(aNormal, 0.0)).xyz * normalizedWeights[i];
                }
            }
            
            mat4 modelMatrix = buildModelMatrix(uModelPos, uModelRotation, uModelScale);
            vec4 worldPos = modelMatrix * vec4(skinnedPosition, 1.0);
            gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
            vec3 worldNormal = normalize(quaternionToMatrix(uModelRotation) * skinnedNormal);
            // Negate light direction to be consistent with other shaders
            vLighting = max(0.3, min(1.0, dot(worldNormal, normalize(-uLightDir))));
            
            vAlpha = aAlpha;
            float id = float(gl_VertexID % 3);
            vBarycentricCoord = vec3(id == 0.0, id == 1.0, id == 2.0);
            
            // Store depth for logarithmic depth buffer
            vFragDepth = 1.0 + gl_Position.w;
        }`;
    }

    /**
     * VirtualBoy fragment shader
     * @returns {string} - Fragment shader source code
     */
    getVirtualBoyFragmentShader() {
        return `#version 300 es
        precision mediump float;
        flat in float vLighting;
        in vec3 vBarycentricCoord;
        in float vAlpha;
        in float vFragDepth;  // For logarithmic depth buffer
        out vec4 fragColor;
        
        uniform float uFarPlane;  // For logarithmic depth
        
        void main() {
            float edgeWidth = 1.0;
            vec3 d = fwidth(vBarycentricCoord);
            vec3 a3 = smoothstep(vec3(0.0), d * edgeWidth, vBarycentricCoord);
            float edge = min(min(a3.x, a3.y), a3.z);
            
            if (edge < 0.9) {
                fragColor = vec4(1.0, 0.0, 0.0, vAlpha) * vLighting;
            } else {
                fragColor = vec4(0.0, 0.0, 0.0, vAlpha);
            }
            
            // Logarithmic depth buffer encoding
            float logDepth = log2(vFragDepth) / log2(uFarPlane + 1.0);
            gl_FragDepth = logDepth;
        }`;
    }
}
