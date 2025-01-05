// actionengine/math/physics/actionphysicssphere3D.js
class ActionPhysicsSphere3D extends ActionPhysicsObject3D {
    constructor(physicsWorld, radius = 5, mass = 1, initialPosition = new Vector3(0, 500, 0)) {
        // Visual mesh creation
        const segments = 8;
        const triangles = [];
        const getColor = (lat, lon) => ((lat + lon) % 2 === 0) ? "#FFFFFF" : "#000000";
        
        const createVertex = (phi, theta) => new Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );

        // Sphere segments generation
        for (let lat = 0; lat <= segments; lat++) {
            const phi = (lat / segments) * Math.PI;
            const nextPhi = ((lat + 1) / segments) * Math.PI;
            for (let lon = 0; lon < segments; lon++) {
                const theta = (lon / segments) * 2 * Math.PI;
                const nextTheta = ((lon + 1) / segments) * 2 * Math.PI;
                
                if (lat === 0) {
                    triangles.push(new Triangle(
                        new Vector3(0, radius, 0),
                        createVertex(Math.PI / segments, nextTheta),
                        createVertex(Math.PI / segments, theta),
                        getColor(lat, lon)
                    ));
                } else if (lat === segments - 1) {
                    triangles.push(new Triangle(
                        new Vector3(0, -radius, 0),
                        createVertex(Math.PI - Math.PI / segments, theta),
                        createVertex(Math.PI - Math.PI / segments, nextTheta),
                        getColor(lat, lon)
                    ));
                } else {
                    const v1 = createVertex(phi, theta);
                    const v2 = createVertex(nextPhi, theta);
                    const v3 = createVertex(nextPhi, nextTheta);
                    const v4 = createVertex(phi, nextTheta);
                    triangles.push(new Triangle(v1, v3, v2, getColor(lat, lon)));
                    triangles.push(new Triangle(v1, v4, v3, getColor(lat, lon)));
                }
            }
        }
        
        super(physicsWorld, triangles);

        const shape = new Goblin.SphereShape(radius);
        this.body = new Goblin.RigidBody(shape, mass);
        this.body.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
        );
        
        this.body.linear_damping = 0.01;
        this.body.angular_damping = 0.01;
        
        // Store original data for visual updates
        this.originalNormals = [];
        this.originalVerts = [];
        
        this.triangles.forEach((triangle) => {
            this.originalNormals.push(new Vector3(
                triangle.normal.x,
                triangle.normal.y,
                triangle.normal.z
            ));
            
            triangle.vertices.forEach((vertex) => {
                this.originalVerts.push(new Vector3(
                    vertex.x,
                    vertex.y,
                    vertex.z
                ));
            });
        });
        
        this.physicsWorld.addObject(this);
        this.updateVisual();
    }

    updateVisual() {
        if (!this.body) return;
        
        const pos = this.body.position;
        const rot = this.body.rotation;
        
        this.position = new Vector3(pos.x, pos.y, pos.z);
        this.triangles.forEach((triangle, triIndex) => {
            // Update normal
            const origNormal = this.originalNormals[triIndex];
            const rotatedNormal = this.rotateVector(origNormal, rot);
            triangle.normal = rotatedNormal;
            
            // Update vertices
            triangle.vertices.forEach((vertex, vertIndex) => {
                const origVert = this.originalVerts[triIndex * 3 + vertIndex];
                const rotatedVert = this.rotateVector(origVert, rot);
                
                vertex.x = rotatedVert.x + this.position.x;
                vertex.y = rotatedVert.y + this.position.y;
                vertex.z = rotatedVert.z + this.position.z;
            });
        });
    }

    rotateVector(vector, rotation) {
        const v = new Goblin.Vector3(vector.x, vector.y, vector.z);
        rotation.transformVector3(v);
        return new Vector3(v.x, v.y, v.z);
    }
}