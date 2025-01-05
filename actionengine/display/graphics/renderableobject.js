// actionengine/display/graphics/renderableobject.js
class RenderableObject {
    constructor() {
        this.triangles = [];  // Array of Triangle objects
        this.position = new Vector3(0, 0, 0);
        this.rotation = 0;
        this.scale = 1;
    }

    getModelMatrix() {
        const matrix = Matrix4.create();
        Matrix4.translate(matrix, matrix, this.position.toArray());
        Matrix4.rotateY(matrix, matrix, this.rotation);
        Matrix4.scale(matrix, matrix, [this.scale, this.scale, this.scale]);
        return matrix;
    }
}