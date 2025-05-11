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
        this.equipmentInventory = new EquipmentInventory();
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
        
        // Add equipment to inventory
        this.equipmentInventory.addItem(EQUIPMENT.ironSword);
        this.equipmentInventory.addItem(EQUIPMENT.steelSword);
        this.equipmentInventory.addItem(EQUIPMENT.magicWand);
        this.equipmentInventory.addItem(EQUIPMENT.chainmail);
        this.equipmentInventory.addItem(EQUIPMENT.plateArmor);
        this.equipmentInventory.addItem(EQUIPMENT.wizardHat);
        this.equipmentInventory.addItem(EQUIPMENT.ironHelm);
        this.equipmentInventory.addItem(EQUIPMENT.powerRing);
        this.equipmentInventory.addItem(EQUIPMENT.magicPendant);
        this.equipmentInventory.addItem(EQUIPMENT.guardianAmulet);
        
        // Start each character with equipment
        // Warrior (Cecil)
        this.persistentParty[0].equipment = {
            weapon: JSON.parse(JSON.stringify(EQUIPMENT.bronzeSword)),
            armor: JSON.parse(JSON.stringify(EQUIPMENT.leatherArmor)),
            helmet: JSON.parse(JSON.stringify(EQUIPMENT.leatherCap)),
            accessory: null
        };
        
        // Mage (Rosa)
        this.persistentParty[1].equipment = {
            weapon: JSON.parse(JSON.stringify(EQUIPMENT.woodenStaff)),
            armor: JSON.parse(JSON.stringify(EQUIPMENT.magicRobe)),
            helmet: JSON.parse(JSON.stringify(EQUIPMENT.wizardHat)),
            accessory: null
        };
        
        // Thief (Edge)
        this.persistentParty[2].equipment = {
            weapon: JSON.parse(JSON.stringify(EQUIPMENT.dagger)),
            armor: JSON.parse(JSON.stringify(EQUIPMENT.shadowCloak)),
            helmet: null,
            accessory: JSON.parse(JSON.stringify(EQUIPMENT.speedBoots))
        };
        
        // Calculate stats with equipment
        this.persistentParty.forEach(character => character.calculateStats());

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
    
    fixed_update(fixedDeltaTime){
        // Pass fixed timestep updates to active mode
        this.modeManager.fixed_update(fixedDeltaTime);
    }
    
    update(deltaTime) {
        // Use the provided deltaTime instead of calculating our own
        this.deltaTime = deltaTime;
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