//actionengine/physics/3D/backend.js
/**
 * Physics backend resolver.
 *
 * ActionEngine's 3D physics runs on ONE of two interchangeable backends, both loaded as plain
 * globals: GoblinPhysics (`window.Goblin`) or ActionPhysics (`window.ActionPhysics`). Their class
 * names line up almost exactly on purpose, so the factory layer (`actionengine/physics/3D/`) and
 * the two `glbloader.js` construction sites read `PhysicsBackend.X` instead of naming a backend
 * directly.
 *
 * CHOOSING A BACKEND — it is an APP-WIDE choice (Goblin objects and ActionPhysics objects cannot
 * share a world), made ONCE at startup by the Game constructor:
 *
 *     PhysicsBackend.use(Game.PHYSICS_BACKEND);
 *
 * so `Game.PHYSICS_BACKEND` is the single knob. Nothing else touches the backend — every
 * `new ActionPhysicsWorld3D()` (and everything it builds) inherits what use() set.
 *
 * `use()` re-points every passthrough and is safe to call again. It also auto-runs once at load so
 * PhysicsBackend is never null before the Game constructor: `window.ACTION_PHYSICS_BACKEND` if set,
 * else auto-detect (ActionPhysics when present, else Goblin, else the first real use throws).
 *
 * The handful of places the two backends genuinely differ are normalized here, NOT branched on at
 * every call site: createSolver() (IterativeSolver vs Solver), clearPools() (Goblin's global
 * ObjectPool vs ActionPhysics having none), eachManifold() (one linked-list walk point).
 */
