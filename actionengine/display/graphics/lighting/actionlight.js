// actionengine/display/graphics/lighting/actionlight.js

/**
 * Base class for all light types in the ActionEngine
 * This serves as an abstract class that defines the interface for different light types
 */
class ActionLight {
    /**
     * Constructor for the base light class
     * @param {WebGLRenderingContext} gl - The WebGL rendering context
     * @param {boolean} isWebGL2 - Flag indicating if WebGL2 is available
     */
    constructor(gl, isWebGL2) {
        this.gl = gl;
        this.isWebGL2 = isWebGL2;
        
        // Reference to global lighting constants
        this.constants = window.lightingConstants || {};
        
        // Basic light properties
        this.position = window.Vector3 ? new window.Vector3(0, 0, 0) : { x: 0, y: 0, z: 0 };
        this.color = window.Vector3 ? new window.Vector3(1, 1, 1) : { x: 1, y: 1, z: 1 };  // White light by default
        this.intensity = 1.0;
        
        // Shadow capability flag
        this.castsShadows = false;
        
        // For tracking changes between frames
        this._lastPosition = undefined;
        this._lastIntensity = undefined;
    }
    
    /**
     * Set the light position
     * @param {Vector3} position - The new position
     */
    setPosition(position) {
        // Use copy if it exists, otherwise fall back to direct assignment
        if (typeof this.position.copy === 'function') {
            this.position.copy(position);
        } else {
            this.position.x = position.x;
            this.position.y = position.y;
            this.position.z = position.z;
        }
    }
    
    /**
     * Get the light position
     * @returns {Vector3} - The current position
     */
    getPosition() {
        return this.position;
    }
    
    /**
     * Get the shadow texture for this light (if it exists)
     * @returns {WebGLTexture|null} - The shadow texture or null if there isn't one
     */
    getShadowsEnabled() {
        return this.castsShadows;
    }
    
    /**
     * Set the light color
     * @param {Vector3} color - RGB color vector (values 0-1)
     */
    setColor(color) {
        // Use copy if it exists, otherwise fall back to direct assignment
        if (typeof this.color.copy === 'function') {
            this.color.copy(color);
        } else {
            this.color.x = color.x;
            this.color.y = color.y;
            this.color.z = color.z;
        }
    }
    
    /**
     * Get the light color
     * @returns {Vector3} - The current color
     */
    getColor() {
        return this.color;
    }
    
    /**
     * Set the light intensity
     * @param {number} intensity - The new intensity value
     */
    setIntensity(intensity) {
        this.intensity = intensity;
    }
    
    /**
     * Get the light intensity
     * @returns {number} - The current intensity
     */
    getIntensity() {
        return this.intensity;
    }
    
    /**
     * Enable or disable shadow casting for this light
     * @param {boolean} enabled - Whether shadows should be cast
     */
    setShadowsEnabled(enabled) {
        this.castsShadows = enabled;
    }
    
    /**
     * Update the light's internal state
     * This should be called once per frame
     * @returns {boolean} - Whether any properties changed this frame
     */
    update() {
        let changed = false;
        
        // Check if light position has changed
        if (this._lastPosition === undefined || 
            this._lastPosition.x !== this.position.x ||
            this._lastPosition.y !== this.position.y ||
            this._lastPosition.z !== this.position.z) {
            
            // Cache current position to detect changes
            this._lastPosition = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z
            };
            
            changed = true;
        }
        
        // Track intensity changes
        if (this._lastIntensity === undefined ||
            Math.abs(this._lastIntensity - this.intensity) > 0.0001) {
            
            this._lastIntensity = this.intensity;
            changed = true;
        }
        
        return changed;
    }
    
    /**
     * Sync light properties with global constants
     * This should be implemented by subclasses
     */
    syncWithConstants() {
        // Base implementation does nothing
        // Subclasses should override this
    }
    
    /**
     * Setup shadow mapping resources
     * This should be implemented by subclasses
     */
    setupShadowMap() {
        // Base implementation does nothing
        // Subclasses should override this
    }
    
    /**
     * Begin shadow rendering pass for this light
     * This should be implemented by subclasses
     */
    beginShadowPass() {
        // Base implementation does nothing
        // Subclasses should override this
    }
    
    /**
     * End shadow rendering pass for this light
     * This should be implemented by subclasses
     */
    endShadowPass() {
        // Base implementation does nothing
        // Subclasses should override this
    }
    
    /**
     * Render a single object to this light's shadow map
     * This should be implemented by subclasses
     * @param {object} object - The object to render to the shadow map
     */
    renderObjectToShadowMap(object) {
        // Base implementation does nothing
        // Subclasses should override this
    }
    
    /**
     * Apply this light's uniforms to a shader program
     * This should be implemented by subclasses
     * @param {WebGLProgram} program - The shader program
     * @param {number} index - Index of this light in an array of lights
     */
    applyToShader(program, index) {
        // Base implementation does nothing
        // Subclasses should override this
    }
    
    /**
     * Cleanup resources used by this light
     * This should be called when the light is no longer needed
     */
    dispose() {
        // Base implementation does nothing
        // Subclasses should override to free GL resources
    }
}

// Make ActionLight available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.ActionLight = ActionLight;
}

export { ActionLight };