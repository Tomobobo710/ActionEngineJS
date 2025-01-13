// game/mode/battle/classes/battleinputmanager.js
class BattleInputManager {
    constructor(battleSystem, input) {
        this.battle = battleSystem;
        this.input = input;
        this.lastBounds = {};
    }

    handleInput() {
        if (this.battle.state !== "battle" || !this.battle.activeChar) return;

        const mousePos = this.input.getPointerPosition();
        const isTouching = this.input.isPointerDown();
        const justTouched = this.input.isPointerJustDown();

        // Add cancel button hover check
        if (this.battle.showCancelButton) {
            const bounds = {
                x: 102,
                y: 600 - 170,
                width: 200,
                height: 30
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
            if (isInBounds !== this.battle.lastCancelBounds) {
                if (isInBounds) {
                    this.battle.hoveredCancel = true;
                } else if (!isTouching) {
                    this.battle.hoveredCancel = false;
                }
                this.battle.lastCancelBounds = isInBounds;
            }
        }

        // Add this for cancel button handling
        if (this.battle.showCancelButton) {
            const isHovered = this.input.isPointInBounds(mousePos.x, mousePos.y, {
                x: 102,
                y: this.battle.HEIGHT - 170,
                width: 200,
                height: 30
            });

            // Update hover state
            if (isHovered !== this.lastBounds.cancel) {
                this.battle.hoveredCancel = isHovered;
                this.lastBounds.cancel = isHovered;
            }

            // Handle cancel click
            if (this.input.isElementJustPressed("cancel_button")) {
                this.battle.endTargeting();
                this.battle.currentMenu = "main";
                this.battle.audio.play("menu_cancel");
            }
        }

        /*
        // Clear hover states only if touch ended
        if (!isTouching && justTouched === false) {
            this.clearHoverStates();
        }
		*/

        if (this.battle.targetingMode) {
            this.handleTargeting(mousePos, isTouching);
            return;
        }

        if (this.battle.currentMenu === "magic") {
            this.handleMagicMenu(mousePos, isTouching);
            return;
        }

        // Add proper item menu handling
        if (this.battle.currentMenu === "item") {
            this.handleItemMenu(mousePos, isTouching);
            return;
        }

        this.handleMainMenu(mousePos, isTouching);
    }

    handleMainMenu(mousePos, isTouching) {
        const commands = ["fight", "magic", "item", "run"];

        commands.forEach((command, i) => {
            const bounds = {
                x: 60,
                y: 600 - 140 + i * 35 + 15,
                width: 100,
                height: 30
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
            if (isInBounds !== this.battle[`last${command}Bounds`]) {
                if (isInBounds) {
                    this.battle.hoveredMenuOption = command;
                    this.battle.menuPosition = i;
                    this.battle.audio.play("menu_move");
                } else if (this.battle.hoveredMenuOption === command && !isTouching) {
                    this.battle.hoveredMenuOption = null;
                }
                this.battle[`last${command}Bounds`] = isInBounds;
            }

            if (this.input.isElementJustPressed(`menu_${command}`)) {
                this.executeMainMenuAction(command, i);
            }
        });

        // Handle keyboard navigation
        if (this.input.isKeyJustPressed("DirUp")) {
            this.battle.menuPosition = (this.battle.menuPosition - 1 + 4) % 4;
            this.battle.hoveredMenuOption = commands[this.battle.menuPosition];
            this.battle.audio.play("menu_move");
        }
        if (this.input.isKeyJustPressed("DirDown")) {
            this.battle.menuPosition = (this.battle.menuPosition + 1) % 4;
            this.battle.hoveredMenuOption = commands[this.battle.menuPosition];
            this.battle.audio.play("menu_move");
        }
        if (this.input.isKeyJustPressed("Action1")) {
            const command = commands[this.battle.menuPosition];
            this.executeMainMenuAction(command, this.battle.menuPosition);
        }
    }

    executeMainMenuAction(command, index) {
        this.battle.menuPosition = index;
        switch (command) {
            case "fight":
                this.battle.selectedAction = "fight";
                this.battle.startTargeting(TARGET_TYPES.SINGLE_ENEMY);
                this.battle.audio.play("menu_select");
                break;
            case "magic":
                if (this.battle.activeChar.spells.length > 0) {
                    this.battle.currentMenu = "magic";
                    this.battle.subMenuPosition = 0;
                    this.battle.audio.play("menu_select");
                } else {
                    this.showBattleMessage("No spells known!");
                }
                break;
            case "item":
                const availableItems = this.battle.partyInventory.getAvailableItems();
                if (availableItems.length > 0) {
                    this.battle.currentMenu = "item";
                    this.battle.subMenuPosition = 0;
                    this.battle.selectedAction = "item";
                    this.battle.audio.play("menu_select");
                } else {
                    this.showBattleMessage("No items available!");
                }
                break;
            case "run":
                this.battle.attemptRun();
                break;
        }
    }

    handleMagicMenu(mousePos, isTouching) {
        const spells = this.battle.activeChar.spells;
        const totalPages = Math.ceil(spells.length / this.battle.maxVisibleSpells);
        const currentPage = Math.floor(this.battle.spellScrollOffset / this.battle.maxVisibleSpells);
        const spellsPerColumn = 4;
        const visibleSpells = spells.slice(
            currentPage * this.battle.maxVisibleSpells,
            (currentPage + 1) * this.battle.maxVisibleSpells
        );

        // Handle spell hovers for both columns, but only for actual spells
        visibleSpells.forEach((spellId, visibleIndex) => {
            const actualIndex = visibleIndex + currentPage * this.battle.maxVisibleSpells;
            const isSecondColumn = visibleIndex >= spellsPerColumn;
            const bounds = {
                x: isSecondColumn ? 355 : 195,
                y: 600 - 140 + (visibleIndex % spellsPerColumn) * 35 + 15,
                width: 150,
                height: 30
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
            if (isInBounds !== this.battle[`lastSpell${actualIndex}Bounds`]) {
                if (isInBounds) {
                    this.battle.hoveredSpell = SPELLS[spellId];
                    this.battle.subMenuPosition = actualIndex;
                    this.battle.audio.play("menu_move");
                } else if (this.battle.hoveredSpell === SPELLS[spellId] && !isTouching) {
                    this.battle.hoveredSpell = null;
                }
                this.battle[`lastSpell${actualIndex}Bounds`] = isInBounds;
            }

            if (this.input.isElementJustPressed(`submenu_slot_${visibleIndex}`)) {
                this.battle.handleSpellSelection(SPELLS[spellId]);
            }
        });

        // Rest of the method remains the same
        this.handleScrollArrows(mousePos, currentPage, totalPages);
        this.handleSpellKeyboardNav(spells, currentPage, totalPages);

        if (this.input.isKeyJustPressed("Action2")) {
            this.battle.currentMenu = "main";
            this.battle.spellScrollOffset = 0;
            this.battle.audio.play("menu_cancel");
        }
    }

    handleTargeting(mousePos, isTouching) {
        this.handleTargetGroupSelection();
        this.handleTargetHovers(mousePos, isTouching);
        this.handleTargetSelection();
        this.handleTargetingCancel();
    }

    handleTargetGroupSelection() {
        if (this.input.isKeyJustPressed("DirLeft") || this.input.isKeyJustPressed("DirRight")) {
            this.battle.currentTargetGroup = this.battle.currentTargetGroup === "enemies" ? "allies" : "enemies";
            this.battle.updateTargetList();
            this.battle.audio.play("menu_move");
        }
        if (!this.battle.isGroupTarget) {
            // Only allow individual target selection if not group targeting
            const pressedUp = this.input.isKeyJustPressed("DirUp");
            const pressedDown = this.input.isKeyJustPressed("DirDown");

            if (pressedUp || pressedDown) {
                const dir = pressedUp ? -1 : 1;
                this.battle.targetIndex =
                    (this.battle.targetIndex + dir + this.battle.targetList.length) % this.battle.targetList.length;
                this.battle.audio.play("menu_move");
            }
        }
    }

    handleTargetHovers(mousePos, isTouching) {
        const updateHoverState = (target, index, group) => {
            if (target.isDead) return; // Safety check

            this.battle.currentTargetGroup = group;
            const livingTargets =
                group === "enemies"
                    ? this.battle.enemies.filter((e) => !e.isDead)
                    : this.battle.party.filter((c) => !c.isDead);

            const livingIndex = livingTargets.indexOf(target);
            if (livingIndex === -1) return;

            this.battle.targetIndex = livingIndex;
            this.battle.targetList = this.battle.isGroupTarget ? [livingTargets] : livingTargets;
            this.battle.hoveredTarget = target;
        };

        // Check living enemies
        this.battle.enemies
            .filter((enemy) => !enemy.isDead)
            .forEach((enemy, i) => {
                const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, {
                    x: enemy.pos.x,
                    y: enemy.pos.y,
                    width: 48,
                    height: 48
                });

                if (isInBounds !== enemy.lastInBounds) {
                    if (isInBounds) {
                        updateHoverState(enemy, i, "enemies");
                        this.battle.audio.play("menu_move");
                    } else if (this.battle.hoveredTarget === enemy && !isTouching) {
                        this.battle.hoveredTarget = null;
                    }
                    enemy.lastInBounds = isInBounds;
                }
            });

        // Check living party members
        this.battle.party.forEach((ally, i) => {
            if (!ally || ally.isDead) return; // Skip empty slots or dead allies

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, {
                x: ally.pos.x,
                y: ally.pos.y,
                width: 32,
                height: 32
            });

            if (isInBounds !== ally.lastInBounds) {
                if (isInBounds) {
                    updateHoverState(ally, i, "allies");
                    this.battle.audio.play("menu_move");
                } else if (this.battle.hoveredTarget === ally && !isTouching) {
                    this.battle.hoveredTarget = null;
                }
                ally.lastInBounds = isInBounds;
            }
        });
    }

    updateTargetHover(target, index) {
        this.battle.currentTargetGroup = target.type === "enemy" ? "enemies" : "allies";
        this.battle.targetIndex = index;
        const filteredTargets =
            this.battle.currentTargetGroup === "enemies"
                ? this.battle.enemies.filter((e) => !e.isDead)
                : this.battle.party.filter((c) => !c.isDead);
        this.battle.targetList = this.battle.isGroupTarget ? [filteredTargets] : filteredTargets;
        this.battle.hoveredTarget = target;
    }

    handleTargetSelection() {
        // Handle enemy clicks
        this.battle.enemies.forEach((enemy, index) => {
            if (this.input.isElementJustPressed(`enemy_${index}`)) {
                if (this.battle.isGroupTarget && this.battle.currentTargetGroup === "enemies") {
                    const targets = this.battle.enemies.filter((e) => !e.isDead);
                    this.battle.executeTargetedAction(targets);
                } else {
                    this.battle.executeTargetedAction(enemy);
                }
            }
        });

        // Handle ally clicks with same logic as enemies
        this.battle.party.forEach((ally, index) => {
            if (this.input.isElementJustPressed(`char_${index}`)) {
                if (this.battle.isGroupTarget && this.battle.currentTargetGroup === "allies") {
                    const targets = this.battle.party.filter((c) => !c.isDead);
                    this.battle.executeTargetedAction(targets);
                } else {
                    this.battle.executeTargetedAction(ally);
                }
            }
        });

        // Keep existing keyboard handling
        if (this.input.isKeyJustPressed("Action1")) {
            const target = this.battle.targetList[this.battle.targetIndex];
            if (target && !target.isDead) {
                this.battle.executeTargetedAction(target);
            }
        }
    }

    handleTargetingCancel() {
        if (this.input.isKeyJustPressed("Action2")) {
            this.battle.endTargeting();
            this.battle.currentMenu = "main";
            this.battle.audio.play("menu_cancel");
        }
    }

    clearHoverStates() {
        this.battle.hoveredMenuOption = null;
        this.battle.hoveredTarget = null;
        this.battle.hoveredSpell = null;
        this.battle.hoveredCancel = false;
    }

    getSpellMenuBounds(index) {
        const isSecondColumn = index >= 4;
        return {
            x: isSecondColumn ? 355 : 195,
            y: this.battle.HEIGHT - 140 + (index % 4) * 35 + 15,
            width: 150,
            height: 30
        };
    }

    handleItemMenu(mousePos, isTouching) {
        const availableItems = this.battle.partyInventory.getAvailableItems();
        const totalItems = availableItems.length;
        const totalPages = Math.ceil(totalItems / this.battle.maxVisibleItems);
        const currentPage = Math.floor(this.battle.itemScrollOffset / this.battle.maxVisibleItems);
        const itemsPerColumn = 4;
        const visibleItems = availableItems.slice(
            currentPage * this.battle.maxVisibleItems,
            (currentPage + 1) * this.battle.maxVisibleItems
        );

        // Handle item hovers
        visibleItems.forEach((itemData, visibleIndex) => {
            const actualIndex = visibleIndex + currentPage * this.battle.maxVisibleItems;
            const isSecondColumn = visibleIndex >= itemsPerColumn;
            const bounds = {
                x: isSecondColumn ? 355 : 195,
                y: 600 - 140 + (visibleIndex % itemsPerColumn) * 35 + 15,
                width: 150,
                height: 30
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
            if (isInBounds !== this.battle[`lastItem${actualIndex}Bounds`]) {
                if (isInBounds) {
                    this.battle.hoveredItem = itemData;
                    this.battle.subMenuPosition = actualIndex;
                    this.battle.audio.play("menu_move");
                } else if (this.battle.hoveredItem === itemData && !isTouching) {
                    this.battle.hoveredItem = null;
                }
                this.battle[`lastItem${actualIndex}Bounds`] = isInBounds;
            }

            if (this.input.isElementJustPressed(`submenu_slot_${visibleIndex}`)) {
                this.handleItemSelection(itemData);
            }
        });

        // Handle scroll arrows
        this.handleItemScrollArrows(mousePos, currentPage, totalPages);
        this.handleItemKeyboardNav(availableItems, currentPage, totalPages);

        if (this.input.isKeyJustPressed("Action2")) {
            this.battle.currentMenu = "main";
            this.battle.itemScrollOffset = 0;
            this.battle.audio.play("menu_cancel");
        }
    }

    scrollItems(direction) {
        const change = direction === "up" ? -this.battle.maxVisibleItems : this.battle.maxVisibleItems;
        this.battle.itemScrollOffset += change;
        this.battle.subMenuPosition = this.battle.itemScrollOffset;
        this.battle.audio.play("menu_move");
    }

    handleItemSelection(itemData) {
        this.battle.pendingItem = itemData.item;
        this.battle.startTargeting(itemData.item.targetType);
        this.battle.audio.play("menu_select");
    }

    handleItemKeyboardNav(items, currentPage, totalPages) {
        const pressedLeft = this.input.isKeyJustPressed("DirLeft");
        const pressedRight = this.input.isKeyJustPressed("DirRight");
        const pressedUp = this.input.isKeyJustPressed("DirUp");
        const pressedDown = this.input.isKeyJustPressed("DirDown");

        const itemsPerColumn = 4;
        const itemsPerPage = itemsPerColumn * 2;
        const currentPageStart = currentPage * itemsPerPage;

        const positionInPage = this.battle.subMenuPosition % itemsPerPage;
        const currentColumn = Math.floor(positionInPage / itemsPerColumn);
        const currentRow = positionInPage % itemsPerColumn;

        if (pressedLeft || pressedRight) {
            const targetColumn = currentColumn === 0 ? 1 : 0;
            const targetPosition = currentPageStart + targetColumn * itemsPerColumn + currentRow;

            if (targetPosition < items.length) {
                this.battle.subMenuPosition = targetPosition;
                this.battle.hoveredItem = items[targetPosition];
                this.battle.audio.play("menu_move");
            }
        }

        if (pressedUp) {
            if (currentRow > 0) {
                this.battle.subMenuPosition--;
                this.battle.hoveredItem = items[this.battle.subMenuPosition];
                this.battle.audio.play("menu_move");
            } else if (currentPage > 0) {
                this.scrollItems("up");
                const newPageStart = (currentPage - 1) * itemsPerPage;
                this.battle.subMenuPosition = Math.min(
                    items.length - 1,
                    newPageStart + currentColumn * itemsPerColumn + (itemsPerColumn - 1)
                );
                this.battle.hoveredItem = items[this.battle.subMenuPosition];
            }
        }

        if (pressedDown) {
            if (currentRow < itemsPerColumn - 1 && this.battle.subMenuPosition + 1 < items.length) {
                this.battle.subMenuPosition++;
                this.battle.hoveredItem = items[this.battle.subMenuPosition];
                this.battle.audio.play("menu_move");
            } else if (currentPage < totalPages - 1) {
                this.scrollItems("down");
                const newPageStart = (currentPage + 1) * itemsPerPage;
                this.battle.subMenuPosition = Math.min(items.length - 1, newPageStart + currentColumn * itemsPerColumn);
                this.battle.hoveredItem = items[this.battle.subMenuPosition];
            }
        }

        if (this.input.isKeyJustPressed("Action1")) {
            const selectedItem = items[this.battle.subMenuPosition];
            if (selectedItem) {
                this.handleItemSelection(selectedItem);
            }
        }
    }
    handleItemScrollArrows(mousePos, currentPage, totalPages) {
        const arrowBounds = {
            up: { x: 455, y: 600 - 130, width: 30, height: 20 },
            down: { x: 455, y: 600 - 25, width: 30, height: 20 }
        };

        // Handle up arrow
        if (currentPage > 0) {
            const upArrowInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, arrowBounds.up);
            if (upArrowInBounds !== this.battle.lastUpArrowBounds) {
                this.battle.upArrowHovered = upArrowInBounds;
                this.battle.lastUpArrowBounds = upArrowInBounds;
            }
        }

        // Handle down arrow
        if (currentPage < totalPages - 1) {
            const downArrowInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, arrowBounds.down);
            if (downArrowInBounds !== this.battle.lastDownArrowBounds) {
                this.battle.downArrowHovered = downArrowInBounds;
                this.battle.lastDownArrowBounds = downArrowInBounds;
            }
        }

        // Handle arrow clicks
        if (currentPage > 0 && this.input.isElementJustPressed("item_scroll_up")) {
            this.scrollItems("up");
        }
        if (currentPage < totalPages - 1 && this.input.isElementJustPressed("item_scroll_down")) {
            this.scrollItems("down");
        }
    }