(function (global) {
    "use strict";

    var CLASS_EXPORTS = [
        "World", "SAPBroadphase", "NarrowPhase", "RigidBody",
        "BoxShape", "SphereShape", "CapsuleShape", "ConeShape", "CylinderShape",
        "ConvexShape", "PlaneShape", "MeshShape", "CompoundShape",
        "Vector3", "Quaternion", "FPSCharacterController", "CharacterController"
    ];

    // Resolve a backend name -> { name, ns }, or throw. `explicit` is a name a caller asked for;
    // otherwise fall back to the global, then auto-detect.
    function resolve(explicit) {
        var want = explicit || global.ACTION_PHYSICS_BACKEND || null;

        if (want === "goblin") {
            if (!global.Goblin) throw new Error("[Backend] 'goblin' requested but window.Goblin is not loaded");
            return { name: "goblin", ns: global.Goblin };
        }
        if (want === "actionphysics") {
            if (!global.ActionPhysics) throw new Error("[Backend] 'actionphysics' requested but window.ActionPhysics is not loaded");
            return { name: "actionphysics", ns: global.ActionPhysics };
        }
        if (want != null) {
            throw new Error("[Backend] backend must be 'goblin' or 'actionphysics', got: " + want);
        }
        if (global.ActionPhysics) return { name: "actionphysics", ns: global.ActionPhysics };
        if (global.Goblin) return { name: "goblin", ns: global.Goblin };
        throw new Error("[Backend] no physics backend loaded (need window.Goblin or window.ActionPhysics)");
    }

    var Backend = {
        name: null,
        ns: null,
        ObjectPool: undefined,

        /**
         * Point every passthrough at `name` ('goblin' | 'actionphysics'). Called once by the Game
         * constructor at startup, and once at load time with no argument (auto-resolve). Re-runnable;
         * a second call re-points the globals. Returns the resolved backend name.
         */
        use: function (name) {
            var chosen = resolve(name || null);
            var ns = chosen.ns;
            var isGoblin = chosen.name === "goblin";

            if (!isGoblin && ns.usingHostMath === false) {
                throw new Error(
                    "[Backend] ActionPhysics is NOT using the host ActionMath (usingHostMath === false). " +
                    "Load actionphysics.js AFTER actionengine/math/*.js so it adopts those classes."
                );
            }

            Backend.name = chosen.name;
            Backend.ns = ns;
            Backend._isGoblin = isGoblin;

            for (var i = 0; i < CLASS_EXPORTS.length; i++) {
                var key = CLASS_EXPORTS[i];
                var cls = ns[key];
                if (cls == null) throw new Error("[Backend] backend '" + chosen.name + "' has no export '" + key + "'");
                Backend[key] = cls;
            }

            // Goblin-only; undefined on ActionPhysics. Kept so `if (window.Goblin && window.Goblin.ObjectPool)`
            // style guards elsewhere still behave.
            Backend.ObjectPool = ns.ObjectPool;

            return Backend.name;
        },

        // Fresh solver instance for a new World. Goblin: IterativeSolver. ActionPhysics: Solver.
        createSolver: function () {
            return Backend._isGoblin ? new Backend.ns.IterativeSolver() : new Backend.ns.Solver();
        },

        // Add a mass-independent velocity delta to a dynamic body (a "shove" whose strength does not
        // scale with the target's mass — a gravity-gun, scripted knockback). Just a method-name map:
        // ActionPhysics spells it addLinearVelocity; Goblin's applyImpulse already has exactly this
        // (mass-independent) behavior despite the name. Static/kinematic bodies are unaffected on
        // both (each method guards its own inverse mass).
        addVelocity: function (backendBody, dv) {
            if (Backend._isGoblin) backendBody.applyImpulse(dv);
            else backendBody.addLinearVelocity(dv);
        },

        // Rotate `vec` by quaternion `q` IN PLACE. Method-name map: Goblin's Quaternion spells it
        // transformVector3 (mutates); ActionMath's spells it transformVectorInPlace.
        rotateVectorInPlace: function (q, vec) {
            if (typeof q.transformVectorInPlace === "function") q.transformVectorInPlace(vec);
            else q.transformVector3(vec); // Goblin
            return vec;
        },

        // A new (broadphase, narrowphase, solver, world) set, wired together. Both backends take
        // `new World(broadphase, narrowphase, solver)`.
        createWorld: function () {
            var broadphase = new Backend.SAPBroadphase();
            var narrowphase = new Backend.NarrowPhase();
            var solver = Backend.createSolver();
            var world = new Backend.World(broadphase, narrowphase, solver);
            return { broadphase: broadphase, narrowphase: narrowphase, solver: solver, world: world };
        },

        // Flush the backend's global object pools, if it has any. ActionPhysics has none by design.
        clearPools: function () {
            var pool = Backend.ns.ObjectPool;
            if (!pool || !pool.pools) return;
            Object.keys(pool.pools).forEach(function (k) { pool.pools[k].length = 0; });
        },

        // ALL bodies a ray segment crosses, nearest-first, as a uniform array of
        // { backendBody, point, normal, distance }. Both backends can produce every hit (needed so a
        // caller can skip its own body and take the next), but under different names/shapes:
        //   Goblin        — world.rayIntersect returns the full sorted array already,
        //                   { object, point, normal, t }.
        //   ActionPhysics — world.rayIntersect is single-nearest only; world.rayIntersectAll is the
        //                   all-hits form, { body, point, normal, distance, fraction }.
        raycastAll: function (world, start, end) {
            var w = world && world.getWorld ? world.getWorld() : world;
            if (Backend._isGoblin) {
                var arr = w.rayIntersect(start, end) || [];
                return arr.map(function (h) {
                    return { backendBody: h.object, point: h.point, normal: h.normal, distance: h.t };
                });
            }
            var hits = w.rayIntersectAll(start, end) || [];
            return hits.map(function (h) {
                return { backendBody: h.body, point: h.point, normal: h.normal, distance: h.distance };
            });
        },

        // Walk this tick's contact manifolds. Both backends expose
        // `world.narrowphase.contact_manifolds` as a singly-linked list (`.first` -> `.next_manifold`).
        eachManifold: function (world, fn) {
            var np = world && world.narrowphase;
            var list = np && np.contact_manifolds;
            if (!list) return;
            for (var m = list.first; m; m = m.next_manifold) fn(m);
        }
    };

    // Auto-resolve now so PhysicsBackend is never in a null state before the Game constructor's
    // use() call.
    Backend.use();

    global.PhysicsBackend = Backend;
})(typeof window !== "undefined" ? window : this);
