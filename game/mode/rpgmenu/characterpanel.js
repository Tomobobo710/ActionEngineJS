// game/mode/rpgmenu/characterpanel.js
class CharacterPanel {
    constructor(ctx, input, party, sprites, gameMode) {
        // Add gameMode parameter
        this.ctx = ctx;
        this.input = input;
        this.party = party;
        this.sprites = sprites;
        this.gameMode = gameMode; // Store reference to access colors

        // Panel configuration
        this.config = {
            startX: 20,
            startY: 20,
            width: 495,
            height: 158.6,
            verticalGap: 15,
            portrait: {
                size: 120,
                margin: 20,
                borderWidth: 2
                // Remove hardcoded colors
            },
            stats: {
                width: 310,
                nameY: 35,
                fontSize: 24,
                barHeight: 25,
                firstBarY: 45,
                secondBarY: 95,
                barText: {
                    label: {
                        size: 20
                    },
                    values: {
                        size: 20
                    }
                }
            }
        };

        // State
        this.selectedCharIndex = -1;
        this.selectionState = "none";
        this.targetMode = "single";

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

    createGradient(x, y, width, height, colorStart, colorEnd) {
        // Use gameMode's createGradient if available, otherwise create locally
        if (this.gameMode.createGradient) {
            return this.gameMode.createGradient(x, y, width, height, colorStart, colorEnd);
        }
        const gradient = this.ctx.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    }

    draw() {
        const p = this.config;
        const colors = this.gameMode.colors;

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
                this.ctx.shadowColor = colors.glowColor;
                this.ctx.shadowBlur = colors.glowBlur;
            }

            // Panel background with gradient
            this.ctx.fillStyle = this.createGradient(
                x,
                y,
                p.width,
                p.height,
                colors.menuBackground.start,
                colors.menuBackground.end
            );
            this.ctx.fillRect(x, y, p.width, p.height);

            this.ctx.restore();

            const portraitX = x + p.portrait.margin;
            const portraitY = y + (p.height - p.portrait.size) / 2;

            // Portrait border
            this.ctx.save();

            if (
                (index === this.selectedCharIndex &&
                    (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
                (this.targetMode === "all" && this.selectionState === "selecting_target")
            ) {
                this.ctx.shadowColor = colors.glowColor;
                this.ctx.shadowBlur = colors.glowBlur;
                this.ctx.strokeStyle = colors.selectedText;
            } else {
                this.ctx.strokeStyle = colors.normalText;
            }

            this.ctx.lineWidth = p.portrait.borderWidth;
            this.ctx.strokeRect(
                portraitX - p.portrait.borderWidth,
                portraitY - p.portrait.borderWidth,
                p.portrait.size + p.portrait.borderWidth * 2,
                p.portrait.size + p.portrait.borderWidth * 2
            );

            this.ctx.restore();

            // Character sprite
            this.ctx.save();
            this.ctx.imageSmoothingEnabled = false;
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
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.restore();

            // Stats section
            const statsX = portraitX + p.portrait.size + 25;

            // Name with color change and glow on selection
            this.ctx.save();
            if (
                (index === this.selectedCharIndex &&
                    (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
                (this.targetMode === "all" && this.selectionState === "selecting_target")
            ) {
                this.ctx.shadowColor = colors.glowColor;
                this.ctx.shadowBlur = colors.glowBlur;
                this.ctx.fillStyle = colors.selectedText;
            } else {
                this.ctx.shadowColor = "transparent";
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = colors.normalText;
            }

            this.ctx.font = `${p.stats.fontSize}px monospace`;
            this.ctx.textAlign = "left";
            this.ctx.fillText(`${char.name}`, statsX, y + p.stats.nameY);
            this.ctx.restore();

            // Level
            this.ctx.fillStyle = colors.normalText;
            this.ctx.textAlign = "right";
            this.ctx.fillText(`Level ${char.level}`, x + p.width - 20, y + p.stats.nameY);

            // HP and MP Bars
            this.drawStatBar(statsX, y + p.stats.firstBarY, char.hp, char.maxHp, "#00ff00", "HP", p.stats.width);
            this.drawStatBar(statsX, y + p.stats.secondBarY, char.mp, char.maxMp, "#0000ff", "MP", p.stats.width);
        });
    }

    drawStatBar(x, y, current, max, color, label, width) {
        const height = this.config.stats.barHeight;
        const p = this.config.stats.barText;
        const colors = this.gameMode.colors;

        // Background gradient - now diagonal
        this.ctx.fillStyle = this.createGradient(x, y, width, height, "#222222", "#333333");
        this.ctx.fillRect(x, y, width, height);

        // Current value bar - also diagonal gradient
        const fillWidth = (current / max) * width;
        let colorEnd = this.adjustColor(color, -20);
        this.ctx.fillStyle = this.createGradient(x, y, fillWidth, height, color, colorEnd);
        this.ctx.fillRect(x, y, fillWidth, height);

        // Bar border
        this.ctx.strokeStyle = colors.normalText;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Text
        this.ctx.fillStyle = colors.normalText;
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