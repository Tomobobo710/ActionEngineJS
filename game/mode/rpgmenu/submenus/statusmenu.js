// game/mode/rpgmenu/submenus/statusmenu.js
class StatusMenu extends BaseSubmenu {
    constructor(ctx, input, gameMaster, characterPanel) {
        super(ctx, input, gameMaster, characterPanel);
        this.selectedCharIndex = 0;
        
        // Status effects data with emoji icons
        this.statusIcons = {
            poison: { icon: "☠️", color: "#9933ff", desc: "Losing HP over time" },
            blind: { icon: "👁️", color: "#888888", desc: "High chance to miss attacks" },
            silence: { icon: "🤐", color: "#33ccff", desc: "Cannot cast magic" },
            wither: { icon: "🥀", color: "#FF6347", desc: "Rapidly losing HP" }
        };
    }

    registerElements() {
        // Clean up old elements first
        this.cleanup();
        
        // Register back button
        const backButtonX = 
            this.layout.x + this.layout.width - this.layout.backButton.rightOffset - this.layout.backButton.width / 2;
        this.registerBackButton(() => ({
            x: backButtonX - this.layout.backButton.width / 2,
            y: this.layout.y + this.layout.backButton.topOffset,
            width: this.layout.backButton.width,
            height: this.layout.backButton.height
        }));
        
        // Register left/right character navigation buttons
        const navY = this.layout.y + this.layout.headerHeight + 25;
        
        // Left arrow
        this.input.registerElement("prev_char", {
            bounds: () => ({
                x: this.layout.x + 10,
                y: navY - 15,
                width: 30,
                height: 30
            })
        });
        
        // Right arrow
        this.input.registerElement("next_char", {
            bounds: () => ({
                x: this.layout.x + this.layout.width - 40,
                y: navY - 15,
                width: 30,
                height: 30
            })
        });
    }

    update() {
        // Check for back button
        if (this.input.isElementJustPressed("back_button") || this.input.isKeyJustPressed("Action2")) {
            return "exit";
        }
        
        const party = this.gameMaster.persistentParty;
        if (party.length <= 0) return null;
        
        // Handle character navigation with buttons
        if (this.input.isElementJustPressed("prev_char") || this.input.isKeyJustPressed("DirLeft")) {
            this.selectedCharIndex = (this.selectedCharIndex - 1 + party.length) % party.length;
        }
        
        if (this.input.isElementJustPressed("next_char") || this.input.isKeyJustPressed("DirRight")) {
            this.selectedCharIndex = (this.selectedCharIndex + 1) % party.length;
        }
        
        return null;
    }

    draw() {
        const m = this.layout;
        const colors = this.gameMaster.modeManager.activeMode.colors;
        const party = this.gameMaster.persistentParty;
        
        // Save initial context state and set default text properties
        this.ctx.save();
        this.ctx.textBaseline = "middle";
        
        // Draw window header with gradient
        this.ctx.fillStyle = this.createGradient(
            m.x, m.y, m.width, m.headerHeight,
            colors.headerBackground.start,
            colors.headerBackground.end
        );
        this.ctx.fillRect(m.x, m.y, m.width, m.headerHeight);
        
        // Draw main window background with gradient
        this.ctx.fillStyle = this.createGradient(
            m.x, m.y + m.headerHeight, m.width, m.height - m.headerHeight,
            colors.menuBackground.start, 
            colors.menuBackground.end
        );
        this.ctx.fillRect(m.x, m.y + m.headerHeight, m.width, m.height - m.headerHeight);
        
        // Draw back button
        this.drawBackButton(
            m.x + m.width - m.backButton.rightOffset - m.backButton.width / 2,
            m.y + m.backButton.topOffset,
            m.backButton.width,
            m.backButton.height
        );
        
        // Draw "Status" title
        this.ctx.fillStyle = colors.headerText;
        this.ctx.font = "26px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Status", m.x + 20, m.y + 28);
        
        // Draw character list
        this.drawCharacterList();
        
        // Draw selected character's detailed status
        if (party.length > 0) {
            this.drawCharacterDetails(party[this.selectedCharIndex]);
        }
        
        // Draw description panel with XP information
        this.drawXpProgress(party[this.selectedCharIndex]);
        
