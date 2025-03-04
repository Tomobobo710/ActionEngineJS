// game/world/weather/weathersystem.js
class WeatherSystem {
    constructor() {
        // Current state
        this._current = "none";
        this.lastUpdate = performance.now();

        // Core parameters
        this.intensity = 0;
        this.maxIntensity = 1.0;
        this.transitionSpeed = 1.0;
        this.activeParticles = 0;
        this.maxParticles = 0;
        this.emissionRate = 0;

        // Weather-specific state tracking
        this.windVector = { x: 0, y: 0, z: 0 };
        this.hurricaneCenter = { x: 0, y: 0, z: 0 };
        this.hurricaneRadius = 0;
        this.hurricaneAngle = 0;
        this.hurricaneWindSpeed = 0;

        // Time tracking for effects
        this.elapsedTime = 0;
        this.deltaAccumulator = 0;

        // Weather configurations
        this.configs = this.initializeConfigs();

        this.particleEmitter = new WeatherParticleEmitter(this);
    }

    // Core state methods
    setWeather(type) {
        if (type === "stopWeather") {
            this.stop();
            return;
        }

        if (!this.configs[type]) {
            console.warn(`[WeatherSystem] Unknown weather type: ${type}`);
            return;
        }

        this.current = type;
        const config = this.configs[type];
        this.maxParticles = config.maxParticles;
        this.emissionRate = config.emissionRate;
        this.intensity = 0;
        this.elapsedTime = 0;
        this.deltaAccumulator = 0;

        // Reset weather-specific state
        this.windVector = { x: 0, y: 0, z: 0 };
        this.hurricaneCenter = { x: 0, y: 0, z: 0 };
        this.hurricaneRadius = this.configs.hurricane.radius.min;
        this.hurricaneAngle = 0;
        this.hurricaneWindSpeed = 0;
    }

    get current() {
        return this._current;
    }

    set current(type) {
        // This gets called when debugpanel sets weatherState.current = button.id
        if (type === "stopWeather" || type === "none") {
            this._current = "none";
            this.stop();
            return;
        }

        if (!this.configs[type]) {
            console.warn(`[WeatherSystem] Unknown weather type: ${type}`);
            return;
        }

        this._current = type;
        const config = this.configs[type];
        this.maxParticles = config.maxParticles;
        this.emissionRate = config.emissionRate;
        this.intensity = 0;
        this.elapsedTime = 0;
        this.deltaAccumulator = 0;

        // Reset weather-specific state
        this.windVector = { x: 0, y: 0, z: 0 };
        this.hurricaneCenter = { x: 0, y: 0, z: 0 };
        this.hurricaneRadius = this.configs.hurricane?.radius.min || 0;
        this.hurricaneAngle = 0;
        this.hurricaneWindSpeed = 0;

        console.log(`[WeatherSystem] Weather changed to: ${type}`);
        console.log("[WeatherSystem] Weather parameters:", {
            maxParticles: this.maxParticles,
            emissionRate: this.emissionRate
        });
    }

    update(deltaTime, terrain) {
        if (this._current === "none") {
            // console.log('[WeatherSystem] Weather system not active');
            return;
        }

        this.elapsedTime += deltaTime;
        this.deltaAccumulator += deltaTime;

        // Update intensity
        if (this.intensity < this.maxIntensity) {
            this.intensity = Math.min(this.maxIntensity, this.intensity + this.transitionSpeed * deltaTime);
        }

        const config = this.configs[this.current];
        if (!config) {
            console.log("[WeatherSystem] No config found for", this.weatherSystem.current);
            return;
        }

        //console.log("[WeatherSystem] Attempting emission with config:", config);

        // Update weather-specific logic
        switch (this.current) {
            case "rain":
                this.updateRain(deltaTime, config);
                break;
            case "heavyRain":
                this.updateHeavyRain(deltaTime, config);
                break;
            case "snow":
                this.updateSnow(deltaTime, config);
                break;
            case "wind":
                this.updateWind(deltaTime, config);
                break;
            case "hurricane":
                this.updateHurricane(deltaTime, config);
                break;
            case "poison":
                this.updatePoison(deltaTime, config);
                break;
            case "fire":
                this.updateFire(deltaTime, config);
                break;
        }

        // Update particle emitter
        this.particleEmitter.update(deltaTime, terrain);
    }

