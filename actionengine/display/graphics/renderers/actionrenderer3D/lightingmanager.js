// actionengine/display/graphics/renderers/actionrenderer3D/lightingmanager.js
class LightingManager {
    constructor(gl, isWebGL2) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;
        
        // Matrix for debug panel compatibility
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
        };    

        this.lightPos = new Vector3(
            this.currentLightConfig.POSITION.x,
            this.currentLightConfig.POSITION.y,
            this.currentLightConfig.POSITION.z
        );
        
        // Frame counter for light updates
        this.frameCount = 0;
    }

    getLightConfig() {
        return this.currentLightConfig;
    }

    // For debug panel
    updateLightMatrix() {
        // Just update the light position from config
        this.lightPos.x = this.currentLightConfig.POSITION.x;
        this.lightPos.y = this.currentLightConfig.POSITION.y;
        this.lightPos.z = this.currentLightConfig.POSITION.z;
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

    update() {
        this.frameCount++;
        
        if (this._lastPosition === undefined || 
            this._lastPosition.x !== this.currentLightConfig.POSITION.x ||
            this._lastPosition.y !== this.currentLightConfig.POSITION.y ||
            this._lastPosition.z !== this.currentLightConfig.POSITION.z) {
            
            this.updateLightMatrix();
            
            // Cache position after update
            this._lastPosition = {
                x: this.currentLightConfig.POSITION.x,
                y: this.currentLightConfig.POSITION.y,
                z: this.currentLightConfig.POSITION.z
            };
        }
    }
}