        // Restore initial context state
        this.ctx.restore();
    }
    
    drawCharacterList() {
        const party = this.gameMaster.persistentParty;
        const colors = this.gameMaster.modeManager.activeMode.colors;
        
        if (party.length <= 0) return;
        
        const char = party[this.selectedCharIndex];
        const navY = this.layout.y + this.layout.headerHeight + 25;
        
        this.ctx.save();
        
        // Draw left arrow
        this.ctx.fillStyle = this.input.isElementHovered("prev_char") ? 
            colors.buttonTextHover : colors.buttonTextNormal;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        // Add glow effect on hover
        if (this.input.isElementHovered("prev_char")) {
            this.ctx.shadowColor = colors.glowColor;
            this.ctx.shadowBlur = colors.glowBlur;
        }
        
        this.ctx.fillText("◀", this.layout.x + 25, navY);
        
        // Reset shadow
        this.ctx.shadowColor = "transparent";
        this.ctx.shadowBlur = 0;
        
        // Draw character name and info in center
        this.ctx.fillStyle = colors.selectedText;
        this.ctx.font = "22px monospace";
        this.ctx.textAlign = "center";
        
        // Dim the text for dead characters
        if (char.isDead) {
            this.ctx.fillStyle = "rgba(255, 150, 150, 1)";
        }
        
        // Shorter format to save space
        const characterText = `${char.name} - Lv ${char.level}${char.isDead ? " [DEAD]" : ""}`;
        this.ctx.fillText(characterText, this.layout.x + this.layout.width/2, navY);
        
        // Draw right arrow
        this.ctx.fillStyle = this.input.isElementHovered("next_char") ? 
            colors.buttonTextHover : colors.buttonTextNormal;
        
        // Add glow effect on hover
        if (this.input.isElementHovered("next_char")) {
            this.ctx.shadowColor = colors.glowColor;
            this.ctx.shadowBlur = colors.glowBlur;
        }
        
        this.ctx.fillText("▶", this.layout.x + this.layout.width - 25, navY);
        
        // Draw character counter below in smaller font
        this.ctx.font = "14px monospace";
        this.ctx.fillStyle = colors.normalText;
        this.ctx.textAlign = "center";
        this.ctx.fillText(`Character ${this.selectedCharIndex + 1}/${party.length}`, 
            this.layout.x + this.layout.width/2, navY + 20);
        
        this.ctx.restore();
    }
    
    drawCharacterDetails(character) {
        if (!character) return;
        
        const m = this.layout;
        const colors = this.gameMaster.modeManager.activeMode.colors;
        
        // Start lower to make room for XP bar
        const navY = this.layout.y + this.layout.headerHeight + 40;
        const xpBarY = navY + 40;
        const startY = xpBarY + 40;
        
        // Draw XP bar first
        this.drawCompactXpBar(character, xpBarY);
        
        // Draw section title with smaller font
        this.ctx.fillStyle = colors.headerText;
        this.ctx.font = "16px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Stats", m.x + 20, startY);
        
        // Draw stats in two columns with more compact layout
        this.ctx.font = "16px monospace";
        const statsY = startY + 20;
        const statsSpacing = 24;
        
        // Reorganize stats to better use space and avoid overflow
        const statRows = [
            { left: { name: "HP", value: `${character.hp}/${character.maxHp}` }, right: { name: "ATK", value: character.stats.attack } },
            { left: { name: "MP", value: `${character.mp}/${character.maxMp}` }, right: { name: "DEF", value: character.stats.defense } },
            { left: { name: "STR", value: character.strength }, right: { name: "M.ATK", value: character.stats.magicAttack } },
            { left: { name: "MAG", value: character.magic }, right: { name: "M.DEF", value: character.stats.magicDefense } },
            { left: { name: "SPD", value: character.speed }, right: { name: "ACC", value: character.stats.accuracy } },
            { left: { name: "", value: "" }, right: { name: "EVA", value: character.stats.evasion } }
        ];
        
        // Draw all stats in a more compact grid format
        statRows.forEach((row, i) => {
            const y = statsY + i * statsSpacing;
            
            // Left stat - using abbreviated names to save space
            if (row.left.name) {
                this.ctx.fillStyle = colors.normalText;
                this.ctx.textAlign = "left";
                this.ctx.fillText(row.left.name + ":", m.x + 25, y);
                
                this.ctx.fillStyle = colors.selectedText;
                this.ctx.textAlign = "right";
                this.ctx.fillText(row.left.value, m.x + 110, y);
            }
            
            // Right stat
            this.ctx.fillStyle = colors.normalText;
            this.ctx.textAlign = "left";
            this.ctx.fillText(row.right.name + ":", m.x + 120, y);
            
            this.ctx.fillStyle = colors.selectedText;
            this.ctx.textAlign = "right";
            this.ctx.fillText(row.right.value, m.x + 220, y);
        });
        
        // Draw equipment section - start earlier and use smaller font
        const equipY = statsY + 150;
        this.ctx.fillStyle = colors.headerText;
        this.ctx.font = "16px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Equipment", m.x + 20, equipY);
        
        const equipment = [
            { slot: "Weapon", item: character.equipment.weapon },
            { slot: "Armor", item: character.equipment.armor },
            { slot: "Helmet", item: character.equipment.helmet },
            { slot: "Accessory", item: character.equipment.accessory }
        ];
        
        equipment.forEach((eq, i) => {
            const y = equipY + 20 + i * 22;
            this.ctx.fillStyle = colors.normalText;
            this.ctx.font = "16px monospace";
            this.ctx.textAlign = "left";
            this.ctx.fillText(eq.slot + ":", m.x + 25, y);
            
            this.ctx.fillStyle = eq.item ? colors.selectedText : "#888888";
            this.ctx.textAlign = "left";
            this.ctx.fillText(
                eq.item ? eq.item.name : "None",
                m.x + 100, y
            );
        });
        
        // Draw status effects section - start much earlier
        this.drawStatusEffects(character, equipY + 100);
    }
    
    drawStatusEffects(character, startY) {
        const m = this.layout;
        const colors = this.gameMaster.modeManager.activeMode.colors;
        
        // Draw section title with smaller font
        this.ctx.fillStyle = colors.headerText;
        this.ctx.font = "16px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("Status Effects", m.x + 20, startY);
        
        // Check for active status effects
        const activeEffects = Object.entries(character.status)
            .filter(([_, value]) => value > 0)
            .map(([key]) => key);
        
        if (activeEffects.length === 0) {
            this.ctx.fillStyle = "#888888";
            this.ctx.font = "16px monospace";
            this.ctx.textAlign = "left";
            this.ctx.fillText("None", m.x + 25, startY + 22);
            return;
        }
        
        // Draw active status effects in a more compact way
        activeEffects.forEach((effect, i) => {
            const y = startY + 22 + i * 22;
            const effectInfo = this.statusIcons[effect];
            if (!effectInfo) return;
            
            this.ctx.font = "16px monospace";
            this.ctx.textAlign = "left";
            this.ctx.fillText(effectInfo.icon, m.x + 25, y);
            
            this.ctx.fillStyle = effectInfo.color;
            this.ctx.fillText(` ${effect.charAt(0).toUpperCase() + effect.slice(1)}`, m.x + 50, y);
        });
    }
    
    // Draw XP progress in the description panel at the bottom
    drawXpProgress(character) {
        if (!character) return;
        
        // Calculate XP progress percentage
        let xpPercentage = 0;
        let xpText = "";
        
        if (character.xp > 0 && character.nextLevelXp > 0) {
            const prevLevelXp = this.calculatePreviousLevelXp(character.level);
            const currentLevelXp = character.xp - prevLevelXp;
            const requiredLevelXp = character.nextLevelXp - prevLevelXp;
            xpPercentage = currentLevelXp / requiredLevelXp;
            xpText = `XP: ${character.xp}/${character.nextLevelXp} (${Math.floor(xpPercentage * 100)}%)`;
        } else {
            xpText = `XP: ${character.xp}/${character.nextLevelXp}`;
        }
        
        this.drawDescriptionPanel(xpText);
    }
    
    // Draw a compact XP bar within the status menu itself
    drawCompactXpBar(character, y) {
        if (!character) return;
        
        const m = this.layout;
        const colors = this.gameMaster.modeManager.activeMode.colors;
        
        // Calculate XP progress percentage
        let xpPercentage = 0;
        
        if (character.xp > 0 && character.nextLevelXp > 0) {
            const prevLevelXp = this.calculatePreviousLevelXp(character.level);
            const currentLevelXp = character.xp - prevLevelXp;
            const requiredLevelXp = character.nextLevelXp - prevLevelXp;
            xpPercentage = currentLevelXp / requiredLevelXp;
        }
        
        // XP bar dimensions
        const barX = m.x + 25;
        const barWidth = m.width - 50;
        const barHeight = 15;
        
        // Draw XP bar label with small font
        this.ctx.fillStyle = colors.normalText;
        this.ctx.font = "14px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText("XP Progress:", barX, y - 5);
        
        // Bar background
        this.ctx.fillStyle = "#222222";
        this.ctx.fillRect(barX, y, barWidth, barHeight);
        
        // Bar fill
        this.ctx.fillStyle = this.createGradient(
            barX, y, barWidth * xpPercentage, barHeight,
            "#4444ff", "#8888ff"
        );
        this.ctx.fillRect(barX, y, barWidth * xpPercentage, barHeight);
        
        // Bar border
        this.ctx.strokeStyle = colors.normalText;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, y, barWidth, barHeight);
        
        // Display percentage in center
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "12px monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(`${Math.floor(xpPercentage * 100)}%`, barX + barWidth/2, y + barHeight/2);
    }
    
    calculatePreviousLevelXp(level) {
        if (level <= 1) return 0;
        const baseXp = 100;
        const modifier = 50;
        return baseXp + (level - 1) * modifier;
    }
    
    cleanup() {
        super.cleanup();
        this.input.removeElement("prev_char");
        this.input.removeElement("next_char");
    }
}