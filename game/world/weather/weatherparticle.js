// game/world/weather/weatherparticle.js
class WeatherParticle {
    constructor(type, position, velocity, config) {
        this.type = type;
        this.position = position;
        this.velocity = velocity;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.size = config.minSize + Math.random() * (config.maxSize - config.minSize);
        this.alpha = config.minAlpha + Math.random() * (config.maxAlpha - config.minAlpha);
        this.hasCollided = false;
        this.collisionResponse = null;
        this.maxLife = type === "rain" ? 5.0 : 1.0; // Longer life for rain
        this.life = this.maxLife;
        this.grounded = false;
        this.velocity.y = -25; // Increased fall speed

        // Store initial color for interpolation
        this.startColor = { ...config.colorRange.start };
        this.endColor = { ...config.colorRange.end };

        // Additional type-specific properties
        switch (type) {
            case "snow":
                this.wobblePhase = Math.random() * Math.PI * 2;
                this.wobbleSpeed = 0.5 + Math.random() * 0.5;
                break;
            case "fire":
                this.flickerPhase = Math.random() * Math.PI * 2;
                break;
        }

        // Add rain-specific properties
        if (type === "rain" || type === "heavyRain") {
            this.rotation = Math.atan2(velocity.x, velocity.z);
            this.length = config.minSize * (2 + Math.random());
            this.width = config.minSize * (0.2 + Math.random() * 0.3);
            this.dropletSpeed = 15 + Math.random() * 10;
            this.turbulence = Math.random() * 0.2;
            this.fadeSpeed = 0.8 + Math.random() * 0.4;
            this.streakLength = config.minSize * (3 + Math.random() * 2);
        }

        if (type === "rain" || type === "heavyRain") {
            this.velocity.y = -27.5;
            this.size = config.minSize * 0.8; // More visible size
            this.alpha = 0.4; // More visible transparency
            this.length = this.size * 20; // Good stretch ratio
            this.width = this.size * 0.08; // Visible but still thin
        }
    }

    update(deltaTime, weatherForces, terrain) {
        if (!this.grounded) {
            if (this.type === "rain" || this.type === "heavyRain") {
                const windInfluence = 0.3;
                this.velocity.x += weatherForces.x * windInfluence;
                this.velocity.z += weatherForces.z * windInfluence;
                this.rotation = Math.atan2(this.velocity.x, this.velocity.z);

                this.velocity.x += Math.sin(this.life * 4) * this.turbulence;
                this.velocity.z += Math.cos(this.life * 4) * this.turbulence;
                this.position.y -= this.dropletSpeed * deltaTime;
            }

            this.position.x += this.velocity.x * deltaTime * 2;
            this.position.y += this.velocity.y * deltaTime * 2;
            this.position.z += this.velocity.z * deltaTime * 2;

            const groundHeight = terrain.getHeightAt(this.position.x, this.position.z);
            if (this.position.y <= groundHeight) {
                this.position.y = groundHeight;
                this.grounded = true;
                this.velocity.y = 0;
                this.life = Math.min(this.life, 0.2);
                this.size *= 1.3;
                this.alpha *= 0.6;
            }
        }
        this.life -= deltaTime * 1.5;
        return this.life > 0;
    }

    handleCollision(prevPos, groundHeight) {
        this.hasCollided = true;

        switch (this.type) {
            case "rain":
                this.life = 0.1; // Short splash effect
                this.velocity.y = 0;
                this.position.y = groundHeight;
                this.size *= 1.5; // Expand for splash
                this.alpha *= 0.7;
                break;

            case "snow":
                this.velocity = { x: 0, y: 0, z: 0 };
                this.position.y = groundHeight;
                this.alpha *= 0.8;
                break;

            case "fire":
                this.life = 0.2;
                this.velocity.y *= -0.5;
                this.size *= 1.3;
                break;

            default:
                this.life = 0;
                break;
        }
    }
}

class WeatherParticleEmitter {
    constructor(weatherSystem) {
        this.weatherSystem = weatherSystem;
        this.particles = [];
        this.timeSinceLastEmission = 0;
    }

    generateSpawnPosition(config) {
        const spawnArea = config.spawnArea;

        switch (this.weatherSystem.current) {
            case "hurricane":
                const angle = Math.random() * Math.PI * 2;
                const radius =
                    spawnArea.radiusRange.min + Math.random() * (spawnArea.radiusRange.max - spawnArea.radiusRange.min);
                return {
                    x: Math.cos(angle) * radius,
                    y:
                        spawnArea.heightRange.min +
                        Math.random() * (spawnArea.heightRange.max - spawnArea.heightRange.min),
                    z: Math.sin(angle) * radius
                };

            default:
                return {
                    x: (Math.random() - 0.5) * spawnArea.width,
                    y: spawnArea.height,
                    z: (Math.random() - 0.5) * spawnArea.depth
                };
        }
    }

    generateInitialVelocity(config) {
        const vel = config.velocityRange;
        return {
            x: vel.x.min + Math.random() * (vel.x.max - vel.x.min),
            y: vel.y.min + Math.random() * (vel.y.max - vel.y.min),
            z: vel.z.min + Math.random() * (vel.z.max - vel.z.min)
        };
    }

    update(deltaTime, terrain) {
        if (!this.weatherSystem.isActive()) {
            //console.log('[WeatherParticle] Weather system not active');
            return;
        }

        const config = this.weatherSystem.getConfig(this.weatherSystem.current);
        if (!config) {
            console.log("[WeatherParticle] No config found for", this.weatherSystem.current);
            return;
        }

        // Log initial particle count
        console.log(`[WeatherParticle] Current particle count: ${this.particles.length}`);

        // Emit new particles
        this.timeSinceLastEmission += deltaTime;
        const emissionInterval = 1 / config.emissionRate;

        let particlesEmittedThisFrame = 0;
        while (this.timeSinceLastEmission >= emissionInterval && this.particles.length < config.maxParticles) {
            const pos = this.generateSpawnPosition(config);
            const vel = this.generateInitialVelocity(config);

            this.particles.push(new WeatherParticle(this.weatherSystem.current, pos, vel, config));

            particlesEmittedThisFrame++;
            this.timeSinceLastEmission -= emissionInterval;
        }

        if (particlesEmittedThisFrame > 0) {
            console.log(
                `[WeatherParticle] Emitted ${particlesEmittedThisFrame} new particles. New total: ${this.particles.length}`
            );
        }

        // Update existing particles
        const weatherForces = this.weatherSystem.windVector;
        const oldCount = this.particles.length;
        this.particles = this.particles.filter((particle) => particle.update(deltaTime, weatherForces, terrain));

        const removedCount = oldCount - this.particles.length;
        if (removedCount > 0) {
            console.log(
                `[WeatherParticle] Removed ${removedCount} dead particles. Current total: ${this.particles.length}`
            );
        }
    }

    getParticles() {
        return this.particles;
    }

    clear() {
        this.particles = [];
        this.timeSinceLastEmission = 0;
    }
}