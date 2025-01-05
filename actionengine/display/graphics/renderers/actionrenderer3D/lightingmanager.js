// actionengine/display/graphics/renderers/actionrenderer3D/lightingmanager.js
class LightingManager {
    constructor(gl, isWebGL2) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;

        // Shadow map setup
        this.shadowMapSize = 2048;
        this.shadowFramebuffer = this.gl.createFramebuffer();
        this.shadowMap = this.gl.createTexture();
        
        // Light matrices
        this.lightView = Matrix4.create();
        this.lightSpaceMatrix = Matrix4.create();
        this.lightProjection = Matrix4.create();

        
        
        this.currentLightConfig = {
            POSITION: {
                x: 0,
                y: 10000,
                z: 0
            },
            DIRECTION: {
                x: 0.5,
                y: 1.0,
                z: 0.5
            },
            INTENSITY: 20000,
            MATERIAL: {
                ROUGHNESS: 0.2,
                METALLIC: 0.1,
                BASE_REFLECTIVITY: 0.5
            },
            SHADOW: {
                FRUSTUM_SIZE: 1,
                BIAS: 0.04,
                DARKNESS: 0.5
            }
        };
        
        // Light properties idk what this shit even is bro
        

        this.lightPos = new Vector3(
            this.currentLightConfig.POSITION.x,
            this.currentLightConfig.POSITION.y,
            this.currentLightConfig.POSITION.z
        );
        
        // Frame counter for light updates
        this.frameCount = 0;

        // Initialize everything
        this.setupShadowMap();
    }

    getLightConfig() {
        return this.currentLightConfig;
    }

    setupShadowMap() {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.shadowMap);

        if (this.isWebGL2) {
            this.gl.texImage2D(
                this.gl.TEXTURE_2D,
                0,
                this.gl.DEPTH_COMPONENT24,
                this.shadowMapSize,
                this.shadowMapSize,
                0,
                this.gl.DEPTH_COMPONENT,
                this.gl.UNSIGNED_INT,
                null
            );

            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_COMPARE_MODE, this.gl.COMPARE_REF_TO_TEXTURE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_COMPARE_FUNC, this.gl.LEQUAL);
        } else {
            this.gl.texImage2D(
                this.gl.TEXTURE_2D,
                0,
                this.gl.DEPTH_COMPONENT,
                this.shadowMapSize,
                this.shadowMapSize,
                0,
                this.gl.DEPTH_COMPONENT,
                this.gl.UNSIGNED_SHORT,
                null
            );
        }

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.shadowFramebuffer);
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.DEPTH_ATTACHMENT,
            this.gl.TEXTURE_2D,
            this.shadowMap,
            0
        );

        this.gl.drawBuffers([this.gl.NONE]);
        this.gl.readBuffer(this.gl.NONE);

        if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
            console.error("[LightingManager] Framebuffer is not complete!");
        }

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }

    updateLightMatrix() {
        const config = this.getLightConfig();

        Matrix4.ortho(
            this.lightProjection,
            -config.SHADOW.FRUSTUM_SIZE,
            config.SHADOW.FRUSTUM_SIZE,
            -config.SHADOW.FRUSTUM_SIZE,
            config.SHADOW.FRUSTUM_SIZE,
            -config.SHADOW.FRUSTUM_SIZE,
            config.SHADOW.FRUSTUM_SIZE
        );

        // Use raw position instead of scaled direction
        const lightPos = [
            this.lightPos.x,
            this.lightPos.y,
            this.lightPos.z
        ];

        const target = [0, 0, 0];
        const up = [0, 1, 0];

        Matrix4.lookAt(this.lightView, lightPos, target, up);
        Matrix4.multiply(this.lightSpaceMatrix, this.lightProjection, this.lightView);
    }

    // Accessors
    getShadowFramebuffer() {
        return this.shadowFramebuffer;
    }

    getShadowMap() {
        return this.shadowMap;
    }

    getShadowMapSize() {
        return this.shadowMapSize;
    }

    getLightSpaceMatrix() {
        return this.lightSpaceMatrix;
    }

    getLightDir() {
        return  new Vector3(
            this.currentLightConfig.DIRECTION.x,
            this.currentLightConfig.DIRECTION.y,
            this.currentLightConfig.DIRECTION.z
        ).normalize();
    }

    // Method to handle frame updates
    update() {
        this.frameCount++;
        // Only update light matrix according to frequency
        if (this.frameCount % this.getLightConfig().UPDATE_FREQ === 0) {
            this.updateLightMatrix();
        }
    }
}