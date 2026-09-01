//actionengine/character/actionfpscontroller3D.js
/**
 * ActionFPSController3D - Engine-side, reusable first-person character controller.
 *
 * Physics, ground/wall/slope/ladder/platform/knockback movement and netcode state are delegated
 * to a Goblin.FPSCharacterController instance held internally. This class owns everything that
 * ISN'T physics: weapon/combat/grab/model/view components, camera framing, render-eye smoothing,
 * and the public API surface a game touches. `.body` is an ActionRigidBody3D facade over the
 * delegate's raw Goblin body, so callers keep working with ActionEngine's Vector3 the same as any
 * other physics body in the engine.
 *
 * DESIGN SEAMS:
 *   The controller never reads input directly. Gameplay samples an input command and
 *   feeds it in, bracketing a single Goblin world step:
 *       const cmd = ActionFPSInput.sample(input);   // engine default sampler (or build it yourself)
 *       controller.beginStep(cmd, dt);     // pre-physics: velocity + assists
 *       physicsWorld.fixed_update(dt);     // ONE world step (all bodies)
 *       controller.endStep(dt);            // post-physics: grounded + step-down
 *   The command struct is pure data, so a host can run remote players' commands through
 *   the exact same path. Input mapping (keybinds → command) is policy and lives OUTSIDE this
 *   class — see ActionFPSInput for the default sampler.
 *
 * EXTENSIBILITY:
 *   This base IS the default "kit" (instantiate it directly). A game adds an alternate kit by
 *   subclassing and overriding _updateVertical (jump/gravity) and/or _getMoveSpeed without
 *   touching ground/step/wall logic — see the reference FPS's fpskits.js
 *   (ActionJetpackController3D) for an example. These two hooks are bound onto the Goblin
 *   delegate at construction time (see _bindOverridableHooks) so a subclass override still runs
 *   from inside the delegate's own beginStep, exactly as if the whole controller were one class.
 *
 * Units: ActionEngine's Goblin world is in METERS (gravity -9.81); defaults are in
 * meters (a ~1.8m human ≈ 1.8 units tall). Use `scale` to resize the whole character.
 */
class ActionFPSController3D {
    /**
     * @param {ActionPhysicsWorld3D} physicsWorld
     * @param {Object} options
     * @param {Vector3} options.position    - Spawn position (body center). Default (0,2,0).
     * @param {number}  options.scale       - Uniform size multiplier for the whole character. Default 1.
     * @param {number}  options.width       - Collider width (x) before scale. Default 0.6.
     * @param {number}  options.depth       - Collider depth (z) before scale. Default 0.6.
     * @param {number}  options.height      - Collider height (y) before scale. Default 1.8.
     * @param {number}  options.mass        - Body mass before scale. Default 10.
     * @param {number}  options.eyeHeight   - Eye offset above body CENTER before scale. Default height*0.42.
     * @param {number}  options.walkSpeed   - Held-walk gait speed before scale (slower than run). Default 3.8.
     * @param {number}  options.moveSpeed   - RUN speed (the default no-modifier gait) before scale. Default 7.
     * @param {number}  options.sprintSpeed - Sprint move speed before scale. Default 11.5.
     * @param {number}  options.crouchSpeedMult - Multiplier on the active gait while crouched (unitless). Default 0.5.
     * @param {number}  options.sprintDecay - Rate (units/sec) the sprint boost fades after releasing sprint while still moving. Default 10.
     * @param {number}  options.groundStopDecel- Deceleration (units/sec) when you release all move keys. High = crisp stop, 0 = frictionless drift. Default 80 (a weighty few-frame stop; raise toward Infinity for a dead stop).
     * @param {number}  options.airControl  - 0..1 horizontal steering authority per step while airborne. Default 0.12.
     * @param {number}  options.jumpSpeed   - Jump velocity before scale. Default 4.6.
     * @param {number}  options.friction    - Body friction. Default 0 (kinematic grounding holds slopes; 0 keeps wall-slides clean).
     * @param {number}  options.stepHeight  - Max step-UP height before scale. Default 0.4.
     * @param {number}  options.stepDownDist- Max step-DOWN snap before scale. Default 0.5.
     * @param {number}  options.coyoteTime  - Seconds after leaving a ledge you can still jump. Default 0.1 (0 = off).
     * @param {number}  options.jumpBuffer  - Seconds before landing a jump press is remembered and fires on touchdown. Default 0.12 (0 = off).
     * @param {boolean} options.slideEnabled- Enable crouch-at-speed sliding. Default true (pass false to disable).
     * @param {boolean} options.slideRequiresMoveInput- Require a movement key held to slide (forbids no-key slides). Default false.
     * @param {number}  options.slideMinSpeed- Min along-ground speed (pre-scale) to start a slide. Default 7.8.
     * @param {number}  options.slideEndSpeed- Flat slide ends (you stop) below this speed (pre-scale). Default 1.
     * @param {number}  options.slideFriction- Speed bled per second on flat ground (pre-scale). Default 6.
     * @param {number}  options.slideBoost  - Launch speed multiplier at slide entry. Default 1.3.
     * @param {number}  options.slideControl- 0..1 carve authority while sliding (speed-preserving). Default 0.14.
     * @param {number}  options.slideSlopeAccel- Gravity-along-slope multiplier while sliding (downhill speeds up). Default 1.5.
     * @param {number}  options.slideSlopeMin - Min slope (sin of angle, 0..1) that SUSTAINS a slide at any speed via gravity. Default 0.2; Infinity disables.
     * @param {number}  options.slideSlopeFriction- Cross-slope bleed per second on a sustaining slope: carves the slide onto the fall line (pre-scale). Default 1.5.
     * @param {number}  options.slideCoyoteFrames- Frames after dropping below slide speed a crouch press still slides (release-then-crouch). Default 5.
     * @param {boolean} options.receivePush - Enable prop→player knockback via the ghost body. Default true.
     * @param {number}  options.receiveMaxSpeed - Cap on how fast a single prop hit can knock the player. Default 16.
     * @param {number}  options.receiveKnockbackFraction - Fraction of the ghost's contact velocity transferred to the player. Default 1.
     * @param {number}  options.ghostMaxSpeed - Cap on the ghost's follow/shove speed (units/sec). Default sprintSpeed * 1.3.
     * @param {number}  options.ghostDamping - Fraction of the ghost's current velocity damped each tick (0..1). Default 1.
     * @param {number}  options.maxSlopeAngle - Max standable slope in degrees; steeper slides you off. Default 45.57 (Valve). 90 disables.
     * @param {boolean} options.visible     - Render the collider mesh (false for local FP). Default false.
     * @param {string}  options.color       - Collider color when visible. Default "#cc4444".
     */
    constructor(physicsWorld, options = {}) {
        this.physicsWorld = physicsWorld;
        const world = physicsWorld.getWorld ? physicsWorld.getWorld() : physicsWorld.world;

        const o = { ...options };
        if (o.position) o.position = { x: o.position.x, y: o.position.y, z: o.position.z };

        // The backend's bundled FPS controller (Goblin's or ActionPhysics's, per PhysicsBackend).
        // The field name `_goblin` is historical — it is whichever backend is selected.
        this._goblin = new PhysicsBackend.FPSCharacterController(world, o);
        this._bindOverridableHooks();

        // .body is a live facade over the delegate's raw Goblin body: same contract every other
        // ActionEngine physics body exposes (Vector3 position/linearVelocity), never the raw
        // backend on the public surface. Matches the existing precedent in ActionCharacter.js,
        // which wraps a different Goblin controller's body the same way. _ghost is the same facade
        // over the push-object solver stand-in (see Goblin.FPSCharacterController's _buildGhost).
        this.body = new ActionRigidBody3D(this._goblin.body);
        this._resyncGhost();
        this._resyncObject();
        this._syncDebugNames();
        this._trackInPhysicsWorld();

        // Optional components, each on by default: weapons:false combat:false model:false view:false input:false
        this._buildComponents(o);
    }

