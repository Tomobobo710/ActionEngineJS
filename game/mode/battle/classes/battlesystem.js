// game/mode/battle/classes/battlesystem.jsW
class BattleSystem {
    constructor(party, enemyParty, audio, input, inventory, gameMaster) {
        this.party = party;
        this.enemies = enemyParty.map((data) => new Character(data));
        this.partyInventory = inventory;
        this.enemyInventory = new Inventory();
        this.audio = audio;
        this.input = input;
        this.gameMaster = gameMaster;
        this.battleLog = new BattleLog();

        // Create our state manager and specialized components
        this.stateManager = new BattleStateManager(this);
        this.actionExecutor = new BattleActionExecutor(this);
        this.aiController = new BattleAIController(this);
        this.targetingManager = new BattleTargetingManager(this);

        this.setupInitialPositions();
        this.initializeEnemyInventory();
        this.resultsMenu = null;
        
        // Create the input manager and renderer
        this.inputManager = new BattleInputManager(this, this.input);
        this.renderer = new BattleRenderer(this);
    }

    initializeEnemyInventory() {
        // Random chance to have each item type
        Object.keys(ITEMS).forEach((itemId) => {
            if (Math.random() < 0.3) {
                // 30% chance for each item
                const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 of each
                this.enemyInventory.addItem(itemId, quantity);
            }
        });
    }

    handleInput(input) {
        this.inputManager.handleInput(input);
    }

    // Add methods to handle party management
    addPartyMember(character, slot) {
        if (slot >= 0 && slot < 4) {
            this.party[slot] = character;
            character.pos = {
                x: 600,
                y: 150 + slot * 100
            };
            character.targetPos = { ...character.pos };
        }
    }

    removePartyMember(slot) {
        if (slot >= 0 && slot < 4) {
            this.party[slot] = null;
        }
    }

    handleSpellSelection(selectedSpell) {
        if (this.stateManager.activeChar.mp >= selectedSpell.mpCost) {
            this.stateManager.pendingSpell = selectedSpell;
            this.targetingManager.startTargeting(selectedSpell.targetType);
            this.audio.play("menu_select");
        } else {
            this.showBattleMessage("Not enough MP!");
            this.audio.play("menu_error");
        }
    }

    attemptRun() {
        if (Math.random() < 0.5) {
            this.battleLog.addMessage("Got away safely!", "system");
            this.stateManager.state = "victory";
        } else {
            this.battleLog.addMessage("Couldn't escape!", "system");
            this.showBattleMessage("Couldn't escape!");
        }
    }
    
    setupInitialPositions() {
        this.party.forEach((char, i) => {
            if (!char) return;
            char.pos.x = 600;
            char.pos.y = 150 + i * 100;
            char.targetPos = { ...char.pos };
        });

        this.enemies.forEach((enemy, i) => {
            enemy.pos.x = 200;
            enemy.pos.y = 150 + i * 80;
            enemy.targetPos = { ...enemy.pos };
        });
    }

