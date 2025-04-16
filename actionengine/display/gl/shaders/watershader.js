class WaterShader {
    getWaterVertexShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        ${isWebGL2 ? "in" : "attribute"} vec3 aPosition;
        ${isWebGL2 ? "in" : "attribute"} vec3 aNormal;
        ${isWebGL2 ? "in" : "attribute"} vec2 aTexCoord;
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        uniform float uTime;
        
        ${isWebGL2 ? "out" : "varying"} vec3 vPosition;
        ${isWebGL2 ? "out" : "varying"} vec3 vNormal;
        ${isWebGL2 ? "out" : "varying"} vec2 vTexCoord;
        
        void main() {
            vec3 pos = aPosition;
            
            float wave = sin(pos.x * 2.0 + uTime) * 2.0 + 
                        sin(pos.z * 1.5 + uTime * 0.8) * 1.8;
            pos.y += wave;
            
            vec3 normal = aNormal;
            normal.xz += cos(pos.xz * 2.0 + uTime) * 0.2;
            normal = normalize(normal);
            
            vPosition = (uModelMatrix * vec4(pos, 1.0)).xyz;
            vNormal = normal;
            vTexCoord = aTexCoord;
            
            gl_Position = uProjectionMatrix * uViewMatrix * vec4(vPosition, 1.0);
        }`;
    }

    getWaterFragmentShader(isWebGL2) {
        return `${isWebGL2 ? "#version 300 es\n" : ""}
        precision highp float;
        
        ${isWebGL2 ? "in" : "varying"} vec3 vPosition;
        ${isWebGL2 ? "in" : "varying"} vec3 vNormal;
        ${isWebGL2 ? "in" : "varying"} vec2 vTexCoord;
        
        uniform vec3 uCameraPos;
        uniform vec3 uLightDir;
        uniform float uTime;
        
        ${isWebGL2 ? "out vec4 fragColor;\n" : ""}
        
        void main() {
            vec3 viewDir = normalize(uCameraPos - vPosition);
            
            vec3 waterColor = vec3(0.0, 0.4, 0.6);
            
            float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
            
            vec3 reflectDir = reflect(-uLightDir, vNormal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
            
            vec3 finalColor = waterColor + fresnel * 0.5 + spec;
            
            float alpha = mix(0.6, 0.9, fresnel);
            
            ${isWebGL2 ? "fragColor" : "gl_FragColor"} = vec4(finalColor, alpha);
        }`;
    }
}