// game/mode/battle/animations/itemanimation.js
class ItemAnimation {
    constructor(config, targetPos, user) {
        this.config = config || {}; // Allow for custom config or use defaults
        this.targetPos = { ...targetPos };
        this.user = user;
        this.frame = 0;
        this.maxFrames = 60;
        this.finished = false;
        this.particles = [];
        
        // Store original position
        this.originalPos = {
            x: user.pos.x,
            y: user.pos.y
        };
        
        // Define animation phases
        this.phases = {
            STEP_FORWARD: { start: 0, end: 10 },
            USE_ITEM: { start: 10, end: 45 },
            STEP_BACK: { start: 45, end: 60 }
        };
        
        // Create particles for the sparkle effect
        this.createParticles();
    }
    
    createParticles() {
        // Create sparkle particles
        const particleCount = 20 + Math.floor(Math.random() * 10);
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: 0,
                y: 0,
                size: 1 + Math.random() * 3,
                angle: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 2.5,
                life: 1.0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                color: this.getRandomColor()
            });
        }
    }
    
    getRandomColor() {
        // Default to a mix of yellow/white sparkles for generic items
        // You could modify this based on item type later
        const colors = [
            "#ffffff", // White
            "#fff9c4", // Light yellow
            "#ffecb3", // Light amber
            "#e3f2fd", // Light blue
            "#f3e5f5"  // Light purple
        ];
        
        return colors[Math.floor(Math.random() * colors.length)];
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
        
        // Handle character movement
        switch (phase) {
            case "STEP_FORWARD":
                const stepProgress = this.frame / this.phases.STEP_FORWARD.end;
                const moveDistance = this.user.isEnemy ? 40 : -40; // this works different from the other animation classes and is the prefered way of doing isEnemy check
                this.user.pos.x = this.originalPos.x + moveDistance * stepProgress;
                break;
                
            case "STEP_BACK":
                const returnProgress = (this.phases.STEP_BACK.end - this.frame) / 
                    (this.phases.STEP_BACK.end - this.phases.STEP_BACK.start);
                const backDistance = this.user.isEnemy ? 40 : -40;
                this.user.pos.x = this.originalPos.x + backDistance * returnProgress;
                break;
                
            case "USE_ITEM":
                // Update particle positions
                this.particles.forEach(p => {
                    // Calculate how far into the USE_ITEM phase we are
                    const useProgress = (this.frame - this.phases.USE_ITEM.start) / 
                        (this.phases.USE_ITEM.end - this.phases.USE_ITEM.start);
                    
                    // Update particle position
                    p.x = Math.cos(p.angle) * p.speed * (this.frame - this.phases.USE_ITEM.start);
                    p.y = Math.sin(p.angle) * p.speed * (this.frame - this.phases.USE_ITEM.start);
                    
                    // Update rotation
                    p.rotation += p.rotationSpeed;
                    
                    // Fade out particles over time
                    p.life = Math.max(0, 1 - useProgress);
                });
                break;
        }
        
        // When animation is complete
        if (this.frame >= this.maxFrames) {
            this.finished = true;
            this.user.pos.x = this.originalPos.x;
            this.user.pos.y = this.originalPos.y;
        }
    }
    
    render(ctx) {
        const phase = this.getCurrentPhase();
        
        // Only render particles during USE_ITEM phase
        if (phase === "USE_ITEM") {
            ctx.save();
            ctx.translate(this.targetPos.x, this.targetPos.y);
            
            // Draw a subtle glow around the target
            const useProgress = (this.frame - this.phases.USE_ITEM.start) / 
                (this.phases.USE_ITEM.end - this.phases.USE_ITEM.start);
            
            // Draw circular glow
            const glowSize = 30 + Math.sin(useProgress * Math.PI) * 20;
            const glowOpacity = Math.sin(useProgress * Math.PI) * 0.6;
            
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
            gradient.addColorStop(0, `rgba(255, 255, 220, ${glowOpacity})`);
            gradient.addColorStop(1, 'rgba(255, 255, 220, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw particles
            this.particles.forEach(p => {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                
                // Draw a sparkle (4-point star)
                ctx.fillStyle = p.color.replace(')', `, ${p.life})`).replace('rgb', 'rgba');
                
                ctx.beginPath();
                ctx.moveTo(0, -p.size * 2);
                ctx.lineTo(0, p.size * 2);
                ctx.moveTo(-p.size * 2, 0);
                ctx.lineTo(p.size * 2, 0);
                ctx.lineWidth = p.size / 2;
                ctx.strokeStyle = p.color.replace(')', `, ${p.life})`).replace('rgb', 'rgba');
                ctx.stroke();
                
                // Add a small circle in the center
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            });
            
            ctx.restore();
        }
    }
}