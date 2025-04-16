// game/mode/battle/ui/battleresultsmenu.js
class BattleResultsMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster, battleResults) {
        super(ctx, input, gameMaster);

        this.battleResults = battleResults;
        this.displayPhase = "initial"; // Phases: initial -> items -> gold -> xp -> complete
        this.phaseStartTime = Date.now();
        this.phaseDelay = 500; // Minimum time before allowing advancement

        // Calculate rewards
        this.calculateRewards();

        // Set up the UI panels and elements
        this.setupUI();

        // Animation properties for XP bars
        this.xpAnimProgress = 0;
        this.xpResults = [];
        this.levelUps = [];
    }

    calculateRewards() {
        // Calculate gold rewards (existing code)
        this.goldReward = 0;
        this.battleResults.defeatedEnemies.forEach((enemy) => {
            const level = enemy.level || 1;
            const baseGold = 25 * level;
            const variation = baseGold * 0.2; // 20% variation
            const enemyGold = Math.round(baseGold + (Math.random() * variation * 2 - variation));
            this.goldReward += enemyGold;
        });

        // Determine item rewards (existing code)
        this.itemRewards = [];
        const availableItems = this.battleResults.enemyInventory.getAvailableItems();

        availableItems.forEach(({ id, item, quantity }) => {
            if (Math.random() < 0.1) {
                const rewardQuantity = Math.min(quantity, Math.ceil(Math.random() * 2));
                this.itemRewards.push({
                    id: id,
                    item: item,
                    quantity: rewardQuantity
                });
            }
        });

        // Calculate XP rewards
        this.xpReward = 0;
        this.battleResults.defeatedEnemies.forEach((enemy) => {
            const level = enemy.level || 1;
            const baseXp = 20 * level;
            const variation = baseXp * 0.1; // 10% variation
            const enemyXp = Math.round(baseXp + (Math.random() * variation * 2 - variation));
            this.xpReward += enemyXp;
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
                this.displayPhase = "xp";

                // Prepare XP animation
                this.xpAnimProgress = 0;
                this.xpResults = [];
                this.levelUps = [];

                const allyParty = this.gameMaster.persistentParty;

                if (Array.isArray(allyParty) && allyParty.length > 0) {
                    const xpPerAlly = Math.floor(this.xpReward / allyParty.length);

                    // Apply XP to each ally and track results
                    allyParty.forEach((ally) => {
                        if (!ally.isDead) {
                            const result = ally.gainXp(xpPerAlly);
                            this.xpResults.push({
                                character: ally,
                                xpGained: result.gained,
                                oldXp: result.oldXp,
                                newXp: result.newXp,
                                leveledUp: result.leveledUp
                            });

                            if (result.leveledUp) {
                                this.levelUps.push(ally);
                            }
                        }
                    });
                }
                break;

            case "xp":
                this.displayPhase = "complete";
                break;

            case "complete":
                return "exit"; // Exit the menu
        }

        this.phaseStartTime = Date.now();
    }

    update() {
        super.update();

        // Handle XP animation
        if (this.displayPhase === "xp") {
            this.xpAnimProgress += 0.01;
            if (this.xpAnimProgress > 1) {
                this.xpAnimProgress = 1;
            }
        }

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

            // Apply XP rewards to the party array
            const allyParty = this.gameMaster.persistentParty;

            if (Array.isArray(allyParty) && allyParty.length > 0) {
                const xpPerAlly = Math.floor(this.xpReward / allyParty.length);

                allyParty.forEach((ally) => {
                    if (!ally.isDead) {
                        ally.gainXp(xpPerAlly);
                    }
                });
            }

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
            case "xp":
                this.drawXpPhase();
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

    drawXpPhase() {
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";

        this.ctx.fillText("Experience Gained", 400, 130);

        // Show total XP earned
        this.ctx.font = "20px monospace";
        this.ctx.fillText(`Total: ${this.xpReward} XP`, 400, 160);

        // List each character and their XP gain with progress bars
        const startY = 200;
        const spacing = 60;

        this.xpResults.forEach((result, index) => {
            const char = result.character;
            const y = startY + index * spacing;

            // Draw character name
            this.ctx.textAlign = "left";
            this.ctx.font = "18px monospace";
            this.ctx.fillText(char.name, 100, y);

            // Draw XP gained
            this.ctx.textAlign = "right";
            this.ctx.fillText(`+${result.xpGained} XP`, 700, y);

            // Draw XP bar
            const barWidth = 400;
            const barHeight = 20;
            const barX = 200;
            const barY = y + 10;

            // Background bar
            this.ctx.fillStyle = "#333333";
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            // Calculate XP progress - simple linear calculation from old to new XP
            const previousXpNeeded = char.level === 1 ? 0 : 100 + (char.level - 1) * 50;
            const totalXpNeeded = char.nextLevelXp - previousXpNeeded;

            const previousProgress = Math.min(1, (result.oldXp - previousXpNeeded) / totalXpNeeded);
            let currentProgress = Math.min(1, (result.newXp - previousXpNeeded) / totalXpNeeded);

            if (result.leveledUp) {
                // If leveled up, we want to show the bar filling completely
                currentProgress = 1;
            }

            // Animated progress (from old to new)
            const animatedProgress = previousProgress + (currentProgress - previousProgress) * this.xpAnimProgress;

            // Previously filled XP
            this.ctx.fillStyle = "#4444cc";
            this.ctx.fillRect(barX, barY, barWidth * previousProgress, barHeight);

            // Newly gained XP (animated)
            this.ctx.fillStyle = "#6666ff";
            const newXpWidth = barWidth * (animatedProgress - previousProgress);
            if (newXpWidth > 0) {
                this.ctx.fillRect(barX + barWidth * previousProgress, barY, newXpWidth, barHeight);
            }

            // XP numbers
            this.ctx.textAlign = "center";
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "14px monospace";

            // Only show current progress if no level up occurred
            if (!result.leveledUp) {
                this.ctx.fillText(
                    `${Math.floor(result.oldXp + (result.newXp - result.oldXp) * this.xpAnimProgress)} / ${char.nextLevelXp}`,
                    barX + barWidth / 2,
                    barY + 15
                );
            } else {
                // If leveled up, show different text
                if (this.xpAnimProgress > 0.9) {
                    this.ctx.fillText("LEVEL UP!", barX + barWidth / 2, barY + 15);
                } else {
                    this.ctx.fillText(
                        `${Math.floor(result.oldXp + (result.newXp - result.oldXp) * this.xpAnimProgress)} / ${previousXpNeeded + totalXpNeeded}`,
                        barX + barWidth / 2,
                        barY + 15
                    );
                }
            }

            // Level up indicator
            if (result.leveledUp) {
                const levelUpVisible = this.xpAnimProgress > 0.8;
                if (levelUpVisible) {
                    this.ctx.fillStyle = "#ffcc00";
                    this.ctx.font = "20px monospace";
                    this.ctx.textAlign = "right";
                    this.ctx.fillText(`LVL ${char.level - 1} → ${char.level}`, 700, y + 35);
                }
            }
        });
    }

    drawCompletePhase() {
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";

        this.ctx.fillText("Battle Complete!", 400, 200);
        this.ctx.fillText("Press Continue to return to the world", 400, 250);
    }
}