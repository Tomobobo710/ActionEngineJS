// game/mode/battle/classes/attackanimation.js
class AttackAnimation {
    constructor(attacker, target, isEnemy) {
        this.attacker = attacker;
        this.target = target;
        this.frame = 0;
        this.maxFrames = 60;
        this.finished = false;
        this.originalPos = {
            x: attacker.pos.x,
            y: attacker.pos.y
        };
        this.isEnemy = isEnemy;
        this.moveDistance = this.isEnemy ? 100 : -100;

        // Slash effect properties
        this.slashAngles = [];
        for (let i = 0; i < 5; i++) {
            this.slashAngles.push({
                angle: (Math.random() * Math.PI) / 4 - Math.PI / 8,
                offset: (Math.random() - 0.5) * 20,
                size: 30 + Math.random() * 20
            });
        }
    }

    update() {
        this.frame++;

        // Movement animation
        if (this.frame < 15) {
            // Move toward target (wind up)
            this.attacker.pos.x = this.originalPos.x + this.moveDistance * (this.frame / 15);
        } else if (this.frame < 30) {
            // Move back (follow through)
            this.attacker.pos.x = this.originalPos.x + this.moveDistance * ((30 - this.frame) / 15);
        } else {
            // Reset position
            this.attacker.pos.x = this.originalPos.x;
        }

        if (this.frame >= this.maxFrames) {
            this.finished = true;
            this.attacker.pos.x = this.originalPos.x;
            this.attacker.pos.y = this.originalPos.y;
        }
    }

    render(ctx) {
        // Impact effect (when hit connects)
        if (this.frame >= 15 && this.frame < 30) {
            ctx.save();

            // Draw slash effects
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";

            const progress = (this.frame - 15) / 15;
            const fadeOut = 1 - progress;

            this.slashAngles.forEach((slash) => {
                ctx.save();
                ctx.translate(this.target.pos.x + slash.offset, this.target.pos.y);
                ctx.rotate(slash.angle);

                // Main slash
                const gradient = ctx.createLinearGradient(-slash.size, 0, slash.size, 0);
                gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${fadeOut})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

                ctx.strokeStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(-slash.size, 0);
                ctx.lineTo(slash.size, 0);
                ctx.stroke();

                // Colored trail
                const trailGradient = ctx.createLinearGradient(-slash.size, 0, slash.size, 0);
                trailGradient.addColorStop(0, `rgba(255, 50, 50, 0)`);
                trailGradient.addColorStop(0.5, `rgba(255, 50, 50, ${fadeOut * 0.7})`);
                trailGradient.addColorStop(1, `rgba(255, 50, 50, 0)`);

                ctx.strokeStyle = trailGradient;
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(-slash.size * 0.8, 0);
                ctx.lineTo(slash.size * 0.8, 0);
                ctx.stroke();

                ctx.restore();
            });

            // Impact burst
            const burstProgress = (this.frame - 15) / 5;
            if (burstProgress <= 1) {
                const burstSize = 40 * burstProgress;
                const burstOpacity = 1 - burstProgress;

                ctx.fillStyle = `rgba(255, 255, 255, ${burstOpacity})`;
                ctx.beginPath();
                ctx.arc(this.target.pos.x, this.target.pos.y, burstSize, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }
}