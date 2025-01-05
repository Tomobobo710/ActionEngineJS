// game/display/gl/shaders/debugshadowmapshader.js
class DebugShadowMapShader {    
    getDebugShadowMapVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec2 aPosition;
        ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;

        void main() {
            vTexCoord = aPosition * 0.5 + 0.5;  // convert from -1,1 to 0,1
            // Scale to maintain square aspect and position in corner
            vec2 scaledPos = (aPosition * 0.2) + vec2(-0.8, -0.8);
            gl_Position = vec4(scaledPos, 0.0, 1.0);
        }`;
    }

    getDebugShadowMapFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision mediump float;
        ${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
        ${isWebGL2 ? 
            "precision highp sampler2DShadow;\nuniform sampler2DShadow uShadowMap;" : 
            "uniform sampler2D uShadowMap;"}
        ${isWebGL2 ? "out vec4 fragColor;\n" : ""}

        void main() {
            float depth = ${isWebGL2 ? 
                "texture(uShadowMap, vec3(vTexCoord, 0.0))" : 
                "texture2D(uShadowMap, vTexCoord).r"};
            depth = 1.0 - depth;
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(vec3(depth), 1.0);
        }`;
    }
}