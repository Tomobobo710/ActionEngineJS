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

        this.characterPanel.selectionState = "selecting_hero";
        this.characterPanel.selectedCharIndex = 0;
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
            party.forEach((_, index) => {
                if (this.input.isElementHovered(`character_panel_${index}`)) {
                    this.characterPanel.selectedCharIndex = index;
                }
            });

            // Handle hero selection clicks
            for (let index = 0; index < party.length; index++) {
                if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                    this.characterPanel.selectionState = "selected_hero";
                    this.casterIndex = index;
                    this.registerSpellElements();
                    return;
                }
            }

            // Keyboard selection
            if (this.input.isKeyJustPressed("Action1")) {
                this.characterPanel.selectionState = "selected_hero";
                this.casterIndex = this.characterPanel.selectedCharIndex;
                this.registerSpellElements();
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
                party.forEach((_, index) => {
                    if (this.input.isElementHovered(`character_panel_${index}`)) {
                        this.characterPanel.selectedCharIndex = index;
                    }
                });

                // Handle target selection clicks
                for (let index = 0; index < party.length; index++) {
                    if (this.input.isElementJustPressed(`character_panel_${index}`)) {
                        this.handleSpellUse(selectedChar, selectedChar.spells[this.selectedIndex], party[index]);
                        this.characterPanel.selectionState = "selected_hero";
                        this.characterPanel.selectedCharIndex = this.casterIndex;
                        this.registerSpellElements();
                        return;
                    }
                }

                if (this.input.isKeyJustPressed("Action1")) {
                    this.handleSpellUse(
                        selectedChar,
                        selectedChar.spells[this.selectedIndex],
                        party[this.characterPanel.selectedCharIndex]
                    );
                    this.characterPanel.selectionState = "selected_hero";
                    return;
                }
            } else {
                // All target handling
                if (
                    party.some((_, index) => this.input.isElementJustPressed(`character_panel_${index}`)) ||
                    this.input.isKeyJustPressed("Action1")
                ) {
                    this.handleSpellUse(selectedChar, selectedChar.spells[this.selectedIndex], party);
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
                if (this.input.isElementJustPressed("arrow_left") && this.pagination.currentPage > 0) {
                    this.pagination.currentPage--;
                    this.registerSpellElements();
                    return;
                }
                if (
                    this.input.isElementJustPressed("arrow_right") &&
                    (this.pagination.currentPage + 1) * this.pagination.itemsPerPage < spells.length
                ) {
                    this.pagination.currentPage++;
                    this.registerSpellElements();
                    return;
                }
            }
            
            // Handle spell hovering
            pageSpells.forEach((_, index) => {
                if (this.input.isElementHovered(`magic_spell_${index}`)) {
                    console.log('hovered to select');
                    this.selectedIndex = startIndex + index;
                }
            });

            // Handle spell selection clicks
            for (let index = 0; index < pageSpells.length; index++) {
                if (this.input.isElementJustPressed(`magic_spell_${index}`)) {
                    const selectedSpell = SPELLS[spells[this.selectedIndex]];
                    this.characterPanel.selectionState = "selecting_target";
                    this.characterPanel.targetMode = selectedSpell.targetType.startsWith("all_") ? "all" : "single";
                    this.characterPanel.selectedCharIndex = this.characterPanel.targetMode === "single" ? 0 : -1;
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
            if (this.input.isKeyJustPressed("DirLeft") && this.pagination.currentPage > 0) {
                this.pagination.currentPage--;
                this.registerSpellElements();
                return;
            }

            if (this.input.isKeyJustPressed("DirRight") && 
                (this.pagination.currentPage + 1) * this.pagination.itemsPerPage < spells.length) {
                this.pagination.currentPage++;
                this.registerSpellElements();
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
                this.characterPanel.selectedCharIndex = this.characterPanel.targetMode === "single" ? 0 : -1;
                return;
            }

            return;
        }
    }

    draw() {
        const m = this.layout;

        // Draw window header
        this.ctx.fillStyle = "rgba(0, 0, 153, 0.95)";
        this.ctx.fillRect(m.x, m.y, m.width, m.headerHeight);

        // Draw main window background
        this.ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
        this.ctx.fillRect(m.x, m.y + m.headerHeight, m.width, m.height - m.headerHeight);

        // Draw back button
        this.drawBackButton(
            m.x + m.width - m.backButton.rightOffset - m.backButton.width / 2,
            m.y + m.backButton.topOffset,
            m.backButton.width,
            m.backButton.height
        );

        // Draw title based on state
        this.ctx.fillStyle = "#00ffff";
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
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Select Hero", m.x + m.width / 2, m.y + 100);
            return;
        }

        if (this.characterPanel.selectionState === "selecting_target") {
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Select Target", m.x + m.width / 2, m.y + 100);
            return;
        }

        if (this.characterPanel.selectionState === "selected_hero") {
            this.drawSpellList();
        }
    }

    drawSpellList() {
        const m = this.layout;
        const selectedChar = this.gameMaster.persistentParty[this.casterIndex];
        const spells = selectedChar.spells;
        const startIndex = this.pagination.currentPage * this.pagination.itemsPerPage;
        const pageSpells = spells.slice(startIndex, startIndex + this.pagination.itemsPerPage);

        pageSpells.forEach((spellName, index) => {
            const actualIndex = startIndex + index;
            const y = m.y + m.headerHeight + 20 + index * m.spellSpacing;
            const spellData = SPELLS[spellName];

            if (actualIndex === this.selectedIndex) {
                this.ctx.fillStyle = "rgba(0, 51, 102, 0.95)";
                this.ctx.fillRect(m.x + m.padding, y - 2, m.width - m.padding * 2, m.spellHeight);
            }

            this.ctx.fillStyle = actualIndex === this.selectedIndex ? "#00ffff" : "#ffffff";
            this.ctx.font = "24px monospace";

            // Spell name
            this.ctx.textAlign = "left";
            this.ctx.fillText(spellData.name, m.x + 20, y + m.textOffset);

            // MP cost
            this.ctx.textAlign = "right";
            this.ctx.fillText(`${spellData.mpCost} MP`, m.x + m.width - 20, y + m.textOffset);
        });

        // Draw pagination if needed
        const totalSpells = selectedChar.spells.length;
        if (totalSpells > this.pagination.itemsPerPage) {
            super.drawPagination(totalSpells, this.layout);
        }
        // Draw description panel
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