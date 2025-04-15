// game/mode/rpgmenu/submenus/magicmenu.js
class MagicMenu extends BaseSubmenu {
    constructor(ctx, input, gameMaster, characterPanel) {
        super(ctx, input, gameMaster, characterPanel);
        this.casterIndex = -1;
        this.selectedIndex = 0;
    }

    registerElements() {
        const l = this.layout;
        const backButtonX = l.x + l.width - l.backButton.rightOffset - l.backButton.width / 2;

        this.registerBackButton(() => ({
            x: backButtonX - l.backButton.width / 2,
            y: l.y + l.backButton.topOffset,
            width: l.backButton.width,
            height: l.backButton.height
        }));

        // NEW FIX: Initialize with the first living character instead of just character 0
        this.characterPanel.selectionState = "selecting_hero";
        
        // Find first living character in the party
        const firstLivingIndex = this.gameMaster.persistentParty.findIndex(char => !char.isDead);
        
        // If all characters are dead, default to 0, otherwise use the first living character
        this.characterPanel.selectedCharIndex = firstLivingIndex >= 0 ? firstLivingIndex : 0;
    }

    registerSpellElements() {
        const m = this.layout;
        const selectedChar = this.gameMaster.persistentParty[this.casterIndex];
        const spells = selectedChar.spells;
        const startIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
        const pageSpells = spells.slice(startIndex, startIndex + this.pagination.itemsPerPage);

        // Clean up old elements first
        this.cleanup();

        // Register back button
        const backButtonX = m.x + m.width - m.backButton.rightOffset - m.backButton.width / 2;
        this.registerBackButton(() => ({
            x: backButtonX - m.backButton.width / 2,
            y: m.y + m.backButton.topOffset,
            width: m.backButton.width,
            height: m.backButton.height
        }));

        // Register spell elements
        pageSpells.forEach((_, index) => {
            this.input.registerElement(`magic_spell_${index}`, {
                bounds: () => ({
                    x: m.x + m.padding,
                    y: m.y + m.headerHeight + 20 + index * m.spellSpacing,
                    width: m.width - m.padding * 2,
                    height: m.spellHeight
                })
            });
        });

        // Register pagination elements
        this.registerPaginationElements(this.layout, selectedChar.spells.length);
    }

    update() {
        // Check back button first
        if (this.input.isElementJustPressed("back_button")) {
            this.characterPanel.selectionState = "none";
            this.characterPanel.selectedCharIndex = -1;
            this.casterIndex = -1;
            return "exit";
        }

        // Hero selection state
        if (this.characterPanel.selectionState === "selecting_hero") {
            const party = this.gameMaster.persistentParty;

            // Handle hovering for hero selection
            party.forEach((char, index) => {
                // Skip dead characters when hovering
                if (char.isDead) return;
                
                if (this.input.isElementHovered(`character_panel_${index}`)) {
                    this.characterPanel.selectedCharIndex = index;
                }
            });

            // Handle hero selection clicks
            for (let index = 0; index < party.length; index++) {
                // Skip interaction with dead characters
                if (party[index].isDead) continue;
                
                if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                    this.characterPanel.selectionState = "selected_hero";
                    this.casterIndex = index;
                    this.registerSpellElements();
                    return;
                }
            }

            // Keyboard selection
            if (this.input.isKeyJustPressed("Action1")) {
                // Don't allow selecting dead characters
                const selectedChar = party[this.characterPanel.selectedCharIndex];
                if (selectedChar && !selectedChar.isDead) {
                    this.characterPanel.selectionState = "selected_hero";
                    this.casterIndex = this.characterPanel.selectedCharIndex;
                    this.registerSpellElements();
                } else {
                    // Display an error message or feedback
                    console.log("Cannot select a dead character");
                }
                return;
            }

            if (this.input.isKeyJustPressed("Action2")) {
                return "exit";
            }

            return;
        }

