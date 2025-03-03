// game/mode/battle/classes/spellanimation.js
class SpellAnimation {
    constructor(config, targetPos, attacker, isEnemy) {
        this.config = config;
        this.targetPos = { ...targetPos };
        this.attacker = attacker;
        this.frame = 0;
        this.maxFrames = 90;
        this.finished = false;
        this.particles = [];

        this.originalPos = {
            x: attacker.pos.x,
            y: attacker.pos.y
        };

        this.isEnemy = isEnemy;
        this.moveDistance = this.isEnemy ? 50 : -50;

        // Define animation phases
        this.phases = {
            STEP_FORWARD: { start: 0, end: 15 },
            DARKEN: { start: 15, end: 30 },
            CAST_SPELL: { start: 30, end: 60 },
            LIGHTEN: { start: 60, end: 75 },
            STEP_BACK: { start: 75, end: 90 }
        };

        this.initializeParticles();
    }

    initializeParticles() {
        switch (this.config.type) {
            case "explosion":
                for (let i = 0; i < 20; i++) {
                    this.particles.push({
                        angle: Math.random() * Math.PI * 2,
                        speed: 1 + Math.random() * 3,
                        size: 2 + Math.random() * 4,
                        life: 1.0,
                        x: 0,
                        y: 0
                    });
                }
                break;

            case "crystals":
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    this.particles.push({
                        angle: angle,
                        speed: 2 + Math.random(),
                        size: 10 + Math.random() * 10,
                        life: 1.0,
                        rotation: Math.random() * Math.PI * 2,
                        spinSpeed: (Math.random() - 0.5) * 0.2
                    });
                }
                break;

            case "bolt":
                this.boltSegments = [];
                this.generateLightningPath();
                break;

            case "mist":
                for (let i = 0; i < 30; i++) {
                    this.particles.push({
                        x: (Math.random() - 0.5) * 60,
                        y: (Math.random() - 0.5) * 60,
                        size: 15 + Math.random() * 25,
                        life: 1.0,
                        drift: (Math.random() - 0.5) * 2
                    });
                }
                break;
        }
    }

    getCurrentPhase() {
        for (let [phase, timing] of Object.entries(this.phases)) {
            if (this.frame >= timing.start && this.frame < timing.end) {
                return phase;
            }
        }
        return null;
    }

    update() {
        this.frame++;

        const phase = this.getCurrentPhase();

        switch (phase) {
            case "STEP_FORWARD":
                const stepProgress = this.frame / this.phases.STEP_FORWARD.end;
                this.attacker.pos.x = this.originalPos.x + this.moveDistance * stepProgress;
                break;

            case "STEP_BACK":
                const returnProgress =
                    (this.phases.STEP_BACK.end - this.frame) /
                    (this.phases.STEP_BACK.end - this.phases.STEP_BACK.start);
                this.attacker.pos.x = this.originalPos.x + this.moveDistance * returnProgress;
                break;

            case "CAST_SPELL":
                // Only update particles during actual spell cast
                const spellProgress =
                    (this.frame - this.phases.CAST_SPELL.start) /
                    (this.phases.CAST_SPELL.end - this.phases.CAST_SPELL.start);
                this.particles.forEach((p) => {
                    // Existing particle updates but using spellProgress instead of overall progress
                    switch (this.config.type) {
                        case "explosion":
                        case "crystals":
                            p.x = Math.cos(p.angle) * (p.speed * (this.frame - this.phases.CAST_SPELL.start));
                            p.y = Math.sin(p.angle) * (p.speed * (this.frame - this.phases.CAST_SPELL.start));
                            if (this.config.type === "crystals") {
                                p.rotation += p.spinSpeed;
                            }
                            break;
                        case "mist":
                            p.x += p.drift;
                            p.y += Math.sin((this.frame - this.phases.CAST_SPELL.start) * 0.1) * 0.5;
                            break;
                    }
                    p.life = Math.max(0, 1 - spellProgress);
                });
                break;
        }

        if (this.frame >= this.maxFrames) {
            this.finished = true;
            this.attacker.pos.x = this.originalPos.x;
            this.attacker.pos.y = this.originalPos.y;
        }
    }

    render(ctx) {
        const phase = this.getCurrentPhase();

        // Calculate darkness
        let darkness = 0;
        if (phase === "DARKEN") {
            darkness =
                ((this.frame - this.phases.DARKEN.start) / (this.phases.DARKEN.end - this.phases.DARKEN.start)) * 0.7;
        } else if (phase === "CAST_SPELL") {
            darkness = 0.7;
        } else if (phase === "LIGHTEN") {
            darkness =
                ((this.phases.LIGHTEN.end - this.frame) / (this.phases.LIGHTEN.end - this.phases.LIGHTEN.start)) * 0.7;
        }

        // Draw darkness overlay
        if (darkness > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        // Only draw spell effects during CAST_SPELL phase
        if (phase === "CAST_SPELL") {
            ctx.save();
            ctx.translate(this.targetPos.x, this.targetPos.y);

            const progress = this.frame / this.maxFrames;

            switch (this.config.type) {
                case "explosion":
                    // Core explosion
                    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 80 * progress);
                    gradient.addColorStop(0, `rgba(255, 200, 50, ${1 - progress})`);
                    gradient.addColorStop(0.5, `rgba(255, 100, 50, ${0.5 - progress * 0.5})`);
                    gradient.addColorStop(1, "rgba(255, 50, 50, 0)");

                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(0, 0, 80 * progress, 0, Math.PI * 2);
                    ctx.fill();

                    // Particles
                    this.particles.forEach((p) => {
                        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 50, ${p.life})`;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ctx.fill();
                    });
                    break;

                case "crystals":
                    // Draw glowing background
                    ctx.fillStyle = `rgba(100, 200, 255, ${0.2 * (1 - progress)})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, 60, 0, Math.PI * 2);
                    ctx.fill();

                    // Draw ice crystals
                    this.particles.forEach((p) => {
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.rotation);

                        const crystalGradient = ctx.createLinearGradient(-p.size, 0, p.size, 0);
                        crystalGradient.addColorStop(0, `rgba(130, 200, 255, ${p.life})`);
                        crystalGradient.addColorStop(0.5, `rgba(255, 255, 255, ${p.life})`);
                        crystalGradient.addColorStop(1, `rgba(130, 200, 255, ${p.life})`);

                        ctx.fillStyle = crystalGradient;

                        // Draw crystal shape
                        ctx.beginPath();
                        ctx.moveTo(-p.size, 0);
                        ctx.lineTo(0, -p.size * 0.5);
                        ctx.lineTo(p.size, 0);
                        ctx.lineTo(0, p.size * 0.5);
                        ctx.closePath();
                        ctx.fill();

                        // Add sparkle
                        if (Math.random() < 0.3) {
                            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * p.life})`;
                            ctx.beginPath();
                            ctx.arc(0, 0, 2, 0, Math.PI * 2);
                            ctx.fill();
                        }

                        ctx.restore();
                    });
                    break;

                case "bolt":
                    ctx.translate(-this.targetPos.x, -this.targetPos.y);

                    // Draw multiple layers of lightning
                    for (let layer = 3; layer >= 0; layer--) {
                        const width = (3 - layer) * 2;
                        const alpha = layer === 0 ? 0.8 : 0.2;
                        const offset = (Math.random() - 0.5) * 2;

                        ctx.strokeStyle = `rgba(255, 255, ${200 + layer * 20}, ${alpha * (1 - progress)})`;
                        ctx.lineWidth = width;
                        ctx.beginPath();

                        this.boltSegments.forEach((segment, i) => {
                            if (i === 0) {
                                ctx.moveTo(segment.x + offset, segment.y);
                            } else {
                                ctx.lineTo(segment.x + offset, segment.y);
                            }
                        });

                        ctx.stroke();
                    }

                    // Add electric particles
                    for (let i = 0; i < 5; i++) {
                        const randomSegment = this.boltSegments[Math.floor(Math.random() * this.boltSegments.length)];
                        ctx.fillStyle = `rgba(255, 255, 200, ${Math.random() * (1 - progress)})`;
                        ctx.beginPath();
                        ctx.arc(
                            randomSegment.x + (Math.random() - 0.5) * 20,
                            randomSegment.y,
                            2 + Math.random() * 2,
                            0,
                            Math.PI * 2
                        );
                        ctx.fill();
                    }
                    break;

                case "mist":
                    // Draw swirling mist particles
                    this.particles.forEach((p) => {
                        const baseColor = this.config.color || "#88ff88"; // Default color if none provided
                        const r = parseInt(baseColor.slice(1, 3), 16);
                        const g = parseInt(baseColor.slice(3, 5), 16);
                        const b = parseInt(baseColor.slice(5, 7), 16);

                        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${p.life * 0.5})`);
                        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                        ctx.fillStyle = gradient;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ctx.fill();
                    });

                    // Add some swirl effects
                    const baseColor = this.config.color || "#88ff88"; // Default color if none provided
                    const r = parseInt(baseColor.slice(1, 3), 16);
                    const g = parseInt(baseColor.slice(3, 5), 16);
                    const b = parseInt(baseColor.slice(5, 7), 16);
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.2 * (1 - progress)})`;
                    ctx.lineWidth = 2;
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.arc(0, 0, 20 + i * 20, 0, Math.PI * 2 * (1 - progress) + (i * Math.PI) / 2);
                        ctx.stroke();
                    }
                    break;
            }

            ctx.restore();
        }
    }

    generateLightningPath() {
        let x = this.targetPos.x;
        let y = this.targetPos.y - 150;
        let segments = [{ x, y }];

        while (y < this.targetPos.y) {
            y += 15 + Math.random() * 15;
            x += (Math.random() - 0.5) * 40;
            segments.push({ x, y });
        }

        this.boltSegments = segments;
    }
}