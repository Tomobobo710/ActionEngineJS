// game/debug/scenedebugpanel.js
class SceneDebugPanel extends BaseDebugPanel {
    constructor(debugCanvas, game) {
        // Configure panel options
        const options = {
            panelId: 'scene',
            toggleId: 'sceneDebugToggle',
            defaultTab: 'basic',
            toggleText: 'Scene Debug',
            toggleX: 20, // Position on far left
            toggleY: 10,
            toggleWidth: 120,
            toggleHeight: 30,
            panelWidth: 450,
            panelHeight: 560,
            panelX: 20, // Position on left side
            panelY: 50,
            tabs: [
                { id: 'basic', label: 'Basic' },
                { id: 'character', label: 'Character' },
                { id: 'camera', label: 'Camera' },
                { id: 'terrain', label: 'Terrain' }
            ]
        };
        
        // Call parent constructor
        super(debugCanvas, game, options);
        
        // Create sliders for character properties with default values
        // The character might not exist yet when this panel is created
        this.characterSliders = {
            "Move Speed": {
                value: this.game.character ? (this.game.character.moveSpeed || 5) : 5,
                min: 1,
                max: 20,
                id: "characterMoveSpeed",
                updateProperty: (value) => { 
                    if (this.game.character) {
                        this.game.character.moveSpeed = value; 
                    }
                }
            },
            "Jump Force": {
                value: this.game.character ? (this.game.character.jumpForce || 8) : 8,
                min: 1,
                max: 30,
                id: "characterJumpForce",
                updateProperty: (value) => { 
                    if (this.game.character) {
                        this.game.character.jumpForce = value; 
                    }
                }
            },
            "Gravity": {
                value: this.game.character ? (this.game.character.gravity || 9.8) : 9.8,
                min: 1,
                max: 30,
                id: "characterGravity",
                updateProperty: (value) => { 
                    if (this.game.character) {
                        this.game.character.gravity = value; 
                    }
                }
            }
        };
        
        // Create sliders for camera properties with null checks
        this.cameraSliders = {
            "Follow Speed": {
                value: this.game.camera ? (this.game.camera.followSpeed || 5) : 5,
                min: 1,
                max: 20,
                id: "cameraFollowSpeed",
                updateProperty: (value) => { 
                    if (this.game.camera) {
                        this.game.camera.followSpeed = value; 
                    }
                }
            },
            "Distance": {
                value: this.game.camera ? (this.game.camera.distance || 10) : 10,
                min: 1,
                max: 50,
                id: "cameraDistance",
                updateProperty: (value) => { 
                    if (this.game.camera) {
                        this.game.camera.distance = value; 
                    }
                }
            },
            "Height": {
                value: this.game.camera ? (this.game.camera.height || 5) : 5,
                min: 0,
                max: 30,
                id: "cameraHeight",
                updateProperty: (value) => { 
                    if (this.game.camera) {
                        this.game.camera.height = value; 
                    }
                }
            }
        };
        
        // Create toggles for scene settings with null checks
        const hasCharacterCamera = this.game.character && this.game.character.camera;
        
        this.sceneToggles = [
            {
                id: "toggleWireframe",
                label: "Show Wireframe",
                checked: this.game.renderer3D ? !!this.game.renderer3D.showWireframe : false,
                updateProperty: (value) => { 
                    if (this.game.renderer3D) {
                        this.game.renderer3D.showWireframe = value; 
                    }
                }
            },
            {
                id: "toggleFog",
                label: "Enable Fog",
                checked: this.game.renderer3D ? (this.game.renderer3D.useFog !== false) : true,
                updateProperty: (value) => { 
                    if (this.game.renderer3D) {
                        this.game.renderer3D.useFog = value; 
                    }
                }
            },
            {
                id: "toggleFreeCam",
                label: "Free Camera Mode",
                checked: hasCharacterCamera ? !!this.game.character.camera.isDetached : false,
                updateProperty: (value) => { 
                    if (this.game.character && this.game.character.camera) {
                        this.game.character.camera.isDetached = value; 
                    }
                }
            },
            {
                id: "toggleRandomBattles",
                label: "Enable Random Battles",
                checked: this.game.enableRandomBattles !== false, // Default to true if not set
                updateProperty: (value) => { 
                    if (this.game) {
                        this.game.enableRandomBattles = value; 
                    }
                }
            }
        ];
        
        // Create buttons for world generation
        this.worldButtons = [
            {
                id: "regenerateWorld",
                label: "Regenerate World",
                x: this.panelX + 50,
                y: this.panelY + 100,
                width: 200,
                height: 40,
                color: "#3355aa"
            },
            {
                id: "resetCharacterPosition",
                label: "Reset Character Position",
                x: this.panelX + 50,
                y: this.panelY + 160,
                width: 200,
                height: 40,
                color: "#3355aa"
            }
        ];
        
        // Register UI elements - explicitly register tabs first
        // Register tabs
        this.tabs.forEach((tab, index) => {
            const tabElementId = `scene_tab_${tab.id}`;
            this.game.input.registerElement(
                tabElementId,
                {
                    bounds: () => ({
                        x: this.panelX + (index * (this.panelWidth / this.tabs.length)),
                        y: this.panelY,
                        width: this.panelWidth / this.tabs.length,
                        height: 30
                    })
                },
                "debug"
            );
        });
        
        // Register other UI elements
        this.registerSliders(this.characterSliders, "character");
        this.registerSliders(this.cameraSliders, "camera");
        this.registerToggles(this.sceneToggles);
        this.registerButtons(this.worldButtons);
    }
    
