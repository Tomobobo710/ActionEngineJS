class BattleResultsMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster, battleResults) {
        super(ctx, input, gameMaster);

        this.battleResults = battleResults;
        this.displayPhase = "initial"; // Phases: initial -> items -> gold -> complete
        this.phaseStartTime = Date.now();
        this.phaseDelay = 500; // Minimum time before allowing advancement

        // Calculate rewards
        this.calculateRewards();

        // Set up the UI panels and elements
        this.setupUI();
    }

    calculateRewards() {
        // Calculate gold rewards
        this.goldReward = 0;
        this.battleResults.defeatedEnemies.forEach((enemy) => {
            const level = enemy.level || 1;
            const baseGold = 25 * level;
            const variation = baseGold * 0.2; // 20% variation
            const enemyGold = Math.round(baseGold + (Math.random() * variation * 2 - variation));
            this.goldReward += enemyGold;
        });

        // Determine item rewards (10% chance per item in enemy inventory)
        this.itemRewards = [];
        const availableItems = this.battleResults.enemyInventory.getAvailableItems();

        availableItems.forEach(({ id, item, quantity }) => {
            // For each item type, check if player gets it (10% chance)
            if (Math.random() < 0.1) {
                // Determine how many they get (at least 1, at most the available quantity)
                const rewardQuantity = Math.min(quantity, Math.ceil(Math.random() * 2));
                this.itemRewards.push({
                    id: id,
                    item: item,
                    quantity: rewardQuantity
                });
            }
        });
    }

    setupUI() {
        // Title panel
        this.addElement("main", {
            name: "titlePanel",
            type: "panel",
            x: 40,
            y: 20,
            width: 720,
            height: 60,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });

        // Title text
        this.addElement("main", {
            name: "titleText",
            type: "textLabel",
            x: 400,
            y: 50,
            text: "BATTLE RESULTS",
            font: "32px monospace",
            textAlign: "center",
            textBaseline: "middle",
            focusable: false,
            background: { visible: false }
        });

        // Main content panel
        this.addElement("main", {
            name: "contentPanel",
            type: "panel",
            x: 40,
            y: 100,
            width: 720,
            height: 400,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });

        // Bottom panel for controls
        this.addElement("main", {
            name: "controlPanel",
            type: "panel",
            x: 40,
            y: 520,
            width: 720,
            height: 60,
            focusable: false,
            background: { visible: false },
            panel: { borderWidth: 2, drawBackground: true }
        });

        // Continue button
        this.addElement("main", {
            name: "continueButton",
            type: "textButton",
            x: 300,
            y: 550,
            width: 200,
            height: 40,
            text: "Continue",
            font: "24px monospace",
            textAlign: "center",
            textOffsetX: 100, // Center the text in the button
            button: {
                onClick: () => {
                    // We need to handle the exit case here
                    if (this.displayPhase === "complete") {
                        return "exit"; // This won't work in an onClick handler
                    }
                    this.advancePhase();
                }
            }
        });
    }

    advancePhase() {
        // Only allow advancing if we've passed the phase delay
        if (Date.now() - this.phaseStartTime < this.phaseDelay) {
            return;
        }

        switch (this.displayPhase) {
            case "initial":
                this.displayPhase = "items";
                break;

            case "items":
                // Apply item rewards to player inventory
                this.itemRewards.forEach((reward) => {
                    this.gameMaster.persistentParty.inventory.addItem(reward.id, reward.quantity);
                });
                this.displayPhase = "gold";
                break;

            case "gold":
                // Add gold to player
                this.gameMaster.persistentParty.gold += this.goldReward;
                this.displayPhase = "complete";
                break;

            case "complete":
                return "exit"; // Exit the menu
        }

        this.phaseStartTime = Date.now();
    }

    update() {
        super.update();
        if (this.displayPhase === "complete") {
            return "exit";
        }
        return null;
    }

    handleAction1() {
        const result = this.advancePhase();
        return result; // This will properly return "exit" during the final phase
    }

    handleAction2() {
        // Skip to end and apply all rewards immediately
        if (this.displayPhase !== "complete") {
            // Apply item rewards
            this.itemRewards.forEach((reward) => {
                this.gameMaster.persistentParty.inventory.addItem(reward.id, reward.quantity);
            });

            // Apply gold rewards
            this.gameMaster.persistentParty.gold += this.goldReward;

            return "exit";
        }

        return "exit";
    }

    draw() {
        // Draw base elements (panels, common UI)
        super.draw();

        // Draw phase-specific content
        switch (this.displayPhase) {
            case "initial":
                this.drawInitialPhase();
                break;
            case "items":
                this.drawItemsPhase();
                break;
            case "gold":
                this.drawGoldPhase();
                break;
            case "complete":
                this.drawCompletePhase();
                break;
        }
    }

    drawInitialPhase() {
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";

        // Draw "Victory!" text
        this.ctx.fillText("Victory!", 400, 150);

        // List defeated enemies
        this.ctx.fillText("Enemies Defeated:", 400, 200);

        this.battleResults.defeatedEnemies.forEach((enemy, index) => {
            this.ctx.fillText(enemy.name, 400, 240 + index * 30);
        });
    }

    drawItemsPhase() {
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";

        this.ctx.fillText("Items Obtained", 400, 150);

        if (this.itemRewards.length === 0) {
            this.ctx.fillText("No items dropped", 400, 250);
        } else {
            this.itemRewards.forEach((reward, index) => {
                this.ctx.fillText(
                    `${reward.item.emoji || "📦"} ${reward.item.name} x${reward.quantity}`,
                    400,
                    200 + index * 30
                );
            });
        }
    }

    drawGoldPhase() {
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";

        this.ctx.fillText("Gold Earned", 400, 150);

        // Draw fancy gold amount
        this.ctx.font = "36px monospace";
        this.ctx.fillStyle = "#ffcc00"; // Gold color
        this.ctx.fillText(`${this.goldReward} G`, 400, 250);

        // Draw current gold total
        this.ctx.font = "20px monospace";
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.fillText(`Total: ${this.gameMaster.persistentParty.gold + this.goldReward} G`, 400, 300);
    }

    drawCompletePhase() {
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";

        this.ctx.fillText("Battle Complete!", 400, 200);
        this.ctx.fillText("Press Continue to return to the world", 400, 250);
    }
}