    // Bind this instance's _updateVertical/_getMoveSpeed onto the Goblin delegate as instance-level
    // overrides, so beginStep — which calls `this._updateVertical(...)` on the delegate internally —
    // actually runs whatever a subclass of ActionFPSController3D overrode. This is what lets
    // fpskits.js's ActionJetpackController3D (or any future kit) subclass this class and override
    // just the vertical hook, exactly as if the whole controller were one undivided class.
    _bindOverridableHooks() {
        this._goblin._updateVertical = (cmd, dt) => this._updateVertical(cmd, dt);
        this._goblin._getMoveSpeed = (cmd) => this._getMoveSpeed(cmd);
    }

    // Build the optional weapon / combat / model / view / input components. Each defaults ON.
    _buildComponents(o) {
        // `weapons:[...]` supplies a roster; `true`/absent ⇒ engine default roster; `false` ⇒ none.
        if (o.weapons !== false && typeof ActionFPSWeapon !== "undefined") {
            this.weapon = new ActionFPSWeapon(this, {
                roster: Array.isArray(o.weapons) ? o.weapons : undefined,
                models: o.weaponModels
            });
            this.userData = { weapon: this.weapon.weaponSlot };
            // Route the live aim into the weapon so the viewmodel/muzzle track the current view.
            const self = this;
            this.weapon.aimProvider = {
                get yaw() { return self._renderYaw; },
                get pitch() { return self._renderPitch; },
                direction() { return self.getLiveAimDirection(); }
            };
        } else {
            this.weapon = null;
        }

        if (o.combat !== false && typeof ActionFPSCombat !== "undefined") {
            this.combat = new ActionFPSCombat(this, typeof o.combat === "object" ? o.combat : {});
        } else {
            this.combat = null;
        }

        // Gravity-gun pickup/carry/throw of dynamic bodies.
        if (o.grab !== false && typeof ActionFPSGrabber !== "undefined") {
            this.grabber = new ActionFPSGrabber(this, typeof o.grab === "object" ? o.grab : {});
        } else {
            this.grabber = null;
        }

        if (o.model !== false && typeof ActionFPSBodyModel !== "undefined") {
            const slots = this.weapon ? this.weapon.weaponDefs.length : 2;
            this.model = new ActionFPSBodyModel(this._goblin._color, slots);
        } else {
            this.model = null;
        }

        if (o.view !== false && typeof ActionFPSCamera !== "undefined") {
            this.view = new ActionFPSCamera(typeof o.view === "object" ? o.view : undefined);
            if (this.weapon || this.grabber) {
                const rig = this.view;
                const self = this;
                const viewSeam = {
                    get isFirstPerson() { return rig.isFirstPerson; },
                    get cameraPosition() { return self._lastCameraPos || self.getEyePosition(); }
                };
                if (this.weapon) this.weapon.view = viewSeam;
                // Same seam as the weapon's crosshair: in third person the aim ray originates at the
                // CAMERA (what the crosshair sits over), not the eye — otherwise the grab/hold point
                // sits wherever the body is facing instead of where the player is actually looking.
                if (this.grabber) this.grabber.view = viewSeam;
            }
        } else {
            this.view = null;
        }

        this._bindings = o.bindings || null;
    }