        // Target selection state
        if (this.characterPanel.selectionState === "selecting_target") {
            const selectedChar = this.gameMaster.persistentParty[this.casterIndex];
            const spells = selectedChar.spells;
            const party = this.gameMaster.persistentParty;

            if (this.characterPanel.targetMode === "single") {
                // Handle hovering for targeting
                party.forEach((char, index) => {
                    // Only include living characters for targeting
                    if (char.isDead) return;
                    
                    if (this.input.isElementHovered(`character_panel_${index}`)) {
                        this.characterPanel.selectedCharIndex = index;
                    }
                });

                // Handle target selection clicks
                for (let index = 0; index < party.length; index++) {
                    // Skip dead targets
                    if (party[index].isDead) continue;
                    
                    if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                        this.handleSpellUse(selectedChar, selectedChar.spells[this.selectedIndex], party[index]);
                        this.characterPanel.selectionState = "selected_hero";
                        this.characterPanel.selectedCharIndex = this.casterIndex;
                        this.registerSpellElements();
                        return;
                    }
                }

                if (this.input.isKeyJustPressed("Action1")) {
                    // Check if target is alive
                    const targetChar = party[this.characterPanel.selectedCharIndex];
                    if (targetChar && !targetChar.isDead) {
                        this.handleSpellUse(
                            selectedChar,
                            selectedChar.spells[this.selectedIndex],
                            targetChar
                        );
                        this.characterPanel.selectionState = "selected_hero";
                    }
                    return;
                }
            } else {
                // All target handling
                if (
                    party.some((char, index) => !char.isDead && this.input.isElementJustPressed(`character_panel_${index}`)) ||
                    this.input.isKeyJustPressed("Action1")
                ) {
                    // Filter out dead party members for mass-targeting spells
                    const livingPartyMembers = party.filter(char => !char.isDead);
                    this.handleSpellUse(selectedChar, selectedChar.spells[this.selectedIndex], livingPartyMembers);
                    this.characterPanel.selectionState = "selected_hero";
                    this.characterPanel.selectedCharIndex = this.casterIndex;
                    return;
                }
            }

            // Cancel targeting
            if (this.input.isKeyJustPressed("Action2")) {
                this.characterPanel.selectionState = "selected_hero";
                this.characterPanel.selectedCharIndex = this.casterIndex;
                return;
            }

