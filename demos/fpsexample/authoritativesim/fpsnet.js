// fpsnet.js — FPS-specific bindings onto the ActionSim framework (game-side; the engine
// stays a generic sim, never an "FPS sim").
//
// Model (see [[fps-netcode-design]]):
//   - HOST runs a SERVER (authoritative world: all player controllers + props) AND a CLIENT.
//   - EVERY client has its OWN prediction world (static arena + its local predicted
//     controller only). Remotes (other players + props) are render-only, fed by snapshots.
//   - Host's client talks to its server in-process via a loopback transport — identical
//     code path to a remote guest.
//
// This file provides: FPSAvatarManager (remote-player visuals via ActionFPSBodyModel), FPSPropEntity
// (server-side snapshot source for a prop), and FPSSession (the composition; it keeps each prop as a kinematic
// ghost in its own prediction world so player↔prop blocking is predicted — Tier 2).

// Weapon geometry/rig/body-pose/muzzle and the default character mesh are engine mechanism now
// (ActionFPSWeaponSystem, ActionFPSCharacterModel; box-mesh/ray-AABB via ActionBoxGeometry,
// Quaternion.fromDirection). The host fire path reuses ActionFPSWeaponSystem.bodyWeaponPose; remote
// avatars use ActionFPSCharacterModel.build (tinted per player) + the weapon system's body gun.

// The default player avatar mesh is an engine default now (ActionFPSCharacterModel, GLB-swappable);
// `color` is the per-player identity tint the game supplies. The remote body (ActionFPSBodyModel)
// scales it to the live collider each frame. The weapon on the body comes from ActionFPSWeaponSystem.