    // ---- Component convenience API (only meaningful when the component is enabled) ----

    /** Sample a movement command from the engine input system using the default bindings (input:true).
     *  Returns the pure-data command struct beginStep consumes. Throws if input was disabled. */
    sampleCommand(input, bindings) {
        return ActionFPSInput.sample(input, bindings || this._bindings || undefined);
    }

    /** Switch the equipped weapon slot (no-op without a weapon component). */
    selectWeapon(slot) {
        if (!this.weapon) return;
        this.weapon.selectWeapon(slot);
        if (this.userData) this.userData.weapon = this.weapon.weaponSlot;
    }

    /** Reload the active weapon (no-op without a weapon component). */
    reload() { if (this.weapon) this.weapon.reload(); }

    /**
     * Drive the owned first-person camera rig (view:true) onto the engine `camera`. The rig frames
     * along this controller's LIVE aim (from aim()) — you don't thread a look direction through. Pass
     * the renderer's sub-tick factor `alpha` (0..1) and the camera rides the interpolated eye
     * (captureRenderState()/renderEye()) for smooth framing between 60Hz physics ticks; omit it (null)
     * to frame off the live physics eye. Stashes the resulting camera position so the weapon's
     * third-person muzzle/crosshair follow it. Call once per render frame. No-op (plain eye snap)
     * without a view rig.
     */
    updateCamera(camera, alpha = null, dt = 1 / 60) {
        this._renderDt = dt; // stash real render dt for the eye spring (renderEye only gets alpha)
        if (!this.view) { this.applyToCamera(camera); return; }
        const viewSource = alpha == null ? this : this._renderViewSource(alpha);
        this.view.update(viewSource, this.getLiveAimDirection(), dt, camera);
        this._lastCameraPos = camera.position;
    }

    /** The first-person viewmodel object to feed the renderer's viewmodel pass (or null). Only render
     *  it when first-person + alive; getRenderObjects() deliberately excludes it. */
    get viewmodel() { return this.weapon ? this.weapon.viewmodel : null; }

    /** Fire if able: gates on ammo (dry-click on empty), fires, returns true if a shot left the barrel.
     *  Damage is resolved by whoever owns authority (offline: the weapon; networked: the host). */
    tryFire() {
        if (!this.weapon) return false;
        if (!this.weapon.canFire()) { this.weapon.fireEmpty(); return false; }
        this.weapon.fire();
        return true;
    }

    // Combat passthroughs (so the HUD reads the character, not a sub-object).
    get health() { return this.combat ? this.combat.health : null; }
    get maxHealth() { return this.combat ? this.combat.maxHealth : null; }
    get dead() { return this.combat ? this.combat.dead : false; }

    /**
     * Per-RENDER-frame cosmetic + life-cycle tick (NOT the fixed physics step — that's beginStep/
     * endStep). Decays recoil, ages tracers/rockets/explosions, and (offline) runs the combat respawn
     * countdown + kill-plane check. dt in seconds. Safe to call with any component disabled.
     */
    update(dt) {
        if (this.weapon) this.weapon.update(dt);
        if (this.combat) this.combat.update(dt);
    }

    /**
     * Render objects for THIS character's third-person body + active cosmetic FX (tracers, rockets,
     * explosions). The first-person viewmodel is NOT included (the caller renders it in the viewmodel
     * pass only when first-person + alive). Pass the renderer's sub-tick factor `alpha` (0..1) to pose
     * the body at the same interpolated position the camera uses (so body + view never disagree between
     * 60Hz ticks); omit it (null) for the live physics position. (A Vector3 is also accepted as an
     * explicit eye override.)
     */
    getRenderObjects(alpha = null, aim = null) {
        const renderEye = alpha == null ? null : (typeof alpha === "number" ? this.renderEye(alpha) : alpha);
        const out = [];
        // The third-person body is drawn only when actually in third-person — in first-person the eye
        // sits inside the mesh, so drawing it puts the body's interior in front of the camera (the
        // "black box"). The first-person viewmodel is the FP representation and is rendered separately.
        const showBody = this.model && !this.dead && !(this.view && this.view.isFirstPerson);
        if (showBody) {
            const s = this.getState();
            if (this.weapon) s.userData = { ...(s.userData || {}), weapon: this.weapon.weaponSlot };
            // Optional sub-tick-INTERPOLATED eye: pose the body at the same smoothed position the
            // camera uses, so the body + its posed weapon track the view between 60Hz physics ticks
            // instead of snapping. renderEye is the eye; body origin = eye - eyeHeight. Absent ⇒ the
            // authoritative (last-tick) position.
            if (renderEye) {
                s.x = renderEye.x;
                s.y = renderEye.y - this.eyeHeight;
                s.z = renderEye.z;
            }
            // LIVE aim for the OWN body: the snapshot yaw/pitch only update at the fixed (60Hz) tick,
            // but the camera orbits on the client's live aim every render frame — so a third-person
            // body left on the snapshot yaw freezes between ticks while the view keeps turning (the
            // "dangling weapon"). Default to the controller's live aim (from aim()); an explicit `aim`
            // arg overrides. Falls back to the networked snapshot yaw (correct for remotes/replay) only
            // when no live aim has been set.
            const bodyAim = aim || (this._liveAimSet ? { yaw: this._liveYaw, pitch: this._livePitch } : null);
            if (bodyAim) {
                if (bodyAim.yaw !== undefined) s.yaw = bodyAim.yaw;
                if (bodyAim.pitch !== undefined) s.pitch = bodyAim.pitch;
            }
            this.model.setState(s);
            for (const o of this.model.getRenderObjects()) out.push(o);
        }
        if (this.weapon) {
            const tracer = this.weapon.buildTracerObject();
            if (tracer) out.push(tracer);
            for (const fx of this.weapon.buildEffectObjects()) out.push(fx);
        }
        return out;
    }