            return;
        }

        // Spell selection state
        if (this.characterPanel.selectionState === "selected_hero") {
            const selectedChar = this.gameMaster.persistentParty[this.casterIndex];
            const spells = selectedChar.spells;
            const startIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
            const pageSpells = spells.slice(startIndex, startIndex + this.pagination.itemsPerPage);

            // Handle pagination
            if (spells.length > this.pagination.itemsPerPage) {
                if (
                    (this.input.isElementJustPressed("arrow_left") || this.input.isKeyJustPressed("DirLeft")) &&
                    this.pagination.currentPage > 0
                ) {
                    this.pagination.currentPage--;
                    this.selectedIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
                    this.registerSpellElements();
                    return;
                }
                if (
                    (this.input.isElementJustPressed("arrow_right") || this.input.isKeyJustPressed("DirRight")) &&
                    (this.pagination.currentPage + 1) * this.pagination.itemsPerPage < spells.length
                ) {
                    this.pagination.currentPage++;
                    this.selectedIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
                    this.registerSpellElements();
                    return;
                }
            }

            // Handle spell hovering
            pageSpells.forEach((_, index) => {
                if (this.input.isElementHovered(`magic_spell_${index}`)) {
                    console.log("hovered to select");
                    this.selectedIndex = startIndex + index;
                }
            });

            // Handle spell selection clicks
            for (let index = 0; index < pageSpells.length; index++) {
                if (this.input.isElementJustPressed(`magic_spell_${index}`)) {
                    const selectedSpell = SPELLS[spells[this.selectedIndex]];
                    this.characterPanel.selectionState = "selecting_target";
                    this.characterPanel.targetMode = selectedSpell.targetType.startsWith("all_") ? "all" : "single";
                    
                    // Initialize with first living character when selecting targets
                    if (this.characterPanel.targetMode === "single") {
                        // Find first living character to target
                        const firstLivingIndex = this.gameMaster.persistentParty.findIndex(char => !char.isDead);
                        this.characterPanel.selectedCharIndex = firstLivingIndex >= 0 ? firstLivingIndex : 0;
                    } else {
                        this.characterPanel.selectedCharIndex = -1;
                    }
                    return;
                }
            }

            // Keyboard navigation
            if (this.input.isKeyJustPressed("DirUp")) {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                if (this.selectedIndex < startIndex) {
                    if (this.pagination.currentPage > 0) {
                        this.pagination.currentPage--;
                        this.registerSpellElements();
                    }
                }
                return;
            }

            if (this.input.isKeyJustPressed("DirDown")) {
                this.selectedIndex = Math.min(spells.length - 1, this.selectedIndex + 1);
                if (this.selectedIndex >= startIndex + this.pagination.itemsPerPage) {
                    if ((this.pagination.currentPage + 1) * this.pagination.itemsPerPage < spells.length) {
                        this.pagination.currentPage++;
                        this.registerSpellElements();
                    }
                }
                return;
            }

            if (this.input.isKeyJustPressed("Action2")) {
                this.characterPanel.selectionState = "selecting_hero";
                return;
            }

            if (this.input.isKeyJustPressed("Action1")) {
                const selectedSpell = SPELLS[spells[this.selectedIndex]];
                this.characterPanel.selectionState = "selecting_target";
                this.characterPanel.targetMode = selectedSpell.targetType.startsWith("all_") ? "all" : "single";
                
                // Initialize with first living character
                if (this.characterPanel.targetMode === "single") {
                    // Find first living character to target
                    const firstLivingIndex = this.gameMaster.persistentParty.findIndex(char => !char.isDead);
                    this.characterPanel.selectedCharIndex = firstLivingIndex >= 0 ? firstLivingIndex : 0;
                } else {
                    this.characterPanel.selectedCharIndex = -1;
                }
                return;
            }

            return;
        }
    }

    draw() {
        const m = this.layout;
        const colors = this.gameMaster.modeManager.activeMode.colors;

        // Draw window header with gradient
        this.ctx.fillStyle = this.createGradient(
            m.x,
            m.y,
            m.width,
            m.headerHeight,
            colors.headerBackground.start,
            colors.headerBackground.end
        );
        this.ctx.fillRect(m.x, m.y, m.width, m.headerHeight);

        // Draw main window background with gradient
        this.ctx.fillStyle = this.createGradient(
            m.x,
            m.y + m.headerHeight,
            m.width,
            m.height - m.headerHeight,
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

        // Draw title
        this.ctx.fillStyle = colors.headerText;
        this.ctx.font = "26px monospace";
        this.ctx.textAlign = "left";
        if (this.characterPanel.selectionState === "selecting_hero") {
            this.ctx.fillText("Magic", m.x + 20, m.y + 28);
        } else {
            const caster = this.gameMaster.persistentParty[this.casterIndex];
            this.ctx.fillText(`Magic (${caster.name})`, m.x + 20, m.y + 28);
        }

        // Draw state-specific content
        if (this.characterPanel.selectionState === "selecting_hero") {
            this.ctx.fillStyle = colors.normalText;
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Select Caster", m.x + m.width / 2, m.y + 100);
            
            return;
        }

        if (this.characterPanel.selectionState === "selecting_target") {
            this.ctx.fillStyle = colors.normalText;
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Select Target", m.x + m.width / 2, m.y + 100);
            
            // Add indication about targeting living characters
            this.ctx.font = "18px monospace";
            this.ctx.fillStyle = "#ff4444";
            this.ctx.fillText("(Only living characters can be targeted)", m.x + m.width / 2, m.y + 130);

            // Add description panel for the selected spell
            const selectedChar = this.gameMaster.persistentParty[this.casterIndex];
            const selectedSpell = SPELLS[selectedChar.spells[this.selectedIndex]];
            if (selectedSpell && selectedSpell.description) {
                this.drawDescriptionPanel(selectedSpell.description);
            } else {
                this.drawDescriptionPanel("");
            }
            return;
        }

        if (this.characterPanel.selectionState === "selected_hero") {
            this.drawSpellList();
        }
    }

    drawSpellList() {
        const m = this.layout;
        const colors = this.gameMaster.modeManager.activeMode.colors;
        const selectedChar = this.gameMaster.persistentParty[this.casterIndex];
        const spells = selectedChar.spells;
        const startIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
        const pageSpells = spells.slice(startIndex, startIndex + this.pagination.itemsPerPage);

        pageSpells.forEach((spellName, index) => {
            const actualIndex = startIndex + index;
            const y = m.y + m.headerHeight + 20 + index * m.spellSpacing;
            const spellData = SPELLS[spellName];

            this.ctx.save();

            // Selection highlight with glow and gradient
            if (actualIndex === this.selectedIndex) {
                // Add glow effect
                this.ctx.shadowColor = colors.glowColor;
                this.ctx.shadowBlur = colors.glowBlur;

                // Background for selected spell with gradient
                this.ctx.fillStyle = this.createGradient(
                    m.x + m.padding,
                    y - 2,
                    m.width - m.padding * 2,
                    m.spellHeight,
                    colors.selectedBackground.start,
                    colors.selectedBackground.end
                );
                this.ctx.fillRect(m.x + m.padding, y - 2, m.width - m.padding * 2, m.spellHeight);
            }

            // Text color - normalText by default, selectedText when selected
            this.ctx.fillStyle = actualIndex === this.selectedIndex ? colors.selectedText : colors.normalText;
            this.ctx.font = "24px monospace";

            // Draw spell emoji and name (left aligned)
            this.ctx.textAlign = "left";
            this.ctx.fillText(spellData.emoji, m.x + 20, y + m.textOffset);
            this.ctx.fillText(spellData.name, m.x + 60, y + m.textOffset);

            // MP cost (right aligned)
            this.ctx.textAlign = "right";
            this.ctx.fillText(`${spellData.mpCost} MP`, m.x + m.width - 20, y + m.textOffset);

            this.ctx.restore();
        });

        // Draw pagination if needed
        const totalSpells = selectedChar.spells.length;
        if (totalSpells > this.pagination.itemsPerPage) {
            super.drawPagination(totalSpells, this.layout);
        }

        // Draw description panel with gradient
        const selectedSpell = SPELLS[selectedChar.spells[this.selectedIndex]];
        if (selectedSpell && selectedSpell.description) {
            this.drawDescriptionPanel(selectedSpell.description);
        } else {
            this.drawDescriptionPanel("");
        }
    }

    handleSpellUse(caster, spellName, target) {
        const spell = SPELLS[spellName];
        console.log(`${caster.name} casting ${spell.name} on ${Array.isArray(target) ? "all allies" : target.name}`);

        if (caster.mp < spell.mpCost) {
            console.log("Not enough MP!");
            return false;
        }

        let result = caster.castSpell(spell, target);
        caster.menuState.lastSpellIndex = this.selectedIndex;
        return result;
    }

    cleanup() {
        super.cleanup();

        // Clean up spell elements
        const selectedChar = this.gameMaster.persistentParty[this.casterIndex];
        if (selectedChar) {
            const spells = selectedChar.spells;
            const startIndex = this.currentPage * this.layout.spellsPerPage;
            const pageSpells = spells.slice(startIndex, startIndex + this.layout.spellsPerPage);

            pageSpells.forEach((_, index) => {
                this.input.removeElement(`magic_spell_${index}`);
            });
        }

        // Clean up pagination elements
        this.input.removeElement("magic_arrow_left");
        this.input.removeElement("magic_arrow_right");
    }
}