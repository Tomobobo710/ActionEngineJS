// actionengine/math/geometry/modelcodegenerator.js

/**
 * ModelCodeGenerator converts GLB models into ActionEngine Triangle-based code.
 * This outputs ActionEngine Model Format - clean Triangle[] code instead of base64.
 */
class ModelCodeGenerator {
    
    /**
     * Generate ActionEngine Triangle code from GLB file
     * @param {string} base64Data - GLB file as base64 string
     * @param {string} modelName - Name for the generated function
     * @param {Object} options - Generation options
     * @returns {string} Complete JavaScript code for the model
     */
    static generateFromGLB(base64Data, modelName = null, options = {}) {
        // Generate generic name if none provided
        if (!modelName) {
            const timestamp = Date.now().toString(36);
            modelName = `Model_${timestamp}`;
        }
        
        try {
            // Load GLB model using ActionEngine GLBLoader
            const glbModel = GLBLoader.loadModel(base64Data);
            
            // Generate Triangle-based code directly from GLB triangles
            return ModelCodeGenerator.generateTriangleCode(glbModel.triangles, modelName, options);
        } catch (error) {
            console.error('ActionEngine model code generation failed:', error);
            throw error;
        }
    }
    
    /**
     * Generate ActionEngine Triangle code from Triangle array
     * @param {Triangle[]} triangles - Array of Triangle objects
     * @param {string} modelName - Function name for the model
     * @param {Object} options - Code generation options
     * @returns {string} Complete JavaScript function code
     */
    static generateTriangleCode(triangles, modelName, options = {}) {
        const timestamp = new Date().toISOString();
        
        let code = `// Generated ActionEngine Model: ${modelName}\n`;
        code += `// Created: ${timestamp}\n`;
        code += `createTriangles() {\n`;
        code += `    return [\n`;
        
        triangles.forEach((triangle, i) => {
            const v1 = triangle.vertices[0];
            const v2 = triangle.vertices[1];
            const v3 = triangle.vertices[2];
            const color = triangle.color || "#808080";
            
            code += `        new Triangle(\n`;
            code += `            new Vector3(${v1.x.toFixed(6)}, ${v1.y.toFixed(6)}, ${v1.z.toFixed(6)}),\n`;
            code += `            new Vector3(${v2.x.toFixed(6)}, ${v2.y.toFixed(6)}, ${v2.z.toFixed(6)}),\n`;
            code += `            new Vector3(${v3.x.toFixed(6)}, ${v3.y.toFixed(6)}, ${v3.z.toFixed(6)}),\n`;
            code += `            "${color}"\n`;
            code += `        )${i < triangles.length - 1 ? ',' : ''}\n`;
        });
        
        code += `    ];\n`;
        code += `}\n`;
        
        return code;
    }
    
    /**
     * Export Triangle code as downloadable file
     * @param {Triangle[]} triangles - Array of Triangle objects
     * @param {string} modelName - Name for the model
     */
    static exportTriangleCode(triangles, modelName) {
        const code = ModelCodeGenerator.generateTriangleCode(triangles, modelName);
        
        // Download the file
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${modelName}.js`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    /**
     * Export GLB model as ActionEngine Triangle code
     * @param {string} base64Data - GLB file as base64 string
     * @param {string} modelName - Name for the model
     */
    static exportGLBAsCode(base64Data, modelName) {
        const glbModel = GLBLoader.loadModel(base64Data);
        ModelCodeGenerator.exportTriangleCode(glbModel.triangles, modelName);
    }
}