    // ---- Delegated physics state (read-through to the Goblin controller) ----

    get grounded() { return this._goblin.grounded; }
    set grounded(v) { this._goblin.grounded = v; }
    get groundNormal() { return this._goblin.groundNormal; }
    get _onLadder() { return this._goblin._onLadder; }
    get velocityY() { return this._goblin.velocityY; }
    get crouching() { return this._goblin.crouching; }
    get scale() { return this._goblin.scale; }
    get width() { return this._goblin.width; }
    get depth() { return this._goblin.depth; }
    get height() { return this._goblin.height; }
    get eyeHeight() { return this._goblin.eyeHeight; }
    get mass() { return this._goblin.mass; }
    get walkSpeed() { return this._goblin.walkSpeed; }
    get moveSpeed() { return this._goblin.moveSpeed; }
    get sprintSpeed() { return this._goblin.sprintSpeed; }
    get jumpSpeed() { return this._goblin.jumpSpeed; }
    get stepHeight() { return this._goblin.stepHeight; }
    get stepDownDist() { return this._goblin.stepDownDist; }
    get climbSteepSlopes() { return this._goblin.climbSteepSlopes; }
    set climbSteepSlopes(v) { this._goblin.climbSteepSlopes = v; }
    get slideEnabled() { return this._goblin.slideEnabled; }
    get sliding() { return this._goblin.sliding; }
    get userData() { return this._goblin.userData; }
    set userData(v) { this._goblin.userData = v; }
    get yaw() { return this._goblin.yaw; }
    set yaw(v) { this._goblin.yaw = v; }
    get pitch() { return this._goblin.pitch; }
    set pitch(v) { this._goblin.pitch = v; }
    get maxPitch() { return this._goblin.maxPitch; }
    get standHeight() { return this._goblin.standHeight; }
    get standEye() { return this._goblin.standEye; }

    // Feel/policy knobs — mutable at runtime on the base controller (a game may retune these live),
    // so both directions proxy through to the delegate.
    get airControl() { return this._goblin.airControl; }
    set airControl(v) { this._goblin.airControl = v; }
    get friction() { return this._goblin.friction; }
    set friction(v) { this._goblin.friction = v; }
    get coyoteTime() { return this._goblin.coyoteTime; }
    set coyoteTime(v) { this._goblin.coyoteTime = v; }
    get jumpBuffer() { return this._goblin.jumpBuffer; }
    set jumpBuffer(v) { this._goblin.jumpBuffer = v; }
    get crouchRatio() { return this._goblin.crouchRatio; }
    set crouchRatio(v) { this._goblin.crouchRatio = v; }
    get crouchSpeedMult() { return this._goblin.crouchSpeedMult; }
    set crouchSpeedMult(v) { this._goblin.crouchSpeedMult = v; }
    get maxSlopeAngle() { return this._goblin.maxSlopeAngle; }
    set maxSlopeAngle(v) { this._goblin.maxSlopeAngle = v; }
    get groundStopDecel() { return this._goblin.groundStopDecel; }
    get sprintDecay() { return this._goblin.sprintDecay; }

    get ladderClimbSpeed() { return this._goblin.ladderClimbSpeed; }
    get ladderStrafeSpeed() { return this._goblin.ladderStrafeSpeed; }
    get ladderMountReach() { return this._goblin.ladderMountReach; }
    get ladderDismountPushSpeed() { return this._goblin.ladderDismountPushSpeed; }

    get slideRequiresMoveInput() { return this._goblin.slideRequiresMoveInput; }
    set slideRequiresMoveInput(v) { this._goblin.slideRequiresMoveInput = v; }
    get slideMinSpeed() { return this._goblin.slideMinSpeed; }
    get slideEndSpeed() { return this._goblin.slideEndSpeed; }
    get slideFriction() { return this._goblin.slideFriction; }
    get slideBoost() { return this._goblin.slideBoost; }
    set slideBoost(v) { this._goblin.slideBoost = v; }
    get slideControl() { return this._goblin.slideControl; }
    set slideControl(v) { this._goblin.slideControl = v; }
    get slideSlopeAccel() { return this._goblin.slideSlopeAccel; }
    set slideSlopeAccel(v) { this._goblin.slideSlopeAccel = v; }
    get slideSlopeMin() { return this._goblin.slideSlopeMin; }
    set slideSlopeMin(v) { this._goblin.slideSlopeMin = v; }
    get slideSlopeFriction() { return this._goblin.slideSlopeFriction; }
    // Goblin's controller only; ActionPhysics's port has no slide-coyote window. Undefined there.
    get slideCoyoteFrames() { return this._goblin.slideCoyoteFrames; }
    set slideCoyoteFrames(v) { this._goblin.slideCoyoteFrames = v; }

    /** This controller's physics-body id (the name raycasts exclude to avoid self-hits). */
    get bodyId() { return this._goblin.bodyId; }