    // Weather-specific update methods
    // game/world/weather/WeatherSystem.js - Part 3: Weather-Specific Update Methods

    updatePosition(characterPosition) {
    // Update spawn areas to be centered on character
        for (const type in this.configs) {
            const config = this.configs[type];
            if (config.spawnArea) {
                // For regular spawn areas
                if (!config.spawnArea.radiusRange) {
                    config.spawnArea.centerX = characterPosition.x;
                    config.spawnArea.centerZ = characterPosition.z;
                }
                // For radial spawn areas (hurricane)
                else {
                    this.hurricaneCenter = {
                        x: characterPosition.x,
                        y: characterPosition.y,
                        z: characterPosition.z
                    };
                }
            }
        }
    }
    
    updateRain(deltaTime, config) {
        this.windVector = this.calculateWindForce(deltaTime);
        this.windVector.x *= config.windEffect * 2;
        this.windVector.z *= config.windEffect * 2;
        this.windVector.y = -(config.fallSpeed * 2);

        // Multiple overlapping time-based modulations
        const fastPulse = Math.sin(this.elapsedTime * 8) * 0.5 + 0.5;
        const mediumPulse = Math.sin(this.elapsedTime * 3) * 0.3 + 0.7;
        const slowPulse = Math.sin(this.elapsedTime * 1.5) * 0.2 + 0.8;

        const baseEmissionRate = config.emissionRate * 2.5;
        const adjustedEmissionRate = baseEmissionRate * fastPulse * mediumPulse * slowPulse;

        const particlesToEmit = Math.floor(deltaTime * adjustedEmissionRate);

        for (let i = 0; i < particlesToEmit; i++) {
            if (this.particleEmitter.getParticles().length < config.maxParticles * 2) {
                const pos = this.particleEmitter.generateSpawnPosition(config);
                const vel = this.particleEmitter.generateInitialVelocity(config);

                // Randomized height offsets
                pos.y += (Math.random() * 150 - 75) * (0.5 + Math.random());

                this.particleEmitter.particles.push(new WeatherParticle(this.current, pos, vel, config));
            }
        }
    }

    updateHeavyRain(deltaTime, config) {
        this.windVector = this.calculateWindForce(deltaTime);
        this.windVector.x *= config.windEffect * 1.5;
        this.windVector.z *= config.windEffect * 1.5;
        this.windVector.y = -config.fallSpeed;

        const particlesToEmit = Math.floor(deltaTime * config.emissionRate);
        for (let i = 0; i < particlesToEmit; i++) {
            if (this.particleEmitter.getParticles().length < config.maxParticles) {
                const pos = this.particleEmitter.generateSpawnPosition(config);
                const vel = this.particleEmitter.generateInitialVelocity(config);
                this.particleEmitter.particles.push(new WeatherParticle(this.current, pos, vel, config));
            }
        }
    }

    updateSnow(deltaTime, config) {
        // Get base wind but with higher effect due to snow's lighter weight
        this.windVector = this.calculateWindForce(deltaTime);

        // Apply wind effect with snow's high susceptibility
        this.windVector.x *= config.windEffect * 2;
        this.windVector.z *= config.windEffect * 2;

        // Add wobble effect to vertical movement
        const wobble = Math.sin(this.elapsedTime * config.wobbleFrequency) * config.wobbleAmplitude;
        this.windVector.y = -(config.fallSpeed + wobble);

        // Add slight circular motion
        const circularMotion = {
            x: Math.sin(this.elapsedTime * 0.5) * 0.3,
            z: Math.cos(this.elapsedTime * 0.5) * 0.3
        };

        this.windVector.x += circularMotion.x;
        this.windVector.z += circularMotion.z;
    }

