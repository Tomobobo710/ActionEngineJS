//actionengine/geometry/modelregistry.js
/**
 * ModelRegistry - Global registry for loaded ActionModelPackages
 * 
 * Stores ActionModel3D instances indexed by model name.
 * Used by ModelIndex.js (generated) to register models when loaded.
 * Used by ModelLoaderManager to retrieve models for rendering.
 */
class ModelRegistry {
    /**
     * Internal storage for registered models
     * Map: modelName (string) -> ActionModel3D
     */
    static #registry = new Map();

    /**
     * Internal storage for module data (meshes, materials, animations, textures)
     * Map: moduleName (string) -> module data object
     * Used during ActionModelPackage loading
     */
    static #modules = new Map();

    /**
     * Register an ActionModel3D in the registry
     * @param {string} modelName - Unique name for the model
     * @param {ActionModel3D} actionModel3D - The model to register
     * @throws {Error} If modelName is not a string or actionModel3D is not ActionModel3D
     */
    static register(modelName, actionModel3D) {
        if (typeof modelName !== 'string' || !modelName.trim()) {
            throw new Error('ModelRegistry.register: modelName must be a non-empty string');
        }
        
        if (!actionModel3D || typeof actionModel3D !== 'object') {
            throw new Error('ModelRegistry.register: actionModel3D must be an ActionModel3D instance');
        }

        this.#registry.set(modelName, actionModel3D);
        console.log(`ModelRegistry: Registered model "${modelName}" with ${actionModel3D.objects?.length || 0} objects`);
    }

    /**
     * Retrieve a registered ActionModel3D
     * @param {string} modelName - Name of the model to retrieve
     * @returns {ActionModel3D|null} The registered model, or null if not found
     */
    static get(modelName) {
        const model = this.#registry.get(modelName);
        if (!model) {
            console.warn(`ModelRegistry: Model "${modelName}" not found in registry`);
            return null;
        }
        return model;
    }

    /**
     * Check if a model is registered
     * @param {string} modelName - Name of the model to check
     * @returns {boolean} True if model is registered
     */
    static exists(modelName) {
        return this.#registry.has(modelName);
    }

    /**
     * Get all registered models (useful for debugging)
     * @returns {Map<string, ActionModel3D>} Map of all registered models
     */
    static getAll() {
        return new Map(this.#registry); // Return a copy to prevent external modification
    }

    /**
     * Unregister a model
     * @param {string} modelName - Name of the model to unregister
     * @returns {boolean} True if model was registered and removed
     */
    static clear(modelName) {
        const hadModel = this.#registry.has(modelName);
        this.#registry.delete(modelName);
        if (hadModel) {
            console.log(`ModelRegistry: Unregistered model "${modelName}"`);
        }
        return hadModel;
    }

    /**
     * Clear all registered models
     */
    static clearAll() {
        this.#registry.clear();
        console.log(`ModelRegistry: Cleared all registered models`);
    }

    /**
     * Get list of all registered model names
     * @returns {string[]} Array of model names
     */
    static listNames() {
        return Array.from(this.#registry.keys());
    }

    /**
     * Get count of registered models
     * @returns {number} Number of registered models
     */
    static count() {
        return this.#registry.size;
    }

    /**
     * Register module data (mesh, materials, animations, textures)
     * @param {string} moduleName - Name of the module (e.g., 'mesh_object_0', 'materials', 'animations')
     * @param {Object} data - The module data
     */
    static registerModule(moduleName, data) {
        this.#modules.set(moduleName, data);
    }

    /**
     * Retrieve registered module data
     * @param {string} moduleName - Name of the module to retrieve
     * @returns {Object|null} The module data, or null if not found
     */
    static getModule(moduleName) {
        const data = this.#modules.get(moduleName);
        if (!data) {
            console.warn(`ModelRegistry: Module "${moduleName}" not found`);
            return null;
        }
        return data;
    }

    /**
     * Check if a module is registered
     * @param {string} moduleName - Name of the module to check
     * @returns {boolean} True if module is registered
     */
    static hasModule(moduleName) {
        return this.#modules.has(moduleName);
    }

    /**
     * Clear all module data (call after model is reconstructed)
     */
    static clearModules() {
        this.#modules.clear();
    }
}
