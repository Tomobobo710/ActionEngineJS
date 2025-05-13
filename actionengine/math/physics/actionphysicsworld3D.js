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

    fixed_update(fixedDeltaTime) {
        if (!this.world || this.isPaused) return;
        
        // Store pre-physics state for objects that need to know if they've moved
        const movedObjects = new Set();
        
        // Capture pre-step positions and rotations for moving objects
        this.objects.forEach(object => {
            if (object.body && !object.body.is_static) {
                movedObjects.add(object);
            }
        });

        try {
            // Step physics with the fixed timestep
            this.world.step(fixedDeltaTime);
            
            // Mark objects that moved during physics as visually dirty
            movedObjects.forEach(object => {
                if (typeof object.markVisualDirty === 'function') {
                    object.markVisualDirty();
                }
            });
        } catch (error) {
            if (error.toString().includes("silhouette")) {
                console.error("===== SILHOUETTE ERROR DETECTED =====");
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
                
                // Log object counts and world state
                console.error("Physics objects count:", this.objects.size);
                console.error("Rigid bodies count:", this.world.rigid_bodies.length);
                
                // Log character information if available
                if (window.gameCharacter) {
                    console.error("Character information:");
                    console.error("  - Type:", window.gameCharacter.constructor.name);
                    console.error("  - Position:", 
                        window.gameCharacter.body.position.x,
                        window.gameCharacter.body.position.y,
                        window.gameCharacter.body.position.z
                    );
                    console.error("  - Has body?", !!window.gameCharacter.body);
                    console.error("  - Body in world?", this.world.rigid_bodies.includes(window.gameCharacter.body));
                }
                
                // Log object pool sizes - these are key to understanding the issue
                if (window.Goblin && window.Goblin.ObjectPool) {
                    console.error("Goblin object pools:");
                    Object.keys(window.Goblin.ObjectPool.pools).forEach(key => {
                        console.error(`  - ${key}: ${window.Goblin.ObjectPool.pools[key].length} objects`);
                    });
                }
                
                // Continue execution - skip this physics step
                console.error("Skipping current physics step due to error");
                
                // Log a counter of how many times this has happened
                this._silhouetteErrorCount = (this._silhouetteErrorCount || 0) + 1;
                console.error(`Total silhouette errors: ${this._silhouetteErrorCount}`);
                
                // Keep track of what the character was doing when this happened
                if (window.gameCharacter && window.gameCharacter.debugInfo) {
                    const state = window.gameCharacter.debugInfo.state;
                    console.error("Character state when error occurred:", state ? state.current : "unknown");
                }
                
                // Store detailed information for later analysis
                if (!window._silhouetteErrorLog) window._silhouetteErrorLog = [];
                window._silhouetteErrorLog.push({
                    timestamp: new Date().toISOString(),
                    errorMessage: error.message,
                    characterPosition: window.gameCharacter ? 
                        [window.gameCharacter.body.position.x, 
                         window.gameCharacter.body.position.y, 
                         window.gameCharacter.body.position.z] : null,
                    characterState: window.gameCharacter && window.gameCharacter.debugInfo ? 
                        window.gameCharacter.debugInfo.state.current : null
                });
            } else {
                // Re-throw any other errors
                throw error;
            }
        }
    }

    update(deltaTime) {
        // This is now a lightweight wrapper for backward compatibility
        // Physics is now handled in fixed_update()        
        if (!this.world || this.isPaused) return;
        
        // Update any non-physics related components here that need variable timestep
        // (none currently, all physics moved to fixed_update)
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

    getWorld() {
        return this.world;
    }
}