    updateWind(deltaTime, config) {
        // Base wind force
        const baseWind = this.calculateWindForce(deltaTime);

        // Calculate gust effect
        const gustPhase = Math.sin(this.elapsedTime * config.gustFrequency);
        const gustMultiplier = 1 + Math.max(0, gustPhase) * config.gustStrength;

        // Apply gust to wind vector
        this.windVector.x = baseWind.x * config.baseSpeed * gustMultiplier;
        this.windVector.y = baseWind.y * 0.2; // Minimal vertical movement
        this.windVector.z = baseWind.z * config.baseSpeed * gustMultiplier * 0.3;
    }

    updateHurricane(deltaTime, config) {
        // Update hurricane center (possible movement)
        this.hurricaneAngle += config.rotationSpeed * deltaTime;
        this.hurricaneAngle %= Math.PI * 2;

        // Update hurricane radius with pulsing effect
        const radiusRange = config.radius.max - config.radius.min;
        const pulseFactor = Math.sin(this.elapsedTime * 0.5) * 0.5 + 0.5;
        this.hurricaneRadius = config.radius.min + radiusRange * pulseFactor;

        // Calculate wind speed with height variation
        this.hurricaneWindSpeed = config.windSpeed * (1 + Math.sin(this.elapsedTime) * 0.2);

        // Calculate forces
        const hurricaneForce = this.calculateHurricaneForce(deltaTime);
        this.windVector = hurricaneForce;
    }

    updatePoison(deltaTime, config) {
        // Calculate base spread
        const spreadPhase = Math.sin(this.elapsedTime * config.pulseFrequency);
        const spreadMultiplier = 1 + spreadPhase * (config.pulseScale - 1);

        // Update spread radius
        const currentSpreadRadius = config.spreadRadius * spreadMultiplier;

        // Calculate upward drift with variation
        this.windVector.x = Math.sin(this.elapsedTime * 0.5) * 2;
        this.windVector.y = config.riseSpeed * (1 + Math.sin(this.elapsedTime * 2) * 0.2);
        this.windVector.z = Math.cos(this.elapsedTime * 0.5) * 2;

        // Store current spread for particle spawning
        this.currentSpread = currentSpreadRadius;
    }

    updateFire(deltaTime, config) {
        // Calculate base rise speed with flickering
        const flicker = Math.sin(this.elapsedTime * config.flickerFrequency) * config.flickerIntensity;
        const riseSpeed = config.riseSpeed * (1 + flicker);

        // Add heat distortion effect
        const heatDistortion = {
            x: Math.sin(this.elapsedTime * 5) * config.heatIntensity,
            z: Math.cos(this.elapsedTime * 5) * config.heatIntensity
        };

        // Update wind vector with rise and distortion
        this.windVector.x = heatDistortion.x;
        this.windVector.y = riseSpeed;
        this.windVector.z = heatDistortion.z;

        // Store heat intensity for visual effects
        this.currentHeatIntensity = config.heatIntensity * (1 + flicker);
    }

    // game/world/weather/WeatherSystem.js - Part 4: Force Calculation Utilities

    calculateWindForce(deltaTime) {
        // Base wind pattern using layered noise
        const time = this.elapsedTime;

        // Calculate different frequency layers
        const slowWind = {
            x: Math.sin(time * 0.3) * 0.5,
            y: Math.sin(time * 0.2) * 0.2,
            z: Math.cos(time * 0.3) * 0.5
        };

        const mediumWind = {
            x: Math.sin(time * 0.7) * 0.3,
            y: Math.sin(time * 0.6) * 0.1,
            z: Math.cos(time * 0.7) * 0.3
        };

        const fastWind = {
            x: Math.sin(time * 1.1) * 0.2,
            y: Math.sin(time * 1.0) * 0.1,
            z: Math.cos(time * 1.1) * 0.2
        };

        // Combine layers with different weights
        return {
            x: slowWind.x * 0.5 + mediumWind.x * 0.3 + fastWind.x * 0.2,
            y: slowWind.y * 0.5 + mediumWind.y * 0.3 + fastWind.y * 0.2,
            z: slowWind.z * 0.5 + mediumWind.z * 0.3 + fastWind.z * 0.2
        };
    }