    /**
     * Raycast options that exclude THIS controller's own body — pass straight to ActionRaycast3D
     * so a game's own casts (weapons, line-of-sight) don't hit the shooter. The controller already
     * uses this internally for its ground/wall probes; exposing it keeps games off the backend body.
     */
    get raycastIgnore() { return { ignoreObjects: this._goblin.raycastIgnore }; }

    /** Resize the whole character at runtime (rebuilds the collider, feet planted). */
    setScale(scale) {
        this._goblin.setScale(scale);
        this._resyncBody();
    }

    // The delegate's _buildBody replaces its Goblin.RigidBody (and, via _buildGhost, its ghost body)
    // on crouch/scale/respawn; re-point the facades at the fresh backend bodies so callers holding
    // `this.body`/`this._ghost`/`this.object` keep reading live state instead of a stale, detached one.
    _resyncBody() {
        this._untrackFromPhysicsWorld();
        this.body = new ActionRigidBody3D(this._goblin.body);
        this._resyncGhost();
        this._resyncObject();
        this._syncDebugNames();
        this._trackInPhysicsWorld();
    }

    // Goblin's own raycast helper (used internally by ground/wall/ladder probes) reads a body's
    // identity off `.name`, which the delegate sets correctly. ActionRaycast3D (ActionEngine's own
    // raycaster, used by every weapon cast) instead reads `.debugName` — a field only
    // ActionRigidBody3D's `name` SETTER writes, which the delegate never goes through since it builds
    // raw Goblin.RigidBody instances directly. Without this, a weapon's self-ignore list matches
    // against a field that's always undefined on the player/ghost body, so nothing is ever actually
    // excluded — the shooter's own body (and ghost) becomes a normal, hittable target for their own
    // shots. Every backend body the delegate rebuilds (crouch/scale/respawn) needs this reapplied.
    _syncDebugNames() {
        this.body.goblinBody.debugName = this.body.goblinBody.name;
        if (this._ghost) this._ghost.goblinBody.debugName = this._ghost.goblinBody.name;
    }

    // The delegate registers both its own body and the ghost's directly with the Goblin world
    // (world.addRigidBody) — physics works without this. But ActionEngine's physicsWorld ALSO keeps
    // its own `objects` Set (physicsWorld.addObject/removeObject) for consumers that enumerate the
    // scene that way, e.g. physbench rebuilding a block: `w.objects.forEach(o => w.removeObject(o))`.
    // Without tracking both handles there, a rebuilt controller's OLD ghost body never gets removed
    // from the world on a scene wipe — a real, previously-hidden bug this delegation surfaced (the
    // ghost used to ride along for free inside physicsWorld.addObject(this.object) when the ghost was
    // its own ActionPhysicsBox3D; the Goblin delegate's ghost is a bare RigidBody the old registration
    // path never sees). addObject would call world.addRigidBody again (double-add) since the delegate
    // already did that, so track directly in the Set instead of going through addObject/removeObject.
    _trackInPhysicsWorld() {
        this.physicsWorld.objects.add(this.object);
        if (this._ghostObject) this.physicsWorld.objects.add(this._ghostObject);
    }
    _untrackFromPhysicsWorld() {
        if (this.object) this.physicsWorld.objects.delete(this.object);
        if (this._ghostObject) this.physicsWorld.objects.delete(this._ghostObject);
    }

    // _ghost/_ghostObject are the same wrapped facade as body/object, over Goblin.FPSCharacterController's
    // push-object solver stand-in (see its _buildGhost). Exposed because tests and any consumer that
    // pokes the ghost directly (see physbench's ghost.js suite) expect ActionRigidBody3D shape here too.
    _resyncGhost() {
        const g = this._goblin._ghost;
        this._ghost = g ? new ActionRigidBody3D(g) : null;
        // .body here must be the WRAPPED facade (this._ghost), not the delegate's raw body — same
        // reasoning as _resyncObject: a render adapter reads box dimensions via obj.body.goblinBody.
        this._ghostObject = this._goblin._ghostObject
            ? { body: this._ghost, isVisible: this._goblin._ghostObject.isVisible,
                setVisibility(v) { this.isVisible = v; } }
            : null;
    }

    // Goblin's own `object` handle is `{body, isVisible}` with the RAW backend body (no setVisibility
    // — nothing on the Goblin side calls it). ActionEngine's callers expect `setVisibility(v)` AND an
    // ActionRigidBody3D-shaped `.body` — a browser viewer's render adapter reads box dimensions via
    // `obj.body.goblinBody.shape`, which only exists on the wrapper, not the raw body. Reuse `this.body`
    // (already resynced to the same fresh backend body just above) rather than the delegate's raw one.
    _resyncObject() {
        const g = this._goblin.object;
        const body = this.body;
        this.object = { body, isVisible: g.isVisible, setVisibility(v) { g.isVisible = v; this.isVisible = v; } };
    }

    // ---- Look --------------------------------------------------------------

    look(deltaYaw, deltaPitch) { this._goblin.look(deltaYaw, deltaPitch); }
    setLook(yaw, pitch) { this._goblin.setLook(yaw, pitch); }

    /** Full 3D look direction (includes pitch). */
    getLookDirection() {
        const d = this._goblin.getLookDirection();
        return new Vector3(d.x, d.y, d.z);
    }