    handleScrollArrows(mousePos, currentPage, totalPages) {
        const arrowBounds = {
            up: { x: 455, y: 600 - 130, width: 30, height: 20 },
            down: { x: 455, y: 600 - 25, width: 30, height: 20 }
        };

        // Up arrow hover
        if (currentPage > 0) {
            const upArrowInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, arrowBounds.up);
            if (upArrowInBounds !== this.battle.lastUpArrowBounds) {
                this.battle.upArrowHovered = upArrowInBounds;
                this.battle.lastUpArrowBounds = upArrowInBounds;
            }
        }

        // Down arrow hover
        if (currentPage < totalPages - 1) {
            const downArrowInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, arrowBounds.down);
            if (downArrowInBounds !== this.battle.lastDownArrowBounds) {
                this.battle.downArrowHovered = downArrowInBounds;
                this.battle.lastDownArrowBounds = downArrowInBounds;
            }
        }

        // Existing click handling
        if (currentPage > 0 && this.input.isElementJustPressed("spell_scroll_up")) {
            this.scrollSpells("up");
        }
        if (currentPage < totalPages - 1 && this.input.isElementJustPressed("spell_scroll_down")) {
            this.scrollSpells("down");
        }
    }

    scrollSpells(direction) {
        const change = direction === "up" ? -this.battle.maxVisibleSpells : this.battle.maxVisibleSpells;
        this.battle.spellScrollOffset += change;
        this.battle.subMenuPosition = this.battle.spellScrollOffset;
        this.battle.audio.play("menu_move");
    }

    handleSpellKeyboardNav(spells, currentPage, totalPages) {
        const pressedLeft = this.input.isKeyJustPressed("DirLeft");
        const pressedRight = this.input.isKeyJustPressed("DirRight");
        const pressedUp = this.input.isKeyJustPressed("DirUp");
        const pressedDown = this.input.isKeyJustPressed("DirDown");

        // Always set hover state to match current cursor position
        this.battle.hoveredSpell = SPELLS[spells[this.battle.subMenuPosition]];

        const spellsPerColumn = 4;
        const spellsPerPage = spellsPerColumn * 2;
        const currentPageStart = currentPage * spellsPerPage;

        // Calculate current position
        const positionInPage = this.battle.subMenuPosition % spellsPerPage;
        const currentColumn = Math.floor(positionInPage / spellsPerColumn);
        const currentRow = positionInPage % spellsPerColumn;

        if (pressedLeft || pressedRight) {
            // Move between columns, wrapping around
            const targetColumn = currentColumn === 0 ? 1 : 0;
            const targetPosition = currentPageStart + targetColumn * spellsPerColumn + currentRow;

            // Only move if target position has a spell
            if (targetPosition < spells.length) {
                this.battle.subMenuPosition = targetPosition;
                this.battle.audio.play("menu_move");
            }
        }

        if (pressedUp) {
            if (currentRow > 0) {
                // Move up within current column
                this.battle.subMenuPosition--;
                this.battle.audio.play("menu_move");
            } else if (currentPage > 0) {
                // At top of any column, go to previous page
                this.scrollSpells("up");
                // Position at BOTTOM of same column on previous page
                const newPageStart = (currentPage - 1) * spellsPerPage;
                this.battle.subMenuPosition = Math.min(
                    spells.length - 1,
                    newPageStart + currentColumn * spellsPerColumn + (spellsPerColumn - 1)
                );
            }
        }

        if (pressedDown) {
            if (currentRow < spellsPerColumn - 1 && this.battle.subMenuPosition + 1 < spells.length) {
                // Move down within current column
                this.battle.subMenuPosition++;
                this.battle.audio.play("menu_move");
            } else if (currentPage < totalPages - 1) {
                // At bottom of any column, go to next page
                this.scrollSpells("down");
                // Position at TOP of same column on next page
                const newPageStart = (currentPage + 1) * spellsPerPage;
                this.battle.subMenuPosition = Math.min(
                    spells.length - 1,
                    newPageStart + currentColumn * spellsPerColumn
                );
            }
        }

        if (this.input.isKeyJustPressed("Action1")) {
            const selectedSpell = SPELLS[spells[this.battle.subMenuPosition]];
            this.battle.handleSpellSelection(selectedSpell);
        }
    }

    navigateSpellList(direction, spells, currentPage, totalPages) {
        const newPos = this.battle.subMenuPosition + direction;
        if (newPos >= 0 && newPos < spells.length) {
            this.battle.subMenuPosition = newPos;
            // Handle scrolling if needed
            if (newPos >= (currentPage + 1) * this.battle.maxVisibleSpells) {
                this.scrollSpells("down");
            } else if (newPos < currentPage * this.battle.maxVisibleSpells) {
                this.scrollSpells("up");
            }
            this.battle.audio.play("menu_move");
        }
    }
}