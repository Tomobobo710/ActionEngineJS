// actionengine/math/physics/actionphysicsworld3D.js
class ActionPhysicsWorld3D {
    constructor(fixedTimestep = 1/60) {
        const broadphase = new Goblin.SAPBroadphase();
        const narrowphase = new Goblin.NarrowPhase();
        const solver = new Goblin.IterativeSolver();
        this.world = new Goblin.World(broadphase, narrowphase, solver);
        
        this.world.gravity = new Goblin.Vector3(0, -9.81, 0);
        
        this.objects = new Set();
        this.constraints = new Set();
        
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

            this.objects.forEach(object => {
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
            this.constraints.add(constraint);
            this.world.addConstraint(constraint);
        }

    addObject(object) {
        this.objects.add(object);
        if (object.body) {
            //console.log("[PhysicsWorld] Adding object body:", object.body);
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
        
        //console.log("[PhysicsWorld] Adding terrain body:", body);
        if (this.terrainBody) {
            //console.log("[PhysicsWorld] Removing old terrain body");
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
    
    removeConstraint(constraint) {
        if (!constraint) {
            //console.warn("[PhysicsWorld] Attempted to remove null constraint");
            return;
        }
        this.constraints.delete(constraint);
        this.world.removeConstraint(constraint);
    }
    
    removeObject(object) {
        this.objects.delete(object);
        if (object.body) {
            this.world.removeRigidBody(object.body);
        }
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
        if (this.terrainBody) {
            this.world.removeRigidBody(this.terrainBody);
            this.terrainBody = null;
        }
        
        this.objects.forEach(obj => {
            if (obj.body) {
                this.world.removeRigidBody(obj.body);
            }
        });
        
        // Clear all constraints
        this.constraints.forEach(constraint => {
            this.world.removeConstraint(constraint);
        });
        
        this.constraints.clear();
        this.objects.clear();
    }

    setShaderManager(shaderManager) {
        this.shaderManager = shaderManager;
    }
    
    getWorld() {
        return this.world;
    }
}