    /**
     * Set the LIVE, client-owned aim — call once per render frame from your mouse-look. Render-only:
     * this NEVER enters the simulation (it doesn't touch yaw/pitch, the command, movement, or netcode),
     * it just keeps the viewmodel, camera, and third-person body glued to the present view instead of
     * the 60Hz sim yaw — fixing the between-tick "dangle" in every mode. The controller routes this one
     * value to all three internally: the weapon's aimProvider, updateCamera()'s default look, and
     * getRenderObjects()'s default body aim. You supply the value (mouse→angle is your input); the
     * controller owns the plumbing.
     */
    aim(yaw, pitch) {
        this._liveYaw = yaw;
        this._livePitch = pitch;
        this._liveAimSet = true;
    }

    /** The live aim's full 3D direction (render-only; from aim()). Falls back to the sim look. */
    getLiveAimDirection() {
        if (!this._liveAimSet) return this.getLookDirection();
        const cp = Math.cos(this._livePitch);
        return new Vector3(Math.sin(this._liveYaw) * cp, Math.sin(this._livePitch), Math.cos(this._liveYaw) * cp);
    }

    /** The yaw/pitch the render side should use: the live aim if set, else the sim facing. */
    get _renderYaw() { return this._liveAimSet ? this._liveYaw : this.yaw; }
    get _renderPitch() { return this._liveAimSet ? this._livePitch : this.pitch; }

    /** Horizontal forward for a given yaw (defaults to current facing). */
    getForwardHorizontal(yaw = this.yaw) {
        return new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    }

    /** Horizontal right for a given yaw (defaults to current facing). Negated to match
     *  this engine's left-handed view so DirRight strafes to the player's visual right. */
    getRightHorizontal(yaw = this.yaw) {
        return new Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    }

    /** World-space eye position (camera goes here). */
    getEyePosition() {
        const p = this.body.position;
        return new Vector3(p.x, p.y + this.eyeHeight, p.z);
    }

    /**
     * Return the artificial vertical eye displacement accumulated since the last call (step/landing
     * snaps + crouch/scale swaps) and reset it. A camera folds this into a decaying offset so it
     * eases over those discontinuities. Call once per render frame. Render-only — does not affect sim.
     */
    consumeViewDisplacementY() { return this._goblin.consumeViewDisplacementY(); }

    /**
     * Peek at the pending vertical eye displacement WITHOUT consuming it. A render-side smoother
     * consumes (consumeViewDisplacementY); a caller that only wants to DETECT a discontinuity this
     * frame (e.g. to snap interpolation instead of sliding the eye) reads this and leaves the value
     * for the smoother. Read-only — never mutates sim or render state.
     */
    peekViewDisplacementY() { return this._goblin.peekViewDisplacementY(); }

    /**
     * Stash this fixed tick's eye for sub-tick render interpolation. Call ONCE per REAL fixed step,
     * right after the step settles (offline: after endStep; networked: after the session's fixedTick,
     * once prediction + reconciliation have resolved — NOT inside endStep, which also runs during
     * resim). Render-only: nothing here touches the body, getState, or the network. A teleport-sized
     * jump (respawn / kill-plane / hard resync) or an artificial step/crouch eye snap (which the
     * camera's view-displacement smoother already eases) snaps the interpolation — prev := curr — so
     * the eye doesn't smear across the discontinuity.
     */
    captureRenderState() { this._goblin.captureRenderState(); }

    /**
     * The render-only eye position: the last two captured fixed-tick eyes lerped by the sub-tick factor
     * `alpha` (0..1, the fraction into the current fixed step the renderer hands action_draw). Falls back
     * to the live physics eye until two ticks have been captured. updateCamera()/getRenderObjects() use
     * this internally, so most games never call it directly.
     */
    renderEye(alpha) {
        const e = this._goblin.renderEye(alpha);
        return this._springEye(e.x, e.y, e.z, alpha);
    }

