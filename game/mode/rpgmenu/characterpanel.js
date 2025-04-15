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
        // NEW: Add a flag for phoenix targeting mode
        this.isPhoenixTargeting = false;

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
            this.party.forEach((char, index) => {
                // Skip dead characters for normal targeting or caster selection
                // but include them for Phoenix targeting
                if ((char.isDead && !this.isPhoenixTargeting && this.selectionState === "selecting_target") || 
                    (char.isDead && this.selectionState === "selecting_hero")) {
                    return;
                }
                
                // For Phoenix targeting, skip living characters
                if (!char.isDead && this.isPhoenixTargeting && this.selectionState === "selecting_target") {
                    return;
                }
                
                if (this.input.isElementHovered(`character_panel_${index}`)) {
                    this.selectedCharIndex = index;
                }
            });

            // Handle keyboard navigation
            if (this.input.isKeyJustPressed("DirUp")) {
                if (this.selectionState === "selecting_hero") {
                    // Find the previous living character for hero selection
                    let newIndex = this.selectedCharIndex - 1;
                    while (newIndex >= 0) {
                        if (!this.party[newIndex].isDead) {
                            break;
                        }
                        newIndex--;
                    }
                    if (newIndex >= 0) {
                        this.selectedCharIndex = newIndex;
                    }
                } else if (this.selectionState === "selecting_target") {
                    if (this.isPhoenixTargeting) {
                        // Find the previous DEAD character for Phoenix
                        let newIndex = this.selectedCharIndex - 1;
                        while (newIndex >= 0) {
                            if (this.party[newIndex].isDead) {
                                break;
                            }
                            newIndex--;
                        }
                        if (newIndex >= 0) {
                            this.selectedCharIndex = newIndex;
                        }
                    } else {
                        // Find the previous LIVING character for normal items
                        let newIndex = this.selectedCharIndex - 1;
                        while (newIndex >= 0) {
                            if (!this.party[newIndex].isDead) {
                                break;
                            }
                            newIndex--;
                        }
                        if (newIndex >= 0) {
                            this.selectedCharIndex = newIndex;
                        }
                    }
                }
            }
            
            if (this.input.isKeyJustPressed("DirDown")) {
                if (this.selectionState === "selecting_hero") {
                    // Find the next living character for hero selection
                    let newIndex = this.selectedCharIndex + 1;
                    while (newIndex < this.party.length) {
                        if (!this.party[newIndex].isDead) {
                            break;
                        }
                        newIndex++;
                    }
                    if (newIndex < this.party.length) {
                        this.selectedCharIndex = newIndex;
                    }
                } else if (this.selectionState === "selecting_target") {
                    if (this.isPhoenixTargeting) {
                        // Find the next DEAD character for Phoenix
                        let newIndex = this.selectedCharIndex + 1;
                        while (newIndex < this.party.length) {
                            if (this.party[newIndex].isDead) {
                                break;
                            }
                            newIndex++;
                        }
                        if (newIndex < this.party.length) {
                            this.selectedCharIndex = newIndex;
                        }
                    } else {
                        // Find the next LIVING character for normal items
                        let newIndex = this.selectedCharIndex + 1;
                        while (newIndex < this.party.length) {
                            if (!this.party[newIndex].isDead) {
                                break;
                            }
                            newIndex++;
                        }
                        if (newIndex < this.party.length) {
                            this.selectedCharIndex = newIndex;
                        }
                    }
                }
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

            // Determine if this character is selectable based on targeting mode
            let isSelectable = true;
            if (this.selectionState === "selecting_hero") {
                // Only living characters can cast
                isSelectable = !char.isDead;
            } else if (this.selectionState === "selecting_target") {
                // For phoenix, only dead characters are valid targets
                // For other items/spells, only living characters are valid
                isSelectable = this.isPhoenixTargeting ? char.isDead : !char.isDead;
            }

            // Add glow effect to the entire panel when selected and selectable
            if (
                (index === this.selectedCharIndex && isSelectable &&
                    (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
                (this.targetMode === "all" && this.selectionState === "selecting_target" && isSelectable)
            ) {
                this.ctx.shadowColor = colors.glowColor;
                this.ctx.shadowBlur = colors.glowBlur;
            }

            // Make dead character panels more visually distinct
            if (char.isDead) {
                // Use a darker background for dead characters
                this.ctx.fillStyle = this.createGradient(
                    x,
                    y,
                    p.width,
                    p.height,
                    "rgba(50, 50, 50, 0.8)",
                    "rgba(30, 30, 30, 0.8)"
                );
            } else {
                // Panel background with gradient for living characters
                this.ctx.fillStyle = this.createGradient(
                    x,
                    y,
                    p.width,
                    p.height,
                    colors.menuBackground.start,
                    colors.menuBackground.end
                );
            }
            this.ctx.fillRect(x, y, p.width, p.height);

            this.ctx.restore();

            const portraitX = x + p.portrait.margin;
            const portraitY = y + (p.height - p.portrait.size) / 2;

            // Portrait border
            this.ctx.save();

            // Add special highlighting for dead characters when Phoenix targeting is active
            if (
                (index === this.selectedCharIndex && isSelectable &&
                    (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
                (this.targetMode === "all" && this.selectionState === "selecting_target" && isSelectable)
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
            
            // Apply semi-transparency to dead character sprites
            if (char.isDead) {
                // Make dead characters for Phoenix targeting more visible
                this.ctx.globalAlpha = (this.isPhoenixTargeting && index === this.selectedCharIndex) ? 0.9 : 0.6;
                
                // Add a gold aura for selected dead characters with Phoenix
                if (this.isPhoenixTargeting && index === this.selectedCharIndex) {
                    this.ctx.shadowColor = "#ffcc00";  // Golden glow for Phoenix targets
                    this.ctx.shadowBlur = 15;
                }
            }
            
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

            // Add a clear "DEAD" indicator for dead characters
            if (char.isDead) {
                this.ctx.save();
                
                // Different styling if this is a valid Phoenix target
                if (this.isPhoenixTargeting && (index === this.selectedCharIndex || this.targetMode === "all")) {
                    // Gold styling for Phoenix targets
                    this.ctx.strokeStyle = "#ffcc00";
                    this.ctx.fillStyle = "#ffcc00";
                    this.ctx.lineWidth = 3;
                    this.ctx.font = "bold 24px monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.fillText("REVIVE", portraitX + p.portrait.size/2, portraitY + p.portrait.size/2);
                } else {
                    // Regular red X for dead characters
                    this.ctx.strokeStyle = "#ff4444";
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.moveTo(portraitX + 10, portraitY + 10);
                    this.ctx.lineTo(portraitX + p.portrait.size - 10, portraitY + p.portrait.size - 10);
                    this.ctx.moveTo(portraitX + p.portrait.size - 10, portraitY + 10);
                    this.ctx.lineTo(portraitX + 10, portraitY + p.portrait.size - 10);
                    this.ctx.stroke();
                    
                    // Add "DEAD" text 
                    this.ctx.fillStyle = "#ff4444";
                    this.ctx.font = "bold 24px monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.fillText("DEAD", portraitX + p.portrait.size/2, portraitY + p.portrait.size/2);
                }
                
                this.ctx.restore();
            }

            // Stats section
            const statsX = portraitX + p.portrait.size + 25;

            // Name with color change and glow on selection
            this.ctx.save();
            if (
                (index === this.selectedCharIndex && isSelectable &&
                    (this.selectionState === "selecting_target" || this.selectionState === "selecting_hero")) ||
                (this.targetMode === "all" && this.selectionState === "selecting_target" && isSelectable)
            ) {
                this.ctx.shadowColor = colors.glowColor;
                this.ctx.shadowBlur = colors.glowBlur;
                this.ctx.fillStyle = colors.selectedText;
            } else {
                this.ctx.shadowColor = "transparent";
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = char.isDead ? "#888888" : colors.normalText; // Grayed out for dead
            }

            // For Phoenix targeting, make dead character names gold if selected
            if (this.isPhoenixTargeting && char.isDead && 
                (index === this.selectedCharIndex || this.targetMode === "all")) {
                this.ctx.fillStyle = "#ffcc00";
            }

            this.ctx.font = `${p.stats.fontSize}px monospace`;
            this.ctx.textAlign = "left";
            this.ctx.fillText(`${char.name}${char.isDead ? " [DEAD]" : ""}`, statsX, y + p.stats.nameY);
            this.ctx.restore();

            // Level
            this.ctx.fillStyle = char.isDead ? "#888888" : colors.normalText;
            // Gold color for Phoenix targets
            if (this.isPhoenixTargeting && char.isDead && 
                (index === this.selectedCharIndex || this.targetMode === "all")) {
                this.ctx.fillStyle = "#ffcc00";
            }
            this.ctx.textAlign = "right";
            this.ctx.fillText(`Level ${char.level}`, x + p.width - 20, y + p.stats.nameY);

            // HP and MP Bars
            let hpColor = char.isDead ? "#888888" : "#00ff00";
            let mpColor = char.isDead ? "#888888" : "#0000ff";
            
            // Gold colors for Phoenix targets
            if (this.isPhoenixTargeting && char.isDead && 
                (index === this.selectedCharIndex || this.targetMode === "all")) {
                hpColor = "#ffcc00";
                mpColor = "#ffcc00";
            }
            
            this.drawStatBar(statsX, y + p.stats.firstBarY, char.hp, char.maxHp, hpColor, "HP", p.stats.width);
            this.drawStatBar(statsX, y + p.stats.secondBarY, char.mp, char.maxMp, mpColor, "MP", p.stats.width);
            
            // Draw status effects
            this.drawStatusEffects(char, statsX, y + p.stats.firstBarY + 35, p.stats.width);
        });
    }
    
    // Add method to draw status effects
    drawStatusEffects(character, x, y, width) {
        // Check which status effects are active
        const activeStatuses = Object.entries(character.status)
            .filter(([status, duration]) => duration > 0);
            
        if (activeStatuses.length === 0) return; // No status effects
        
        this.ctx.save();
        
        // Draw status effect box with semi-transparent background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        this.ctx.fillRect(x, y, width, 24);
        this.ctx.strokeStyle = "#666666";
        this.ctx.strokeRect(x, y, width, 24);
        
        // Draw status effect icons and text
        let statusX = x + 10;
        activeStatuses.forEach(([status, duration]) => {
            // Choose color and icon based on status type
            let statusColor;
            let statusEmoji;
            
            switch(status) {
                case "poison":
                    statusColor = "#9933ff"; // Purple for poison 
                    statusEmoji = "☠️";
                    break;
                case "blind":
                    statusColor = "#888888"; // Gray for blind
                    statusEmoji = "👁️";
                    break;
                case "silence":
                    statusColor = "#33ccff"; // Light blue for silence
                    statusEmoji = "🤐";
                    break;
                default:
                    statusColor = "#ffffff"; // White for unknown
                    statusEmoji = "❓";
            }
            
            // Draw emoji and text
            this.ctx.font = "16px monospace";
            this.ctx.textAlign = "left";
            this.ctx.fillText(statusEmoji, statusX, y + 18);
            
            this.ctx.fillStyle = statusColor;
            this.ctx.fillText(` ${status.toUpperCase()}: ${duration}`, statusX + 20, y + 18);
            
            statusX += 120; // Move to next status position
        });
        
        this.ctx.restore();
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
        this.isPhoenixTargeting = false;
    }
}