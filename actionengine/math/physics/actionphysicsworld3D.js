// actionengine/math/physics/actionphysicsworld3D.js
class ActionPhysicsWorld3D {
    constructor(fixedTimestep = 1 / 60) {
        this.broadphase = new Goblin.SAPBroadphase();
        this.narrowphase = new Goblin.NarrowPhase();
        this.solver = new Goblin.IterativeSolver();
        this.world = new Goblin.World(this.broadphase, this.narrowphase, this.solver);

        this.world.gravity = new Goblin.Vector3(0, -98.1, 0);

        this.objects = new Set();

        // Physics timing variables
        this.fixedTimeStep = fixedTimestep;
        this.physicsAccumulator = 0;
        this.lastPhysicsTime = performance.now();
        this.isPaused = false;
    }

    update(deltaTime) {
        if (!this.world || this.isPaused) return;

        const currentTime = performance.now();
        const frameTime = Math.min((currentTime - this.lastPhysicsTime) / 1000, 0.25); // Cap at 250ms
        this.lastPhysicsTime = currentTime;
        this.physicsAccumulator += frameTime;

        while (this.physicsAccumulator >= this.fixedTimeStep) {
            this.world.step(this.fixedTimeStep);
            this.physicsAccumulator -= this.fixedTimeStep;
            this.objects.forEach((object) => {
                if (object.body) {
                    object.updateVisual();
                }
            });
        }
    }

    addConstraint(constraint) {
        if (!constraint) {
            console.warn("[PhysicsWorld] Attempted to add null constraint");
            return;
        }
        //console.log("[PhysicsWorld] Adding constraint:", constraint);
        this.world.addConstraint(constraint);
    }

    addObject(object) {
        this.objects.add(object);
        if (object.body) {
            //console.log("[PhysicsWorld] Adding object body:", object.body);
            this.world.addRigidBody(object.body);
        }
        if (object.rigidBodies) {
            object.rigidBodies.forEach((body) => {
                console.log("[PhysicsWorld] Adding object body:", body);
                this.world.addRigidBody(body);
            });
        }
        if (object.constraints) {
            object.constraints.forEach((constraint) => {
                console.log("[PhysicsWorld] Adding object constraint:", constraint);
                this.world.addConstraint(constraint);
            });
        }
    }

    addRigidBody(body, group = 0, mask = 0) {
        /* //disable masking for now
        if (group !== undefined || mask !== undefined) {
            body.collision_groups = group || 1;
            body.collision_mask = mask || -1;
        }
        */
        this.world.addRigidBody(body);
    }

    addTerrainBody(body, group = 0, mask = 0) {
        //console.log("[PhysicsWorld] Adding terrain body:", body);
        if (this.terrainBody) {
            //console.log("[PhysicsWorld] Removing old terrain body");
            this.world.removeRigidBody(this.terrainBody);
        }
        this.terrainBody = body;
        
        //disable masking for now
        //body.collision_groups = group;
        //body.collision_mask = mask;
        
        //console.log("[PhysicsWorld] Adding to world with groups:", group, "mask:", mask);
        this.world.addRigidBody(body);
    }

    removeRigidBody(body) {
        this.world.removeRigidBody(body);
    }

    removeConstraint(constraint) {
        if (!constraint) {
            console.warn("[PhysicsWorld] Attempted to remove null constraint");
            return;
        }
        this.world.removeConstraint(constraint);
    }

    removeObject(object) {
        if (object.body) {
            this.world.removeRigidBody(object.body);
        }
        // Check for additional bodies
        if (object.rigidBodies) {
            object.rigidBodies.forEach((body) => {
                //console.log("[PhysicsWorld] Removing object body:", body);
                this.world.removeRigidBody(body);
            });
        }
        if (object.constraints) {
            object.constraints.forEach((constraint) => {
                //console.log("[PhysicsWorld] Removing object constraint:", constraint);
                this.world.removeConstraint(constraint);
            });
        }
        this.objects.delete(object);
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
        this.lastPhysicsTime = performance.now();
        this.physicsAccumulator = 0;
    }

    reset() {
        // nuke it
        this.broadphase = new Goblin.SAPBroadphase();
        this.narrowphase = new Goblin.NarrowPhase();
        this.solver = new Goblin.IterativeSolver();
        
        // Clear all object pools
        Object.keys(Goblin.ObjectPool.pools).forEach(key => {
            Goblin.ObjectPool.pools[key].length = 0;
        });
        
        if (this.terrainBody) {
            this.world.removeRigidBody(this.terrainBody);
            this.terrainBody = null;
        }

        this.objects.forEach((obj) => {
            this.removeObject(obj);
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