    calculateHurricaneForce(deltaTime) {
        // Get the base rotation angle
        const angle = this.hurricaneAngle;
        const radius = this.hurricaneRadius;

        // Calculate rotational forces
        const tangentialForce = {
            x: -Math.sin(angle) * this.hurricaneWindSpeed,
            y: 0,
            z: Math.cos(angle) * this.hurricaneWindSpeed
        };

        // Add vertical oscillation
        const verticalForce = Math.sin(this.elapsedTime * 2) * 2;

        // Add inward/outward pulses
        const radialPulse = Math.sin(this.elapsedTime) * 2;

        // Calculate radial forces (pulling toward/away from center)
        const radialForce = {
            x: Math.cos(angle) * radialPulse,
            y: 0,
            z: Math.sin(angle) * radialPulse
        };

        // Combine forces
        return {
            x: tangentialForce.x + radialForce.x,
            y: verticalForce,
            z: tangentialForce.z + radialForce.z
        };
    }

    // Weather state helpers
    getWeatherParams() {
        const config = this.configs[this.current];
        return {
            type: this.current,
            intensity: this.intensity,
            activeParticles: this.particleEmitter.getParticles().length, // Get real count from emitter
            maxParticles: this.maxParticles,
            emissionRate: this.emissionRate
        };
    }

    stop() {
        this._current = "none";
        this.intensity = 0;
        this.activeParticles = 0;
        this.maxParticles = 0;
        this.emissionRate = 0;
        this.elapsedTime = 0;
        this.deltaAccumulator = 0;
        this.windVector = { x: 0, y: 0, z: 0 };

        // Clear the particle emitter
        this.particleEmitter.clear();
    }

    isActive() {
        return this.current !== "none";
    }

