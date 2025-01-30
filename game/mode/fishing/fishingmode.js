class FishingMode {
   constructor(canvases, input, audio) {
       this.canvas = canvases.gameCanvas;
       this.guiCanvas = canvases.guiCanvas;
       this.debugCanvas = canvases.debugCanvas;
       this.input = input;
       this.physicsWorld = new ActionPhysicsWorld3D();
       this.renderer3d = new ActionRenderer3D(this.canvas);
       this.guiContext = this.guiCanvas.getContext('2d');
       this.fishes = [];

       // Setup volumetric rendering
       this.setupVolumetrics();

       // Initialize camera
       this.camera = new ActionCamera(
           new Vector3(0, 20, -60),
           new Vector3(0, 0, 0)
       );

       this.cameraState = 'fisher';
       this.cameraAngle = Math.PI;
       this.cameraRadius = 20;
       this.cameraHeight = 20;

       this.shaderManager = new ShaderManager(this.renderer3d.gl);
       this.shaderManager.registerAllShaders(this.renderer3d);
       this.physicsWorld.setShaderManager(this.shaderManager);
       
       // Add ocean
       this.ocean = new Ocean(this.physicsWorld, 500, 500, 8, 1);
       
       this.fishingArea = new FishingArea();
       this.fisher = new Fisher(this, new Vector3(0, 30, -50));
       this.lure = new Lure(this.physicsWorld);
       this.lure.visible = false;
       this.fisher.attachLure(this.lure);

       this.hookingBarVisible = false;
       this.hookingProgress = 0;

       this.generateInitialFish(50);
       this.caughtFishManager = new CaughtFishManager();
    

       this.lastTime = performance.now();
   }

     generateInitialFish(count) {
    const types = ["BASS", "TROUT", "SWORDFISH"];
    
    // Divide the fishing area into sectors
    const sectorsPerDimension = Math.ceil(Math.cbrt(count)); // Cubic root for 3D division
    const sectorWidth = this.fishingArea.bounds.width / sectorsPerDimension;
    const sectorDepth = this.fishingArea.bounds.depth / sectorsPerDimension;
    const sectorLength = this.fishingArea.bounds.length / sectorsPerDimension;

    // Create array of all possible sectors
    const sectors = [];
    for (let x = 0; x < sectorsPerDimension; x++) {
        for (let y = 0; y < sectorsPerDimension; y++) {
            for (let z = 0; z < sectorsPerDimension; z++) {
                sectors.push({x, y, z});
            }
        }
    }

    // Shuffle sectors array for random distribution
    for (let i = sectors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sectors[i], sectors[j]] = [sectors[j], sectors[i]];
    }

    // Generate fish in different sectors
    for (let i = 0; i < count; i++) {
        // Get sector for this fish
        const sector = sectors[i % sectors.length];
        
        // Calculate position within sector (with some randomization within the sector)
        const position = new Vector3(
            ((sector.x + Math.random()) * sectorWidth - this.fishingArea.bounds.width/2),
            ((sector.y + Math.random()) * sectorDepth - this.fishingArea.bounds.depth/2),
            ((sector.z + Math.random()) * sectorLength - this.fishingArea.bounds.length/2)
        );

        const rotationAxis = ["x", "y", "z"][Math.floor(Math.random() * 3)];
        const randomType = types[Math.floor(Math.random() * types.length)];

        const fish = FishGenerator.generate(
            this.physicsWorld,
            randomType,
            position,
            rotationAxis
        );
        
        this.fishes.push(fish);
        this.fishingArea.addFish(fish);
    }
}
  // Add method to handle caught fish
    handleFishCaught(fish) {
        // Add fish to caught fish manager
        const fishId = this.caughtFishManager.addFish(fish, this.fishingArea.fish.get(fish));
        
        // Remove fish from active fishing area
        this.fishingArea.fish.delete(fish);
        const fishIndex = this.fishes.indexOf(fish);
        if (fishIndex > -1) {
            this.fishes.splice(fishIndex, 1);
        }
        
        // Clean up physics body
        if (fish.body) {
            this.physicsWorld.removeObject(fish);
        }
        
        return fishId;
    }
    
    tryHookFish() {
        console.log("Attempting to hook fish!");
        for (const fish of this.fishes) {
            const fishAI = this.fishingArea.fish.get(fish);
            if (fishAI.tryHook(this.lure)) {
                console.log('Fish successfully hooked!');
                break;
            }
        }
    }
    
    showCaughtFishUI(fishId) {
        const fishData = this.caughtFishManager.getFish(fishId);
        if (!fishData) return;

        // Add to GUI drawing
        this.showCaughtFishDialog = true;
        this.caughtFishId = fishId;
    }
    
   setupVolumetrics() {
       const gl = this.renderer3d.gl;
    
       // Create depth texture
       this.depthTexture = gl.createTexture();
       gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
       gl.texImage2D(
           gl.TEXTURE_2D,
           0,
           gl.DEPTH_COMPONENT24,
           800,
           600,
           0,
           gl.DEPTH_COMPONENT,
           gl.UNSIGNED_INT,
           null
       );
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    
       // Create framebuffer and attach depth texture
       this.depthFramebuffer = gl.createFramebuffer();
       gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthFramebuffer);
       gl.framebufferTexture2D(
           gl.FRAMEBUFFER,
           gl.DEPTH_ATTACHMENT,
           gl.TEXTURE_2D,
           this.depthTexture,
           0
       );
   }

   update(deltaTime) {
       
       // Reset hooking UI state at start of update
       this.hookingBarVisible = false;
       this.hookingProgress = 0;

       // Update fisher and check for state changes
       this.fisher.update(deltaTime, this.input);
       
       // Update lure
       this.lure.update(deltaTime);
       
       // Update camera
       this.updateCamera(deltaTime);
       
       // Update ocean
       this.ocean.update(deltaTime);
       
       // Update fishing area (which updates fish movement)
       this.fishingArea.update(deltaTime);
       
       // Check for attackable fish and update UI
       for (const fish of this.fishes) {
           const fishAI = this.fishingArea.fish.get(fish);
           if (fishAI.currentBehavior === fishAI.behaviors.attack && 
               fishAI.canBeHooked) {
               this.hookingBarVisible = true;
               this.hookingProgress = fishAI.currentBehavior.getHookingWindowProgress();
           }
       }

       // Handle hook input
       if (this.input.isKeyJustPressed('Action1')) {
           this.tryHookFish();
       }

       // Draw casting power meter when charging
       if (this.fisher.isChargingCast) {
           this.drawCastingPowerMeter(this.fisher.getCastPowerPercentage());
       }

       this.fishes.forEach(fish => { fish.update(deltaTime); });
       this.physicsWorld.update(deltaTime);
       
       if (this.input.isKeyJustPressed("Numpad0")) {
            this.camera.isDetached = !this.camera.isDetached;
        }
        if (this.camera.isDetached) {
            this.camera.handleDetachedInput(this.input, deltaTime);
            return;
        }
   }

    updateCamera(deltaTime) {
    if (this.camera.isDetached) return;

    const CAMERA_LERP_SPEED = 3;
    const CAMERA_ROTATION_SPEED = 2;
    let targetPos, targetLookAt;

    switch(this.fisher.state) {
        case 'ready':
            // Align camera with fisher's orientation
            const cameraOffset = new Vector3(
                -Math.sin(this.fisher.aimAngle), // Use negative sin for correct left/right
                1.5,  // Height above fisher
                -Math.cos(this.fisher.aimAngle)  // Use negative cos for correct forward/back
            ).scale(40);
            
            targetPos = this.fisher.position.add(cameraOffset);
            targetLookAt = this.fisher.position.add(
                new Vector3(
                    Math.sin(this.fisher.aimAngle),
                    0,
                    Math.cos(this.fisher.aimAngle)
                ).scale(20)
            );
            break;

        case 'casting':
            // Maintain behind view during cast
            const castViewOffset = new Vector3(
                Math.cos(this.fisher.aimAngle + Math.PI), // Add PI to keep behind view
                1.5,
                Math.sin(this.fisher.aimAngle + Math.PI)  // Add PI to keep behind view
            ).scale(30);

            targetPos = this.lure.position.add(castViewOffset);
            targetLookAt = this.lure.position;
            break;

        case 'fishing':
            // Start with the base angle that matches our initial behind view
            if (!this.initialFishingAngle) {
                this.initialFishingAngle = 0; // Start at 0 to face the back
            }
            
            // Allow rotation but start from behind perspective
            if (this.input.isKeyPressed('Numpad4')) {
                this.initialFishingAngle += CAMERA_ROTATION_SPEED * deltaTime;
            }
            if (this.input.isKeyPressed('Numpad6')) {
                this.initialFishingAngle -= CAMERA_ROTATION_SPEED * deltaTime;
            }

            const fishingOffset = new Vector3(
                -Math.sin(this.initialFishingAngle),
                1.5,
                -Math.cos(this.initialFishingAngle)
            ).scale(30);
            
            targetPos = this.lure.position.add(fishingOffset);
            targetLookAt = this.lure.position;
            break;

        case 'reeling':
            const distanceToFisher = this.lure.position.distanceTo(this.fisher.position);
            if (distanceToFisher < 15) {
                // Transition back to fisher view when close
                const returnOffset = new Vector3(
                    -Math.sin(this.fisher.aimAngle),
                    1.5,
                    -Math.cos(this.fisher.aimAngle)
                ).scale(40);
                targetPos = this.fisher.position.add(returnOffset);
                targetLookAt = this.fisher.position;
            } else {
                // Keep following lure while reeling
                const reelingOffset = new Vector3(
                    -Math.sin(this.cameraAngle),
                    1.5,
                    -Math.cos(this.cameraAngle)
                ).scale(30);
                targetPos = this.lure.position.add(reelingOffset);
                targetLookAt = this.lure.position;
            }
            break;
    }

    // Smooth camera movement using lerp
    this.camera.position = this.lerpVector(
        this.camera.position, 
        targetPos, 
        deltaTime * CAMERA_LERP_SPEED
    );
    this.camera.target = this.lerpVector(
        this.camera.target,
        targetLookAt,
        deltaTime * CAMERA_LERP_SPEED
    );
}
pause() {
       this.physicsWorld.pause();
   }

   resume() {
       this.lastTime = performance.now();
       this.physicsWorld.resume();
   }
 lerpVector(start, end, t) {
    return new Vector3(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t,
        start.z + (end.z - start.z) * t
    );
}
 
     drawUI() {
    // Draw instructions
    this.guiContext.fillStyle = '#fff';
    this.guiContext.font = '16px Arial';
    this.guiContext.textAlign = 'left';
    this.guiContext.fillText('Hold SHIFT to charge cast', 10, 30);
    this.guiContext.fillText('Release SHIFT to cast', 10, 50);
    this.guiContext.fillText('WASD to move lure', 10, 70);
    this.guiContext.fillText('SPACE to reel in', 10, 90);

    // Draw hooking bar if active
    if (this.hookingBarVisible) {
        this.drawHookingBar(this.hookingProgress);
    }

    // Draw casting power meter when charging
    if (this.fisher.isChargingCast) {
        this.drawCastingPowerMeter(this.fisher.getCastPowerPercentage());
    }
         
    if (this.fisher.lure?.hookedFish) {
            this.drawLineTensionMeter(this.fisher.lineTension);
        }
         
     if (this.showCaughtFishDialog) {
            this.drawCaughtFishDialog();
        }    
}
    
    drawCaughtFishDialog() {
    const fishData = this.caughtFishManager.getFish(this.caughtFishId);
    if (!fishData) return;

    // Draw dialog background
    const dialogWidth = 300;
    const dialogHeight = 200;
    const x = (this.guiCanvas.width - dialogWidth) / 2;
    const y = (this.guiCanvas.height - dialogHeight) / 2;

    this.guiContext.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.guiContext.fillRect(x, y, dialogWidth, dialogHeight);

    // Draw fish info
    this.guiContext.fillStyle = '#fff';
    this.guiContext.font = '20px Arial';
    this.guiContext.textAlign = 'center';
    this.guiContext.fillText(`Caught a ${fishData.type || 'Fish'}!`, x + dialogWidth/2, y + 40);
    
    // Add null check for size
    const sizeText = fishData.size ? `Size: ${fishData.size.toFixed(2)}` : 'Size: Unknown';
    this.guiContext.fillText(sizeText, x + dialogWidth/2, y + 70);

    // Initialize uiElements array if it doesn't exist
    if (!this.uiElements) {
        this.uiElements = [];
    }

    // Draw buttons
    this.drawButton(x + 50, y + dialogHeight - 50, 100, 30, 'Keep', () => {
        this.showCaughtFishDialog = false;
    });

    this.drawButton(x + dialogWidth - 150, y + dialogHeight - 50, 100, 30, 'Release', () => {
        this.caughtFishManager.removeFish(this.caughtFishId);
        this.showCaughtFishDialog = false;
    });
}
    
    drawButton(x, y, width, height, text, onClick) {
        // Add to tracked UI elements for input handling
        this.uiElements.push({
            type: 'button',
            bounds: {x, y, width, height},
            onClick
        });

        // Draw button
        this.guiContext.fillStyle = '#444';
        this.guiContext.fillRect(x, y, width, height);
        this.guiContext.fillStyle = '#fff';
        this.guiContext.textAlign = 'center';
        this.guiContext.fillText(text, x + width/2, y + height/2 + 6);
    }
    
