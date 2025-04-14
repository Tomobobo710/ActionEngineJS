// game/mode/battle/classes/battleinputmanager.js
class BattleInputManager {
    constructor(battleSystem, input) {
        this.battle = battleSystem;
        this.input = input;
        this.lastBounds = {};
    }

    handleInput() {
        if (this.battle.stateManager.state !== "battle" || !this.battle.stateManager.activeChar) return;

        const mousePos = this.input.getPointerPosition();
        const isTouching = this.input.isPointerDown();
        const justTouched = this.input.isPointerJustDown();

        // Cancel button hover check
        if (this.battle.stateManager.showCancelButton) {
            const bounds = {
                x: 2,
                y: 600 - 185,
                width: 200,
                height: 30
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
            if (isInBounds !== this.battle.lastCancelBounds) {
                if (isInBounds) {
                    this.battle.stateManager.hoveredCancel = true;
                } else if (!isTouching) {
                    this.battle.stateManager.hoveredCancel = false;
                }
                this.battle.lastCancelBounds = isInBounds;
            }

            // Handle cancel click
            if (this.input.isElementJustPressed("cancel_button")) {
                if (this.battle.targetingManager.targetingMode) {
                    this.battle.targetingManager.endTargeting();
                }
                this.battle.stateManager.currentMenu = "main";
                this.battle.audio.play("menu_cancel");
            }
        }

        // Direct access to targeting manager
        if (this.battle.targetingManager.targetingMode) {
            this.handleTargeting(mousePos, isTouching);
            return;
        }

        if (this.battle.stateManager.currentMenu === "magic") {
            this.handleMagicMenu(mousePos, isTouching);
            return;
        }

        // Add proper item menu handling
        if (this.battle.stateManager.currentMenu === "item") {
            this.handleItemMenu(mousePos, isTouching);
            return;
        }

        this.handleMainMenu(mousePos, isTouching);
    }

    handleMainMenu(mousePos, isTouching) {
        const commands = ["fight", "magic", "item", "run"];

        commands.forEach((command, i) => {
            const bounds = {
                x: 10, // Match the registration
                y: 600 - 140 + i * 35,
                width: 100,
                height: 30
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
            if (isInBounds !== this.battle[`last${command}Bounds`]) {
                if (isInBounds) {
                    this.battle.stateManager.hoveredMenuOption = command;
                    this.battle.stateManager.menuPosition = i;
                    this.battle.audio.play("menu_move");
                } else if (this.battle.stateManager.hoveredMenuOption === command && !isTouching) {
                    this.battle.stateManager.hoveredMenuOption = null;
                }
                this.battle[`last${command}Bounds`] = isInBounds;
            }

            if (this.input.isElementJustPressed(`menu_${command}`)) {
                this.executeMainMenuAction(command, i);
            }
        });

        // Handle keyboard navigation
        if (this.input.isKeyJustPressed("DirUp")) {
            this.battle.stateManager.menuPosition = (this.battle.stateManager.menuPosition - 1 + 4) % 4;
            this.battle.stateManager.hoveredMenuOption = commands[this.battle.stateManager.menuPosition];
            this.battle.audio.play("menu_move");
        }
        if (this.input.isKeyJustPressed("DirDown")) {
            this.battle.stateManager.menuPosition = (this.battle.stateManager.menuPosition + 1) % 4;
            this.battle.stateManager.hoveredMenuOption = commands[this.battle.stateManager.menuPosition];
            this.battle.audio.play("menu_move");
        }
        if (this.input.isKeyJustPressed("Action1")) {
            const command = commands[this.battle.stateManager.menuPosition];
            this.executeMainMenuAction(command, this.battle.stateManager.menuPosition);
        }
    }

    executeMainMenuAction(command, index) {
        this.battle.stateManager.menuPosition = index;
        switch (command) {
            case "fight":
                this.battle.stateManager.selectedAction = "fight";
                this.battle.targetingManager.startTargeting(TARGET_TYPES.SINGLE_ENEMY);
                this.battle.audio.play("menu_select");
                break;
            case "magic":
                if (this.battle.stateManager.activeChar.spells.length > 0) {
                    this.battle.stateManager.currentMenu = "magic";
                    this.battle.stateManager.subMenuPosition = 0;
                    this.battle.audio.play("menu_select");
                } else {
                    this.battle.showBattleMessage("No spells known!");
                }
                break;
            case "item":
                const availableItems = this.battle.partyInventory.getAvailableItems();
                if (availableItems.length > 0) {
                    this.battle.stateManager.currentMenu = "item";
                    this.battle.stateManager.subMenuPosition = 0;
                    this.battle.stateManager.selectedAction = "item";
                    this.battle.audio.play("menu_select");
                } else {
                    this.battle.showBattleMessage("No items available!");
                }
                break;
            case "run":
                this.battle.attemptRun();
                break;
        }
    }

    handleMagicMenu(mousePos, isTouching) {
        const spells = this.battle.stateManager.activeChar.spells;
        const totalPages = Math.ceil(spells.length / this.battle.stateManager.maxVisibleSpells);
        const currentPage = Math.floor(
            this.battle.stateManager.spellScrollOffset / this.battle.stateManager.maxVisibleSpells
        );
        const spellsPerColumn = 4;
        const visibleSpells = spells.slice(
            currentPage * this.battle.stateManager.maxVisibleSpells,
            (currentPage + 1) * this.battle.stateManager.maxVisibleSpells
        );

        // Handle spell hovers for both columns, but only for actual spells
        visibleSpells.forEach((spellId, visibleIndex) => {
            const actualIndex = visibleIndex + currentPage * this.battle.stateManager.maxVisibleSpells;
            const isSecondColumn = visibleIndex >= spellsPerColumn;
            const bounds = {
                x: isSecondColumn ? 280 : 120, // Match registration
                y: 600 - 140 + (visibleIndex % spellsPerColumn) * 35,
                width: 150,
                height: 30
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
            if (isInBounds !== this.battle[`lastSpell${actualIndex}Bounds`]) {
                if (isInBounds) {
                    this.battle.stateManager.hoveredSpell = SPELLS[spellId];
                    this.battle.stateManager.subMenuPosition = actualIndex;
                    this.battle.audio.play("menu_move");
                } else if (this.battle.stateManager.hoveredSpell === SPELLS[spellId] && !isTouching) {
                    this.battle.stateManager.hoveredSpell = null;
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
            this.battle.stateManager.currentMenu = "main";
            this.battle.stateManager.spellScrollOffset = 0;
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
        const targetingManager = this.battle.targetingManager;

        if (this.input.isKeyJustPressed("DirLeft") || this.input.isKeyJustPressed("DirRight")) {
            targetingManager.switchTargetGroup();
            this.battle.audio.play("menu_move");
        }

        if (!targetingManager.isGroupTarget) {
            // Only allow individual target selection if not group targeting
            const pressedUp = this.input.isKeyJustPressed("DirUp");
            const pressedDown = this.input.isKeyJustPressed("DirDown");

            if (pressedUp || pressedDown) {
                const dir = pressedUp ? -1 : 1;
                const newIndex =
                    (targetingManager.targetIndex + dir + targetingManager.targetList.length) %
                    targetingManager.targetList.length;
                targetingManager.setTargetIndex(newIndex);
                this.battle.audio.play("menu_move");
            }
        }
    }

    handleTargetHovers(mousePos, isTouching) {
        const targetingManager = this.battle.targetingManager;

        // Determine if we're using Phoenix (special case for targeting dead characters)
        const isUsingPhoenix =
            this.battle.stateManager.pendingItem && this.battle.stateManager.pendingItem.name === "Phoenix";

        // Helper function to update the target hover state
        const updateHoverState = (target, index, group) => {
            // For Phoenix, we specifically want to target dead characters
            if (isUsingPhoenix) {
                // Only allow targeting dead characters with Phoenix
                if (!target.isDead) return;
            } else {
                // For normal targeting, only allow targeting living characters
                if (target.isDead) return;
            }

            this.battle.stateManager.currentTargetGroup = group;

            // Get all targets in the current group based on Phoenix targeting
            let targetList;
            if (isUsingPhoenix) {
                // Get dead targets for phoenix
                targetList =
                    group === "enemies"
                        ? this.battle.enemies.filter((e) => e.isDead)
                        : this.battle.party.filter((c) => c && c.isDead);
            } else {
                // Get living targets for normal actions
                targetList =
                    group === "enemies"
                        ? this.battle.enemies.filter((e) => !e.isDead)
                        : this.battle.party.filter((c) => c && !c.isDead);
            }

            // Find this target in the filtered target list
            const targetIndex = targetList.indexOf(target);
            if (targetIndex === -1) return; // Shouldn't happen, but just in case

            // Update the target selection state
            targetingManager.setTargetIndex(targetIndex);
            targetingManager.hoveredTarget = target;

            // Update the target list in case the group changed
            targetingManager.updateTargetList();
        };

        // Check all enemies (not just filtered ones)
        this.battle.enemies.forEach((enemy, originalIndex) => {
            // Calculate the same position for all enemies regardless of status
            const x = 176; // Fixed x position
            const y = 126 + originalIndex * 80; // Fixed y position based on original index

            const bounds = {
                x: x,
                y: y,
                width: 48,
                height: 48
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);

            // Use original index for tracking hover state to maintain consistency
            if (isInBounds !== enemy.lastInBounds) {
                // Different handling based on whether we're using a Phoenix
                if (isInBounds) {
                    if (isUsingPhoenix) {
                        // For Phoenix, only allow hovering over dead enemies
                        if (enemy.isDead) {
                            updateHoverState(enemy, originalIndex, "enemies");
                            this.battle.audio.play("menu_move");
                        }
                    } else {
                        // For normal items/actions, only allow hovering over living enemies
                        if (!enemy.isDead) {
                            updateHoverState(enemy, originalIndex, "enemies");
                            this.battle.audio.play("menu_move");
                        }
                    }
                } else if (targetingManager.hoveredTarget === enemy && !isTouching) {
                    targetingManager.hoveredTarget = null;
                }
                enemy.lastInBounds = isInBounds;
            }
        });

        // Similar approach for party members
        this.battle.party.forEach((ally, originalIndex) => {
            if (!ally) return; // Skip empty slots

            // Fixed positions for consistency
            const x = 584;
            const y = 134 + originalIndex * 100;

            const bounds = {
                x: x,
                y: y,
                width: 32,
                height: 32
            };

            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);

            if (isInBounds !== ally.lastInBounds) {
                if (isInBounds) {
                    if (isUsingPhoenix) {
                        // For Phoenix, only allow hovering over dead allies
                        if (ally.isDead) {
                            updateHoverState(ally, originalIndex, "allies");
                            this.battle.audio.play("menu_move");
                        }
                    } else {
                        // For normal items/actions, only allow hovering over living allies
                        if (!ally.isDead) {
                            updateHoverState(ally, originalIndex, "allies");
                            this.battle.audio.play("menu_move");
                        }
                    }
                } else if (targetingManager.hoveredTarget === ally && !isTouching) {
                    targetingManager.hoveredTarget = null;
                }
                ally.lastInBounds = isInBounds;
            }
        });
    }

    handleTargetSelection() {
        const targetingManager = this.battle.targetingManager;

        // Check if we're using a Phoenix (special case)
        const isUsingPhoenix =
            this.battle.stateManager.pendingItem && this.battle.stateManager.pendingItem.name === "Phoenix";

        // Handle enemy clicks
        this.battle.enemies.forEach((enemy, index) => {
            // Filter based on whether we're using Phoenix
            if (isUsingPhoenix) {
                // For Phoenix, only allow clicking on dead enemies
                if (!enemy.isDead) return;
            } else {
                // For normal actions, only allow clicking on living enemies
                if (enemy.isDead) return;
            }

            if (this.input.isElementJustPressed(`enemy_${index}`)) {
                if (targetingManager.isGroupTarget && this.battle.stateManager.currentTargetGroup === "enemies") {
                    // Get appropriate targets based on Phoenix use
                    const targets = isUsingPhoenix
                        ? this.battle.enemies.filter((e) => e.isDead)
                        : this.battle.enemies.filter((e) => !e.isDead);
                    targetingManager.executeTargetedAction(targets);
                } else {
                    targetingManager.executeTargetedAction(enemy);
                }
            }
        });

        // Handle ally clicks
        this.battle.party.forEach((ally, index) => {
            // Skip empty slots
            if (!ally) return;

            // Filter based on whether we're using Phoenix
            if (isUsingPhoenix) {
                // For Phoenix, only allow clicking on dead allies
                if (!ally.isDead) return;
            } else {
                // For normal actions, only allow clicking on living allies
                if (ally.isDead) return;
            }

            if (this.input.isElementJustPressed(`char_${index}`)) {
                if (targetingManager.isGroupTarget && this.battle.stateManager.currentTargetGroup === "allies") {
                    // Get appropriate targets based on Phoenix use
                    const targets = isUsingPhoenix
                        ? this.battle.party.filter((c) => c && c.isDead)
                        : this.battle.party.filter((c) => c && !c.isDead);
                    targetingManager.executeTargetedAction(targets);
                } else {
                    targetingManager.executeTargetedAction(ally);
                }
            }
        });

        // Keep existing keyboard handling
        if (this.input.isKeyJustPressed("Action1")) {
            const target = targetingManager.getCurrentTarget();
            if (target) {
                // For Phoenix, we want to check if the target is dead
                // For normal actions, we want to check if the target is alive
                const isValidTarget = isUsingPhoenix ? target.isDead : !target.isDead;

                if (isValidTarget) {
                    targetingManager.executeTargetedAction(target);
                }
            }
        }
    }

    handleTargetingCancel() {
        if (this.input.isKeyJustPressed("Action2")) {
            this.battle.targetingManager.endTargeting();
            this.battle.stateManager.currentMenu = "main";
            this.battle.audio.play("menu_cancel");
        }
    }

    clearHoverStates() {
        this.battle.stateManager.hoveredMenuOption = null;
        this.battle.targetingManager.hoveredTarget = null;
        this.battle.stateManager.hoveredSpell = null;
        this.battle.stateManager.hoveredCancel = false;
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
        const totalPages = Math.ceil(totalItems / this.battle.stateManager.maxVisibleItems);
        const currentPage = Math.floor(
            this.battle.stateManager.itemScrollOffset / this.battle.stateManager.maxVisibleItems
        );
        const itemsPerColumn = 4;
        const visibleItems = availableItems.slice(
            currentPage * this.battle.stateManager.maxVisibleItems,
            (currentPage + 1) * this.battle.stateManager.maxVisibleItems
        );

        // Handle item hovers
        visibleItems.forEach((itemData, visibleIndex) => {
            const actualIndex = visibleIndex + currentPage * this.battle.stateManager.maxVisibleItems;
            const isSecondColumn = visibleIndex >= itemsPerColumn;
            const bounds = {
                x: isSecondColumn ? 280 : 120, // Match registration
                y: 600 - 140 + (visibleIndex % itemsPerColumn) * 35,
                width: 150,
                height: 30
            };
            const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
            if (isInBounds !== this.battle[`lastItem${actualIndex}Bounds`]) {
                if (isInBounds) {
                    this.battle.stateManager.hoveredItem = itemData;
                    this.battle.stateManager.subMenuPosition = actualIndex;
                    this.battle.audio.play("menu_move");
                } else if (this.battle.stateManager.hoveredItem === itemData && !isTouching) {
                    this.battle.stateManager.hoveredItem = null;
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
            this.battle.stateManager.currentMenu = "main";
            this.battle.stateManager.itemScrollOffset = 0;
            this.battle.audio.play("menu_cancel");
        }
    }

    scrollItems(direction) {
        const change =
            direction === "up" ? -this.battle.stateManager.maxVisibleItems : this.battle.stateManager.maxVisibleItems;
        this.battle.stateManager.itemScrollOffset += change;
        this.battle.stateManager.subMenuPosition = this.battle.stateManager.itemScrollOffset;
        this.battle.audio.play("menu_move");
    }

    handleItemSelection(itemData) {
        this.battle.stateManager.pendingItem = itemData.item;
        this.battle.targetingManager.startTargeting(itemData.item.targetType);
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

        const positionInPage = this.battle.stateManager.subMenuPosition % itemsPerPage;
        const currentColumn = Math.floor(positionInPage / itemsPerColumn);
        const currentRow = positionInPage % itemsPerColumn;

        if (pressedLeft || pressedRight) {
            const targetColumn = currentColumn === 0 ? 1 : 0;
            const targetPosition = currentPageStart + targetColumn * itemsPerColumn + currentRow;

            if (targetPosition < items.length) {
                this.battle.stateManager.subMenuPosition = targetPosition;
                this.battle.stateManager.hoveredItem = items[targetPosition];
                this.battle.audio.play("menu_move");
            }
        }

        if (pressedUp) {
            if (currentRow > 0) {
                this.battle.stateManager.subMenuPosition--;
                this.battle.stateManager.hoveredItem = items[this.battle.stateManager.subMenuPosition];
                this.battle.audio.play("menu_move");
            } else if (currentPage > 0) {
                this.scrollItems("up");
                const newPageStart = (currentPage - 1) * itemsPerPage;
                this.battle.stateManager.subMenuPosition = Math.min(
                    items.length - 1,
                    newPageStart + currentColumn * itemsPerColumn + (itemsPerColumn - 1)
                );
                this.battle.stateManager.hoveredItem = items[this.battle.stateManager.subMenuPosition];
            }
        }

        if (pressedDown) {
            if (currentRow < itemsPerColumn - 1 && this.battle.stateManager.subMenuPosition + 1 < items.length) {
                this.battle.stateManager.subMenuPosition++;
                this.battle.stateManager.hoveredItem = items[this.battle.stateManager.subMenuPosition];
                this.battle.audio.play("menu_move");
            } else if (currentPage < totalPages - 1) {
                this.scrollItems("down");
                const newPageStart = (currentPage + 1) * itemsPerPage;
                this.battle.stateManager.subMenuPosition = Math.min(
                    items.length - 1,
                    newPageStart + currentColumn * itemsPerColumn
                );
                this.battle.stateManager.hoveredItem = items[this.battle.stateManager.subMenuPosition];
            }
        }

        if (this.input.isKeyJustPressed("Action1")) {
            const selectedItem = items[this.battle.stateManager.subMenuPosition];
            if (selectedItem) {
                this.handleItemSelection(selectedItem);
            }
        }
    }

    handleItemScrollArrows(mousePos, currentPage, totalPages) {
        const arrowBounds = {
            up: { x: 440, y: 600 - 130, width: 30, height: 20 },
            down: { x: 440, y: 600 - 35, width: 30, height: 20 }
        };

        // Handle up arrow
        if (currentPage > 0) {
            const upArrowInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, arrowBounds.up);
            if (upArrowInBounds !== this.battle.lastUpArrowBounds) {
                this.battle.stateManager.upArrowHovered = upArrowInBounds;
                this.battle.lastUpArrowBounds = upArrowInBounds;
            }
        }

        // Handle down arrow
        if (currentPage < totalPages - 1) {
            const downArrowInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, arrowBounds.down);
            if (downArrowInBounds !== this.battle.lastDownArrowBounds) {
                this.battle.stateManager.downArrowHovered = downArrowInBounds;
                this.battle.lastDownArrowBounds = downArrowInBounds;
            }
        }

        // Handle arrow clicks
        if (currentPage > 0 && this.input.isElementJustPressed("page_scroll_up")) {
            this.scrollItems("up");
        }
        if (currentPage < totalPages - 1 && this.input.isElementJustPressed("page_scroll_down")) {
            this.scrollItems("down");
        }
    }

    handleScrollArrows(mousePos, currentPage, totalPages) {
        const arrowBounds = {
            up: { x: 440, y: 600 - 130, width: 30, height: 20 },
            down: { x: 440, y: 600 - 35, width: 30, height: 20 }
        };

        // Up arrow hover
        if (currentPage > 0) {
            const upArrowInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, arrowBounds.up);
            if (upArrowInBounds !== this.battle.lastUpArrowBounds) {
                this.battle.stateManager.upArrowHovered = upArrowInBounds;
                this.battle.lastUpArrowBounds = upArrowInBounds;
            }
        }

        // Down arrow hover
        if (currentPage < totalPages - 1) {
            const downArrowInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, arrowBounds.down);
            if (downArrowInBounds !== this.battle.lastDownArrowBounds) {
                this.battle.stateManager.downArrowHovered = downArrowInBounds;
                this.battle.lastDownArrowBounds = downArrowInBounds;
            }
        }

        // Pagination button click handling
        if (currentPage > 0 && this.input.isElementJustPressed("page_scroll_up")) {
            this.scrollSpells("up");
        }
        if (currentPage < totalPages - 1 && this.input.isElementJustPressed("page_scroll_down")) {
            this.scrollSpells("down");
        }
    }

    scrollSpells(direction) {
        const change =
            direction === "up" ? -this.battle.stateManager.maxVisibleSpells : this.battle.stateManager.maxVisibleSpells;
        this.battle.stateManager.spellScrollOffset += change;
        this.battle.stateManager.subMenuPosition = this.battle.stateManager.spellScrollOffset;
        this.battle.audio.play("menu_move");
    }

    handleSpellKeyboardNav(spells, currentPage, totalPages) {
        const pressedLeft = this.input.isKeyJustPressed("DirLeft");
        const pressedRight = this.input.isKeyJustPressed("DirRight");
        const pressedUp = this.input.isKeyJustPressed("DirUp");
        const pressedDown = this.input.isKeyJustPressed("DirDown");

        // Always set hover state to match current cursor position
        this.battle.stateManager.hoveredSpell = SPELLS[spells[this.battle.stateManager.subMenuPosition]];

        const spellsPerColumn = 4;
        const spellsPerPage = spellsPerColumn * 2;
        const currentPageStart = currentPage * spellsPerPage;

        // Calculate current position
        const positionInPage = this.battle.stateManager.subMenuPosition % spellsPerPage;
        const currentColumn = Math.floor(positionInPage / spellsPerColumn);
        const currentRow = positionInPage % spellsPerColumn;

        if (pressedLeft || pressedRight) {
            // Move between columns, wrapping around
            const targetColumn = currentColumn === 0 ? 1 : 0;
            const targetPosition = currentPageStart + targetColumn * spellsPerColumn + currentRow;

            // Only move if target position has a spell
            if (targetPosition < spells.length) {
                this.battle.stateManager.subMenuPosition = targetPosition;
                this.battle.audio.play("menu_move");
            }
        }

        if (pressedUp) {
            if (currentRow > 0) {
                // Move up within current column
                this.battle.stateManager.subMenuPosition--;
                this.battle.audio.play("menu_move");
            } else if (currentPage > 0) {
                // At top of any column, go to previous page
                this.scrollSpells("up");
                // Position at BOTTOM of same column on previous page
                const newPageStart = (currentPage - 1) * spellsPerPage;
                this.battle.stateManager.subMenuPosition = Math.min(
                    spells.length - 1,
                    newPageStart + currentColumn * spellsPerColumn + (spellsPerColumn - 1)
                );
            }
        }

        if (pressedDown) {
            if (currentRow < spellsPerColumn - 1 && this.battle.stateManager.subMenuPosition + 1 < spells.length) {
                // Move down within current column
                this.battle.stateManager.subMenuPosition++;
                this.battle.audio.play("menu_move");
            } else if (currentPage < totalPages - 1) {
                // At bottom of any column, go to next page
                this.scrollSpells("down");
                // Position at TOP of same column on next page
                const newPageStart = (currentPage + 1) * spellsPerPage;
                this.battle.stateManager.subMenuPosition = Math.min(
                    spells.length - 1,
                    newPageStart + currentColumn * spellsPerColumn
                );
            }
        }

        if (this.input.isKeyJustPressed("Action1")) {
            const selectedSpell = SPELLS[spells[this.battle.stateManager.subMenuPosition]];
            this.battle.handleSpellSelection(selectedSpell);
        }
    }

    navigateSpellList(direction, spells, currentPage, totalPages) {
        const newPos = this.battle.stateManager.subMenuPosition + direction;
        if (newPos >= 0 && newPos < spells.length) {
            this.battle.stateManager.subMenuPosition = newPos;
            // Handle scrolling if needed
            if (newPos >= (currentPage + 1) * this.battle.stateManager.maxVisibleSpells) {
                this.scrollSpells("down");
            } else if (newPos < currentPage * this.battle.stateManager.maxVisibleSpells) {
                this.scrollSpells("up");
            }
            this.battle.audio.play("menu_move");
        }
    }
}