    /**
     * Spring-smooth the rendered eye. The eye only gets NEW sim data at 60Hz, but we render at up to 144Hz;
     * the sub-tick lerp subdivides each tick-to-tick segment UNEVENLY (the 60/144 beat — measured as the
     * camera stepping 0.025 then 0.010 per frame in blocks, an 8.5x step ratio while walking straight). That
     * beat makes the whole VIEW micro-lurch, so every object shimmers against it — the jitter that no prop
     * smoothing could fix. A critically-damped spring on the rendered eye irons the beat into continuous
     * motion. Stiff (low lag) because we're only smoothing sub-tick unevenness, not big corrections; a large
     * gap (teleport/respawn/step-snap) hard-snaps so we never add view latency across a real jump. dt is the
     * real render dt (updateCamera passes it through the frame). Render-only — never touches the body/sim.
     *
     * Y IS DELIBERATELY NOT SPRUNG. Vertical eye motion is crouch / step-up / scale, which the camera's view
     * rig already eases via consumeViewDisplacementY (a decaying offset). Springing Y too would double-smooth
     * those and make crouch feel wrong. The 60/144 beat we're fixing is HORIZONTAL (measured: X/Z lurch, Y had
     * zero reversals), so we spring X/Z only and pass Y through untouched for the rig's smoother to own.
     */
    _springEye(x, y, z, alpha) {
        const C = (typeof FPS_EYE_SMOOTH !== "undefined") ? FPS_EYE_SMOOTH
            : (typeof window !== "undefined" && window.FPS_EYE_SMOOTH);
        if (!C || !C.ENABLED) return new Vector3(x, y, z);
        // renderEye is called MORE THAN ONCE per real frame (camera + third-person body + viewmodel),
        // each time with the SAME interpolated eye (x,z) and the SAME alpha. Integrate the spring
        // exactly ONCE per frame and return the cached sprung eye for the rest, or we double-step it.
        //
        // We detect "a new frame" from the render inputs themselves — no counter for the app to bump
        // (a missed bump silently freezes the view, which is a nasty footgun). A new frame changes at
        // least one of: the interpolated eye target (x,z — moves every frame the player moves) or
        // `alpha` (the sub-tick fraction). If BOTH are identical to last call, it's a repeat call
        // this frame (return cache) OR a genuinely static frame (returning the settled eye is
        // correct anyway).
        const same = this._eyeSmOut &&
            this._eyeSmLastX === x && this._eyeSmLastZ === z && this._eyeSmLastAlpha === alpha;
        if (same) return new Vector3(this._eyeSmOut.x, y, this._eyeSmOut.z);
        this._eyeSmLastX = x; this._eyeSmLastZ = z; this._eyeSmLastAlpha = alpha;
        const dt = Math.min(this._renderDt || 1 / 144, 1 / 30);
        if (!this._eyeSm) { this._eyeSm = { x, z, vx: 0, vz: 0 }; this._eyeSmOut = { x, z }; return new Vector3(x, y, z); }
        const s = this._eyeSm;
        const gx = x - s.x, gz = z - s.z;
        // Snap gate scales with the character: a big character's eye moves proportionally farther per frame,
        // so a fixed 1× teleport threshold would snap on normal high-scale motion and let the beat show.
        const snap = C.SNAP_DIST * (this.scale || 1);
        if (gx * gx + gz * gz > snap * snap) {
            s.x = x; s.z = z; s.vx = 0; s.vz = 0; // horizontal teleport — snap
        } else {
            // ANALYTIC critically-damped spring — same fix as ActionPhysicsObject3D.smoothToBody().
            // The old semi-implicit integration (v += (k*g - c*v)*dt; x += v*dt) is only stable while
            // k*dt^2 stays small; at STIFFNESS 2500 it starts overshooting below ~50fps and diverges
            // from there. On the PROP spring that drew objects metres from their bodies; here it
            // springs the EYE, so the whole view lurches and the entire world appears to trip out.
            // Math.min(dt, 1/30) does not rescue it — 0.033s is already inside the unstable region.
            // Closed form costs one exp() and is stable at any dt.
            const w = Math.sqrt(C.STIFFNESS);
            const e = Math.exp(-w * dt);
            const ax = (s.vx + w * gx) * dt;
            const az = (s.vz + w * gz) * dt;
            s.vx = (s.vx - ax * w) * e; s.vz = (s.vz - az * w) * e;
            s.x = x - (gx + ax) * e;    s.z = z - (gz + az) * e;
        }
        this._eyeSmOut = { x: s.x, z: s.z }; // Y not sprung — passed through raw (crouch/step owned by the rig)
        return new Vector3(s.x, y, s.z);
    }

    /** A controller-shaped view source that reports the sub-tick-INTERPOLATED eye while delegating
     *  scale / world / self-ignore / view-displacement to the real controller. updateCamera() feeds this
     *  to the camera rig so the framing smooths between physics ticks without the rig (or getState) ever
     *  seeing the render-only eye. Cached + mutated in place (one per controller; called every frame). */
    _renderViewSource(alpha) {
        const eye = this.renderEye(alpha);
        const p = this._renderProxy || (this._renderProxy = {});
        p.scale = this.scale;
        p.physicsWorld = this.physicsWorld;
        p.raycastIgnore = this.raycastIgnore;
        p.getEyePosition = () => eye;
        p.consumeViewDisplacementY = () => this.consumeViewDisplacementY();
        p.peekViewDisplacementY = () => this.peekViewDisplacementY();
        return p;
    }

    /** This controller's physics-body id (the name raycasts exclude to avoid self-hits). */
    get _renderProxy() { return this.__renderProxy; }
    set _renderProxy(v) { this.__renderProxy = v; }

    /**
     * Netcode reconciliation hooks (opt-in, called by ActionSimClient around the un-acked-command
     * RESIMULATION — rollback-and-resim, distinct from a game "replay"). During resim the controller
     * re-derives already-perceived state, so its step/crouch snaps must NOT feed the camera smoother
     * (that double-counts every step until the command acks — the cause of jittery third/first-person
     * step smoothing in MP). Live ticks are unaffected.
     */
    beginResim() { this._goblin.beginResim(); }
    endResim() { this._goblin.endResim(); }

    applyToCamera(camera) {
        const eye = this.getEyePosition();
        camera.position = eye;
        camera.target = eye.add(this.getLookDirection());
        camera.isDetached = false;
    }

    // ---- Simulation (bracketed around one physics world step) --------------

    /**
     * PRE-physics: set this tick's horizontal velocity (slope/wall projected) + assists. Delegates
     * entirely to the Goblin controller; see Goblin.FPSCharacterController#beginStep for the full
     * mechanism (ladder/platform/slide/slope/jump).
     */
    beginStep(command, dt) {
        this._goblin.beginStep(command, dt);
        this._afterDelegateCall();
    }

    /** POST-physics: decide grounded and clamp the feet to the ground surface, acquire platform base
     *  velocity, sync the push ghost. See Goblin.FPSCharacterController#endStep. */
    endStep(dt) {
        this._goblin.endStep(dt);
        this._afterDelegateCall();
    }