function fpsColorFor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    const hue = h % 360;
    const s = 0.6,
        l = 0.55;
    const k = (n) => (n + hue / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const to = (x) =>
        Math.round(255 * x)
            .toString(16)
            .padStart(2, "0");
    return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

// The player avatar (body mesh + posed weapon, driven by authoritative state) is now the engine's
// ActionFPSBodyModel — used for BOTH the local third-person body and remote players. The slide-tilt
// quaternion compose it needed is Quaternion.multiply now, so the game-side fpsQuatMul / FPS_SLIDE_TILT
// helpers are gone with it. fpsColorFor (above) still maps a player id → identity tint (policy).

/** Server-side snapshot source for a prop (wraps the authoritative physics body). Carries the layout
 *  spec (shape + dims + color) so the snapshot replicates the real shape, and the client rebuilds the
 *  matching ghost via game.buildProp — not a box stand-in. */
class FPSPropEntity {
    constructor(box, spec) {
        this.box = box;
        this.spec = spec; // { shape, w?, h?, d?, r?, color, ... } from game.fpsPropLayout()
        this.heldBy = null; // id of the player carrying this prop, or null (set each tick by the session)
    }
    getState() {
        const b = this.box.body;
        const p = b.position;
        const r = b.rotation;
        const v = b.linearVelocity;
        const av = b.angularVelocity;
        const s = this.spec;
        return {
            type: "prop",
            shape: s.shape,
            mass: s.mass, // so the client rebuilds a DYNAMIC body (buildProp defaults to mass 0 = static)
            w: s.w,
            h: s.h,
            d: s.d,
            r: s.r,
            x: p.x,
            y: p.y,
            z: p.z,
            qx: r.x,
            qy: r.y,
            qz: r.z,
            qw: r.w,
            // Velocity too: clients predict props as real bodies and roll back to this state, so they
            // must restart mid-motion (linear + angular) instead of from rest. Cheap (6 floats).
            vx: v.x,
            vy: v.y,
            vz: v.z,
            wx: av.x,
            wy: av.y,
            wz: av.z,
            // Who's carrying this prop, so clients PREDICT it when it's free or theirs, but INTERPOLATE
            // it when another player holds it (we can't predict their carry → predicting it jitters).
            heldBy: this.heldBy || null,
            color: s.color
        };
    }
}

/**
 * Client-side PREDICTED prop: a real dynamic body in the guest's prediction world that the local
 * player can shove (and be shoved by) immediately, instead of waiting a round-trip. ActionSimClient
 * rolls it back to the authoritative snapshot each frame (setState) and the resim carries it forward,
 * so self-pushes feel instant and the server stays authoritative. {setState,getState} is all the
 * framework needs.
 */
class FPSPredictedProp {
    constructor(box) {
        this.box = box; // dynamic ActionPhysicsBox3D living in clientWorld
    }
    setState(s) {
        const b = this.box.body;
        b.position = new Vector3(s.x, s.y, s.z);
        b.rotation = new Quaternion(s.qx, s.qy, s.qz, s.qw);
        b.linearVelocity = new Vector3(s.vx || 0, s.vy || 0, s.vz || 0);
        b.angularVelocity = new Vector3(s.wx || 0, s.wy || 0, s.wz || 0);
        this.box.updateVisual();
    }
    getState() {
        const b = this.box.body;
        const p = b.position;
        const r = b.rotation;
        const v = b.linearVelocity;
        const av = b.angularVelocity;
        return { x: p.x, y: p.y, z: p.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w, vx: v.x, vy: v.y, vz: v.z, wx: av.x, wy: av.y, wz: av.z };
    }
}

/**
 * FPSAvatarManager — owns the remote-player visuals (an ActionFPSBodyModel per remote id), extracted out of
 * FPSSession so the session stays a composition root. Pure view: it turns authoritative remote
 * snapshots into posed avatars + nameplate anchors. The session feeds it remote state and asks it
 * for render objects / counts / nameplates.
 */
class FPSAvatarManager {
    constructor(session) {
        this.session = session;
        this.avatars = new Map(); // id -> ActionFPSBodyModel
    }

    get all() { return this.avatars; } // raw map (e.g. the weapon hit-clamp iterates avatar boxes)
    has(id) { return this.avatars.has(id); }
    get(id) { return this.avatars.get(id); }
    remove(id) { this.avatars.delete(id); }
    count() { return this.avatars.size; }

    /** Apply an authoritative remote player snapshot (create the avatar on first sighting). */
    applyRemote(id, s) {
        let a = this.avatars.get(id);
        if (!a) {
            a = new ActionFPSBodyModel(fpsColorFor(id)); // engine body component (same as the local body)
            this.avatars.set(id, a);
        }
        a.setState(s);
    }

    /** Render objects for every remote avatar (body + posed weapon). */
    renderObjects() {
        const out = [];
        for (const [, a] of this.avatars) for (const o of a.getRenderObjects()) out.push(o);
        return out;
    }

    /**
     * Head-anchor world positions + display names for every VISIBLE remote player, for the game's
     * screen-space nameplates. Names come from ActionNet's user list (the de-duped displayName).
     * Dead/hidden avatars (empty mesh) are skipped — no plate over a corpse.
     */
    nameplates(nm) {
        const out = [];
        const users = nm && nm.getConnectedUsers ? nm.getConnectedUsers() : [];
        const nameById = new Map(users.map((u) => [u.id, u.displayName || u.username || u.id]));
        for (const [id, a] of this.avatars) {
            const o = a.object;
            if (!o || !o.triangles || !o.triangles.length) continue; // dead/hidden
            const p = o.transform.position;
            const sy = o.transform.scale ? o.transform.scale.y : 1;
            // Mesh is 18 tall, centered on the body origin → half-height 9; lift a touch above the head.
            // Scales with the player so a giant's plate floats proportionally high; `scale` is consumed
            // by the sprite size in the game's _collectNameplates so the plate matches the body.
            out.push({ id, x: p.x, y: p.y + 12 * sy, z: p.z, name: nameById.get(id) || id, scale: sy });
        }
        return out;
    }
}

/**
 * FPSPropReplicator — client-side replication of dynamic props + kinematic player ghosts, extracted
 * out of FPSSession. Owns three structures:
 *   - propBodies   : real PREDICTED dynamic bodies (free / self-held) living in the prediction world
 *   - propViews    : render-only INTERPOLATED stand-ins for a prop a REMOTE player holds
 *   - playerGhosts : mass-0 collide-only blockers so player↔player blocking is PREDICTED
 * Borrows the session's clientWorld / game / client (lazy getters, so it can be constructed before
 * the client exists). Behaviour is identical to when this lived on the session.
 */
class FPSPropReplicator {
    constructor(session) {
        this.session = session;
        this.propBodies = new Map(); // id -> predicted dynamic body (free / self-held) in clientWorld
        this.propViews = new Map(); // id -> render-only interpolated stand-in (remote-held prop)
        this.playerGhosts = new Map(); // id -> mass-0 collide-only ghost of a remote player
    }

    get clientWorld() { return this.session.clientWorld; }
    get game() { return this.session.game; }
    get client() { return this.session.client; }

    /** Render-only views for remote-held props (predicted bodies render via clientWorld directly). */
    views() { return this.propViews.values(); }

    /** Drop a remote player's collision ghost (on disconnect). */
    removePlayerGhost(id) {
        const g = this.playerGhosts.get(id);
        if (g) {
            this.clientWorld.removeObject(g);
            this.playerGhosts.delete(id);
        }
    }

    /**
     * Reposition the kinematic PLAYER ghosts in the prediction world from the latest authoritative
     * snapshots (creating them on first sighting), then kick the broadphase so THIS tick's predicted
     * raycasts see the new positions. Called each fixed tick BEFORE prediction. Ghosts are mass-0,
     * collide-only and invisible (the avatar renders the player); they reproduce the server's
     * player↔player blocking, which we can't dynamically predict (no access to others' input).
     */
    syncGhosts() {
        this.client.eachRemoteLatest((id, s) => {
            if (!s) return;
            if (s.type !== "prop" && s.type !== "rocket") this.syncPlayerGhost(id, s); // a player
        });
        const gw = this.clientWorld.getWorld();
        if (gw && gw.broadphase) gw.broadphase.update();
    }

    /**
     * Factory for ActionSimClient: on first sighting of a prop snapshot, build the SAME dynamic body
     * SP/host use (real mass) in the prediction world and hand back a {setState} adapter. The client
     * rolls it back to authority each snapshot and the resim carries it forward, so local pushes are
     * predicted. The body renders directly (it's in clientWorld.objects).
     */
    createPredicted(id, s) {
        // If this prop was a remote-held interp VIEW (a player just dropped it / handed it back), retire
        // the view — we now own its prediction (a real body below).
        this.propViews.delete(id);
        const box = this.game.buildProp(s); // dynamic, full material — identical to SP/host
        box.body.name = id; // matches the host's prop body name → the pickup raycast resolves to this id
        this.clientWorld.addObject(box);
        this.propBodies.set(id, box);
        const ent = new FPSPredictedProp(box);
        ent.setState(s); // seed to the authoritative state we first saw it at
        return ent;
    }

    /** A prop we were predicting is now held by another player → stop predicting it (render as a view). */
    releasePredicted(id) {
        const box = this.propBodies.get(id);
        if (box) {
            this.clientWorld.removeObject(box);
            this.propBodies.delete(id);
        }
    }

    /** Interpolated render of a prop currently held by a REMOTE player. Mass-0 render-only object (not
     *  in any physics world), positioned from the smoothed authoritative snapshot. */
    updatePropView(id, s) {
        let v = this.propViews.get(id);
        if (!v) {
            v = this.game.buildProp(s, 0); // render-only stand-in, NOT added to a world
            v.body.name = "propview_" + id;
            this.propViews.set(id, v);
        }
        v.body.position = new Vector3(s.x, s.y, s.z);
        v.body.rotation = new Quaternion(s.qx, s.qy, s.qz, s.qw);
        v.updateVisual();
    }

    syncPlayerGhost(id, s) {
        const w = s.w || 6,
            h = s.h || 18;
        let g = this.playerGhosts.get(id);
        // Rebuild if the collider size changed (crouch / Z–X scale) so the predicted block matches.
        if (g && (Math.abs(g._ghostW - w) > 0.5 || Math.abs(g._ghostH - h) > 0.5)) {
            this.clientWorld.removeObject(g);
            this.playerGhosts.delete(id);
            g = null;
        }
        if (!g) {
            g = new ActionPhysicsBox3D(w, h, w, 0, new Vector3(s.x, s.y, s.z), "#000000", { isVisible: false });
            g.body.name = "playerghost_" + id;
            g._playerGhost = true; // excluded from the render list (the avatar draws the player)
            g._ghostW = w;
            g._ghostH = h;
            this.clientWorld.addObject(g);
            this.playerGhosts.set(id, g);
        }
        // Hitbox stays axis-aligned (yaw is cosmetic), matching the server controller's body.
        g.body.position = new Vector3(s.x, s.y, s.z);
        g.updateVisual();
    }
}

/**
 * FPSPickups — host-authoritative grab/drop + carry of dynamic props, extracted out of FPSSession.
 * Borrows the session's serverPlayers / propEntities / serverWorld / game (the shared pickup math
 * lives on the game so SP, host, and client predict identically). Host only.
 */
class FPSPickups {
    constructor(session) {
        this.session = session;
    }
    get serverPlayers() { return this.session.serverPlayers; }
    get propEntities() { return this.session.propEntities; }
    get serverWorld() { return this.session.serverWorld; }
    get game() { return this.session.game; }

    /** Authoritative grab/drop for player `id` via their controller's grabber: drop if holding, else
     *  raycast the server world for a prop in front of them — the SAME engine mechanism the client
     *  predicts with (the server controller has no live aim, so the grabber uses its reconciled sim
     *  facing automatically). */
    serverToggle(id) {
        const player = this.serverPlayers.get(id);
        if (!player || player.dead) return;
        player.controller.grabber.toggle();
    }

    /** Carry tick (host): stamp each prop's holder (for the client's predict-vs-interpolate choice),
     *  then drive every holder's grabber to pull their prop toward the hold point before the world step. */
    drive(dt) {
        for (const [, ent] of this.propEntities) ent.heldBy = null; // reset ownership each tick
        for (const [id, player] of this.serverPlayers) {
            const g = player.controller.grabber;
            if (player.dead || !g || !g.held) continue;
            const ent = this.propEntities.get(g.held);
            if (!ent) { g.held = null; continue; } // holding a non-replicated body? drop it
            ent.heldBy = id; // policy: tells the client to predict (self/free) vs interpolate (remote-held)
            g.drive(dt); // authoritative carry (server controller's sim aim, via the grabber)
        }
    }
}

/** Composes the ActionSim framework into the FPS for one client (host runs server too). */
class FPSSession {
    constructor(game, gui, isHost) {
        this.game = game;
        this.gui = gui;
        this.nm = gui.getNetManager();
        this.isHost = isHost;
        this.localId = this.nm.peerId;

        this.avatarMgr = new FPSAvatarManager(this); // remote-player visuals (id -> ActionFPSBodyModel)
        this.props = new FPSPropReplicator(this); // predicted prop bodies + interp views + player ghosts
        this.rocketViews = new Map(); // id -> RenderableObject (render-only flying rockets)

        // Combat. gameMode is the pluggable damage filter (game.gameMode overrides; default FFA),
        // shared with the host-authoritative combat (FPSCombat, constructed below on the host;
        // owns fire/hitscan/rockets/damage/respawns). gameMode is shared by reference.
        this.gameMode = game.gameMode || new FFAMode();
        this.combatHost = null; // FPSCombat (host only)
        this.pickups = null; // FPSPickups (host only)
        this._joinIndex = 0; // for team assignment
        this.localHealth = 100; // our authoritative HP (from snapshots, for the HUD)
        this.localDead = false;

        // CLIENT prediction world: static arena + the local predicted controller + PREDICTED dynamic
        // props (real bodies the local player shoves/gets shoved by immediately, rolled back to
        // authority each snapshot by ActionSimClient — see FPSPropReplicator.createPredicted) + KINEMATIC player
        // ghosts (so player↔player blocking is predicted). Remote players stay kinematic because we
        // don't have their inputs; props we DO predict because we have our own push.
        this.clientWorld = new ActionPhysicsWorld3D();
        game.buildArena(this.clientWorld);
        game.buildOmniTestRooms(this.clientWorld); // match SP: rooms + omni lights (lights spawn once)
        this._localKit = "soldier";
        this.localController = this._makeController(this.clientWorld, this._localKit, this.spawnFor(0), "cliLocal", true);

        const p2p = new ActionSimP2PTransport(this.nm);
        this._p2pTransport = p2p; // kept so destroy() can unsubscribe it from the net manager

        if (isHost) {
            // SERVER authoritative world: arena + all player controllers + props.
            this.serverWorld = new ActionPhysicsWorld3D();
            game.buildArena(this.serverWorld);
            game.buildOmniTestRooms(this.serverWorld); // authoritative collision for the rooms (geometry only; lights already spawned)
            this.serverPlayers = new Map(); // id -> FPSPlayerEntity (server-authoritative)
            this.propEntities = new Map();

            const [srvEnd, cliEnd] = ActionSimLoopbackTransport.pair("__server__", this.localId);
            this.serverTransport = new ActionSimCompositeTransport([p2p, srvEnd]);
            this.server = new ActionSimServer({
                transport: this.serverTransport,
                // Drive every holder's carried prop toward their hold point BEFORE the step, so the
                // solver moves it this tick (authoritative carry). Then step the world.
                stepWorld: (dt) => {
                    this.pickups.drive(dt);
                    this.serverWorld.fixed_update(dt);
                },
                onCommand: (id, cmd, server) => this._onPlayerCommand(id, cmd, server),
                // Input recorder: OFF for now. Raise to keep the last N ticks of consumed input
                // (e.g. 600 ≈ 10s) and pull it with server.getReplay(). We don't use replays yet,
                // but the knob is wired so enabling it is a one-line change, not an engine mod.
                replayTicks: 0
            });

            this._addServerPlayer(this.localId); // host is just another player
            this._spawnProps();
            this.combatHost = new FPSCombat(this); // host-authoritative combat (fire/hitscan/rockets/damage)
            this.pickups = new FPSPickups(this); // host-authoritative grab/drop + carry

            this.clientTransport = cliEnd; // host's client speaks to its server in-process
        } else {
            this.clientTransport = p2p;
        }

        this.client = new ActionSimClient({
            transport: this.clientTransport,
            localId: this.localId,
            localEntity: this.localController,
            // Carry the LOCAL player's predicted held prop toward our hand before stepping the
            // prediction world — runs live AND inside reconcile resim, so the prop follows smoothly.
            // The grabber pulls within the local controller's own world (clientWorld) using our live aim.
            stepWorld: (dt) => {
                this.localController.grabber.drive(dt);
                this.clientWorld.fixed_update(dt);
            },
            sampleCommand: () => this.game.buildCommand(),
            onRemoteState: (id, s) => this._applyRemote(id, s),
            onLocalState: (s) => this._onLocalState(s),
            // Render remotes ~100ms in the past, lerped between snapshots — smooth at any refresh
            // rate, immune to packet jitter. Purely visual: prediction still uses always-latest
            // ghosts (eachRemoteLatest), and lag-comp rewinds to renderViewTick() so authoritative
            // hits match what we drew. We interpolate position + collider size (x,y,z,w,h) and
            // shortest-arc the aim angles (yaw,pitch) the avatar/weapon pose read.
            renderPolicy: "interpolated",
            interpDelayMs: 100,
            bufferOpts: { lerpKeys: ["x", "y", "z", "w", "h"], angleKeys: ["yaw", "pitch"] },
            // Dynamic runahead: size the server-side input buffer from real RTT (transport.getRtt)
            // instead of a fixed depth — shallow on a LAN (less input lag), deeper across a slow
            // link (fewer starves). The host's loopback transport reports 0, so its own buffer stays
            // at the floor. RTT comes from the P2P manager's ping/pong (ActionNetManagerP2P).
            runahead: { margin: 2, min: 5, max: 16 },
            // Client-side prop prediction: predict a prop when it's FREE or WE hold it (pushing/carrying
            // it feels instant); INTERPOLATE it when another player holds it (we can't model their
            // carry, so predicting it just jitters — let it follow authority smoothly like an avatar).
            // ActionSimClient migrates a prop between the two as heldBy changes (createPredicted /
            // releasePredicted). Free + self-held props use the predicted body; remote-held use a view.
            predictObject: (s) => s && s.type === "prop" && (s.heldBy == null || s.heldBy === this.localId),
            createPredicted: (id, s) => this.props.createPredicted(id, s),
            releasePredicted: (id) => this.props.releasePredicted(id)
        });

        // Authoritative combat FX arrive out-of-band of snapshots. `fx_shot` = one per hitscan
        // shot (the synced cosmetic tracer + hit/damage feedback, fired even on a miss);
        // `fx_explosion` = a rocket detonation (remove the rocket view + blast FX + flash).
        this.clientTransport.on("fx_shot", (msg) => this._onFxShot(msg));
        this.clientTransport.on("fx_explosion", (msg) => this._onExplosion(msg));

        // Membership: host spawns/despawns server players from userJoined/userList/userLeft.
        // Handlers are stored so destroy() can unsubscribe them (a left/rejoined room must not
        // leave a dead session bound to the net manager, double-handling events).
        this._nmHandlers = [];
        const onNm = (ev, fn) => {
            this.nm.on(ev, fn);
            this._nmHandlers.push([ev, fn]);
        };
        if (isHost) {
            onNm("userJoined", (u) => this._onUserJoined(u));
            onNm("userList", (list) => this._onUserList(list));
        }
        onNm("userLeft", (u) => this._onLeft(u));
        onNm("guestLeft", (u) => this._onLeft(u));
    }

    /** Tear down all network subscriptions so this session can be dropped cleanly. */
    destroy() {
        if (this._nmHandlers) {
            for (const [ev, fn] of this._nmHandlers) if (this.nm.off) this.nm.off(ev, fn);
            this._nmHandlers = [];
        }
        if (this._p2pTransport) this._p2pTransport.destroy();
    }

    // Pick a random spawn point from the grid. The grid has 24 slots (6 cols × 4 rows), spread
    // across the open arena and clear of the central pillar.
    spawnFor(_index) {
        const cols = 6, rows = 4;
        const spacingX = 34, spacingZ = 28;
        const slot = Math.floor(Math.random() * cols * rows);
        const col = slot % cols;
        const row = Math.floor(slot / cols);
        const x = (col - (cols - 1) / 2) * spacingX;
        const z = -36 - row * spacingZ;
        return new Vector3(x, 24, z);
    }

    /** Build a kit controller (soldier|jetpack) — the one factory both modes + kit-swaps use. */
    _makeController(world, kit, pos, bodyName, local = false) {
        const opts = {
            ...this.game.controllerTuning, // demonstrate the full controller config (single source of truth)
            position: pos.clone ? pos.clone() : pos,
            visible: false, // first-person: don't render our own collider
            color: "#cc4444", // collider color (only shown when visible:true)
            bodyName,
            // The LOCAL predicted body carries the weapon component (client prediction/FX/ammo) AND its
            // camera rig; the client reads its HP from snapshots, so its combat store stays off. The
            // SERVER's authoritative copies are pure command-driven bodies that DO carry combat — it's
            // the health STORE the host's FPSCombat writes through (FPSPlayerEntity delegates to it) and
            // the snapshot reads from. No weapon FX, camera, or model on them (remotes render via
            // ActionFPSBodyModel); the host owns respawn timing, so the component never self-drives here.
            weapons: local ? FPS_WEAPONS : false,
            view: local ? this.game.cameraConfig : false,
            combat: local ? false : { maxHealth: 100 },
            // Grab rides on BOTH the local predicted body (we predict our own carry) and the host's
            // authoritative bodies (the host re-decides + drives the carry, writing through the grabber).
            grab: this.game.grabConfig,
            model: false,
            input: false
        };
        const ctrl = kit === "jetpack"
            ? new ActionJetpackController3D(world, { ...opts, ...this.game.jetpackTuning })
            : new ActionFPSController3D(world, opts); // default kit = the base controller, instantiated directly
        if (local) this.game._wireLocalWeapon(ctrl); // inject the networked enemy-box seam (tracer clamp); aim/camera self-wire
        return ctrl;
    }

    _addServerPlayer(id) {
        if (!id || id === undefined || this.server.hasPlayer(id)) return;
        const index = this.serverPlayers.size;
        const ctrl = this._makeController(this.serverWorld, "soldier", this.spawnFor(index), "srv_" + index);
        const team = this.gameMode.assignTeam(id, this._joinIndex++);
        const ent = new FPSPlayerEntity(ctrl, id, team);
        ent.kit = "soldier"; // authoritative kit (rebuilt on cmd.kit change)
        // heldProp delegates to ctrl.grabber.held (inits null) — no need to seed it here.
        this.serverPlayers.set(id, ent);
        this.server.addPlayer(id, ent);
    }

    _spawnProps() {
        // Same layout + same construction as single-player (game.fpsPropLayout / game.buildProp) — the
        // host just additionally wraps each body for replication. One world, one code path.
        const specs = this.game.fpsPropLayout();
        for (let i = 0; i < specs.length; i++) {
            const s = specs[i];
            const body = this.game.buildProp(s); // dynamic body, material baked in — identical to SP
            const id = "prop" + i;
            body.body.name = id; // so the pickup raycast can identify this prop by body name
            this.serverWorld.addObject(body);
            const ent = new FPSPropEntity(body, s);
            this.propEntities.set(id, ent);
            this.server.addObject(id, ent);
        }
    }

    _onUserJoined(u) {
        const id = u && (u.id || u.peerId);
        if (id && id !== this.localId) this._addServerPlayer(id);
    }
    _onUserList(list) {
        if (!list) return;
        for (const u of list) {
            const id = u.id || u.peerId;
            if (id && id !== this.localId) this._addServerPlayer(id);
        }
    }
    _onLeft(u) {
        const id = u && (u.id || u.peerId);
        if (!id) return;
        if (this.isHost && this.serverPlayers.has(id)) {
            this.serverPlayers.get(id).controller.destroy();
            this.serverPlayers.delete(id);
            this.server.removePlayer(id);
            this.combatHost.removePlayer(id);
        }
        this.props.removePlayerGhost(id);
        this.avatarMgr.remove(id);
        this.client.removeRemote(id);
    }

    _applyRemote(id, s) {
        if (id === this.localId) return; // never represent our own player as a remote
        // Free / self-held props are PREDICTED (routed to createPredicted, not here). A prop reaches
        // this path only while a REMOTE player holds it — render it from the interpolated snapshot.
        if (s && s.type === "prop") {
            this.props.updatePropView(id, s);
            return;
        }
        if (s && s.type === "rocket") {
            this._updateRocketView(id, s);
            return;
        }
        this.avatarMgr.applyRemote(id, s);
    }

    // Prop replication (predicted bodies / interp views) + player collision ghosts live in
    // FPSPropReplicator (this.props), constructed above. See the class for the moved methods.

    // ---- engine hooks (called by the game) ----

    fixedTick(dt) {
        this.props.syncGhosts(); // position kinematic prop + player ghosts from latest authoritative state
        this.client.tick(dt); // predict (collides against ghosts) + send command
        if (this.isHost) {
            this.server.tick(dt); // authoritative step + snapshot (+ hitscan/rocket-spawn via onCommand)
            this.combatHost._updateRockets(dt); // advance + impact-test flying rockets (after the world step)
            this.combatHost._checkKillPlane(); // kill anyone who fell out of the world
            this.combatHost._updateRespawns();
        }
    }

    update(dt) {
        this.client.sampleRemotes(); // push remote states to avatars/prop views
    }

    // ---- per-command host hook (kit + pickup; combat delegated to FPSCombat) ----

    /**
     * Per-command authoritative hook (host only): apply the kit swap and the pickup edge, stamp the
     * heldProp into the snapshot payload, then hand the command to FPSCombat for the fire dispatch
     * (hitscan / rockets / lag-comp damage). Kept here because kit + pickup are session concerns.
     */
    _onPlayerCommand(id, cmd, server) {
        if (!cmd) return;
        if (cmd.kit !== undefined) this._setPlayerKit(id, cmd.kit); // authoritative kit swap

        // Pickup: toggle grab/drop on the F edge, then reflect the authoritative heldProp in this
        // player's snapshot payload (userData) EVERY tick — beginStep overwrote userData from the
        // command, and the snapshot is sent right after this hook, so the client sees current truth.
        const player = this.serverPlayers.get(id);
        if (player && !player.dead) {
            // Toggle once per UNIQUE command — a starved tick re-applies lastCmd (same seq), and the
            // pickup edge must NOT re-fire on the repeat (toggle isn't idempotent like kit/fire).
            if (cmd.pickup && cmd.seq !== player._lastPickupSeq) {
                player._lastPickupSeq = cmd.seq;
                this.pickups.serverToggle(id);
            }
            const weapon = (cmd.userData && cmd.userData.weapon) | 0;
            player.controller.userData = { weapon, heldProp: player.heldProp || null };
        }

        this.combatHost.onFire(id, cmd, server); // authoritative fire dispatch (hitscan / rockets)
    }

    // The host-authoritative combat (hitscan, rockets, splash/knockback, HP damage, kill plane,
    // respawns) lives in FPSCombat (fpscombat.js), constructed as this.combatHost on the host.

    // ---- combat (client-side reactions) ----

    _onLocalState(s) {
        if (s.health !== undefined) this.localHealth = s.health;
        this.localDead = !!s.dead;
        // Reconcile the carried prop to host authority — the grabber ignores it during the brief grace
        // window right after a local grab/drop (so an in-flight snapshot from before the host saw our F
        // press can't undo it), and otherwise adopts the host's truth.
        this.localController.grabber.reconcile((s.userData && s.userData.heldProp) || null);
    }

    _onFxShot(msg) {
        if (!msg) return;
        if (msg.shooter === this.localId) {
            // We predicted our own tracer already — just resolve the hit feedback.
            if (msg.victim) this.game.onHitConfirmed(!!msg.killed);
        } else {
            // Draw a remote shooter's tracer to the authoritative endpoint (stops at real impact).
            this.game.weapons.addRemoteTracer(msg.ox, msg.oy, msg.oz, msg.ex, msg.ey, msg.ez);
        }
        if (msg.victim === this.localId) this.game.onTookDamage();
    }

    _onExplosion(msg) {
        if (!msg) return;
        // Drop the flying-rocket view and stop interpolating it.
        const v = this.rocketViews.get(msg.id);
        if (v) this.rocketViews.delete(msg.id);
        this.client.removeRemote(msg.id);
        this.game.weapons.spawnExplosion(msg.x, msg.y, msg.z); // cosmetic blast
        if (msg.shooter === this.localId) {
            this.game.weapons.onSelfRocketExploded(msg.x, msg.y, msg.z); // retire the predicted rocket nearest the blast
            if (msg.hurt && msg.hurt.length) this.game.onHitConfirmed(!!(msg.killed && msg.killed.length));
        }
        if (msg.hurt && msg.hurt.indexOf(this.localId) !== -1) this.game.onTookDamage();
    }

    /** Create/update the render-only model for a flying rocket from its snapshot. */
    _updateRocketView(id, s) {
        // Our own rockets are predicted locally (game.localRockets) — don't double-render the
        // replicated copy. Others' rockets render here from snapshots.
        if (s.shooter === this.localId) return;
        let v = this.rocketViews.get(id);
        if (!v) {
            v = ActionBoxGeometry.build(2, 2, 6, "#ffcf6a", false);
            v.name = "rocket_" + id;
            this.rocketViews.set(id, v);
        }
        v.transform.position = new Vector3(s.x, s.y, s.z);
        v.transform.rotation = Quaternion.fromDirection(s.vx, s.vy, s.vz);
    }

    getLocalController() {
        return this.localController;
    }

    /** Rebuild the LOCAL predicted controller for a new kit (preserve pose/velocity). */
    setLocalKit(kitIndex) {
        const want = kitIndex === 1 ? "jetpack" : "soldier";
        if (want === this._localKit) return;
        const old = this.localController;
        const p = old.body.position;
        const v = old.body.linearVelocity;
        old.destroy();
        this.localController = this._makeController(this.clientWorld, want, new Vector3(p.x, p.y, p.z), "cliLocal", true);
        this.localController.body.linearVelocity = new Vector3(v.x, v.y, v.z);
        this.game._carryWeaponState(old, this.localController); // keep equipped slot + ammo across the swap
        this.client.localEntity = this.localController; // the client predicts the new controller
        this._localKit = want;
    }

    /** Rebuild a player's AUTHORITATIVE controller for a new kit (host; preserve pose/velocity). */
    _setPlayerKit(id, kitIndex) {
        const ent = this.serverPlayers.get(id);
        if (!ent) return;
        const want = kitIndex === 1 ? "jetpack" : "soldier";
        if (want === ent.kit) return;
        const old = ent.controller;
        const p = old.body.position;
        const v = old.body.linearVelocity;
        const bodyName = old.bodyId; // keep "srv_N" so raycasts/occlusion still match
        old.destroy();
        const ctrl = this._makeController(this.serverWorld, want, new Vector3(p.x, p.y, p.z), bodyName);
        ctrl.body.linearVelocity = new Vector3(v.x, v.y, v.z);
        ent.controller = ctrl;
        ent.kit = want;
    }

    getRenderObjects() {
        // clientWorld.objects includes the arena, the (invisible) local controller, the PREDICTED
        // props (real dynamic bodies that render AS the props), and the player ghosts (collision-only
        // — skipped here; the avatar draws each player). Then add remote avatars + flying rockets.
        const out = [];
        for (const o of this.clientWorld.objects) {
            if (o._playerGhost) continue;
            out.push(o);
        }
        for (const o of this.avatarMgr.renderObjects()) out.push(o);
        for (const v of this.props.views()) out.push(v); // remote-held props (interpolated, not in clientWorld)
        // Host: add server rocket models directly (skip own — localRockets predicts those).
        // Client: render from snapshot-driven rocketViews (host already excluded ours above).
        if (this.isHost) {
            for (const [, r] of this.combatHost.rockets) {
                if (r.shooterId === this.localId) continue;
                out.push(r.model.objects[0]);
            }
        } else {
            for (const [, v] of this.rocketViews) out.push(v);
        }
        return out;
    }

    playerCount() {
        return 1 + this.avatarMgr.count();
    }

    getNameplates() {
        return this.avatarMgr.nameplates(this.nm);
    }
}