    initializeConfigs() {
        return {
            rain: {
                maxParticles: 2000,
                emissionRate: 1500,
                windEffect: 0.3,
                fallSpeed: 15,
                minSize: 3,
                maxSize: 5,
                minAlpha: 0.3,
                maxAlpha: 0.6,
                fadeInTime: 0.2,
                fadeOutTime: 0.3,
                colorRange: {
                    start: { r: 180, g: 190, b: 255 },
                    end: { r: 150, g: 150, b: 255 }
                },
                velocityRange: {
                    x: { min: -2, max: 2 },
                    y: { min: -1, max: -2 },
                    z: { min: -2, max: 2 }
                },
                spawnArea: {
                    width: 1000,
                    height: 200,
                    depth: 1000
                }
            },

            heavyRain: {
                maxParticles: 4000,
                emissionRate: 2000,
                windEffect: 0.5,
                fallSpeed: 20,
                minSize: 4,
                maxSize: 7,
                minAlpha: 0.4,
                maxAlpha: 0.7,
                fadeInTime: 0.15,
                fadeOutTime: 0.25,
                colorRange: {
                    start: { r: 150, g: 150, b: 255 },
                    end: { r: 120, g: 120, b: 255 }
                },
                velocityRange: {
                    x: { min: -3, max: 3 },
                    y: { min: -20, max: -15 },
                    z: { min: -3, max: 3 }
                },
                spawnArea: {
                    width: 1200,
                    height: 250,
                    depth: 1200
                },
                thunderChance: 0.02 // Chance per second
            },

            snow: {
                maxParticles: 500,
                emissionRate: 200,
                windEffect: 0.8,
                fallSpeed: 2,
                minSize: 2,
                maxSize: 4,
                minAlpha: 0.4,
                maxAlpha: 0.8,
                fadeInTime: 0.5,
                fadeOutTime: 0.8,
                colorRange: {
                    start: { r: 255, g: 255, b: 255 },
                    end: { r: 230, g: 230, b: 255 }
                },
                velocityRange: {
                    x: { min: -1, max: 1 },
                    y: { min: -2, max: -1 },
                    z: { min: -1, max: 1 }
                },
                spawnArea: {
                    width: 1000,
                    height: 300,
                    depth: 1000
                },
                wobbleFrequency: 2,
                wobbleAmplitude: 0.5
            },

            wind: {
                maxParticles: 300,
                emissionRate: 100,
                baseSpeed: 10,
                gustFrequency: 0.5,
                gustStrength: 5,
                minSize: 1,
                maxSize: 3,
                minAlpha: 0.2,
                maxAlpha: 0.4,
                fadeInTime: 0.3,
                fadeOutTime: 0.5,
                colorRange: {
                    start: { r: 255, g: 255, b: 255 },
                    end: { r: 200, g: 200, b: 255 }
                },
                velocityRange: {
                    x: { min: 8, max: 12 },
                    y: { min: -1, max: 1 },
                    z: { min: -2, max: 2 }
                },
                spawnArea: {
                    width: 200,
                    height: 400,
                    depth: 1000
                },
                streakLength: { min: 20, max: 40 }
            },

            hurricane: {
                maxParticles: 3000,
                emissionRate: 1500,
                windSpeed: 20,
                radius: { min: 150, max: 300 },
                height: { min: 100, max: 400 },
                rotationSpeed: 2.0,
                expansionRate: 0.5,
                minSize: 3,
                maxSize: 6,
                minAlpha: 0.3,
                maxAlpha: 0.6,
                fadeInTime: 0.2,
                fadeOutTime: 0.4,
                colorRange: {
                    start: { r: 150, g: 150, b: 255 },
                    end: { r: 100, g: 100, b: 255 }
                },
                velocityRange: {
                    tangential: { min: 15, max: 25 },
                    vertical: { min: -5, max: 5 },
                    radial: { min: -2, max: 2 }
                },
                spawnArea: {
                    radiusRange: { min: 100, max: 250 },
                    heightRange: { min: 0, max: 300 }
                }
            },

            poison: {
                maxParticles: 800,
                emissionRate: 400,
                riseSpeed: 2,
                spreadRadius: 200,
                minSize: 3,
                maxSize: 8,
                minAlpha: 0.4,
                maxAlpha: 0.7,
                fadeInTime: 0.4,
                fadeOutTime: 0.6,
                colorRange: {
                    start: { r: 150, g: 255, b: 150 },
                    end: { r: 100, g: 200, b: 100 }
                },
                velocityRange: {
                    x: { min: -2, max: 2 },
                    y: { min: 1, max: 3 },
                    z: { min: -2, max: 2 }
                },
                spawnArea: {
                    width: 800,
                    height: 50,
                    depth: 800
                },
                pulseFrequency: 0.5,
                pulseScale: 1.2
            },

            fire: {
                maxParticles: 1500,
                emissionRate: 750,
                riseSpeed: 5,
                heatIntensity: 0.8,
                minSize: 4,
                maxSize: 10,
                minAlpha: 0.3,
                maxAlpha: 0.6,
                fadeInTime: 0.2,
                fadeOutTime: 0.4,
                colorRange: {
                    start: { r: 255, g: 100, b: 50 },
                    end: { r: 200, g: 50, b: 20 }
                },
                velocityRange: {
                    x: { min: -3, max: 3 },
                    y: { min: 4, max: 8 },
                    z: { min: -3, max: 3 }
                },
                spawnArea: {
                    width: 800,
                    height: 50,
                    depth: 800
                },
                flickerFrequency: 10,
                flickerIntensity: 0.3
            }
        };
    }

    getConfig(type) {
        return this.configs[type] || null;
    }
}

// game/world/weather/WeatherSystem.js - Part 1: Configurations