    // Update method, called each frame
    updateContent() {
        // Handle character sliders if character tab is active
        if (this.activeTab === 'character') {
            this.handleOptionSliders(this.characterSliders);
        }
        
        // Handle camera sliders if camera tab is active
        else if (this.activeTab === 'camera') {
            this.handleOptionSliders(this.cameraSliders);
        }
        
        // Handle terrain tab interactions
        else if (this.activeTab === 'terrain') {
            // Handle world regeneration button
            if (this.game.input.isElementJustPressed("regenerateWorld", "debug")) {
                // Logic to regenerate the world - we'll use the seed mechanism since that's what the game uses
                if (this.game) {
                    // This is the pattern used in WorldMode.js when regenerating the world
                    console.log("[SceneDebugPanel] Generating new world...");
                    if (typeof this.game.seed !== 'undefined') {
                        this.game.seed = Math.floor(Math.random() * 10000);
                    }
                    if (typeof this.game.generateWorld === 'function') {
                        this.game.generateWorld();
                    }
                }
            }
            
            // Handle character position reset button
            if (this.game.input.isElementJustPressed("resetCharacterPosition", "debug")) {
                if (this.game.character && this.game.character.body) {
                    // Use the body property which appears to be used for physics
                    this.game.character.body.position.x = 0;
                    this.game.character.body.position.y = 100; // Start high up
                    this.game.character.body.position.z = 0;
                    
                    // Reset velocity if it exists
                    if (this.game.character.body.linear_velocity) {
                        this.game.character.body.linear_velocity.x = 0;
                        this.game.character.body.linear_velocity.y = 0;
                        this.game.character.body.linear_velocity.z = 0;
                    }
                }
            }
        }
        
        // Handle scene toggles (these work on any tab)
        this.sceneToggles.forEach(toggle => {
            if (this.game.input.isElementJustPressed(toggle.id, "debug")) {
                toggle.checked = !toggle.checked;
                if (toggle.updateProperty) {
                    toggle.updateProperty(toggle.checked);
                }
            }
        });
    }
    
    // Draw method for the debug panel content
    drawContent() {
        // Draw content based on active tab
        switch (this.activeTab) {
            case 'basic': this.drawBasicInfo(); break;
            case 'character': this.drawCharacterControls(); break;
            case 'camera': this.drawCameraControls(); break;
            case 'terrain': this.drawTerrainControls(); break;
        }
    }
    