drawLineTensionMeter(tension) {
        const barWidth = 200;
        const barHeight = 20;
        const x = 10;
        const y = this.guiCanvas.height - 150;

        // Background
        this.guiContext.fillStyle = '#333';
        this.guiContext.fillRect(x, y, barWidth, barHeight);

        // Tension level
        let color;
        if (tension < 0.5) color = '#0f0';
        else if (tension < 0.8) color = '#ff0';
        else color = '#f00';

        this.guiContext.fillStyle = color;
        this.guiContext.fillRect(x, y, barWidth * tension, barHeight);

        // Label
        this.guiContext.fillStyle = '#fff';
        this.guiContext.font = '16px Arial';
        this.guiContext.textAlign = 'left';
        this.guiContext.fillText('Line Tension', x, y - 5);
    }
    
drawCastingPowerMeter(percentage) {
        const barWidth = 200;
        const barHeight = 20;
        const x = (this.guiCanvas.width - barWidth) / 2;
        const y = this.guiCanvas.height - 100;

        this.guiContext.fillStyle = '#333';
        this.guiContext.fillRect(x, y, barWidth, barHeight);

        this.guiContext.fillStyle = '#0f0';
        this.guiContext.fillRect(x, y, barWidth * (percentage / 100), barHeight);

        this.guiContext.fillStyle = '#fff';
        this.guiContext.font = '16px Arial';
        this.guiContext.textAlign = 'center';
        this.guiContext.fillText('Casting Power', x + barWidth / 2, y - 10);
    }

