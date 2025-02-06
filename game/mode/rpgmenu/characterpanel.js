// game/mode/rpgmenu/characterpanel.js
class CharacterPanel {
    constructor(ctx, input, party, sprites) {
        this.ctx = ctx;
        this.input = input;
        this.party = party;
        this.sprites = sprites;

        // Panel configuration
        this.config = {
            startX: 20,
            startY: 20,
            width: 495,
            height: 158.6,
            verticalGap: 15,
            portrait: {
                size: 120, // Up from 100
                margin: 20,
                borderWidth: 2,
                borderColor: "#ffffff",
                // Add inner glow/shadow for depth
                innerGlow: {
                    color: "rgba(0, 255, 255, 0.2)",
                    blur: 8
                }
            },
            stats: {
                width: 310, // Increased width for bars
                nameY: 35, // More vertical space
                fontSize: 24, // Bigger text
                barHeight: 25, // Taller bars
                firstBarY: 45,
                secondBarY: 95,
                barText: {
                    label: {
                        size: 20,
                        color: "#ffffff"
                    },
                    values: {
                        size: 20,
                        color: "#ffffff"
                    }
                }
            },
            glow: {
                color: "#00ffff",
                blur: 15
            },
            textColor: {
                normal: "#ffffff",
                selected: "#00ffff"
            }
        };

        // State
        this.selectedCharIndex = -1;
        this.selectionState = "none"; // 'none', 'selecting_hero', 'selecting_target'
        this.targetMode = "single"; // 'single' or 'all'

        this.registerInteractiveElements();
    }

    registerInteractiveElements() {
        this.party.forEach((_, index) => {
            this.input.registerElement(`character_panel_${index}`, {
                bounds: () => ({
                    x: this.config.startX,
                    y: this.config.startY + index * (this.config.height + this.config.verticalGap),
                    width: this.config.width,
                    height: this.config.height
                })
            });
        });
    }

    cleanup() {
        this.party.forEach((_, index) => {
            this.input.removeElement(`character_panel_${index}`);
        });
    }

    update() {
        // Handle mouse hover for character selection in all states that need it
        if (this.selectionState === "selecting_hero" || this.selectionState === "selecting_target") {
            // Check for mouse hover on any character panel
            this.party.forEach((_, index) => {
                if (this.input.isElementHovered(`character_panel_${index}`)) {
                    this.selectedCharIndex = index;
                }
            });

            // Handle keyboard navigation
            if (this.input.isKeyJustPressed("DirUp")) {
                this.selectedCharIndex = Math.max(0, this.selectedCharIndex - 1);
            }
            if (this.input.isKeyJustPressed("DirDown")) {
                this.selectedCharIndex = Math.min(this.party.length - 1, this.selectedCharIndex + 1);
            }
        }
    }