    // A crouch/scale rebuild inside beginStep/endStep (steep-slope stand-up-blocked, cmd.scale, etc.)
    // replaces the delegate's backend body — re-point the facade so callers reading `.body`/`.object`
    // this same tick see the fresh body, not one already removed from the world.
    _afterDelegateCall() {
        if (this.body.goblinBody !== this._goblin.body) this._resyncBody();
    }

    /** TEMP DEBUG: begin capturing per-tick movement state (see endStep). `seconds` sizes the ring
     *  buffer (default 20s at 60Hz). Console-driven: _debugStart(20), reproduce, _debugDump().
     *  Only present on backends that ship this ring-buffer tool (Goblin's controller); a no-op
     *  elsewhere. */
    _debugStart(seconds) { return this._goblin._debugStart ? this._goblin._debugStart(seconds) : undefined; }
    /** TEMP DEBUG: label the NEXT captured tick (e.g. the start of one of your sub-tests). */
    _debugMark(label) { return this._goblin._debugMark ? this._goblin._debugMark(label) : undefined; }
    /** TEMP DEBUG: stop + return the captured ticks as a compact table string (markers inline). */
    _debugDump() { return this._goblin._debugDump ? this._goblin._debugDump() : undefined; }

    // ---- Overridable kit hooks --------------------------------------------
    // The base implementation IS the Goblin delegate's own — called with `this` bound to the
    // delegate, so it runs entirely in Goblin's own field names (this.body is already the raw
    // body there, this._coyoteTimer/etc. are its real private state). Bound onto the delegate at
    // construction (_bindOverridableHooks) so beginStep's internal `this._updateVertical(...)`
    // call reaches whichever version is current: a subclass override REPLACES this method on the
    // wrapper's prototype chain, so the binding calls the override instead — and the override (see
    // fpskits.js's ActionJetpackController3D) reads this.body.linearVelocity/this.grounded in
    // ActionEngine's naming, which the getters above already proxy to the delegate correctly.

    _getMoveSpeed(cmd) {
        return PhysicsBackend.FPSCharacterController.prototype._getMoveSpeed.call(this._goblin, cmd);
    }

    /** Vertical hook. Base = grounded jump only (gravity/landing handled by the solver). A jump
     *  adds platform base velocity's Y component additively, not an overwrite — jumping off a
     *  rising platform flings the player higher than jumpSpeed alone would. */
    _updateVertical(cmd, dt) {
        PhysicsBackend.FPSCharacterController.prototype._updateVertical.call(this._goblin, cmd, dt);
    }

    /**
     * LADDERS: a ladder is any body tagged `goblinBody.isLadder = true`. See
     * Goblin.FPSCharacterController#_updateLadder for the full mechanism.
     */
    _findLadderAhead(dir) { return this._goblin._findLadderAhead(dir); }
    _updateLadder(cmd, moveYaw, movePitch, dt) { return this._goblin._updateLadder(cmd, moveYaw, movePitch, dt); }

    // ---- Internal helpers --------------------------------------------------

    _climbableSlopeAhead(start, dx, dz) { return this._goblin._climbableSlopeAhead(start, dx, dz); }
    _probeGroundCandidates(maxSnap) { return this._goblin._probeGroundCandidates(maxSnap); }
    // Some backends (ActionPhysics's port) consolidated to _probeGroundCandidates only.
    _probeGround(maxSnap) { return this._goblin._probeGround ? this._goblin._probeGround(maxSnap) : this._goblin._probeGroundCandidates(maxSnap); }
    _collideAndSlide(vx, vz, dt) { return this._goblin._collideAndSlide(vx, vz, dt); }
    _sweptCollideAndSlide(opts) { return this._goblin._sweptCollideAndSlide(opts); }
    _ceilingClearanceAt(cx, cz, feetY) { return this._goblin._ceilingClearanceAt(cx, cz, feetY); }
    _headroomGate(vx, vz, dt) { return this._goblin._headroomGate(vx, vz, dt); }
    _probeCeiling(reachAboveFeet) { return this._goblin._probeCeiling(reachAboveFeet); }
    _ceilingSlide(vx, vy, vz, dt) { return this._goblin._ceilingSlide(vx, vy, vz, dt); }
    _canStand() { return this._goblin._canStand(); }
    _setCrouch(want) { this._goblin._setCrouch(want); this._resyncBody(); }
    _syncGhost(dt) { this._goblin._syncGhost(dt); }
    _readGhostKnockback() { this._goblin._readGhostKnockback(); }

    // ---- ActionSim entity interface (host-authoritative snapshots / reconciliation) ----
    // beginStep/endStep are above; getState/setState complete the duck-typed entity contract
    // {beginStep, endStep, getState, setState} the ActionSim framework drives.

    /** Snapshot this controller's authoritative state for the network. */
    getState() { return this._goblin.getState(); }

    /** Apply an authoritative state (from a host snapshot). Sets position, velocity and grounded;
     *  does not touch yaw/pitch. Used for client-side reconciliation before replaying un-acked inputs. */
    setState(s) {
        this._goblin.setState(s);
        this._resyncBody();
    }

    /** Add a velocity impulse and force the character airborne (explosions / knockback / rocket-jumping). */
    applyKnockback(vx, vy, vz) { this._goblin.applyKnockback(vx, vy, vz); }

    // ---- Lifecycle ---------------------------------------------------------

    setPosition(pos) {
        this._goblin.setPosition({ x: pos.x, y: pos.y, z: pos.z });
    }

    destroy() {
        this._untrackFromPhysicsWorld();
        this._goblin.destroy();
    }
}
