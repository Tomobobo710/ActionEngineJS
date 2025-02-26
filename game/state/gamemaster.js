// game/state/gamemaster.js
class GameMaster {
    constructor(canvases, input, audio) {
        this.canvases = canvases;
        this.input = input;
        this.audio = audio;

        this.modeManager = new GameModeManager(this);

        // Persistent game state
        this.playerState = {
        position: new Vector3(0, 500, 0),
        rotation: 0,
        linear_velocity: new Vector3(0, 0, 0),
        angular_velocity: new Vector3(0, 0, 0),
        physics_properties: {
            friction: 0.5,
            restitution: 0.1
        }
    };

        // Add party and inventory creation here
        this.partyInventory = new Inventory();
        this.persistentParty = DEFAULT_PARTY.map(
            (char) =>
                new Character({
                    ...char,
                    sprite: null // Sprites will be handled by BattleMode
                })
        );
        this.persistentParty.gold = 500;
        
        // Add colors as a deep copy of the defaults
        this.persistentParty.colors = JSON.parse(JSON.stringify(DEFAULT_COLORS));
        
        // Attach inventory to party
        Object.defineProperty(this.persistentParty, "inventory", {
            value: this.partyInventory,
            enumerable: false
        });

        // Add starter items
        STARTER_INVENTORY.forEach(({ item, quantity }) => {
            this.partyInventory.addItem(item, quantity);
        });

        // Kickstart game with a mode
        this.modeManager.switchMode("start");

        // Set up visibility handlers
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });

        window.addEventListener("blur", () => this.pause());
        window.addEventListener("focus", () => this.resume());

        this.lastTime = performance.now();
        this.deltaTime = 0;
        
        this.worldTime = {
            hours: 12,
            minutes: 0
        };
    }

    getWorldTime() {
        return { ...this.worldTime }; // Return copy to prevent direct mutation
    }

    setWorldTime(hours, minutes) {
        this.worldTime.hours = hours;
        this.worldTime.minutes = minutes;
    }
    
    update() {
        const currentTime = performance.now();
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
        this.lastTime = currentTime;

        // Check for mode switch input
        if (this.input.isKeyJustPressed("ActionDebugToggle")) {
            this.modeManager.cycleMode();
        }

        this.modeManager.update(this.deltaTime);
    }

    draw() {
        this.modeManager.draw();
    }

    pause() {
        this.modeManager.pause();
    }

    resume() {
        this.lastTime = performance.now();
        this.modeManager.resume();
    }

    savePlayerState(position, rotation, linear_vel, angular_vel, physics_props = null) {
        this.playerState.position = position;
        this.playerState.rotation = rotation;
        this.playerState.linear_velocity = linear_vel;
        this.playerState.angular_velocity = angular_vel;

        if (physics_props) {
            this.playerState.physics_properties = physics_props;
        }
    }

    getPlayerState() {
        return this.playerState;
    }
}