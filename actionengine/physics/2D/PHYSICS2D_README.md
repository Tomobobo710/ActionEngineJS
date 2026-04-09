# 2D Physics Engine — Architecture

## File Structure

| File | Class | Purpose |
|---|---|---|
| `actionaabb2d.js` | `ActionAABB2D` | Axis-aligned bounding box |
| `actionshape2d.js` | `ActionShape2D` + `ActionShapeType2D` | Base shape + type enum |
| `actioncircleshape2d.js` | `ActionCircleShape2D` | Circle collider |
| `actionboxshape2d.js` | `ActionBoxShape2D` | OBB collider (oriented box) |
| `actionrigidbody2d.js` | `ActionRigidBody2D` | Rigid body (mass, velocity, forces, impulses) |
| `actionmanifold2d.js` | `ActionManifold2D` + `ActionContactPoint2D` | Contact manifold |
| `actionnarrowphase2d.js` | `ActionNarrowPhase2D` | Circle-circle, circle-box, box-box (SAT + Sutherland-Hodgman clipping) |
| `actioncontactsolver2d.js` | `ActionContactSolver2D` | Sequential impulse solver (warm start, Coulomb friction) |
| `actionbroadphase2d.js` | `ActionBroadPhase2D` | Spatial hash broadphase |
| `actionphysicsworld2d.js` | `ActionPhysicsWorld2D` | World orchestrator |
| `physicsconstants2d.js` | `PhysicsConstants2D` | Centralized tunable constants |

## Simulation Pipeline (`ActionPhysicsWorld2D.fixed_update`)

1. **Integrate forces** → velocities (gravity, damping)
2. **Broadphase** → spatial hash generates candidate pairs
3. **Narrowphase** → generate contact manifolds
4. **Velocity solve** → preSolve → warmStart → solveVelocity (prevents NEW penetration)
5. **Integrate velocity** → positions
6. **Narrowphase (post-integration)** → re-detect collisions with fresh penetration data
7. **Position correction** → gradually push overlapping bodies apart
8. **Clear forces** + update sleep state

## Overlap Resolution

The engine uses a two-phase approach to handle penetration:

**Velocity Solver (Step 5):**
- Prevents bodies from moving INTO each other
- Works on velocities before integration
- Cannot fix existing overlap (bodies at rest with zero velocity)

**Position Correction (Steps 7-8):**
- Fixes existing penetration after integration
- Re-runs collision detection to get fresh, accurate penetration depths
- Gradually corrects overlap over multiple frames to maintain stability
- Only corrects penetration beyond `POSITION_SLOP` threshold
- Applies `POSITION_CORRECTION_RATE` fraction per frame (default 20%)

This approach eliminates the visual overlap issues while maintaining stability. The key insight: penetration data from before integration is stale and causes instability. Fresh collision detection after integration provides accurate data for position correction.

## Constants (`PhysicsConstants2D`)

| Constant | Default | Purpose |
|---|---|---|
| `GRAVITY_Y` | 500 | Vertical gravity (px/s²) |
| `VELOCITY_ITERATIONS` | 20 | Solver velocity passes |
| `POSITION_SLOP` | 1 | Allow this much overlap before correcting (px) |
| `POSITION_CORRECTION_RATE` | 0.2 | Fraction of excess penetration to correct per frame |
| `RESTITUTION_VELOCITY_THRESHOLD` | 20 | Min velocity for bounce (prevents micro-jitter) |
| `SKIN_THICKNESS` | 0 | Shape inflation for early contact |

## Game Demo (`game/game.js`)

- 6 scenes: Stacking, Pyramid, SquarePyramid, Funnel, Mixed, Chaos
- Slowmo enabled by default (0.25x time scale)
- Visual interpolation between physics steps for smooth slowmo
- Click to spawn circles/boxes/bullets
- Arrow keys apply force to all dynamic bodies
