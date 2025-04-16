// game/display/gl/shaders/shadowshader.js
class ShadowShader {    
    getShadowVertexShader() {
        return `${this.isWebGL2 ? "#version 300 es\n" : ""}
        ${this.isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        uniform mat4 uLightSpaceMatrix;
        uniform mat4 uModelMatrix;

        void main() {
            gl_Position = uLightSpaceMatrix * uModelMatrix * vec4(aPosition, 1.0);
        }`;
    }
    
    getShadowFragmentShader() {
        return `${this.isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        ${this.isWebGL2 ? "out vec4 fragColor;\n" : ""}

        void main() {
            ${this.isWebGL2 ? "fragColor = vec4(1.0);" : "gl_FragColor = vec4(1.0);"}
        }`;
    }
}