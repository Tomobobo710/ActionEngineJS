// actionengine/math/physics/actionphysicsworld3D.js
class ActionPhysicsWorld3D {
    constructor(fixedTimestep = 1/60) {
        const broadphase = new Goblin.SAPBroadphase();
        const narrowphase = new Goblin.NarrowPhase();
        const solver = new Goblin.IterativeSolver();
        this.world = new Goblin.World(broadphase, narrowphase, solver);
        
        this.world.gravity = new Goblin.Vector3(0, -9.81, 0);
        this.objects = new Set();

        // Add physics timing variables
        this.fixedTimeStep = fixedTimestep;
        this.physicsAccumulator = 0;
        this.lastPhysicsTime = performance.now();
    }

    update(deltaTime) {
        if (!this.world) return;

        const currentTime = performance.now();
        const frameTime = (currentTime - this.lastPhysicsTime) / 1000;
        this.lastPhysicsTime = currentTime;

        // Accumulate time and run fixed timesteps
        this.physicsAccumulator += frameTime;
        
        while (this.physicsAccumulator >= this.fixedTimeStep) {
            this.world.step(this.fixedTimeStep);
            this.physicsAccumulator -= this.fixedTimeStep;

            // Update visual positions of all physics objects
            this.objects.forEach(object => {
                if (object.body) {
                    object.updateVisual();
                }
            });
        }
    }

    addObject(object) {
        this.objects.add(object);
        if (object.body) {
            console.log("[PhysicsWorld] Adding object body:", object.body);
            this.world.addRigidBody(object.body);
        }
    }

    addRigidBody(body, group = 0, mask = 0) {
        /*
        if (group !== undefined || mask !== undefined) {
            body.collision_groups = group || 1;
            body.collision_mask = mask || -1;
        }
        */
        this.world.addRigidBody(body);
    }

    addTerrainBody(body, group = 0, mask = 0) {
        
        console.log("[PhysicsWorld] Adding terrain body:", body);
        if (this.terrainBody) {
            console.log("[PhysicsWorld] Removing old terrain body");
            this.world.removeRigidBody(this.terrainBody);
        }
        this.terrainBody = body;

        //body.collision_groups = group;
        //body.collision_mask = mask;

        //console.log("[PhysicsWorld] Adding to world with groups:", group, "mask:", mask);
        this.world.addRigidBody(body);
    }

    removeRigidBody(body) {
        this.world.removeRigidBody(body);
    }

    removeObject(object) {
        this.objects.delete(object);
        if (object.body) {
            this.world.removeRigidBody(object.body);
        }
    }

    reset() {
        if (this.terrainBody) {
            this.world.removeRigidBody(this.terrainBody);
            this.terrainBody = null;
        }

        this.objects.forEach(obj => {
            if (obj.body) {
                this.world.removeRigidBody(obj.body);
            }
        });
        this.objects.clear();
    }

    setShaderManager(shaderManager) {
        this.shaderManager = shaderManager;
    }
    
    getWorld() {
        return this.world;
    }
}