    // Draw the basic info tab content
    drawBasicInfo() {
        const padding = 10;
        const lineHeight = 16;
        let currentY = this.panelY + 70; // Adjusted to be inside the panel box
        
        // Set text alignment to left for all content in this tab
        this.ctx.textAlign = "left";
        
        // Define helper functions
        const addLine = (label, value) => {
            if (value === undefined || value === null) {
                value = "N/A";
            }
            this.ctx.textAlign = "left";
            this.ctx.fillText(`${label}: ${value}`, this.panelX + 20, currentY);
            currentY += lineHeight;
        };
        
        const addVector = (label, vector) => {
            if (!vector) {
                addLine(label, "N/A");
                return;
            }
            addLine(
                label,
                `${this.roundTo(vector.x, this.roundingConfig.positionPrecision)}, ${this.roundTo(vector.y, this.roundingConfig.positionPrecision)}, ${this.roundTo(vector.z, this.roundingConfig.positionPrecision)}`
            );
        };
        
        // First show the Scene Settings header
        this.ctx.fillStyle = "#00ff00";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Scene Settings", this.panelX + 20, currentY);
        currentY += lineHeight;
        
        // Draw toggles
        this.drawToggles(this.sceneToggles);
        
        // Add some space after toggles
        currentY += 170;
        
        // Performance metrics
        this.ctx.fillStyle = "#00ff00";
        addLine("Use 2D Renderer", this.game.use2DRenderer ? "Enabled" : "Disabled");
        this.ctx.fillStyle = "#ffffff";
        addLine("FPS", this.roundTo(this.game.debugPanel ? this.game.debugPanel.getFPS() : 0, this.roundingConfig.fpsPrecision));
        addLine("Delta Time", this.roundTo(this.game.deltaTime * 1000, this.roundingConfig.timePrecision) + "ms");
    }
    
    // Draw the character controls tab content
    drawCharacterControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Character Settings", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw sliders
        super.drawSliders(this.characterSliders);
        
        // Check if character exists
        if (!this.game.character) {
            this.ctx.fillStyle = "#ff5555";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Character not available", this.panelX + this.panelWidth / 2, this.panelY + 250);
            return;
        }
        
        const offsetY = this.panelY + 250;
        let currentY = offsetY;
        const lineHeight = 16;
        
        // Helper function to add text lines
        const addLine = (label, value) => {
            this.ctx.fillText(`${label}: ${value}`, this.panelX + 20, currentY);
            currentY += lineHeight;
        };
        
        // Display basic character info regardless of debug info availability
        this.ctx.fillStyle = "#00ff00";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Character Information", this.panelX + 20, currentY);
        currentY += lineHeight;
        
        this.ctx.fillStyle = "#ffffff";
        
        // Show position from either character.position or character.body.position
        if (this.game.character.position) {
            addLine("Position", this.formatVector(this.game.character.position));
        } else if (this.game.character.body && this.game.character.body.position) {
            addLine("Position", this.formatVector(this.game.character.body.position));
        }
        
        // Show velocity if available
        if (this.game.character.velocity) {
            addLine("Velocity", this.formatVector(this.game.character.velocity));
        } else if (this.game.character.body && this.game.character.body.linear_velocity) {
            addLine("Velocity", this.formatVector(this.game.character.body.linear_velocity));
        }
        
        // Show rotation if available
        if (typeof this.game.character.rotation !== 'undefined') {
            addLine("Rotation", this.game.character.rotation);
        }
        
