// actionengine/math/geometry/modelcodegenerator.js

/**
 * ModelCodeGenerator converts GLB models into ActionEngine procedural geometry code.
 * Creates human-readable, git-friendly, debuggable geometry definitions.
 * This becomes the ActionEngine Model Format - clean code instead of base64.
 */
class ModelCodeGenerator {
    
    /**
     * Generate ActionEngine geometry code from GLB file
     * @param {string} base64Data - GLB file as base64 string
     * @param {string} modelName - Name for the generated function (optional)
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
            // Load GLB model
            const glbModel = GLBLoader.loadModel(base64Data);
            
            // Convert to ActionEngine geometry format
            const geometry = ModelCodeGenerator.convertGLBToGeometry(glbModel);
            
            // Generate code
            return ModelCodeGenerator.generateGeometryCode(geometry, modelName, options);
        } catch (error) {
            console.error('Model code generation failed:', error);
            throw error;
        }
    }
    
    /**
     * Convert GLB model to ActionEngine geometry format
     * @param {Object} glbModel - Loaded GLB model
     * @returns {Object} ActionEngine geometry object
     */
    static convertGLBToGeometry(glbModel) {
        const vertices = [];
        const colorGroups = new Map();
        
        glbModel.triangles.forEach((triangle) => {
            const startIndex = vertices.length;
            
            // Add vertices
            vertices.push(
                triangle.vertices[0],
                triangle.vertices[1],
                triangle.vertices[2]
            );
            
            const face = [startIndex, startIndex + 1, startIndex + 2];
            const color = triangle.color || '#808080';
            
            // Group faces by color
            if (!colorGroups.has(color)) {
                colorGroups.set(color, []);
            }
            colorGroups.get(color).push(face);
        });
        
        // Convert to ActionEngine format
        if (colorGroups.size > 1) {
            const coloredFaces = [];
            for (const [color, faces] of colorGroups) {
                coloredFaces.push({ faces, color });
            }
            
            return {
                vertices,
                coloredFaces,
                multiColor: true
            };
        } else {
            const allFaces = [];
            for (const faces of colorGroups.values()) {
                allFaces.push(...faces);
            }
            
            return {
                vertices,
                faces: allFaces,
                color: colorGroups.keys().next().value || '#808080'
            };
        }
    }
    
    /**
     * Generate JavaScript code for geometry
     * @param {Object} geometry - ActionEngine geometry object
     * @param {string} modelName - Function name for the model
     * @param {Object} options - Code generation options
     * @returns {string} Complete JavaScript function code
     */
    static generateGeometryCode(geometry, modelName, options = {}) {
        const {
            addComments = false,
            indentation = '    '
        } = options;
        
        let code = [];
        
        // Function header
        code.push(`// Generated ActionEngine Model: ${modelName}`);
        code.push(`// Created: ${new Date().toISOString()}`);
        code.push(`createGeometry() {`);
        
        // Generate vertices array
        code.push(`${indentation}const vertices = [`);
        geometry.vertices.forEach((vertex, index) => {
            const comment = addComments ? `${indentation}${indentation}// ${index}` : '';
            code.push(`${indentation}${indentation}new Vector3(${vertex.x.toFixed(6)}, ${vertex.y.toFixed(6)}, ${vertex.z.toFixed(6)}),${comment}`);
        });
        code.push(`${indentation}];`);
        code.push('');
        
        // Generate faces or coloredFaces
        if (geometry.coloredFaces) {
            // Multi-color model
            code.push(`${indentation}const coloredFaces = [`);
            
            geometry.coloredFaces.forEach((colorGroup, groupIndex) => {
                const comment = addComments ? '' : '';
                
                code.push(`${indentation}${indentation}{`);
                code.push(`${indentation}${indentation}${indentation}faces: [`);
                
                colorGroup.faces.forEach((face, faceIndex) => {
                    const isLast = faceIndex === colorGroup.faces.length - 1;
                    code.push(`${indentation}${indentation}${indentation}${indentation}[${face.join(', ')}]${isLast ? '' : ','}`);
                });
                
                code.push(`${indentation}${indentation}${indentation}],`);
                code.push(`${indentation}${indentation}${indentation}color: '${colorGroup.color}'${comment}`);
                
                const isLastGroup = groupIndex === geometry.coloredFaces.length - 1;
                code.push(`${indentation}${indentation}}${isLastGroup ? '' : ','}`);
                
                if (!isLastGroup) code.push('');
            });
            
            code.push(`${indentation}];`);
            code.push('');
            
            // Return statement
            code.push(`${indentation}return {`);
            code.push(`${indentation}${indentation}vertices: vertices,`);
            code.push(`${indentation}${indentation}coloredFaces: coloredFaces,`);
            code.push(`${indentation}${indentation}multiColor: true`);
            code.push(`${indentation}};`);
            
        } else {
            // Single-color model
            code.push(`${indentation}const faces = [`);
            geometry.faces.forEach((face, index) => {
                const comment = addComments ? `${indentation}${indentation}// ${index}` : '';
                code.push(`${indentation}${indentation}[${face.join(', ')}],${comment}`);
            });
            code.push(`${indentation}];`);
            code.push('');
            
            // Return statement
            code.push(`${indentation}return {`);
            code.push(`${indentation}${indentation}vertices: vertices,`);
            code.push(`${indentation}${indentation}faces: faces,`);
            code.push(`${indentation}${indentation}color: '${geometry.color}'`);
            code.push(`${indentation}};`);
        }
        
        code.push('}');
        
        return code.join('\n');
    }
    
    /**
     * Generate and download model code as .js file
     * @param {string} base64Data - GLB file as base64
     * @param {string} modelName - Model name (optional)
     * @param {Object} options - Generation options
     */
    static exportModelCode(base64Data, modelName = null, options = {}) {
        // Generate generic name if none provided
        if (!modelName) {
            const timestamp = Date.now().toString(36);
            modelName = `Model_${timestamp}`;
        }
        const code = ModelCodeGenerator.generateFromGLB(base64Data, modelName, options);
        
        // Download as .js file
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${modelName}Geometry.js`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`Generated ActionEngine model code: ${modelName}Geometry.js`);
    }
    
    /**
     * Generate and download model code directly from geometry object
     * @param {Object} geometry - ActionEngine geometry object
     * @param {string} modelName - Model name (optional)
     * @param {Object} options - Generation options
     */
    static exportGeometry(geometry, modelName = null, options = {}) {
        // Generate generic name if none provided
        if (!modelName) {
            const timestamp = Date.now().toString(36);
            modelName = `Model_${timestamp}`;
        }
        
        // Generate code directly from geometry
        const code = ModelCodeGenerator.generateGeometryCode(geometry, modelName, options);
        
        // Download as .js file
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${modelName}Geometry.js`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`Generated ActionEngine model code: ${modelName}Geometry.js`);
    }
    

    

}