drawHookingBar(progress) {
    const barWidth = 200;
    const barHeight = 20;
    const x = (this.guiCanvas.width - barWidth) / 2;
    const y = this.guiCanvas.height - 50;

    // Draw background
    this.guiContext.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.guiContext.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    // Draw progress bar background
    this.guiContext.fillStyle = '#333';
    this.guiContext.fillRect(x, y, barWidth, barHeight);

    // Draw progress (filling from right to left)
    this.guiContext.fillStyle = '#0f0';
    const progressWidth = barWidth * (1 - progress);
    this.guiContext.fillRect(x, y, progressWidth, barHeight);

    // Draw "HOOK!" text
    this.guiContext.fillStyle = '#fff';
    this.guiContext.font = '16px Arial';
    this.guiContext.textAlign = 'center';
    this.guiContext.fillText('HOOK!', x + barWidth / 2, y - 10);
}
    
   draw() {
       // Clear the GUI canvas first
       this.guiContext.clearRect(0, 0, this.guiCanvas.width, this.guiCanvas.height);

       // Draw 3D scene
       const bufferInfo = this.shaderManager.getBufferInfo();
       this.renderer3d.render({
           renderableBuffers: bufferInfo.renderableBuffers,
           renderableIndexCount: bufferInfo.renderableIndexCount,
           camera: this.camera,
           renderableObjects: Array.from(this.physicsWorld.objects)
       });

       // Draw UI elements
       this.drawUI();
   }

   cleanup() {
    if (this.physicsWorld) {
        this.physicsWorld.reset();
        this.physicsWorld = null;
    }

    if (this.renderer3d && this.renderer3d.gl) {
        const gl = this.renderer3d.gl;
        
        // Clean up all WebGL resources
        if (this.renderer3d.program) {
            gl.deleteProgram(this.renderer3d.program);
        }
        if (this.renderer3d.vertexBuffer) {
            gl.deleteBuffer(this.renderer3d.vertexBuffer);
        }
        if (this.renderer3d.indexBuffer) {
            gl.deleteBuffer(this.renderer3d.indexBuffer);
        }
        
        this.renderer3d = null;
    }

    if (this.shaderManager) {
        // Instead of calling deleteAllShaders, we'll just null the reference
        this.shaderManager = null;
    }

    if (this.depthFramebuffer && this.renderer3d && this.renderer3d.gl) {
        const gl = this.renderer3d.gl;
        gl.deleteFramebuffer(this.depthFramebuffer);
        gl.deleteTexture(this.depthTexture);
        this.depthFramebuffer = null;
        this.depthTexture = null;
    }

    this.fishes = [];
    this.camera = null;
    this.fisher = null;
    this.lure = null;
    this.fishingArea = null;
    this.ocean = null;

    // Clear canvases
    if (this.guiContext) {
        this.guiContext.clearRect(0, 0, 800, 600);
    }

    this.input.clearAllElements();
    
    // Clear references
    this.canvas = null;
    this.guiCanvas = null;
    this.debugCanvas = null;
    this.guiContext = null;
    this.input = null;
}
}