        // Check if advanced debug info is available
        if (typeof this.game.character.getDebugInfo === 'function') {
            try {
                const characterDebug = this.game.character.getDebugInfo();
                if (characterDebug) {
                    // State info
                    if (characterDebug.state) {
                        currentY += 10;
                        this.ctx.fillStyle = "#00ff00";
                        this.ctx.fillText("Character State", this.panelX + 20, currentY);
                        currentY += lineHeight;
                        
                        this.ctx.fillStyle = "#ffffff";
                        if (characterDebug.state.current) {
                            addLine("Current State", characterDebug.state.current);
                        }
                        
                        if (characterDebug.state.lastTransition) {
                            addLine("Last State", characterDebug.state.lastTransition.from || "None");
                            const timeSinceTransition = Date.now() - characterDebug.state.lastTransition.time;
                            addLine("Time In State", Math.round(timeSinceTransition) + "ms");
                        }
                    }
                    
                    // Physics info
                    if (characterDebug.physics) {
                        currentY += 10;
                        this.ctx.fillStyle = "#00ff00";
                        this.ctx.fillText("Physics", this.panelX + 20, currentY);
                        currentY += lineHeight;
                        
                        this.ctx.fillStyle = "#ffffff";
                        if (characterDebug.physics.position) {
                            addLine("Debug Position", this.formatVector(characterDebug.physics.position));
                        }
                        if (characterDebug.physics.velocity) {
                            addLine("Debug Velocity", this.formatVector(characterDebug.physics.velocity));
                        }
                    }
                    
                    // Movement info
                    if (characterDebug.movement) {
                        currentY += 10;
                        this.ctx.fillStyle = "#00ff00";
                        this.ctx.fillText("Movement", this.panelX + 20, currentY);
                        currentY += lineHeight;
                        
                        this.ctx.fillStyle = "#ffffff";
                        if (characterDebug.movement.input_direction) {
                            addLine("Raw Input", this.formatVector(characterDebug.movement.input_direction));
                        }
                        if (characterDebug.movement.raw_move) {
                            addLine("Raw Move", this.formatVector(characterDebug.movement.raw_move));
                        }
                        if (characterDebug.movement.projected_move) {
                            addLine("Projected Move", this.formatVector(characterDebug.movement.projected_move));
                        }
                    }
                }
            } catch (error) {
                // If there's an error getting debug info, just show basic info
                this.ctx.fillStyle = "#ff5555";
                currentY += 10;
                addLine("Debug Info", "Error retrieving detailed info");
            }
        }
    }
    
    
    // Draw the camera controls tab content
    drawCameraControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Camera Settings", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw sliders
        super.drawSliders(this.cameraSliders);
        
        // Camera info section
        
        // Camera info section
        const offsetY = this.panelY + 250;
        let currentY = offsetY;
        const lineHeight = 16;
        
        // Check if camera exists
        if (!this.game.camera) {
            this.ctx.fillStyle = "#ff5555";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Camera not available", this.panelX + this.panelWidth / 2, offsetY);
            return;
        }
        
        // Helper function to add text lines
        const addLine = (label, value) => {
            this.ctx.fillText(`${label}: ${value}`, this.panelX + 20, currentY);
            currentY += lineHeight;
        };
        
        // Camera metrics
        this.ctx.fillStyle = "#00ff00";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Camera Info", this.panelX + 20, currentY);
        currentY += lineHeight;
        
        this.ctx.fillStyle = "#ffffff";
        
        // Check if character and character.camera exist
        if (this.game.character && this.game.character.camera) {
            addLine("Camera Mode", this.game.character.camera.isDetached ? "Detached" : "Following");
        } else {
            addLine("Camera Mode", "N/A");
        }
        
        // Now display camera properties
            // Display camera properties that definitely exist
            if (this.game.camera.position) {
                addLine("Position", this.formatVector(this.game.camera.position));
            }
            
            if (this.game.camera.target) {
                addLine("Target", this.formatVector(this.game.camera.target));
            }
            
            // Calculate distance and height based on camera properties
            if (this.game.camera.position && this.game.camera.target) {
                const dx = this.game.camera.position.x - this.game.camera.target.x;
                const dy = this.game.camera.position.y - this.game.camera.target.y;
                const dz = this.game.camera.position.z - this.game.camera.target.z;
                const calculatedDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                addLine("Distance", this.roundTo(calculatedDist, this.roundingConfig.positionPrecision));
                
                if (this.game.character && this.game.character.position) {
                    const camHeight = this.game.camera.position.y - this.game.character.position.y;
                    addLine("Height Above Character", this.roundTo(camHeight, this.roundingConfig.positionPrecision));
                }
            }
            
            // Display known camera properties if they exist
            if (typeof this.game.camera.followSpeed !== 'undefined') {
                addLine("Follow Speed", this.game.camera.followSpeed);
            }
            
            if (typeof this.game.camera.distance !== 'undefined') {
                addLine("Distance Setting", this.game.camera.distance);
            }
            
            if (typeof this.game.camera.height !== 'undefined') {
                addLine("Height Setting", this.game.camera.height);
            }

        
        // Camera view frustum info if available
        if (this.game.camera.frustum) {
            currentY += 10;
            this.ctx.fillStyle = "#00ff00";
            this.ctx.fillText("View Frustum", this.panelX + 20, currentY);
            currentY += lineHeight;
            
            this.ctx.fillStyle = "#ffffff";
            addLine("Near", this.game.camera.frustum.near);
            addLine("Far", this.game.camera.frustum.far);
            addLine("FOV", this.game.camera.frustum.fov);
        }
    }
    
    // Draw the terrain controls tab content
    drawTerrainControls() {
        // Title
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Terrain Settings", this.panelX + this.panelWidth / 2, this.panelY + 50);
        
        // Draw buttons
        this.drawButtons(this.worldButtons);
        
        // Terrain info section
        const offsetY = this.panelY + 250;
        let currentY = offsetY;
        const lineHeight = 16;
        
        // Check if terrain exists
        if (!this.game.terrain) {
            this.ctx.fillStyle = "#ff5555";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Terrain not available", this.panelX + this.panelWidth / 2, offsetY);
            return;
        }
        
        // Helper function to add text lines
        const addLine = (label, value) => {
            this.ctx.fillText(`${label}: ${value}`, this.panelX + 20, currentY);
            currentY += lineHeight;
        };
        
        // Terrain metrics
        this.ctx.fillStyle = "#00ff00";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Terrain Info", this.panelX + 20, currentY);
        currentY += lineHeight;
        
        this.ctx.fillStyle = "#ffffff";
        
        // Display terrain seed if available
        if (typeof this.game.seed !== 'undefined') {
            addLine("World Seed", this.game.seed);
        }
        
        // Display terrain type/name if available
        if (this.game.terrain.generator && this.game.terrain.generator.name) {
            addLine("Generator", this.game.terrain.generator.name);
        }
        
        // Check if character exists and position can be determined
        let characterPosition;
        if (this.game.character) {
            if (this.game.character.position) {
                characterPosition = this.game.character.position;
            } else if (this.game.character.body && this.game.character.body.position) {
                characterPosition = this.game.character.body.position;
            }
        }
        
        if (!characterPosition) {
            addLine("Ground Height", "N/A (character position unknown)");
        } else {
            // Get terrain height at character position
            try {
                if (typeof this.game.terrain.getHeightAt === 'function') {
                    const terrainHeight = this.game.terrain.getHeightAt(
                        characterPosition.x,
                        characterPosition.z
                    );
                    
                    addLine("Ground Height", this.roundTo(terrainHeight, this.roundingConfig.positionPrecision));
                    addLine("Character Y", this.roundTo(characterPosition.y, this.roundingConfig.positionPrecision));
                    
                    // Display height difference
                    const heightDiff = characterPosition.y - terrainHeight;
                    addLine("Height Above Ground", this.roundTo(heightDiff, this.roundingConfig.positionPrecision));
                } else {
                    addLine("Ground Height", "N/A (getHeightAt not available)");
                }
            } catch (error) {
                addLine("Ground Height", "Error getting height");
            }
        }
        
        // Triangle info that character is standing on - only if method exists
        if (this.game.character && typeof this.game.character.getCurrentTriangle === 'function') {
            currentY += 10;
            this.ctx.fillStyle = "#00ff00";
            this.ctx.fillText("Current Triangle", this.panelX + 20, currentY);
            currentY += lineHeight;
            
            try {
                const triangle = this.game.character.getCurrentTriangle();
                
                if (triangle) {
                    this.ctx.fillStyle = "#ffffff";
                    if (typeof triangle.minY !== 'undefined') {
                        addLine("Min Height", this.roundTo(triangle.minY, this.roundingConfig.positionPrecision));
                    }
                    if (typeof triangle.maxY !== 'undefined') {
                        addLine("Max Height", this.roundTo(triangle.maxY, this.roundingConfig.positionPrecision));
                    }
                    if (typeof triangle.avgY !== 'undefined') {
                        addLine("Avg Height", this.roundTo(triangle.avgY, this.roundingConfig.positionPrecision));
                    }
                    if (triangle.normal) {
                        addLine("Normal", this.formatVector(triangle.normal));
                    }
                    if (typeof triangle.biome !== 'undefined') {
                        addLine("Biome", triangle.biome);
                    }
                } else {
                    this.ctx.fillStyle = "#ff5555";
                    addLine("Triangle", "None found");
                }
            } catch (error) {
                this.ctx.fillStyle = "#ff5555";
                addLine("Triangle", "Error retrieving triangle");
            }
        }
    }
}