    draw() {
        const p = this.config;

        this.party.forEach((char, index) => {
            const x = p.startX;
            const y = p.startY + index * (p.height + p.verticalGap);

            this.ctx.save();

            // Add glow effect to the entire panel when selected
            if (
                (index === this.selectedCharIndex &&
                    (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
                (this.targetMode === "all" && this.selectionState === "selecting_target")
            ) {
                this.ctx.shadowColor = p.glow.color;
                this.ctx.shadowBlur = p.glow.blur;
            }

            // Panel background
            this.ctx.fillStyle = "rgba(0, 0, 102, 0.8)";
            this.ctx.fillRect(x, y, p.width, p.height);

            this.ctx.restore();

            const portraitX = x + p.portrait.margin;
            const portraitY = y + (p.height - p.portrait.size) / 2;

            // Portrait border - change color and add glow based on selection
            this.ctx.save(); // Save current context state

            if (
                (index === this.selectedCharIndex &&
                    (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
                (this.targetMode === "all" && this.selectionState === "selecting_target")
            ) {
                this.ctx.shadowColor = p.glow.color;
                this.ctx.shadowBlur = p.glow.blur;
                this.ctx.strokeStyle = p.textColor.selected; // cyan
            } else {
                this.ctx.strokeStyle = "#ffffff"; // white
            }

            this.ctx.lineWidth = p.portrait.borderWidth;
            this.ctx.strokeRect(
                portraitX - p.portrait.borderWidth,
                portraitY - p.portrait.borderWidth,
                p.portrait.size + p.portrait.borderWidth * 2,
                p.portrait.size + p.portrait.borderWidth * 2
            );

            this.ctx.restore(); // Restore context state to remove shadow effects

            // Character sprite
            this.ctx.imageSmoothingEnabled = false; // Add this before drawing
            this.ctx.drawImage(
                this.sprites[char.type],
                0,
                0,
                32,
                32,
                portraitX,
                portraitY,
                p.portrait.size,
                p.portrait.size
            );
            this.ctx.imageSmoothingEnabled = true; // Reset it after if needed for other elements

            // Stats section
            const statsX = portraitX + p.portrait.size + 25;

            // Name with color change and glow on selection
            if (
                (index === this.selectedCharIndex &&
                    (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
                (this.targetMode === "all" && this.selectionState === "selecting_target")
            ) {
                // Add glow effect for selected name
                this.ctx.shadowColor = p.glow.color;
                this.ctx.shadowBlur = p.glow.blur;
                this.ctx.fillStyle = p.textColor.selected;
            } else {
                // Reset shadow and use normal color
                this.ctx.shadowColor = "transparent";
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = p.textColor.normal;
            }

            this.ctx.font = `${p.stats.fontSize}px monospace`;
            this.ctx.textAlign = "left";
            this.ctx.fillText(`${char.name}`, statsX, y + p.stats.nameY);

            // Reset shadow effect before drawing level
            this.ctx.shadowColor = "transparent";
            this.ctx.shadowBlur = 0;

            // Level always white
            this.ctx.fillStyle = p.textColor.normal;
            this.ctx.textAlign = "right";
            this.ctx.fillText(`Level ${char.level}`, x + p.width - 20, y + p.stats.nameY); // -20 for some padding from right edge

            // HP Bar
            this.drawStatBar(statsX, y + p.stats.firstBarY, char.hp, char.maxHp, "#00ff00", "HP", p.stats.width);

            // MP Bar
            this.drawStatBar(statsX, y + p.stats.secondBarY, char.mp, char.maxMp, "#0000ff", "MP", p.stats.width);
        });
    }

    drawStatBar(x, y, current, max, color, label, width) {
        const height = this.config.stats.barHeight;
        const p = this.config.stats.barText;

        // Draw the bar itself
        const bgGradient = this.ctx.createLinearGradient(x, y, x, y + height);
        bgGradient.addColorStop(0, "#222222");
        bgGradient.addColorStop(1, "#333333");
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(x, y, width, height);

        // Current value bar with gradient
        const fillWidth = (current / max) * width;
        const valueGradient = this.ctx.createLinearGradient(x, y, x, y + height);
        valueGradient.addColorStop(0, color);
        valueGradient.addColorStop(1, this.adjustColor(color, -20));
        this.ctx.fillStyle = valueGradient;
        this.ctx.fillRect(x, y, fillWidth, height);

        // Bar border
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Text below the bar
        this.ctx.fillStyle = p.label.color;
        this.ctx.font = `${p.label.size}px monospace`;
        this.ctx.textAlign = "left";
        this.ctx.fillText(`${label}: ${current}/${max}`, x, y + height + 18);
    }

    adjustColor(color, amount) {
        const hex = color.replace("#", "");
        const num = parseInt(hex, 16);
        const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
        const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
    }

    getSelectedCharacter() {
        return this.selectedCharIndex >= 0 ? this.party[this.selectedCharIndex] : null;
    }

    reset() {
        this.selectedCharIndex = -1;
        this.selectionState = "none";
        this.targetMode = "single";
    }
}