class FishingArea {
    constructor(width = 500, length = 500, depth = 50) {
        this.bounds = {
            width,
            length,
            depth
        };
        
        this.fish = new Map();
        this.lure = null; // Add reference to lure
    }
    addFish(fish) {
        // Create an AI controller for this fish
        const ai = new FishAI(fish, this.bounds);
        this.fish.set(fish, ai);
    }
    setLure(lure) {
        // Store reference but only allow interaction when in water
        this.lure = lure;
    }


    update(deltaTime) {
        // Only update fish AI if there's a lure in water
        const activeLure = this.lure?.state === 'inWater' ? this.lure : null;
        for (const [fish, ai] of this.fish) {
            ai.update(deltaTime, activeLure);
        }
    }
}

class Ocean extends ActionPhysicsObject3D {
   constructor(physicsWorld, width = 100, length = 100, segments = 6, gridSize = 3) {
        const triangles = [];
        const spacing = width / segments;
        const offset = Math.floor(gridSize / 2);
        const topSegments = segments * 2;
        const topSpacing = width / topSegments;
        
        // Bottom layer
        for(let tileZ = -offset; tileZ < gridSize-offset; tileZ++) {
            for(let tileX = -offset; tileX < gridSize-offset; tileX++) {
                for(let z = 0; z < segments; z++) {
                    for(let x = 0; x < segments; x++) {
                        const x1 = x * spacing + tileX * width - width/2;
                        const x2 = (x + 1) * spacing + tileX * width - width/2;
                        const z1 = z * spacing + tileZ * length - length/2;
                        const z2 = (z + 1) * spacing + tileZ * length - length/2;
                        
                        triangles.push(
                            new Triangle(
                                new Vector3(x1, 50, z1),
                                new Vector3(x1, 50, z2),
                                new Vector3(x2, 50, z1),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x2, 50, z2),
                                new Vector3(x2, 50, z1),
                                new Vector3(x1, 50, z2),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x1, 50, z1),
                                new Vector3(x2, 50, z1),
                                new Vector3(x1, 50, z2),
                                "#0645f4ff"
                            ),
                            new Triangle(
                                new Vector3(x2, 50, z2),
                                new Vector3(x1, 50, z2),
                                new Vector3(x2, 50, z1),
                                "#0645f4ff"
                            )
                        );
                    }
                }
            }
        }
        super(physicsWorld, triangles);
        
        this.shader = 'water'; // Set shader to use the volumetric water shader
        this.time = 0;
        this.updateInterval = 1/30;
        this.timeSinceLastUpdate = 0;

        this.body = new Goblin.RigidBody(new Goblin.BoxShape(width/2, 1, length/2), 0);
        this.body.position.set(0, 50, 0);
        physicsWorld.addObject(this);
    }

    getWaveHeight(vertex) {
        const waves = [
            { A: 0.5, w: 1.0, phi: 1.0, Q: 0.3, dir: new Vector3(1, 0, 0.2).normalize() },
            { A: 0.3, w: 2.0, phi: 0.5, Q: 0.2, dir: new Vector3(0.8, 0, 0.3).normalize() },
            { A: 0.2, w: 3.0, phi: 1.5, Q: 0.1, dir: new Vector3(0.3, 0, 1).normalize() }
        ];
        
        let height = 0;
        waves.forEach(wave => {
            const dotProduct = wave.dir.x * vertex.x + wave.dir.z * vertex.z;
            const phase = wave.w * dotProduct - wave.phi * this.time;
            height += wave.A * Math.sin(phase);
        });
        return height;
    }
    
    getWaterHeightAt(x, z) {
        let height = 0;
        const waves = [
            { A: 0.5, w: 1.0, phi: 1.0, Q: 0.3, dir: new Vector3(1, 0, 0.2).normalize() },
            { A: 0.3, w: 2.0, phi: 0.5, Q: 0.2, dir: new Vector3(0.8, 0, 0.3).normalize() },
            { A: 0.2, w: 3.0, phi: 1.5, Q: 0.1, dir: new Vector3(0.3, 0, 1).normalize() }
        ];
        
        waves.forEach(wave => {
            const dotProduct = wave.dir.x * x + wave.dir.z * z;
            const phase = wave.w * dotProduct - wave.phi * this.time;
            height += wave.A * Math.sin(phase);
        });
        
        return this.body.position.y + height; // Add base ocean height
    }

    update(deltaTime) {
        this.timeSinceLastUpdate += deltaTime;
        
        if (this.timeSinceLastUpdate >= this.updateInterval) {
            this.time += this.timeSinceLastUpdate;
            this.updateVisual();
            this.timeSinceLastUpdate = 0;
        }
    }

    updateVisual() {
        if (!this.body) return;
        
        const pos = this.body.position;
        const rot = this.body.rotation;
        this.position = new Vector3(pos.x, pos.y, pos.z);

        const waves = [
            { A: 0.5, w: 1.0, phi: 1.0, Q: 0.3, dir: new Vector3(1, 0, 0.2).normalize() },
            { A: 0.3, w: 2.0, phi: 0.5, Q: 0.2, dir: new Vector3(0.8, 0, 0.3).normalize() },
            { A: 0.2, w: 3.0, phi: 1.5, Q: 0.1, dir: new Vector3(0.3, 0, 1).normalize() }
        ];

        this.triangles.forEach((triangle, triIndex) => {
            const origNormal = this.originalNormals[triIndex];
            const rotatedNormal = this.rotateVector(origNormal, rot);
            triangle.normal = rotatedNormal;

            triangle.vertices.forEach((vertex, vertIndex) => {
                const origVert = this.originalVerts[triIndex * 3 + vertIndex];
                const relativeVert = new Goblin.Vector3(origVert.x, origVert.y, origVert.z);
                
                let displacement = new Goblin.Vector3(0, 0, 0);
                
                waves.forEach(wave => {
                    const x0 = relativeVert.x;
                    const z0 = relativeVert.z;
                    const dotProduct = wave.dir.x * x0 + wave.dir.z * z0;
                    const phase = wave.w * dotProduct - wave.phi * this.time;
                    
                    displacement.x += wave.Q * wave.A * wave.dir.x * Math.cos(phase);
                    displacement.y += wave.A * Math.sin(phase);
                    displacement.z += wave.Q * wave.A * wave.dir.z * Math.cos(phase);
                });

                relativeVert.x += displacement.x;
                relativeVert.y += displacement.y;
                relativeVert.z += displacement.z;
                
                rot.transformVector3(relativeVert);
                
                vertex.x = relativeVert.x + this.position.x;
                vertex.y = relativeVert.y + this.position.y;
                vertex.z = relativeVert.z + this.position.z;
            });
        });

        this.physicsWorld.shaderManager?.updateRenderableBuffers(this);
    }
}

class CaughtFishManager {
    constructor() {
        this.caughtFish = new Map(); // Store fish with unique IDs
        this.nextId = 1;
    }

    addFish(fish, fishAI) {
    const fishData = {
        id: this.nextId++,
        type: fish.type || 'Unknown',
        size: fish.size || 1.0,  // Provide default size if undefined
        timeStamp: new Date(),
        config: fish.config // Store original configuration
    };
    
    this.caughtFish.set(fishData.id, fishData);
    return fishData.id;
}

    removeFish(id) {
        return this.caughtFish.delete(id);
    }

    getFish(id) {
        return this.caughtFish.get(id);
    }

    getAllFish() {
        return Array.from(this.caughtFish.values());
    }
}