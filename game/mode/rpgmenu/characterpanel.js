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
                size: 100,
                margin: 15,
                borderWidth: 2,
                borderColor: "#00ffff"
            },
            stats: {
                x: 155,
                width: 230,
                nameY: 35,
                levelOffset: 120,
                fontSize: 20,
                barHeight: 20,
                barSpacing: 45,
                firstBarY: 55,
                secondBarY: 100,
                textOffset: 15
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
        if (
            this.selectionState === "selecting_hero" ||
            this.selectionState === "selecting_target" 
        ) {
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

        // Portrait border
        this.ctx.strokeStyle = p.portrait.borderColor;
        this.ctx.lineWidth = p.portrait.borderWidth;
        this.ctx.strokeRect(
            portraitX - p.portrait.borderWidth,
            portraitY - p.portrait.borderWidth,
            p.portrait.size + p.portrait.borderWidth * 2,
            p.portrait.size + p.portrait.borderWidth * 2
        );

        // Character sprite
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

        // Stats section
        const statsX = portraitX + p.portrait.size + 30;

        // Name and Level with color change on selection
        this.ctx.fillStyle = (
            (index === this.selectedCharIndex &&
                (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
            (this.targetMode === "all" && this.selectionState === "selecting_target")
        ) ? p.textColor.selected : p.textColor.normal;
        
        this.ctx.font = `${p.stats.fontSize}px monospace`;
        this.ctx.textAlign = "left";
        this.ctx.fillText(`${char.name}`, statsX, y + p.stats.nameY);
        this.ctx.fillText(`LV ${char.level}`, statsX + p.stats.levelOffset, y + p.stats.nameY);

        // HP Bar
        this.drawStatBar(statsX, y + p.stats.firstBarY, char.hp, char.maxHp, "#00ff00", "HP", p.stats.width);

        // MP Bar
        this.drawStatBar(statsX, y + p.stats.secondBarY, char.mp, char.maxMp, "#0000ff", "MP", p.stats.width);
    });
}

    drawStatBar(x, y, current, max, color, label, width) {
        const height = 20;

        // Bar background with gradient
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
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);

        // Text below bar
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "14px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`${label}: ${current}/${max}`, x, y + height + 15);
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