    update() {
        if (this.stateManager.isPaused) return;

        if (this.stateManager.state === "post_results") {
            this.stateManager.updateTransitions();
            return;
        }

        if (this.stateManager.state === "results") {
            // Update the results menu
            if (this.resultsMenu) {
                const result = this.resultsMenu.update();

                if (result === "exit") {
    console.log("Exit returned from menu..");
    // Clean up
    this.resultsMenu.cleanup();
    this.resultsMenu = null;

    // Instead of going back to victory state, go to a new post_results state
    this.stateManager.state = "post_results";
    this.stateManager.readyForWorldTransition = true;

    // Reset transition progress to ensure animation plays
    this.stateManager.transitionProgress = 0;
    return;
}
            }
            return; // Skip the rest of the update method
        }

        // Handle victory and game over states
        if (this.stateManager.state === "victory" || this.stateManager.state === "gameover") {
            if (!this.stateManager.stateStartTime) {
                this.stateManager.stateStartTime = Date.now();
                // Play the victory sound when entering this state
                if (this.stateManager.state === "victory") {
                    this.audio.play("victory");
                }
            }

            // Stay in this state for 3 seconds before allowing transition
            const stateDuration = 3000; // 3 seconds
            if (Date.now() - this.stateManager.stateStartTime > stateDuration) {
                if (this.stateManager.state === "victory") {
                    // After victory screen, show results
                    this.showResultsScreen();
                } else {
                    // Game over goes straight to world
                    this.stateManager.readyForWorldTransition = true;
                }
            }

            // Only update transition after the delay
            if (this.stateManager.readyForWorldTransition) {
                this.stateManager.updateTransitions();
            }

            return; // Skip the rest of the update method
        }

        // Set showCancelButton based on menu context
        if (this.stateManager.currentMenu === "magic" || 
            this.stateManager.currentMenu === "item" || 
            this.targetingManager.targetingMode) {
            this.stateManager.showCancelButton = true;
        } else {
            this.stateManager.showCancelButton = false;
        }

        // First, handle animations and transitions
        this.actionExecutor.handleAnimations();

        // Apply pending effects if animations are complete
        if (this.actionExecutor.getPendingEffect() && this.stateManager.animations.length === 0) {
            this.actionExecutor.getPendingEffect()();
            this.actionExecutor.clearPendingEffect();
        }

        // Check if any character has ongoing HP/MP animations
        const hasOngoingStatAnimations = [...this.party, ...this.enemies].some((char) => {
            return char && (char.animatingHP || char.animatingMP);
        });

        // Update HP/MP animations for all characters
        [...this.party, ...this.enemies].forEach((char) => {
            if (!char) return; // Skip empty slots

            // Handle HP animation
            if (char.animatingHP) {
                const elapsed = Date.now() - char.hpAnimStartTime;
                const duration = 750;

                if (elapsed >= duration) {
                    // Animation complete, apply the actual change
                    char.hp = char.targetHP;
                    char.animatingHP = false;

                    // Check if character died from this
                    if (char.hp <= 0) {
                        char.isDead = true;
                        // If character died, immediately reset ATB and remove from ready order
                        char.isReady = false;
                        char.atbCurrent = 0;
                        this.stateManager.readyOrder = this.stateManager.readyOrder.filter(c => c !== char);
                        
                        // If the active character died, clear it
                        if (this.stateManager.activeChar === char) {
                            this.stateManager.activeChar = null;
                            this.stateManager.currentMenu = "main";
                            // End targeting if active character died
                            if (this.targetingManager.targetingMode) {
                                this.targetingManager.endTargeting();
                            }
                        }
                        
                        // Remove any queued actions for this character
                        this.stateManager.actionQueue = this.stateManager.actionQueue.filter(action => action.character !== char);
                        
                        this.battleLog.addMessage(`${char.name} was defeated!`, "system");
                    }
                } else {
                    // Animation in progress
                    const progress = elapsed / duration;
                    char.hpAnimProgress = this.easeOutCubic(progress); // Smoother animation
                }
            }

            // Handle MP animation
            if (char.animatingMP) {
                const elapsed = Date.now() - char.mpAnimStartTime;
                const duration = 750;

                if (elapsed >= duration) {
                    // Animation complete, apply the actual change
                    char.mp = char.targetMP;
                    char.animatingMP = false;
                } else {
                    // Animation in progress
                    const progress = elapsed / duration;
                    char.mpAnimProgress = this.easeOutCubic(progress); // Smoother animation
                }
            }
        });

        this.stateManager.updateTransitions();

        // Check victory/defeat conditions
        if (this.stateManager.checkBattleEnd(this.party, this.enemies)) return;

        // Update ATB gauges and track who becomes ready
        this.updateATBGauges();

        // Only process actions if we're not already processing one
        // and there are no active animations AND no ongoing stat animations
        if (!this.stateManager.isProcessingAction && 
            this.stateManager.animations.length === 0 && 
            !hasOngoingStatAnimations) {
            
            // If we have queued actions, process the next one
            if (this.stateManager.actionQueue.length > 0) {
                this.actionExecutor.processNextAction();
            }
            // Otherwise, if we have ready characters and no active character
            else if (!this.stateManager.activeChar && this.stateManager.readyOrder.length > 0) {
                const nextCharacter = this.stateManager.readyOrder[0];

                // Double check that the character is still alive before processing
                if (nextCharacter.isDead) {
                    // Remove dead character from ready order
                    this.stateManager.readyOrder.shift();
                    return;
                }

                if (nextCharacter.isEnemy) {
                    // Only handle enemy input if no actions are queued at all
                    if (this.stateManager.actionQueue.length === 0) {
                        this.aiController.handleEnemyInput(nextCharacter);
                        this.stateManager.readyOrder.shift();
                    }
                } else {
                    // Reset pagination whenever a new character becomes active
                    this.stateManager.spellScrollOffset = 0;
                    this.stateManager.itemScrollOffset = 0;
                    this.stateManager.subMenuPosition = 0;

                    this.stateManager.activeChar = nextCharacter;
                }
            }
        }
    }

    easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    }

    updateATBGauges() {
        [...this.party, ...this.enemies].forEach((char) => {
            // Skip dead characters completely
            if (!char || char.isDead) return;
            
            const wasReady = char.isReady;
            char.updateATB();
            char.updateStatus();

            if (!wasReady && char.isReady) {
                const hasQueuedAction = this.stateManager.actionQueue.some((action) => action.character === char);
                const alreadyInReadyOrder = this.stateManager.readyOrder.includes(char);

                if (!hasQueuedAction && !alreadyInReadyOrder) {
                    char.isEnemy = this.enemies.includes(char);
                    this.stateManager.readyOrder.push(char);
                }
            }
        });
    }

    showBattleMessage(message) {
        this.stateManager.currentMessage = {
            text: message,
            alpha: 1.0,
            startTime: Date.now()
        };
    }

    showResultsScreen() {
        // Create battle results data
        const battleResults = {
            defeatedEnemies: this.enemies.filter((enemy) => enemy.isDead),
            enemyInventory: this.enemyInventory
        };

        // Create the results menu
        this.resultsMenu = new BattleResultsMenu(this.ctx, this.input, this.gameMaster, battleResults);

        // Change state
        this.stateManager.state = "results";
        this.stateManager.stateStartTime = null;
    }

    render(ctx) {
        // If showing results menu, only render that
        if (this.stateManager.state === "results" && this.resultsMenu) {
            this.resultsMenu.draw();
            return;
        }

        // Otherwise use the renderer for normal battle rendering
        this.renderer.render(ctx);
    }
}